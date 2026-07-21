import { Pool } from "pg";

// A single shared connection pool. When DATABASE_URL is set (local Postgres,
// Heroku Postgres, Supabase, ...), the app serves nationwide data from Postgres;
// otherwise it falls back to the committed 10-zip JSON bundle.

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    // Managed Postgres (Heroku, Supabase, etc.) requires SSL; local does not.
    const needsSsl =
      /heroku|amazonaws|supabase|render|railway/i.test(connectionString) ||
      process.env.PGSSLMODE === "require";

    // Pool size is per Node process (one per web dyno with `next start`). Keep
    // `dynos * PG_POOL_MAX` comfortably under the Postgres plan's connection
    // limit (Heroku essential ≈ 20, standard-0 ≈ 120). Default 6 leaves room for
    // psql/migrations/other apps sharing the DB.
    const max = intFromEnv("PG_POOL_MAX", 6, 1, 80);
    const idleTimeoutMillis = intFromEnv("PG_POOL_IDLE_MS", 30_000, 1_000, 600_000);
    const connectionTimeoutMillis = intFromEnv("PG_POOL_CONNECT_MS", 10_000, 1_000, 60_000);
    // Server-side guard so a slow query can't pin a connection forever under load.
    const statementTimeoutMillis = intFromEnv("PG_STATEMENT_TIMEOUT_MS", 15_000, 0, 120_000);

    pool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      ...(statementTimeoutMillis > 0
        ? { statement_timeout: statementTimeoutMillis, query_timeout: statementTimeoutMillis }
        : {}),
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });

    // A pool 'error' on an idle client would otherwise crash the process.
    pool.on("error", (err) => {
      console.error("pg pool idle client error:", err.message);
    });
  }
  return pool;
}
