import { getPool, hasDatabase } from "@/lib/db";
import { dnOrigin } from "@/lib/appEnv";
import { normalizeHost } from "@/lib/embedConfig";
import { formatCustomerNumber } from "@/lib/customerNumber";
import { ensureAuthTables } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Push School Explorer usage and upgrade requests to Dream Neighborhood.
//
//   POST <dnOrigin>/explorer/ingest/usage/            Authorization: Api-Key <key>
//   POST <dnOrigin>/explorer/ingest/upgrade-requests/ Authorization: Api-Key <key>
//
// We push; DN never pulls. A cross-application call in the render path of DN's
// most-visited page would mean a DNS outage blanks the numbers rather than
// merely stops updating them — and the same reasoning applies in reverse, so
// nothing here is ever called from a request that renders anything.
//
// Both endpoints are idempotent, which is what makes retrying safe: `views` is
// a running total DN sets rather than adds, and an upgrade request is
// recognised by its `external_id`. See docs/DN_INTEGRATION.md.
//
// Disabled until DN_INGEST_API_KEY is set, per environment. A staging key does
// not work against DN production.
// ---------------------------------------------------------------------------

const USAGE_PATH = "/explorer/ingest/usage/";
const UPGRADE_PATH = "/explorer/ingest/upgrade-requests/";

/** DN refuses a request whole if it exceeds this. */
const MAX_ROWS_PER_REQUEST = 500;

/**
 * On the very first run we start near the newest request rather than from the
 * beginning: DN backfills history itself, reading our database directly. The
 * small overlap covers requests created between DN's backfill and our first
 * push — `external_id` makes re-sending them harmless.
 */
const INITIAL_OVERLAP = Math.max(0, Number(process.env.DN_INGEST_INITIAL_OVERLAP) || 200);

/** Repeat callers must not hammer DN; a dedicated cron run can force. */
const MIN_INTERVAL_MS = Math.max(0, Number(process.env.DN_INGEST_MIN_INTERVAL_HOURS ?? 6)) * 3600_000;

/**
 * How often the in-process timer wakes to ask the database whether a push is
 * due. The database lease decides whether anything is actually sent, so this
 * only sets how promptly `DN_INGEST_MIN_INTERVAL_HOURS` is noticed.
 */
const TIMER_TICK_MS = Math.max(5_000, Number(process.env.DN_INGEST_TICK_MS) || 3600_000);

const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.DN_INGEST_TIMEOUT_MS) || 20_000);

// Traffic from our own properties, which DN excludes from every customer-facing
// figure. `source` carries this for upgrade requests; the usage payload has no
// equivalent field, so those rows are left out of the usage push entirely.
const OWN_DEMO_HOST_RE = /(^|\.)dreamneighborhoodschools\.com$/i;
// Our smoke sites, plus the reserved names RFC 2606 and RFC 6761 set aside for
// testing. A domain under one of these can never be a real customer site, so a
// row under it is ours — the end-to-end suite creates usage under
// `e2e-realtor.test` on every run. Sending those would put fictional prospects
// in front of whoever reads DN's unmatched-domain list.
const OWN_TEST_HOST_RE =
  /(^|\.)herokuapp\.com$|\.(test|local|localhost|invalid|example)$|(^|\.)example\.(com|net|org)$/i;

export interface DnIngestSummary {
  ran: boolean;
  skippedReason?: string;
  usage: { rows: number; sent: number; batches: number };
  upgradeRequests: { rows: number; sent: number; batches: number; skippedNoDomain: number; fromId: number; toId: number };
  /** How many rows DN could not attach to an account. Stored anyway on its side. */
  unmatchedDomains: number;
  /** How many rows DN refused outright — a row we sent that it could not use. */
  skippedByDn: number;
  /**
   * Customers with more than one authorized domain. Their whole view count goes
   * to one of those domains, because our counters are keyed by customer and
   * there is nothing to split. Zero today, which is why we report activity by
   * domain at all — so this must not become non-zero quietly.
   */
  multiDomainCustomers: string[];
  alreadyHad: number;
  errors: string[];
}

function emptySummary(): DnIngestSummary {
  return {
    ran: false,
    usage: { rows: 0, sent: 0, batches: 0 },
    upgradeRequests: { rows: 0, sent: 0, batches: 0, skippedNoDomain: 0, fromId: 0, toId: 0 },
    unmatchedDomains: 0,
    skippedByDn: 0,
    multiDomainCustomers: [],
    alreadyHad: 0,
    errors: [],
  };
}

