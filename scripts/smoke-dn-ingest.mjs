#!/usr/bin/env node
/**
 * Dream Neighborhood ingest smoke test.
 *
 * Seeds a throwaway Postgres database with embed_partners / embed_usage /
 * app_upgrade_requests, stands up a stub of DN's two ingest endpoints, and
 * drives the real /api/cron/dn-ingest route against both. Verifies the four
 * things that decide whether DN's numbers can be trusted:
 *
 *   - `views` is a running total, so re-running sends the same number rather
 *     than a delta;
 *   - every request carries `external_id` = app_upgrade_requests.id, so a
 *     replay is recognisable;
 *   - the domain is resolved for both legacy `host:` partners and real
 *     accounts, and is normalised the way DN normalises it;
 *   - `source` sends `demo` / `smoke-e2e` verbatim for our own traffic.
 *
 * Requires a Postgres to point at, and a built app (`npm run build`):
 *
 *   DATABASE_URL=postgresql://dream:dream@localhost:5432/dnstest \
 *     node scripts/smoke-dn-ingest.mjs
 */
import { createServer } from "http";
import { spawn } from "child_process";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

const CRON_SECRET = "smoke-cron-secret";
const API_KEY = "smoke-ingest-key";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// ---------------------------------------------------------------------------
// Stub of DN's ingest endpoints.
// ---------------------------------------------------------------------------

const received = { usage: [], requests: [], auth: [], rejected: [] };
const seenExternalIds = new Set();

function startDnStub() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const auth = req.headers.authorization || "";
      received.auth.push(auth);
      if (auth !== `Api-Key ${API_KEY}`) {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "bad key" }));
      }
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "malformed" }));
      }
      if (req.url.startsWith("/explorer/ingest/usage/")) {
        const rows = parsed.usage || [];
        if (rows.length > 500) {
          received.rejected.push("usage batch > 500");
          res.writeHead(400, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "too many rows" }));
        }
        received.usage.push(...rows);
        res.writeHead(200, { "content-type": "application/json" });
        // The shape DN's apps/explorer_popup/ingest.py actually returns:
        // unmatched_domains is a COUNT, not the list its document implies.
        return res.end(JSON.stringify({ written: rows.length, unmatched_domains: 1, skipped: 0 }));
      }
      if (req.url.startsWith("/explorer/ingest/upgrade-requests/")) {
        const rows = parsed.requests || [];
        if (rows.length > 500) {
          received.rejected.push("requests batch > 500");
          res.writeHead(400, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "too many rows" }));
        }
        let alreadyHad = 0;
        for (const r of rows) {
          if (!r.external_id) {
            received.rejected.push("request without external_id");
            continue;
          }
          if (seenExternalIds.has(r.external_id)) alreadyHad += 1;
          else seenExternalIds.add(r.external_id);
        }
        received.requests.push(...rows);
        res.writeHead(200, { "content-type": "application/json" });
        // The document describes unmatched_domains as a list, the code returns a
        // count. Answer with the list here so both shapes are exercised.
        return res.end(
          JSON.stringify({
            created: rows.length - alreadyHad,
            already_had: alreadyHad,
            unmatched_domains: ["never-heard-of-it.test"],
            skipped: 0,
          })
        );
      }
      res.writeHead(404).end();
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }))
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function seed(pool) {
  await pool.query(`DROP TABLE IF EXISTS dn_ingest_state, embed_usage, embed_partners, app_upgrade_requests`);
  await pool.query(`CREATE TABLE embed_partners (
    partner_id TEXT NOT NULL, widget_number INTEGER NOT NULL DEFAULT 1,
    allowed_hosts TEXT[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (partner_id, widget_number))`);
  await pool.query(`CREATE TABLE embed_usage (
    partner_id TEXT NOT NULL, widget_number INTEGER NOT NULL DEFAULT 1,
    views BIGINT NOT NULL DEFAULT 0, first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ,
    popup_last_seen TIMESTAMPTZ, embed_last_seen TIMESTAMPTZ,
    PRIMARY KEY (partner_id, widget_number))`);
  await pool.query(`CREATE TABLE app_upgrade_requests (
    id BIGSERIAL PRIMARY KEY, customer_id TEXT NOT NULL, partner_id TEXT,
    provider_name TEXT NOT NULL DEFAULT '', requester_key TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), summary_sent_at TIMESTAMPTZ)`);

  // A real account with two authorized domains (apex saved with a www prefix,
  // to exercise DN's normalisation), a legacy host: partner, our own demo site,
  // and a smoke site.
  await pool.query(`INSERT INTO embed_partners (partner_id, widget_number, allowed_hosts) VALUES
    ('acct-ann', 1, ARRAY['WWW.AnnsRealty.com','annsrealty-listings.com']),
    ('acct-ann', 2, ARRAY['annsrealty.com']),
    ('acct-demo', 1, ARRAY['dreamneighborhoodschools.com']),
    ('acct-smoke', 1, ARRAY['dream-schools-smoke-ind.herokuapp.com']),
    ('acct-e2e', 1, ARRAY['e2e-realtor.test']),
    ('acct-nodomain', 1, ARRAY[]::text[])`);

  await pool.query(`INSERT INTO embed_usage (partner_id, widget_number, views, first_seen, last_seen, popup_last_seen, embed_last_seen) VALUES
    ('acct-ann', 1, 1200, '2026-04-01T12:00:00Z', '2026-07-30T04:00:00Z', '2026-07-30T04:00:00Z', NULL),
    ('acct-ann', 2,  641, '2026-03-01T12:00:00Z', '2026-07-31T04:00:00Z', NULL, '2026-07-31T04:00:00Z'),
    ('host:annsrealty.com', 1, 90, '2026-01-05T00:00:00Z', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', NULL),
    ('host:other-realty.com', 1, 12, NOW(), NOW(), NOW(), NULL),
    ('acct-demo', 1, 500, NOW(), NOW(), NOW(), NULL),
    ('acct-smoke', 1, 70, NOW(), NOW(), NOW(), NULL),
    ('acct-e2e', 1, 14, NOW(), NOW(), NOW(), NULL),
    ('acct-nodomain', 1, 33, NOW(), NOW(), NOW(), NULL)`);

  await pool.query(`INSERT INTO app_upgrade_requests (customer_id, requester_key, address, source, requested_at) VALUES
    ('acct-ann', 'icyt9p3v66cm', '910 Fairway Dr NE, Warren, OH', 'popup',  '2026-07-24T18:22:00Z'),
    ('acct-ann', 'zz11',          '12 Elm St, Warren, OH',        'inline', '2026-07-25T09:00:00Z'),
    ('acct-demo','dd22',          '1 Demo Way, Los Angeles, CA',  'popup',  '2026-07-26T09:00:00Z'),
    ('acct-smoke','ss33',         '5 Smoke Rd, Austin, TX',       'popup',  '2026-07-27T09:00:00Z'),
    ('host:other-realty.com','oo44','7 Oak Ave, Akron, OH',       'popup',  '2026-07-28T09:00:00Z'),
    ('acct-nodomain','nn55',      '9 Nowhere Ln, Toledo, OH',     'popup',  '2026-07-29T09:00:00Z')`);
}

