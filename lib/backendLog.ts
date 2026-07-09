import { randomUUID } from "crypto";
import { getPool, hasDatabase } from "@/lib/db";
import { sendTransactionalEmail, emailShell, htmlEscape } from "@/lib/email";

// Lightweight backend-health event log. Used to record when we fall back from a
// paid/primary provider to a free source (e.g. Geoapify throttled → Census/Photon),
// so the owner can tell when it's time to upgrade a plan. Events persist in
// Postgres and are viewable at /health (owner only). Writing is throttled per
// dyno; email alerts are throttled to at most one per day per event kind.

export interface BackendEvent {
  id: string;
  kind: string;
  detail: string;
  notified: boolean;
  createdAt: string;
}

let tableReady = false;
export async function ensureBackendLogTable(): Promise<void> {
  if (!hasDatabase() || tableReady) return;
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_backend_events (
       id         TEXT PRIMARY KEY,
       kind       TEXT NOT NULL,
       detail     TEXT NOT NULL DEFAULT '',
       notified   BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS app_backend_events_created_idx ON app_backend_events (created_at DESC)`
  );
  tableReady = true;
}

// Per-dyno write throttle so a sustained outage doesn't flood the table with a
// row per request — one row per kind per window is plenty to spot a trend.
const WRITE_THROTTLE_MS = 5 * 60 * 1000;
const lastWrite = new Map<string, number>();

// Fire-and-forget: never blocks or throws into the request path.
export function logBackendEventAsync(kind: string, detail: string): void {
  const now = Date.now();
  if (now - (lastWrite.get(kind) ?? 0) < WRITE_THROTTLE_MS) return;
  lastWrite.set(kind, now);
  void writeEvent(kind, detail).catch((e) => console.error("backendLog write failed:", e));
}

async function writeEvent(kind: string, detail: string): Promise<void> {
  if (!hasDatabase()) {
    console.warn(`[backend-event] ${kind}: ${detail}`);
    return;
  }
  await ensureBackendLogTable();
  await getPool().query(`INSERT INTO app_backend_events (id, kind, detail) VALUES ($1,$2,$3)`, [
    randomUUID(),
    kind,
    detail,
  ]);
  await maybeNotify(kind, detail);
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const NOTIFY_THROTTLE_MS = 24 * 60 * 60 * 1000;
async function maybeNotify(kind: string, detail: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT MAX(created_at) AS t FROM app_backend_events WHERE kind=$1 AND notified=TRUE`,
    [kind]
  );
  const last = rows[0]?.t ? new Date(rows[0].t).getTime() : 0;
  if (Date.now() - last < NOTIFY_THROTTLE_MS) return;

  const to = ownerEmails();
  if (to.length === 0) return;
  const appUrl = (process.env.APP_URL || "https://app.dreamneighborhoodschools.com").replace(/\/$/, "");
  const subject = `Backend health alert: ${kind}`;
  const html = emailShell(
    `<h1 style="font-size:18px;margin:0 0 8px">Backend fallback in use</h1>
     <p style="color:#475569;font-size:14px;margin:0 0 12px">${htmlEscape(detail)}</p>
     <p style="color:#475569;font-size:13px;margin:0 0 14px">Event type: <strong>${htmlEscape(kind)}</strong></p>
     <a href="${appUrl}/health" style="display:inline-block;background:#12854c;color:#fff;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">View backend health →</a>
     <p style="color:#94a3b8;font-size:12px;margin-top:16px">You'll get at most one alert per day per event type. If this is the Geoapify fallback, it may be time to upgrade the Geoapify plan.</p>`
  );
  const text = `Backend fallback in use.\n\n${detail}\nEvent type: ${kind}\n\nView backend health: ${appUrl}/health\n(At most one alert per day per event type.)`;
  await Promise.all(to.map((addr) => sendTransactionalEmail({ to: addr, subject, html, text })));

  // Mark the most recent event of this kind as notified (so the 24h window starts now).
  await pool.query(
    `UPDATE app_backend_events SET notified=TRUE
       WHERE kind=$1 AND created_at=(SELECT MAX(created_at) FROM app_backend_events WHERE kind=$1)`,
    [kind]
  );
}

export async function listBackendEvents(limit = 300): Promise<BackendEvent[]> {
  if (!hasDatabase()) return [];
  await ensureBackendLogTable();
  const { rows } = await getPool().query(
    `SELECT id, kind, detail, notified, created_at
       FROM app_backend_events ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    detail: r.detail,
    notified: r.notified,
    createdAt: r.created_at,
  }));
}