/**
 * DN's document describes `unmatched_domains` as the domains it did not
 * recognise; `apps/explorer_popup/ingest.py` returns how many there were.
 * Accept either shape rather than depending on which one is deployed — the
 * count is all we do anything with.
 */
function countUnmatched(res: Record<string, unknown>): number {
  const v = res.unmatched_domains;
  if (typeof v === "number") return v;
  if (Array.isArray(v)) return v.length;
  return 0;
}

export function dnIngestConfigured(): boolean {
  return Boolean((process.env.DN_INGEST_API_KEY || "").trim());
}

/**
 * DN mints keys with `python manage.py create_ingest_key` and prints them as
 * `<prefix>.<secret>`; the dashboard and later log lines show a masked
 * `<prefix>.<first few>...` instead. Copying the masked form into the config
 * var gets a `401` that reads exactly like a rotated or wrong-environment key,
 * which is a slow thing to work out. Name it instead.
 */
function maskedKeyProblem(): string | null {
  const key = (process.env.DN_INGEST_API_KEY || "").trim();
  if (key.endsWith("...")) {
    return "DN_INGEST_API_KEY holds the masked form DN prints after minting (ends in '...'), not the key itself";
  }
  return null;
}

// ---------------------------------------------------------------------------
// State: how far through app_upgrade_requests we have pushed.
// ---------------------------------------------------------------------------

let stateReady: Promise<void> | null = null;

async function ensureState(): Promise<void> {
  if (!stateReady) {
    stateReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS dn_ingest_state (
           key             TEXT PRIMARY KEY,
           last_request_id BIGINT NOT NULL DEFAULT 0,
           last_run_at     TIMESTAMPTZ,
           last_ok_at      TIMESTAMPTZ,
           last_error      TEXT
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        stateReady = null;
        throw err;
      });
  }
  return stateReady;
}

interface IngestState {
  lastRequestId: number;
  lastRunAt: Date | null;
  lastOkAt: Date | null;
}

/**
 * Claim this run by stamping `last_run_at`, but only if nobody else has within
 * `minIntervalMs`. One conditional UPDATE rather than a read-then-write, so two
 * web dynos waking at the same moment cannot both push. Both DN endpoints are
 * idempotent, so this is about not making pointless calls and about keeping the
 * "last run" timestamp honest, rather than about correctness.
 */
async function claimRun(minIntervalMs: number): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE dn_ingest_state
        SET last_run_at = NOW()
      WHERE key = 'global'
        AND (last_run_at IS NULL OR last_run_at < NOW() - ($1::bigint * INTERVAL '1 millisecond'))
      RETURNING 1`,
    [Math.max(0, Math.floor(minIntervalMs))]
  );
  return (rowCount ?? 0) > 0;
}

async function readState(): Promise<IngestState> {
  await ensureState();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT last_request_id, last_run_at, last_ok_at FROM dn_ingest_state WHERE key = 'global'`
  );
  if (rows[0]) {
    return {
      lastRequestId: Number(rows[0].last_request_id) || 0,
      lastRunAt: rows[0].last_run_at ?? null,
      lastOkAt: rows[0].last_ok_at ?? null,
    };
  }
  // First run: start just behind the newest request instead of at zero.
  const { rows: maxRows } = await pool.query(`SELECT COALESCE(MAX(id), 0)::bigint AS n FROM app_upgrade_requests`);
  const start = Math.max(0, (Number(maxRows[0].n) || 0) - INITIAL_OVERLAP);
  await pool.query(
    `INSERT INTO dn_ingest_state (key, last_request_id) VALUES ('global', $1) ON CONFLICT (key) DO NOTHING`,
    [start]
  );
  console.info(`[dn-ingest] first run: starting at request id ${start} (DN backfills everything before it)`);
  return { lastRequestId: start, lastRunAt: null, lastOkAt: null };
}

// ---------------------------------------------------------------------------
// The domain is the only identifier the two systems share.
// ---------------------------------------------------------------------------

/**
 * partner/customer id → the domain we report their activity under.
 *
 * A legacy `host:<domain>` partner carries its domain in the id. A real account
 * is keyed by UUID, so the domain comes from `embed_partners.allowed_hosts`.
 *
 * When an account has authorized several domains we pick one deterministically
 * — shortest (most general) first, then alphabetical. Our counters are keyed by
 * customer rather than by domain, so there is no per-domain split to send; a
 * stable choice at least means DN is not left with a stale row on the other
 * domain, since DN sets `views` rather than adding to it.
 */
