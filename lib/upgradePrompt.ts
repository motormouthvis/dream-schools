import { getPool, hasDatabase } from "@/lib/db";

export const DEFAULT_UPGRADE_VIEWS_TO_TRIGGER = 2;
export const DEFAULT_UPGRADE_MIN_DAYS_BETWEEN = 7;
export const DEFAULT_UPGRADE_IDLE_SECONDS = 8;
export const REQUEST_SUPPRESS_DAYS = 90;

export interface UpgradePromptSettings {
  viewsToTrigger: number;
  minDaysBetween: number;
  idleSeconds: number;
}

let tableReady: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_upgrade_settings (
           key TEXT PRIMARY KEY,
           views_to_trigger INTEGER NOT NULL DEFAULT 2,
           min_days_between INTEGER NOT NULL DEFAULT 7,
           idle_seconds INTEGER NOT NULL DEFAULT 8,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_upgrade_requests (
             id BIGSERIAL PRIMARY KEY,
             customer_id TEXT NOT NULL,
             partner_id TEXT,
             provider_name TEXT NOT NULL DEFAULT '',
             requester_key TEXT NOT NULL DEFAULT '',
             address TEXT NOT NULL DEFAULT '',
             source TEXT NOT NULL DEFAULT '',
             requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             summary_sent_at TIMESTAMPTZ
           )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS app_upgrade_requests_customer_idx
             ON app_upgrade_requests(customer_id, requested_at)`
        )
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

function cleanInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function getGlobalUpgradeSettings(): Promise<UpgradePromptSettings> {
  if (!hasDatabase()) {
    return {
      viewsToTrigger: DEFAULT_UPGRADE_VIEWS_TO_TRIGGER,
      minDaysBetween: DEFAULT_UPGRADE_MIN_DAYS_BETWEEN,
      idleSeconds: DEFAULT_UPGRADE_IDLE_SECONDS,
    };
  }
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT views_to_trigger, min_days_between, idle_seconds
       FROM app_upgrade_settings WHERE key = 'global'`
  );
  const r = rows[0];
  return {
    viewsToTrigger: cleanInt(r?.views_to_trigger, DEFAULT_UPGRADE_VIEWS_TO_TRIGGER, 1, 50),
    minDaysBetween: cleanInt(r?.min_days_between, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 1, 365),
    idleSeconds: cleanInt(r?.idle_seconds, DEFAULT_UPGRADE_IDLE_SECONDS, 3, 60),
  };
}

export async function setGlobalUpgradeSettings(values: UpgradePromptSettings): Promise<UpgradePromptSettings> {
  await ensureTables();
  const cleaned = {
    viewsToTrigger: cleanInt(values.viewsToTrigger, DEFAULT_UPGRADE_VIEWS_TO_TRIGGER, 1, 50),
    minDaysBetween: cleanInt(values.minDaysBetween, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 1, 365),
    idleSeconds: cleanInt(values.idleSeconds, DEFAULT_UPGRADE_IDLE_SECONDS, 3, 60),
  };
  await getPool().query(
    `INSERT INTO app_upgrade_settings (key, views_to_trigger, min_days_between, idle_seconds, updated_at)
       VALUES ('global', $1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       views_to_trigger = EXCLUDED.views_to_trigger,
       min_days_between = EXCLUDED.min_days_between,
       idle_seconds = EXCLUDED.idle_seconds,
       updated_at = NOW()`,
    [cleaned.viewsToTrigger, cleaned.minDaysBetween, cleaned.idleSeconds]
  );
  return cleaned;
}

export async function recordUpgradeRequest(input: {
  customerId: string;
  partnerId?: string | null;
  providerName?: string;
  requesterKey?: string;
  address?: string;
  source?: string;
}): Promise<void> {
  if (!hasDatabase() || !input.customerId) return;
  await ensureTables();
  await getPool().query(
    `INSERT INTO app_upgrade_requests
       (customer_id, partner_id, provider_name, requester_key, address, source)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.customerId,
      input.partnerId || null,
      input.providerName || "",
      input.requesterKey || "",
      input.address || "",
      input.source || "",
    ]
  );
}
