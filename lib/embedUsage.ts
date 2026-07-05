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

export type EmbedSurface = "popup" | "embed";

export interface UsageStats {
  views: number;
  firstSeen: string | null;
  lastSeen: string | null;
  popupLastSeen: string | null;
  embedLastSeen: string | null;
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
      // Per-surface detection (which snippet — popup vs embed — was last seen).
      .then(() =>
        pool.query(
          `ALTER TABLE embed_usage
             ADD COLUMN IF NOT EXISTS popup_last_seen TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS embed_last_seen TIMESTAMPTZ`
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

/** Increment the view counter and stamp first/last activity for a widget. */
export async function recordUsage(partnerId: string, widgetNumber: number, surface?: EmbedSurface): Promise<void> {
  if (!hasDatabase() || !partnerId) return;
  await ensureTable();
  const pool = getPool();
  const s = surface === "popup" || surface === "embed" ? surface : null;
  await pool.query(
    `INSERT INTO embed_usage (partner_id, widget_number, views, first_seen, last_seen, popup_last_seen, embed_last_seen)
       VALUES ($1, $2, 1, NOW(), NOW(),
               CASE WHEN $3 = 'popup' THEN NOW() END,
               CASE WHEN $3 = 'embed' THEN NOW() END)
     ON CONFLICT (partner_id, widget_number) DO UPDATE SET
       views = embed_usage.views + 1,
       first_seen = COALESCE(embed_usage.first_seen, NOW()),
       last_seen = NOW(),
       popup_last_seen = CASE WHEN $3 = 'popup' THEN NOW() ELSE embed_usage.popup_last_seen END,
       embed_last_seen = CASE WHEN $3 = 'embed' THEN NOW() ELSE embed_usage.embed_last_seen END`,
    [partnerId, widgetNumber, s]
  );
}

/** Fire-and-forget wrapper: never throws into the caller's request path. */
export function recordUsageAsync(partnerId: string, widgetNumber: number, surface?: EmbedSurface): void {
  recordUsage(partnerId, widgetNumber, surface).catch((err) => {
    console.error("recordUsage failed:", err);
  });
}

/** Usage for one widget, or a zeroed record when nothing has been logged yet. */
export async function getUsage(partnerId: string, widgetNumber = 1): Promise<UsageStats> {
  const zero: UsageStats = { views: 0, firstSeen: null, lastSeen: null, popupLastSeen: null, embedLastSeen: null };
  if (!hasDatabase() || !partnerId) return zero;
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT views, first_seen, last_seen, popup_last_seen, embed_last_seen FROM embed_usage
       WHERE partner_id = $1 AND widget_number = $2`,
    [partnerId, widgetNumber]
  );
  if (!rows[0]) return zero;
  return {
    views: Number(rows[0].views) || 0,
    firstSeen: rows[0].first_seen ?? null,
    lastSeen: rows[0].last_seen ?? null,
    popupLastSeen: rows[0].popup_last_seen ?? null,
    embedLastSeen: rows[0].embed_last_seen ?? null,
  };
}

/** Delete all usage rows for a partner (used when a customer is deleted). */
export async function deleteUsage(partnerId: string): Promise<void> {
  if (!hasDatabase() || !partnerId) return;
  await ensureTable();
  await getPool().query(`DELETE FROM embed_usage WHERE partner_id = $1`, [partnerId]);
}

/**
 * Fold one partner's usage into another (summing views, keeping the earliest
 * first_seen / latest last_seen), then delete the source row. Used when a
 * customer claims a domain previously tracked under a legacy `host:` partner so
 * their view count reflects real traffic.
 */
export async function mergeUsage(fromPartnerId: string, toPartnerId: string): Promise<void> {
  if (!hasDatabase() || !fromPartnerId || !toPartnerId || fromPartnerId === toPartnerId) return;
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT views, first_seen, last_seen FROM embed_usage WHERE partner_id = $1 AND widget_number = 1`,
    [fromPartnerId]
  );
  const src = rows[0];
  if (!src) return;
  await pool.query(
    `INSERT INTO embed_usage (partner_id, widget_number, views, first_seen, last_seen)
       VALUES ($1, 1, $2, $3, $4)
     ON CONFLICT (partner_id, widget_number) DO UPDATE SET
       views = embed_usage.views + EXCLUDED.views,
       first_seen = LEAST(COALESCE(embed_usage.first_seen, EXCLUDED.first_seen), EXCLUDED.first_seen),
       last_seen = GREATEST(COALESCE(embed_usage.last_seen, EXCLUDED.last_seen), EXCLUDED.last_seen)`,
    [toPartnerId, Number(src.views) || 0, src.first_seen, src.last_seen]
  );
  await pool.query(`DELETE FROM embed_usage WHERE partner_id = $1`, [fromPartnerId]);
}