async function domainByPartnerId(): Promise<Map<string, string>> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT partner_id, array_agg(DISTINCT h) AS hosts
       FROM embed_partners, UNNEST(allowed_hosts) AS h
      WHERE h <> ''
      GROUP BY partner_id`
  );
  const out = new Map<string, string>();
  for (const r of rows) {
    const hosts = Array.from(new Set((r.hosts as string[]).map(normalizeHost).filter(Boolean)));
    hosts.sort((a, b) => a.length - b.length || a.localeCompare(b));
    if (hosts[0]) out.set(r.partner_id, hosts[0]);
  }
  return out;
}

/** Customers whose activity cannot be attributed to a single domain. */
async function multiDomainCustomers(): Promise<string[]> {
  const { rows } = await getPool().query(
    `SELECT partner_id, array_agg(DISTINCT h) AS hosts
       FROM embed_partners, UNNEST(allowed_hosts) AS h
      WHERE h <> '' AND partner_id NOT LIKE 'host:%'
      GROUP BY partner_id`
  );
  return rows
    .filter((r: { hosts: string[] }) => new Set(r.hosts.map(normalizeHost).filter(Boolean)).size > 1)
    .map((r: { partner_id: string }) => r.partner_id);
}

/**
 * customer id → the number DN minted for them. Absent for a legacy `host:`
 * partner, which has no account here at all, and for any customer who has no DN
 * account yet — two thirds of ours are School-Explorer-only. Those rows still
 * go, matched on domain, which is what the fallback is for.
 */
async function customerNumberByPartnerId(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    // `customer_number` is added by the auth migrations, and this job runs
    // without touching an auth path — on staging it never could, because the
    // dashboard is retired and /api/auth/* answers 410.
    await ensureAuthTables();
    const { rows } = await getPool().query(
      `SELECT id, customer_number FROM app_users WHERE customer_number IS NOT NULL`
    );
    for (const r of rows) {
      const formatted = formatCustomerNumber(r.customer_number);
      if (formatted) out.set(r.id, formatted);
    }
  } catch (err) {
    // Numbers are an improvement on the domain match, not a precondition for
    // it. Losing them costs precision; letting this throw would stop the push
    // altogether and DN's figures would quietly stop moving.
    console.error("[dn-ingest] customer numbers unavailable, falling back to domain:", err);
  }
  return out;
}

function resolveDomain(partnerId: string, map: Map<string, string>): string {
  if (!partnerId) return "";
  if (partnerId.startsWith("host:")) return normalizeHost(partnerId.slice(5));
  return map.get(partnerId) || "";
}

function isOwnDemoDomain(domain: string): boolean {
  return OWN_DEMO_HOST_RE.test(domain);
}

function isOwnTestDomain(domain: string): boolean {
  return OWN_TEST_HOST_RE.test(domain);
}

/**
 * `demo` and `smoke-e2e` must go over verbatim so DN can exclude our own
 * traffic. Anything DN does not recognise is stored as `other` and counted as
 * real, so we only rewrite what we are sure about: our demo site, our smoke
 * sites, and rows already tagged by the end-to-end suite. Real visitor traffic
 * on a customer domain passes through untouched.
 */
function ingestSource(storedSource: string, domain: string): string {
  const s = (storedSource || "").trim().toLowerCase();
  if (s === "smoke-e2e" || isOwnTestDomain(domain)) return "smoke-e2e";
  if (isOwnDemoDomain(domain)) return "demo";
  return s || "popup";
}

// ---------------------------------------------------------------------------
// Payload builders (exported so they can be inspected without pushing).
// ---------------------------------------------------------------------------

export interface UsageRow {
  domain: string;
  /** DN prefers this over the domain when it is present. */
  customer_number?: string;
  views: number;
  first_seen: string | null;
  last_seen: string | null;
  popup_last_seen: string | null;
  inline_last_seen: string | null;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function earlierOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export async function buildUsageRows(): Promise<UsageRow[]> {
  const pool = getPool();
  const map = await domainByPartnerId();
  const numbers = await customerNumberByPartnerId();
  // A DN account has one Explorer, so collapse our per-widget rows first.
  const { rows } = await pool.query(
    `SELECT partner_id,
            SUM(views)::bigint       AS views,
            MIN(first_seen)          AS first_seen,
            MAX(last_seen)           AS last_seen,
            MAX(popup_last_seen)     AS popup_last_seen,
            MAX(embed_last_seen)     AS inline_last_seen
       FROM embed_usage
      GROUP BY partner_id`
  );
  // Then by domain: a legacy `host:` partner and the account that later claimed
  // the same domain both report under it.
  const byDomain = new Map<string, UsageRow>();
  for (const r of rows) {
    const domain = resolveDomain(r.partner_id, map);
    if (!domain) continue;
    // The usage payload has no `source`, so our own traffic cannot be marked
    // for DN to exclude. Leaving it out is the only way to keep DN's
    // customer-facing figures honest. See the note in docs/DN_INTEGRATION.md.
    if (isOwnDemoDomain(domain) || isOwnTestDomain(domain)) continue;
    const existing = byDomain.get(domain);
    const customerNumber = numbers.get(r.partner_id);
    const next: UsageRow = {
      domain,
      ...(customerNumber ? { customer_number: customerNumber } : {}),
      views: Number(r.views) || 0,
      first_seen: iso(r.first_seen),
      last_seen: iso(r.last_seen),
      popup_last_seen: iso(r.popup_last_seen),
      inline_last_seen: iso(r.inline_last_seen),
    };
    if (!existing) {
      byDomain.set(domain, next);
    } else {
      // A legacy `host:` partner and the account that later claimed the same
      // domain both report under it; only the account carries a number.
      if (!existing.customer_number && next.customer_number) {
        existing.customer_number = next.customer_number;
      }
      existing.views += next.views;
      existing.first_seen = earlierOf(existing.first_seen, next.first_seen);
      existing.last_seen = laterOf(existing.last_seen, next.last_seen);
      existing.popup_last_seen = laterOf(existing.popup_last_seen, next.popup_last_seen);
      existing.inline_last_seen = laterOf(existing.inline_last_seen, next.inline_last_seen);
    }
  }
  return Array.from(byDomain.values());
}

export interface UpgradeRequestRow {
  external_id: string;
  domain: string;
  /** DN prefers this over the domain when it is present. */
  customer_number?: string;
  requester_key: string;
  address: string;
  source: string;
  requested_at: string;
}

export async function buildUpgradeRequestRows(
  afterId: number,
  limit: number
): Promise<{ rows: UpgradeRequestRow[]; maxId: number; skippedNoDomain: number }> {
  const pool = getPool();
  const map = await domainByPartnerId();
  const numbers = await customerNumberByPartnerId();
  const { rows } = await pool.query(
    `SELECT id, customer_id, requester_key, address, source, requested_at
       FROM app_upgrade_requests
      WHERE id > $1
      ORDER BY id ASC
      LIMIT $2`,
    [afterId, limit]
  );
  const out: UpgradeRequestRow[] = [];
  let maxId = afterId;
  let skippedNoDomain = 0;
  for (const r of rows) {
    maxId = Math.max(maxId, Number(r.id));
    const domain = resolveDomain(r.customer_id, map);
    const customerNumber = numbers.get(r.customer_id);
    // With neither a number nor a domain DN has nothing to join on. Skipping
    // beats guessing: a wrong match attributes one realtor's homebuyers to
    // another, and nothing downstream would flag it.
    if (!domain && !customerNumber) {
      skippedNoDomain += 1;
      continue;
    }
    out.push({
      external_id: String(r.id),
      domain,
      ...(customerNumber ? { customer_number: customerNumber } : {}),
      requester_key: r.requester_key || "",
      address: r.address || "",
      source: ingestSource(r.source, domain),
      requested_at: iso(r.requested_at) || new Date().toISOString(),
    });
  }
  return { rows: out, maxId, skippedNoDomain };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const key = (process.env.DN_INGEST_API_KEY || "").trim();
  const res = await fetch(`${dnOrigin()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Api-Key ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    /* a non-JSON body is only useful for the error message below */
  }
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return parsed;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

