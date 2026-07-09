import { randomUUID } from "crypto";
import { getPool, hasDatabase } from "@/lib/db";

// Production metrics + reports for the Server Management page.
//
//  • Daily counters (app_stat_counters) are incremented in memory and flushed to
//    Postgres periodically, so even high-frequency events (autocomplete calls)
//    cost roughly one upsert per flush window rather than one per request.
//  • Searches are also written individually to app_search_log with the caller IP
//    (from x-forwarded-for) so reports can show per-IP / unique-visitor breakdowns.
//    Searches are low-frequency (one per actual lookup), so per-row is fine.
//  • Reports are snapshots (app_reports.data jsonb) generated on demand.

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (!hasDatabase() || tablesReady) return;
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_stat_counters (
       day    DATE NOT NULL,
       metric TEXT NOT NULL,
       value  BIGINT NOT NULL DEFAULT 0,
       PRIMARY KEY (day, metric)
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_search_log (
       id         TEXT PRIMARY KEY,
       ip         TEXT NOT NULL DEFAULT '',
       area       TEXT NOT NULL DEFAULT '',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS app_search_log_created_idx ON app_search_log (created_at DESC)`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_reports (
       id           TEXT PRIMARY KEY,
       type         TEXT NOT NULL,
       label        TEXT NOT NULL,
       generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       data         JSONB NOT NULL
     )`
  );
  tablesReady = true;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- In-memory counter buffer with periodic flush -------------------------
const buffer = new Map<string, number>(); // key: `${day}|${metric}`
let lastFlush = 0;
const FLUSH_MS = 20_000;

export function bumpMetric(metric: string, n = 1): void {
  const key = `${today()}|${metric}`;
  buffer.set(key, (buffer.get(key) ?? 0) + n);
  if (Date.now() - lastFlush >= FLUSH_MS) {
    lastFlush = Date.now();
    void flushMetrics().catch((e) => console.error("metrics flush failed:", e));
  }
}

export async function flushMetrics(): Promise<void> {
  if (!hasDatabase() || buffer.size === 0) return;
  await ensureTables();
  const entries = [...buffer.entries()];
  buffer.clear();
  const pool = getPool();
  for (const [key, val] of entries) {
    const [day, metric] = key.split("|");
    try {
      await pool.query(
        `INSERT INTO app_stat_counters (day, metric, value) VALUES ($1,$2,$3)
           ON CONFLICT (day, metric) DO UPDATE SET value = app_stat_counters.value + EXCLUDED.value`,
        [day, metric, val]
      );
    } catch (e) {
      // Put the count back so it isn't lost, then stop this pass.
      buffer.set(key, (buffer.get(key) ?? 0) + val);
      console.error("metrics upsert failed:", e);
      break;
    }
  }
}

// Fire-and-forget: record an actual search (lookup) with the caller IP.
export function recordSearchAsync(ip: string, area: string): void {
  bumpMetric("searches");
  if (!hasDatabase()) return;
  void (async () => {
    try {
      await ensureTables();
      await getPool().query(`INSERT INTO app_search_log (id, ip, area) VALUES ($1,$2,$3)`, [
        randomUUID(),
        (ip || "").slice(0, 64),
        (area || "").slice(0, 200),
      ]);
    } catch (e) {
      console.error("search log failed:", e);
    }
  })();
}

// ---- Stats + reports ------------------------------------------------------
export interface Stats {
  from: string;
  to: string;
  searches: number;
  uniqueVisitors: number;
  topIps: { ip: string; count: number }[];
  topAreas: { area: string; count: number }[];
  autocompleteCalls: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number; // 0..1
  autocompleteFallbacks: number;
  geocodeFallbacks: number;
  lookupErrors: number;
}

export async function getStats(fromDay: string, toDay: string): Promise<Stats> {
  const empty: Stats = {
    from: fromDay,
    to: toDay,
    searches: 0,
    uniqueVisitors: 0,
    topIps: [],
    topAreas: [],
    autocompleteCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    autocompleteFallbacks: 0,
    geocodeFallbacks: 0,
    lookupErrors: 0,
  };
  if (!hasDatabase()) return empty;
  await flushMetrics();
  await ensureTables();
  const pool = getPool();

  const counters = await pool.query(
    `SELECT metric, SUM(value)::bigint AS total FROM app_stat_counters
       WHERE day BETWEEN $1 AND $2 GROUP BY metric`,
    [fromDay, toDay]
  );
  const m: Record<string, number> = {};
  for (const r of counters.rows) m[r.metric] = Number(r.total);

  // IP + area breakdowns come from the per-search log (inclusive of the whole toDay).
  const ips = await pool.query(
    `SELECT ip, COUNT(*)::int AS n FROM app_search_log
       WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day') AND ip <> ''
       GROUP BY ip ORDER BY n DESC LIMIT 10`,
    [fromDay, toDay]
  );
  const uniq = await pool.query(
    `SELECT COUNT(DISTINCT ip)::int AS n FROM app_search_log
       WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day') AND ip <> ''`,
    [fromDay, toDay]
  );
  const areas = await pool.query(
    `SELECT area, COUNT(*)::int AS n FROM app_search_log
       WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day') AND area <> ''
       GROUP BY area ORDER BY n DESC LIMIT 10`,
    [fromDay, toDay]
  );

  const hits = m["autocomplete_cache_hits"] ?? 0;
  const misses = m["autocomplete_cache_misses"] ?? 0;
  return {
    from: fromDay,
    to: toDay,
    searches: m["searches"] ?? 0,
    uniqueVisitors: Number(uniq.rows[0]?.n ?? 0),
    topIps: ips.rows.map((r: any) => ({ ip: r.ip, count: Number(r.n) })),
    topAreas: areas.rows.map((r: any) => ({ area: r.area, count: Number(r.n) })),
    autocompleteCalls: m["autocomplete_calls"] ?? 0,
    cacheHits: hits,
    cacheMisses: misses,
    cacheHitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
    autocompleteFallbacks: m["autocomplete_fallback"] ?? 0,
    geocodeFallbacks: m["geocode_fallback"] ?? 0,
    lookupErrors: m["lookup_errors"] ?? 0,
  };
}

export async function getTodayStats(): Promise<Stats> {
  const d = today();
  return getStats(d, d);
}

export interface ReportRow {
  id: string;
  type: string;
  label: string;
  generatedAt: string;
  data: Stats;
}

export async function generateReport(type: "daily" | "monthly"): Promise<ReportRow | null> {
  if (!hasDatabase()) return null;
  await ensureTables();
  const now = new Date();
  let fromDay: string;
  const toDay = now.toISOString().slice(0, 10);
  let label: string;
  if (type === "monthly") {
    fromDay = `${now.toISOString().slice(0, 7)}-01`;
    label = `Monthly digest — ${now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  } else {
    fromDay = toDay;
    label = `Daily report — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  const stats = await getStats(fromDay, toDay);
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO app_reports (id, type, label, data) VALUES ($1,$2,$3,$4)`,
    [id, type, label, JSON.stringify(stats)]
  );
  return { id, type, label, generatedAt: new Date().toISOString(), data: stats };
}

export async function listReports(limit = 100): Promise<Omit<ReportRow, "data">[]> {
  if (!hasDatabase()) return [];
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT id, type, label, generated_at FROM app_reports ORDER BY generated_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({ id: r.id, type: r.type, label: r.label, generatedAt: r.generated_at }));
}

export async function getReport(id: string): Promise<ReportRow | null> {
  if (!hasDatabase()) return null;
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT id, type, label, generated_at, data FROM app_reports WHERE id=$1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, type: r.type, label: r.label, generatedAt: r.generated_at, data: r.data };
}
