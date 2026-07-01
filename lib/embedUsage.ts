import { getPool, hasDatabase } from "@/lib/db";

// ---------------------------------------------------------------------------
// Lightweight usage counters for each customer's School Explorer widget.
//
//   embed_usage(partner_id, widget_number)
//     views       — total times the SDK resolved this (enabled) config
//     first_seen  — when the snippet was FIRST detected on the customer's site
//     last_seen   — most recent activity ("last active")
//
// A widget's partner_id is the owning user's id (see /api/app/config), so the
// owner admin can join app_users → embed_usage to show signup + usage together.
//
// recordUsage is called fire-and-forget from the public /api/embed/config
// endpoint. That endpoint sends Cache-Control: max-age=60, so browsers only
// re-request roughly once a minute per page — keeping write volume modest.
// ---------------------------------------------------------------------------

export interface UsageStats {
  views: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS embed_usage (
           partner_id    TEXT NOT NULL,
           widget_number INTEGER NOT NULL DEFAULT 1,
           views         BIGINT NOT NULL DEFAULT 0,
           first_seen    TIMESTAMPTZ,
           last_seen     TIMESTAMPTZ,
           PRIMARY KEY (partner_id, widget_number)
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

/** Increment the view counter and stamp first/last activity for a widget. */
export async function recordUsage(partnerId: string, widgetNumber: number): Promise<void> {
  if (!hasDatabase() || !partnerId) return;
  await ensureTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO embed_usage (partner_id, widget_number, views, first_seen, last_seen)
       VALUES ($1, $2, 1, NOW(), NOW())
     ON CONFLICT (partner_id, widget_number) DO UPDATE SET
       views = embed_usage.views + 1,
       first_seen = COALESCE(embed_usage.first_seen, NOW()),
       last_seen = NOW()`,
    [partnerId, widgetNumber]
  );
}

/** Fire-and-forget wrapper: never throws into the caller's request path. */
export function recordUsageAsync(partnerId: string, widgetNumber: number): void {
  recordUsage(partnerId, widgetNumber).catch((err) => {
    console.error("recordUsage failed:", err);
  });
}

/** Usage for one widget, or a zeroed record when nothing has been logged yet. */
export async function getUsage(partnerId: string, widgetNumber = 1): Promise<UsageStats> {
  const zero: UsageStats = { views: 0, firstSeen: null, lastSeen: null };
  if (!hasDatabase() || !partnerId) return zero;
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT views, first_seen, last_seen FROM embed_usage
       WHERE partner_id = $1 AND widget_number = $2`,
    [partnerId, widgetNumber]
  );
  if (!rows[0]) return zero;
  return {
    views: Number(rows[0].views) || 0,
    firstSeen: rows[0].first_seen ?? null,
    lastSeen: rows[0].last_seen ?? null,
  };
}

/** Delete all usage rows for a partner (used when a customer is deleted). */
export async function deleteUsage(partnerId: string): Promise<void> {
  if (!hasDatabase() || !partnerId) return;
  await ensureTable();
  await getPool().query(`DELETE FROM embed_usage WHERE partner_id = $1`, [partnerId]);
}
