import { Pool } from "pg";

// A single shared connection pool. When DATABASE_URL is set (local Postgres,
// Heroku Postgres, Supabase, ...), the app serves nationwide data from Postgres;
// otherwise it falls back to the committed 10-zip JSON bundle.

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
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
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}
