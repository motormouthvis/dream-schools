import { getPool, hasDatabase } from "@/lib/db";
import { dnOrigin } from "@/lib/appEnv";

// ---------------------------------------------------------------------------
// The customer, read from Dream Neighborhood.
//
// DN holds customers; we hold school data. This module is the only place that
// asks who a customer is, and it never decides — it relays DN's answer and
// remembers the last one in case DN cannot answer next time.
//
// `dn_config_cache` is a cache, not a copy: keyed on hostname, storing DN's
// verbatim response, never edited here, with no columns of our own beside it.
// Nothing reads it as a source of truth, and a stale entry can only ever keep a
// customer running who was working a moment ago.
//
// Three answers, three meanings, and conflating any two of them breaks
// something real:
//
//   200  a customer, and this is their configuration       → render
//   404  not a customer, switched off, or offboarded       → render nothing
//   dead DN gave no answer at all                          → last known good
//
// A 404 is a decision and is honoured within the minute, so offboarding takes
// effect while DN is healthy. An outage is the absence of a decision, so it
// falls back rather than tearing down every customer's site with DN's.
// ---------------------------------------------------------------------------

const RESOLVE_PATH = "/explorer/resolve/";

/** Matches DN's own `Cache-Control: max-age=60`. */
const FRESH_MS = 60_000;

/**
 * How long a good answer stays usable once DN stops answering. A day is long
 * enough to cover any outage anyone would call an outage, and short enough that
 * a customer removed during one does not run indefinitely afterwards.
 */
const STALE_MS = Math.max(FRESH_MS, Number(process.env.DN_CONFIG_STALE_MS) || 24 * 3600_000);

/** DN's own SDK gives up after three seconds; a hanging DN must not hang a page. */
const TIMEOUT_MS = Math.max(1_000, Number(process.env.DN_CONFIG_TIMEOUT_MS) || 3_000);

export type DnConfigOutcome = "live" | "unknown" | "stale" | "unavailable";

export interface DnConfigResult {
  /** `live` and `stale` carry a body; `unknown` and `unavailable` render nothing. */
  outcome: DnConfigOutcome;
  body: Record<string, unknown> | null;
  /** How old the answer is, in seconds. Zero when it came straight from DN. */
  ageSeconds: number;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS dn_config_cache (
           host       TEXT PRIMARY KEY,
           status     INTEGER NOT NULL,
           body       TEXT,
           fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/** Lowercased, port stripped. DN normalises its side; this matches it. */
export function normalizeDnHost(raw: string): string {
  return String(raw || "").trim().toLowerCase().split("/")[0].split(":")[0];
}

interface CacheRow {
  status: number;
  body: Record<string, unknown> | null;
  ageMs: number;
}

async function readCache(host: string): Promise<CacheRow | null> {
  const { rows } = await getPool().query(
    `SELECT status, body, EXTRACT(EPOCH FROM (NOW() - fetched_at)) * 1000 AS age_ms
       FROM dn_config_cache WHERE host = $1`,
    [host]
  );
  if (!rows[0]) return null;
  let body: Record<string, unknown> | null = null;
  try {
    body = rows[0].body ? JSON.parse(rows[0].body) : null;
  } catch {
    body = null;
  }
  return { status: Number(rows[0].status), body, ageMs: Number(rows[0].age_ms) || 0 };
}

async function writeCache(host: string, status: number, body: unknown): Promise<void> {
  await getPool().query(
    `INSERT INTO dn_config_cache (host, status, body, fetched_at)
       VALUES ($1, $2, $3, NOW())
     ON CONFLICT (host) DO UPDATE SET status = EXCLUDED.status, body = EXCLUDED.body, fetched_at = NOW()`,
    [host, status, body == null ? null : JSON.stringify(body)]
  );
}

/**
 * Ask DN. Returns null only when DN gave no answer at all — a non-answer is
 * different from a negative answer and the caller must be able to tell.
 */
async function askDn(host: string): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  const url = `${dnOrigin()}${RESOLVE_PATH}?host=${encodeURIComponent(host)}&widget_number=1`;
  try {
    const res = await fetch(url, {
      method: "GET",
      // DN counts a view per resolve and checks the origin, so tell it which
      // customer's site this page load happened on.
      headers: { Origin: `https://${host}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // 5xx is DN having a bad day, not an answer about this customer.
    if (res.status >= 500) return null;
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // An unparseable body is not an answer either.
      return null;
    }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

export async function getDnConfig(hostRaw: string): Promise<DnConfigResult> {
  const host = normalizeDnHost(hostRaw);
  const miss: DnConfigResult = { outcome: "unavailable", body: null, ageSeconds: 0 };
  if (!host) return { ...miss, outcome: "unknown" };
  if (!hasDatabase()) {
    // No cache to fall back on; relay DN directly and fail closed.
    const direct = await askDn(host);
    if (!direct) return miss;
    return direct.status === 200
      ? { outcome: "live", body: direct.body, ageSeconds: 0 }
      : { outcome: "unknown", body: null, ageSeconds: 0 };
  }

  await ensureTable();
  const cached = await readCache(host).catch(() => null);

  // Fresh enough to answer without troubling DN. Applies to a 404 too: an
  // offboarded customer stays offboarded for the minute, and a live one is not
  // re-fetched on every page load of a busy site.
  if (cached && cached.ageMs < FRESH_MS) {
    return cached.status === 200
      ? { outcome: "live", body: cached.body, ageSeconds: Math.round(cached.ageMs / 1000) }
      : { outcome: "unknown", body: null, ageSeconds: Math.round(cached.ageMs / 1000) };
  }

  const fresh = await askDn(host);
  if (fresh) {
    await writeCache(host, fresh.status, fresh.body).catch(() => {});
    return fresh.status === 200
      ? { outcome: "live", body: fresh.body, ageSeconds: 0 }
      : { outcome: "unknown", body: null, ageSeconds: 0 };
  }

  // DN gave no answer. A previously good one keeps the site running; a previous
  // 404 is never served stale, because "not a customer" must not outlive our
  // ability to check it. Either way we never invent an answer of our own.
  if (cached && cached.status === 200 && cached.ageMs < STALE_MS) {
    return { outcome: "stale", body: cached.body, ageSeconds: Math.round(cached.ageMs / 1000) };
  }
  return miss;
}

/** Force an offboarding through immediately, or clear everything. */
export async function flushDnConfigCache(host?: string): Promise<number> {
  if (!hasDatabase()) return 0;
  await ensureTable();
  const res = host
    ? await getPool().query(`DELETE FROM dn_config_cache WHERE host = $1`, [normalizeDnHost(host)])
    : await getPool().query(`DELETE FROM dn_config_cache`);
  return res.rowCount ?? 0;
}
