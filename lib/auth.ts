import { getPool, hasDatabase } from "@/lib/db";
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Accounts for the School Explorer app. Low-friction email + password signup
// with magic-link email verification and cookie sessions. No billing.
//
//   app_users          — the account (email, password hash, verified, owner)
//   app_sessions       — cookie session tokens (sha256-hashed)
//   app_verify_tokens  — one-time magic-link verification tokens (sha256-hashed)
//
// Passwords use Node's built-in scrypt (no native deps). Session/verify tokens
// are random 32-byte values; only their SHA-256 is stored.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "dn_sess";
const SESSION_TTL_DAYS = 60;
const VERIFY_TTL_HOURS = 48;

export interface AppUser {
  id: string;
  email: string;
  emailVerified: boolean;
  isOwner: boolean;
  createdAt: string;
}

let tableReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_users (
           id             TEXT PRIMARY KEY,
           email          TEXT UNIQUE NOT NULL,
           password_hash  TEXT NOT NULL,
           email_verified BOOLEAN NOT NULL DEFAULT FALSE,
           is_owner       BOOLEAN NOT NULL DEFAULT FALSE,
           created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_sessions (
             token_hash TEXT PRIMARY KEY,
             user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
             created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             expires_at TIMESTAMPTZ NOT NULL
           )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_verify_tokens (
             token_hash TEXT PRIMARY KEY,
             user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
             expires_at TIMESTAMPTZ NOT NULL
           )`
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

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

// Owner accounts (the company owner) are bootstrapped from OWNER_EMAILS.
export function isOwnerEmail(email: string): boolean {
  const list = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(normalizeEmail(email));
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = (stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

function rowToUser(r: any): AppUser {
  return {
    id: r.id,
    email: r.email,
    emailVerified: Boolean(r.email_verified),
    isOwner: Boolean(r.is_owner),
    createdAt: r.created_at,
  };
}

export async function getUserByEmail(email: string): Promise<(AppUser & { passwordHash: string }) | null> {
  if (!hasDatabase()) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM app_users WHERE email = $1`, [normalizeEmail(email)]);
  if (!rows[0]) return null;
  return { ...rowToUser(rows[0]), passwordHash: rows[0].password_hash };
}

export async function createUser(email: string, password: string): Promise<AppUser> {
  await ensureTables();
  const pool = getPool();
  const id = randomUUID();
  const owner = isOwnerEmail(email);
  const { rows } = await pool.query(
    `INSERT INTO app_users (id, email, password_hash, is_owner)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, normalizeEmail(email), hashPassword(password), owner]
  );
  return rowToUser(rows[0]);
}

// A one-time magic-link token; returns the RAW token to embed in the email URL.
export async function createVerificationToken(userId: string): Promise<string> {
  await ensureTables();
  const pool = getPool();
  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFY_TTL_HOURS * 3600 * 1000);
  await pool.query(
    `INSERT INTO app_verify_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)`,
    [sha256(raw), userId, expires]
  );
  return raw;
}

// Consume a verification token: mark the user verified, delete the token, and
// return the user (or null if invalid/expired).
export async function consumeVerificationToken(raw: string): Promise<AppUser | null> {
  if (!hasDatabase() || !raw) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(
    `DELETE FROM app_verify_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id`,
    [sha256(raw)]
  );
  const userId = rows[0]?.user_id;
  if (!userId) return null;
  const upd = await pool.query(
    `UPDATE app_users SET email_verified = TRUE WHERE id = $1 RETURNING *`,
    [userId]
  );
  return upd.rows[0] ? rowToUser(upd.rows[0]) : null;
}

// Create a session; returns the RAW cookie value to set.
export async function createSession(userId: string): Promise<string> {
  await ensureTables();
  const pool = getPool();
  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await pool.query(
    `INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)`,
    [sha256(raw), userId, expires]
  );
  return raw;
}

export async function deleteSession(raw: string): Promise<void> {
  if (!hasDatabase() || !raw) return;
  await ensureTables();
  await getPool().query(`DELETE FROM app_sessions WHERE token_hash = $1`, [sha256(raw)]);
}

export async function getUserBySession(raw: string | undefined | null): Promise<AppUser | null> {
  if (!hasDatabase() || !raw) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.* FROM app_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [sha256(raw)]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

// Read the session token from a Request's Cookie header.
export function sessionTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)dn_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function currentUser(request: Request): Promise<AppUser | null> {
  return getUserBySession(sessionTokenFromRequest(request));
}

export function sessionCookie(value: string, maxAgeSeconds = SESSION_TTL_DAYS * 24 * 3600) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