export async function runDnIngest(
  opts: { force?: boolean; dryRun?: boolean } = {}
): Promise<DnIngestSummary> {
  const summary = emptySummary();
  if (!hasDatabase()) {
    summary.skippedReason = "no database";
    return summary;
  }
  if (!opts.dryRun && !dnIngestConfigured()) {
    summary.skippedReason = "DN_INGEST_API_KEY is not set";
    return summary;
  }
  if (!opts.dryRun) {
    const masked = maskedKeyProblem();
    if (masked) {
      summary.skippedReason = masked;
      return summary;
    }
  }

  await ensureState();
  const pool = getPool();
  const state = await readState();

  if (!opts.dryRun && !(await claimRun(opts.force ? 0 : MIN_INTERVAL_MS))) {
    const since = state.lastRunAt ? Date.now() - new Date(state.lastRunAt).getTime() : 0;
    summary.skippedReason = `last run ${Math.round(since / 60000)}m ago`;
    return summary;
  }

  summary.ran = true;

  // --- usage ---------------------------------------------------------------
  try {
    summary.multiDomainCustomers = await multiDomainCustomers();
    if (summary.multiDomainCustomers.length) {
      // Reporting activity by domain is only sound while this stays empty.
      console.warn(
        "[dn-ingest] customers with more than one authorized domain — their views are " +
          `all attributed to one of them: ${summary.multiDomainCustomers.join(", ")}`
      );
    }
    const usage = await buildUsageRows();
    summary.usage.rows = usage.length;
    for (const batch of chunk(usage, MAX_ROWS_PER_REQUEST)) {
      summary.usage.batches += 1;
      if (opts.dryRun) {
        summary.usage.sent += batch.length;
        continue;
      }
      const res = await post(USAGE_PATH, { usage: batch });
      summary.usage.sent += batch.length;
      summary.unmatchedDomains += countUnmatched(res);
      summary.skippedByDn += Number(res.skipped) || 0;
    }
  } catch (err) {
    summary.errors.push(`usage: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- upgrade requests ----------------------------------------------------
  // Walk forward in batches, advancing the watermark only after each batch is
  // accepted, so a failure mid-run resumes rather than restarts.
  summary.upgradeRequests.fromId = state.lastRequestId;
  let cursor = state.lastRequestId;
  try {
    for (;;) {
      const { rows, maxId, skippedNoDomain } = await buildUpgradeRequestRows(cursor, MAX_ROWS_PER_REQUEST);
      if (maxId === cursor) break;
      summary.upgradeRequests.rows += rows.length;
      summary.upgradeRequests.skippedNoDomain += skippedNoDomain;
      if (rows.length) {
        summary.upgradeRequests.batches += 1;
        if (!opts.dryRun) {
          const res = await post(UPGRADE_PATH, { requests: rows });
          summary.alreadyHad += Number(res.already_had) || 0;
          summary.unmatchedDomains += countUnmatched(res);
          summary.skippedByDn += Number(res.skipped) || 0;
        }
        summary.upgradeRequests.sent += rows.length;
      }
      cursor = maxId;
      if (!opts.dryRun) {
        await pool.query(
          `INSERT INTO dn_ingest_state (key, last_request_id) VALUES ('global', $1)
           ON CONFLICT (key) DO UPDATE SET last_request_id = GREATEST(dn_ingest_state.last_request_id, EXCLUDED.last_request_id)`,
          [cursor]
        );
      }
    }
  } catch (err) {
    summary.errors.push(`upgrade-requests: ${err instanceof Error ? err.message : String(err)}`);
  }
  summary.upgradeRequests.toId = cursor;

  if (!opts.dryRun) {
    await pool.query(
      `UPDATE dn_ingest_state
          SET last_ok_at = CASE WHEN $1::text IS NULL THEN NOW() ELSE last_ok_at END,
              last_error = $1
        WHERE key = 'global'`,
      [summary.errors.length ? summary.errors.join(" | ").slice(0, 1000) : null]
    );
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Trigger
//
// There is no Heroku Scheduler add-on on either app and no clock dyno — only
// `web` — so an endpoint alone would never be called and "at least daily" would
// not hold. The web process therefore wakes on a timer and asks the database
// whether a push is due; `claimRun` is what makes that safe across dynos.
//
// This does nothing at all until DN_INGEST_API_KEY is set, so production is
// unaffected until somebody deliberately turns it on. Set DN_INGEST_TIMER=0 to
// drive /api/cron/dn-ingest from Heroku Scheduler instead, which is the more
// conventional arrangement if you would rather see the runs in one place.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __dnIngestTimer: ReturnType<typeof setInterval> | undefined;
}

function unref(timer: { unref?: () => void }): void {
  if (typeof timer?.unref === "function") timer.unref();
}

export function startDnIngestTimer(): void {
  if (process.env.DN_INGEST_TIMER === "0") return;
  if (!hasDatabase() || !dnIngestConfigured()) return;
  if (globalThis.__dnIngestTimer) return;

  const tick = () => {
    void runDnIngest().then(
      (s) => {
        if (s.ran) console.info("[dn-ingest]", JSON.stringify(s));
      },
      (err) => console.error("[dn-ingest] run failed:", err)
    );
  };
  // Not immediately on boot: a deploy restarts every dyno at once, and there is
  // nothing to report in the first minute that cannot wait.
  unref(setTimeout(tick, Math.min(60_000, TIMER_TICK_MS)));
  const timer = setInterval(tick, TIMER_TICK_MS);
  unref(timer);
  globalThis.__dnIngestTimer = timer;
  console.info(
    `[dn-ingest] enabled: waking every ${Math.round(TIMER_TICK_MS / 1000)}s, pushing at most every ` +
      `${Math.round(MIN_INTERVAL_MS / 3600_000)}h to ${dnOrigin()}`
  );
}
