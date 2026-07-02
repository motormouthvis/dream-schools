import { getPool, hasDatabase } from "@/lib/db";

// ---------------------------------------------------------------------------
// Per-account audit log: account creation, email changes, password changes /
// resets, and verification. Powers the Customer List "History" view.
// ---------------------------------------------------------------------------

export type UserEventType =
  | "account_created"
  | "email_verified"
  | "email_changed"
  | "password_changed"
  | "password_reset"
  | "domain_changed"
  | "default_address_changed"
  | "explorer_enabled_changed"
  | "account_deleted";

export interface UserEvent {
  event: UserEventType | string;
  detail: string | null;
  createdAt: string;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_user_events (
           id         BIGSERIAL PRIMARY KEY,
           user_id    TEXT NOT NULL,
           event      TEXT NOT NULL,
           detail     TEXT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS app_user_events_user_idx ON app_user_events(user_id, created_at)`
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

export async function logUserEvent(
  userId: string,
  event: UserEventType,
  detail?: string | null
): Promise<void> {
  if (!hasDatabase() || !userId) return;
  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO app_user_events (user_id, event, detail) VALUES ($1,$2,$3)`,
      [userId, event, detail ?? null]
    );
  } catch (err) {
    console.error("logUserEvent failed:", err);
  }
}

/** Fire-and-forget: never throws into the caller's request path. */
export function logUserEventAsync(userId: string, event: UserEventType, detail?: string | null): void {
  logUserEvent(userId, event, detail).catch(() => {});
}

export async function getUserEvents(userId: string): Promise<UserEvent[]> {
  if (!hasDatabase() || !userId) return [];
  await ensureTable();
  const { rows } = await getPool().query(
    `SELECT event, detail, created_at FROM app_user_events WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return rows.map((r: any) => ({ event: r.event, detail: r.detail ?? null, createdAt: r.created_at }));
}

export async function deleteUserEvents(userId: string): Promise<void> {
  if (!hasDatabase() || !userId) return;
  await ensureTable();
  await getPool().query(`DELETE FROM app_user_events WHERE user_id = $1`, [userId]);
}