// ---------------------------------------------------------------------------

function startApp(env) {
  const child = spawn("npm", ["run", "start"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, getLog: () => log };
}

async function waitForApp(base, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error("app did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  await seed(pool);

  const { server, base: dnBase } = await startDnStub();
  const port = 3999;
  const appBase = `http://127.0.0.1:${port}`;
  const app = startApp({
    PORT: String(port),
    DATABASE_URL,
    DN_ORIGIN: dnBase,
    DN_INGEST_API_KEY: API_KEY,
    CRON_SECRET,
    DN_INGEST_MIN_INTERVAL_HOURS: "6",
    DN_INGEST_INITIAL_OVERLAP: "1000", // fixtures are tiny; send them all
  });

  try {
    await waitForApp(appBase);

    const call = async (qs = "") => {
      const r = await fetch(`${appBase}/api/cron/dn-ingest?secret=${CRON_SECRET}${qs}`);
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${r.status} from /api/cron/dn-ingest: ${text.slice(0, 400)}\n--- app log ---\n${app.getLog().slice(-3000)}`);
      }
    };

    // --- run 1 -------------------------------------------------------------
    const first = await call();
    record("run 1 completed without errors", first.ok && first.ran, JSON.stringify(first.errors || []));

    const ann = received.usage.find((u) => u.domain === "annsrealty.com");
    record(
      "usage: www is stripped and per-widget rows are summed",
      !!ann && ann.views === 1931,
      ann ? `annsrealty.com views=${ann.views} (1200 + 641 + 90 legacy)` : "no annsrealty.com row"
    );
    record(
      "usage: earliest first_seen and latest last_seen survive the merge",
      !!ann && ann.first_seen.startsWith("2026-01-05") && ann.last_seen.startsWith("2026-07-31"),
      ann ? `${ann.first_seen} → ${ann.last_seen}` : ""
    );
    record(
      "usage: embed_last_seen is sent as inline_last_seen",
      !!ann && typeof ann.inline_last_seen === "string" && !("embed_last_seen" in ann),
      ann ? `inline_last_seen=${ann.inline_last_seen}` : ""
    );
    record(
      "usage: our own demo, smoke and reserved test domains are left out",
      !received.usage.some((u) => /dreamneighborhoodschools\.com|herokuapp\.com|\.test$/.test(u.domain)),
      received.usage.map((u) => u.domain).join(", ")
    );
    record(
      "usage: a partner with no authorized domain is skipped",
      received.usage.length === 2 &&
        received.usage.map((u) => u.domain).sort().join(",") === "annsrealty.com,other-realty.com",
      `${received.usage.length} rows: ${received.usage.map((u) => u.domain).join(", ")}`
    );

    const byId = new Map(received.requests.map((r) => [r.external_id, r]));
    record(
      "requests: every row carries external_id",
      received.requests.length > 0 && received.requests.every((r) => r.external_id),
      `${received.requests.length} rows`
    );
    record(
      "requests: external_id is app_upgrade_requests.id",
      byId.has("1") && byId.get("1").address.startsWith("910 Fairway"),
      Array.from(byId.keys()).join(",")
    );
    record(
      "requests: source demo is sent verbatim for our own site",
      byId.get("3")?.source === "demo",
      `id 3 source=${byId.get("3")?.source}`
    );
    record(
      "requests: source smoke-e2e is sent verbatim for our smoke sites",
      byId.get("4")?.source === "smoke-e2e",
      `id 4 source=${byId.get("4")?.source}`
    );
    record(
      "requests: real visitor traffic keeps popup / inline",
      byId.get("1")?.source === "popup" && byId.get("2")?.source === "inline",
      `id 1=${byId.get("1")?.source}, id 2=${byId.get("2")?.source}`
    );
    record(
      "requests: a legacy host: customer resolves to its domain",
      byId.get("5")?.domain === "other-realty.com",
      `id 5 domain=${byId.get("5")?.domain}`
    );
    record(
      "requests: a customer with no domain is skipped, not guessed at",
      !byId.has("6") && first.upgradeRequests.skippedNoDomain === 1,
      `skippedNoDomain=${first.upgradeRequests.skippedNoDomain}`
    );
    record(
      "unmatched_domains is surfaced whether DN sends a count or a list",
      first.unmatchedDomains === 2 && first.skippedByDn === 0,
      `unmatchedDomains=${first.unmatchedDomains} (1 as a count from usage + 1 as a list from requests), skippedByDn=${first.skippedByDn}`
    );
    record("authorization header is Api-Key <key>", received.auth.every((a) => a === `Api-Key ${API_KEY}`));

    // --- run 2: rate limited ------------------------------------------------
    const throttled = await call();
    record(
      "a second run inside the interval is skipped",
      throttled.ran === false && !!throttled.skippedReason,
      throttled.skippedReason || ""
    );

    // --- run 3: forced, replay ---------------------------------------------
    const usageBefore = received.usage.length;
    const forced = await call("&force=1");
    const annAgain = received.usage.slice(usageBefore).find((u) => u.domain === "annsrealty.com");
    record(
      "views is a running total: a replay resends the same number",
      !!annAgain && annAgain.views === ann.views,
      annAgain ? `${ann.views} → ${annAgain.views}` : "no second usage row"
    );
    record(
      "requests already sent are not resent (watermark advanced)",
      forced.upgradeRequests.sent === 0 && forced.upgradeRequests.fromId >= 6,
      `sent=${forced.upgradeRequests.sent}, fromId=${forced.upgradeRequests.fromId}`
    );

    // --- run 4: a new request is picked up ---------------------------------
    await pool.query(
      `INSERT INTO app_upgrade_requests (customer_id, requester_key, address, source)
       VALUES ('acct-ann', 'new99', '77 New St, Warren, OH', 'popup')`
    );
    const incremental = await call("&force=1");
    record(
      "a new request is picked up on the next run",
      incremental.upgradeRequests.sent === 1,
      `sent=${incremental.upgradeRequests.sent}`
    );

    // --- run 5: replaying a known id reports already_had --------------------
    await pool.query(`UPDATE dn_ingest_state SET last_request_id = 0 WHERE key = 'global'`);
    const replay = await call("&force=1");
    const lastResponseAlreadyHad = replay.alreadyHad;
    record(
      "re-sending the same requests reports already_had",
      lastResponseAlreadyHad >= 6,
      `already_had=${lastResponseAlreadyHad}`
    );

    record("DN never rejected a payload", received.rejected.length === 0, received.rejected.join("; "));
  } finally {
    app.child.kill("SIGTERM");
  }

  // --- the web process pushes on its own, with nobody calling the endpoint ---
  // There is no Heroku Scheduler on either app, so this is what makes "at least
  // daily" true rather than aspirational.
  const timed = startApp({
    PORT: "4001",
    DATABASE_URL,
    DN_ORIGIN: dnBase,
    DN_INGEST_API_KEY: API_KEY,
    CRON_SECRET,
    DN_INGEST_MIN_INTERVAL_HOURS: "0",
    DN_INGEST_TICK_MS: "5000",
  });
  try {
    await waitForApp("http://127.0.0.1:4001");
    const before = received.usage.length;
    let grew = false;
    for (let i = 0; i < 30 && !grew; i += 1) {
      await new Promise((r) => setTimeout(r, 1000));
      grew = received.usage.length > before;
    }
    record(
      "the web process pushes on a timer, with no cron call and no scheduler",
      grew,
      grew ? `${received.usage.length - before} usage rows arrived unprompted` : "nothing arrived in 30s"
    );
  } finally {
    timed.child.kill("SIGTERM");
    server.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
