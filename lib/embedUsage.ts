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
//
// At scale (one big customer across many sites) even one write per view causes
// hot-row contention on a single embed_usage row. `recordUsageAsync` therefore
// COALESCES increments in memory and flushes them in a single batched upsert on
// a short interval, collapsing many views of the same widget into one write.
// View counts are approximate analytics, so losing a few seconds of buffered
// increments on a dyno crash is an acceptable trade for far fewer writes.
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

// ---------------------------------------------------------------------------
// In-memory coalescing buffer for the hot /api/embed/config path.
// ---------------------------------------------------------------------------

interface UsageDelta {
  partnerId: string;
  widgetNumber: number;
  views: number;
  lastSeen: number; // epoch ms
  popupLastSeen: number | null;
  embedLastSeen: number | null;
}

const buffer = new Map<string, UsageDelta>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

const FLUSH_INTERVAL_MS = Math.max(
  1000,
  Math.min(60_000, Number(process.env.EMBED_USAGE_FLUSH_MS) || 10_000)
);
// Safety valve: if a huge number of distinct widgets buffer up, flush early.
const MAX_BUFFER_KEYS = 2000;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushUsage();
  }, FLUSH_INTERVAL_MS);
  // Don't keep the event loop alive just for the flush timer.
  if (typeof flushTimer === "object" && flushTimer && "unref" in flushTimer) {
    (flushTimer as { unref: () => void }).unref();
  }
}

/** Flush all buffered usage deltas in a single batched upsert. */
export async function flushUsage(): Promise<void> {
  if (flushing) return flushing;
  if (!hasDatabase() || buffer.size === 0) return;
  const batch = Array.from(buffer.values());
  buffer.clear();

  flushing = (async () => {
    try {
      await ensureTable();
      const pool = getPool();
      const partnerIds = batch.map((d) => d.partnerId);
      const widgetNumbers = batch.map((d) => d.widgetNumber);
      const views = batch.map((d) => d.views);
      const lastSeen = batch.map((d) => new Date(d.lastSeen).toISOString());
      const popupLastSeen = batch.map((d) => (d.popupLastSeen ? new Date(d.popupLastSeen).toISOString() : null));
      const embedLastSeen = batch.map((d) => (d.embedLastSeen ? new Date(d.embedLastSeen).toISOString() : null));
      await pool.query(
        `INSERT INTO embed_usage AS eu
           (partner_id, widget_number, views, first_seen, last_seen, popup_last_seen, embed_last_seen)
         SELECT * FROM UNNEST(
           $1::text[], $2::int[], $3::bigint[], $4::timestamptz[], $4::timestamptz[], $5::timestamptz[], $6::timestamptz[]
         )
         ON CONFLICT (partner_id, widget_number) DO UPDATE SET
           views = eu.views + EXCLUDED.views,
           first_seen = COALESCE(eu.first_seen, EXCLUDED.first_seen),
           last_seen = GREATEST(eu.last_seen, EXCLUDED.last_seen),
           popup_last_seen = GREATEST(eu.popup_last_seen, EXCLUDED.popup_last_seen),
           embed_last_seen = GREATEST(eu.embed_last_seen, EXCLUDED.embed_last_seen)`,
        [partnerIds, widgetNumbers, views, lastSeen, popupLastSeen, embedLastSeen]
      );
    } catch (err) {
      console.error("flushUsage failed:", err);
      // Re-buffer so the counts aren't lost on a transient failure.
      for (const d of batch) {
        const existing = buffer.get(bufferKey(d.partnerId, d.widgetNumber));
        if (existing) {
          existing.views += d.views;
          existing.lastSeen = Math.max(existing.lastSeen, d.lastSeen);
          existing.popupLastSeen = maxNullable(existing.popupLastSeen, d.popupLastSeen);
          existing.embedLastSeen = maxNullable(existing.embedLastSeen, d.embedLastSeen);
        } else {
          buffer.set(bufferKey(d.partnerId, d.widgetNumber), d);
        }
      }
      if (buffer.size > 0) scheduleFlush();
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

function bufferKey(partnerId: string, widgetNumber: number): string {
  return `${partnerId}\u0000${widgetNumber}`;
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/** Fire-and-forget: buffer one view; flushed in a batched upsert shortly after. */
export function recordUsageAsync(partnerId: string, widgetNumber: number, surface?: EmbedSurface): void {
  if (!hasDatabase() || !partnerId) return;
  const now = Date.now();
  const key = bufferKey(partnerId, widgetNumber);
  const isPopup = surface === "popup";
  const isEmbed = surface === "embed";
  const existing = buffer.get(key);
  if (existing) {
    existing.views += 1;
    existing.lastSeen = now;
    if (isPopup) existing.popupLastSeen = now;
    if (isEmbed) existing.embedLastSeen = now;
  } else {
    buffer.set(key, {
      partnerId,
      widgetNumber,
      views: 1,
      lastSeen: now,
      popupLastSeen: isPopup ? now : null,
      embedLastSeen: isEmbed ? now : null,
    });
  }
  if (buffer.size >= MAX_BUFFER_KEYS) {
    void flushUsage();
  } else {
    scheduleFlush();
  }
}

// Best-effort flush when the dyno is cycling (Heroku sends SIGTERM). Registered
// once per process; never blocks shutdown for more than a moment.
declare global {
  // eslint-disable-next-line no-var
  var __embedUsageShutdownHooked: boolean | undefined;
}
if (typeof process !== "undefined" && !globalThis.__embedUsageShutdownHooked) {
  globalThis.__embedUsageShutdownHooked = true;
  const flushOnExit = () => {
    void flushUsage();
  };
  process.once("SIGTERM", flushOnExit);
  process.once("SIGINT", flushOnExit);
  process.once("beforeExit", flushOnExit);
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
  const base: UsageStats = rows[0]
    ? {
        views: Number(rows[0].views) || 0,
        firstSeen: rows[0].first_seen ?? null,
        lastSeen: rows[0].last_seen ?? null,
        popupLastSeen: rows[0].popup_last_seen ?? null,
        embedLastSeen: rows[0].embed_last_seen ?? null,
      }
    : zero;
  // Fold in any buffered-but-not-yet-flushed views for this widget so the
  // dashboard reflects very recent traffic without waiting for the next flush.
  const pending = buffer.get(bufferKey(partnerId, widgetNumber));
  if (pending) {
    base.views += pending.views;
    const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
    const later = (a: string | null, b: string | null) =>
      !a ? b : !b ? a : a > b ? a : b;
    base.lastSeen = later(base.lastSeen, iso(pending.lastSeen));
    base.firstSeen = base.firstSeen ?? iso(pending.lastSeen);
    base.popupLastSeen = later(base.popupLastSeen, iso(pending.popupLastSeen));
    base.embedLastSeen = later(base.embedLastSeen, iso(pending.embedLastSeen));
  }
  return base;
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
