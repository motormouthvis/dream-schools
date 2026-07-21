import { getPool, hasDatabase } from "@/lib/db";

/** Default wait (ms) before showing the School popup when Neighborhood Explorer hasn't signaled ready. */
export const DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS = 4000;
export const NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN = 2000;
export const NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX = 15000;

export interface EmbedGlobalSettings {
  neighborhoodExplorerGraceMs: number;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!hasDatabase()) return;
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_embed_settings (
           key TEXT PRIMARY KEY,
           neighborhood_explorer_grace_ms INTEGER NOT NULL DEFAULT 4000,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

function clampGraceMs(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS;
  return Math.max(
    NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN,
    Math.min(NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX, n)
  );
}

export async function getEmbedGlobalSettings(): Promise<EmbedGlobalSettings> {
  if (!hasDatabase()) {
    return { neighborhoodExplorerGraceMs: DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS };
  }
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT neighborhood_explorer_grace_ms FROM app_embed_settings WHERE key = 'global'`
  );
  if (!rows[0]) {
    return { neighborhoodExplorerGraceMs: DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS };
  }
  return {
    neighborhoodExplorerGraceMs: clampGraceMs(rows[0].neighborhood_explorer_grace_ms),
  };
}

export async function setEmbedGlobalSettings(
  input: Partial<EmbedGlobalSettings>
): Promise<EmbedGlobalSettings> {
  if (!hasDatabase()) {
    return {
      neighborhoodExplorerGraceMs: clampGraceMs(
        input.neighborhoodExplorerGraceMs ?? DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS
      ),
    };
  }
  await ensureTable();
  const grace = clampGraceMs(
    input.neighborhoodExplorerGraceMs ?? DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS
  );
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO app_embed_settings (key, neighborhood_explorer_grace_ms, updated_at)
     VALUES ('global', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       neighborhood_explorer_grace_ms = EXCLUDED.neighborhood_explorer_grace_ms,
       updated_at = NOW()
     RETURNING neighborhood_explorer_grace_ms`,
    [grace]
  );
  return { neighborhoodExplorerGraceMs: clampGraceMs(rows[0]?.neighborhood_explorer_grace_ms) };
}
