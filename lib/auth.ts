import { getPool, hasDatabase } from "@/lib/db";
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from "crypto";
import { UPGRADE_PROMPT_LIMITS, type UpgradePromptLimitKey } from "@/lib/upgradeLimits";

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
// While a partner/admin is impersonating a realtor, dn_sess points at the
// realtor and this cookie holds the impersonator's own session token so they
// can return to their account.
export const IMPERSONATOR_COOKIE = "dn_imp";
const SESSION_TTL_DAYS = 60;
const VERIFY_TTL_HOURS = 48;

export interface AppUser {
  id: string;
  email: string;
  emailVerified: boolean;
  isOwner: boolean;
  isPartner: boolean;
  partnerId: string | null;
  companyName: string;
  businessName: string;
  /** Shared with Dream Neighborhood, e.g. `DN-100042`. Minted by DN, never here. */
  customerNumber: string | null;
  /** Owner/partner preference: default widget accent color for NEW customers they create. */
  defaultCustomerAccentColor: string;
  upgradeViewsToTrigger: number | null;
  upgradeMinDaysBetween: number | null;
  upgradeIdleSeconds: number | null;
  reminderIntervalDays: number | null;
  reminderLastSentAt: string | null;
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
           is_partner     BOOLEAN NOT NULL DEFAULT FALSE,
           partner_id     TEXT,
           company_name   TEXT NOT NULL DEFAULT '',
           business_name  TEXT NOT NULL DEFAULT '',
           default_customer_accent_color TEXT NOT NULL DEFAULT '',
           customer_login_email_text TEXT NOT NULL DEFAULT '',
           upgrade_views_to_trigger INTEGER,
           upgrade_min_days_between INTEGER,
           upgrade_idle_seconds INTEGER,
           reminder_interval_days INTEGER,
           reminder_last_sent_at TIMESTAMPTZ,
           neighborhood_explorer_active BOOLEAN NOT NULL DEFAULT FALSE,
           created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           deleted_at     TIMESTAMPTZ
         )`
      )
      .then(() =>
        pool.query(
          `ALTER TABLE app_users
             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT FALSE,
             ADD COLUMN IF NOT EXISTS partner_id TEXT,
             ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '',
             ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '',
             ADD COLUMN IF NOT EXISTS default_customer_accent_color TEXT NOT NULL DEFAULT '',
             ADD COLUMN IF NOT EXISTS customer_login_email_text TEXT NOT NULL DEFAULT '',
             ADD COLUMN IF NOT EXISTS upgrade_views_to_trigger INTEGER,
             ADD COLUMN IF NOT EXISTS upgrade_min_days_between INTEGER,
             ADD COLUMN IF NOT EXISTS upgrade_idle_seconds INTEGER,
             ADD COLUMN IF NOT EXISTS reminder_interval_days INTEGER,
             ADD COLUMN IF NOT EXISTS reminder_last_sent_at TIMESTAMPTZ,
             ADD COLUMN IF NOT EXISTS neighborhood_explorer_active BOOLEAN NOT NULL DEFAULT FALSE,
             ADD COLUMN IF NOT EXISTS customer_number TEXT`
        )
      )
      // Unique where present. DN mints these from a sequence, so a duplicate
      // here means an import went wrong — better to fail the import than to
      // have two realtors' homebuyers attributed to one account.
      .then(() =>
        pool.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS app_users_customer_number_idx
             ON app_users (customer_number) WHERE customer_number IS NOT NULL`
        )
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
      // One token table serves both email verification and password resets.
      .then(() =>
        pool.query(
          `ALTER TABLE app_verify_tokens
             ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'verify'`
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

export function ensureAuthTables(): Promise<void> {
  return ensureTables();
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
    isPartner: Boolean(r.is_partner),
    partnerId: r.partner_id ?? null,
    companyName: r.company_name ?? "",
    businessName: r.business_name ?? "",
    customerNumber: r.customer_number || null,
    defaultCustomerAccentColor: r.default_customer_accent_color ?? "",
    upgradeViewsToTrigger: r.upgrade_views_to_trigger == null ? null : Number(r.upgrade_views_to_trigger),
    upgradeMinDaysBetween: r.upgrade_min_days_between == null ? null : Number(r.upgrade_min_days_between),
    upgradeIdleSeconds: r.upgrade_idle_seconds == null ? null : Number(r.upgrade_idle_seconds),
    reminderIntervalDays: r.reminder_interval_days == null ? null : Number(r.reminder_interval_days),
    reminderLastSentAt: r.reminder_last_sent_at ?? null,
    createdAt: r.created_at,
  };
}

export async function getUserByEmail(email: string): Promise<(AppUser & { passwordHash: string }) | null> {
  if (!hasDatabase()) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM app_users WHERE email = $1 AND deleted_at IS NULL`, [normalizeEmail(email)]);
  if (!rows[0]) return null;
  return { ...rowToUser(rows[0]), passwordHash: rows[0].password_hash };
}

export async function getUserById(id: string): Promise<(AppUser & { passwordHash: string }) | null> {
  if (!hasDatabase() || !id) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM app_users WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!rows[0]) return null;
  return { ...rowToUser(rows[0]), passwordHash: rows[0].password_hash };
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  await ensureTables();
  await getPool().query(`UPDATE app_users SET password_hash = $1 WHERE id = $2`, [
    hashPassword(newPassword),
    userId,
  ]);
}

// Change the account's email. Throws a Postgres unique-violation (code 23505)
// if the new address is already taken.
export async function updateEmail(userId: string, newEmail: string): Promise<void> {
  await ensureTables();
  await getPool().query(`UPDATE app_users SET email = $1 WHERE id = $2`, [
    normalizeEmail(newEmail),
    userId,
  ]);
}

export async function createUser(email: string, password: string, partnerId?: string | null): Promise<AppUser> {
  await ensureTables();
  const pool = getPool();
  const id = randomUUID();
  const owner = isOwnerEmail(email);
  const { rows } = await pool.query(
    `INSERT INTO app_users (id, email, password_hash, is_owner, partner_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, normalizeEmail(email), hashPassword(password), owner, partnerId || null]
  );
  return rowToUser(rows[0]);
}

/**
 * Create a realtor account on behalf of a partner/admin (import or manual add).
 * The account is created ALREADY VERIFIED and with NO password — the widget
 * works immediately, and the realtor sets a password the first time they sign
 * in to the app (an empty hash can never authenticate; see verifyPassword).
 */
export async function createManagedUser(input: {
  email: string;
  partnerId?: string | null;
  realtorName?: string;
  businessName?: string;
}): Promise<AppUser> {
  await ensureTables();
  const pool = getPool();
  const id = randomUUID();
  const owner = isOwnerEmail(input.email);
  const { rows } = await pool.query(
    `INSERT INTO app_users (id, email, password_hash, email_verified, is_owner, partner_id, company_name, business_name)
     VALUES ($1,$2,'',TRUE,$3,$4,$5,$6) RETURNING *`,
    [
      id,
      normalizeEmail(input.email),
      owner,
      input.partnerId || null,
      (input.realtorName || "").trim(),
      (input.businessName ?? input.realtorName ?? "").trim(),
    ]
  );
  return rowToUser(rows[0]);
}

/** Read an owner/partner's preferred default widget accent color for new customers. */
export async function getCustomerDefaultAccentColor(userId: string): Promise<string> {
  if (!hasDatabase() || !userId) return "";
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT default_customer_accent_color FROM app_users WHERE id = $1`,
    [userId]
  );
  return String(rows[0]?.default_customer_accent_color || "").trim();
}

/** Save an owner/partner's preferred default widget accent color (or "" to reset). */
export async function setCustomerDefaultAccentColor(userId: string, color: string): Promise<void> {
  if (!hasDatabase() || !userId) return;
  await ensureTables();
  await getPool().query(
    `UPDATE app_users SET default_customer_accent_color = $1 WHERE id = $2`,
    [String(color || "").trim(), userId]
  );
}

/** Owner/partner's editable intro text for the "manage your School Explorer" email ("" = default). */
export async function getCustomerLoginEmailText(userId: string): Promise<string> {
  if (!hasDatabase() || !userId) return "";
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT customer_login_email_text FROM app_users WHERE id = $1`,
    [userId]
  );
  return String(rows[0]?.customer_login_email_text || "");
}

export async function setCustomerLoginEmailText(userId: string, text: string): Promise<void> {
  if (!hasDatabase() || !userId) return;
  await ensureTables();
  await getPool().query(
    `UPDATE app_users SET customer_login_email_text = $1 WHERE id = $2`,
    [String(text || ""), userId]
  );
}

/** True when the account has never set a password (managed/imported realtor). */
export function isPasswordless(passwordHash: string | null | undefined): boolean {
  return !String(passwordHash || "").trim();
}

export async function setUserPartner(userId: string, partnerId: string | null): Promise<void> {
  await ensureTables();
  await getPool().query(`UPDATE app_users SET partner_id = $1 WHERE id = $2`, [partnerId, userId]);
}

export async function updatePartnerProfile(userId: string, companyName: string): Promise<void> {
  await ensureTables();
  await getPool().query(`UPDATE app_users SET company_name = $1 WHERE id = $2`, [companyName.trim(), userId]);
}

/** Realtor Name for customer accounts — stored in company_name (partners use that column for Partner Name). */
export async function updateRealtorProfile(userId: string, realtorName: string): Promise<void> {
  await updatePartnerProfile(userId, realtorName);
}

export async function updateBusinessProfile(userId: string, businessName: string): Promise<void> {
  await ensureTables();
  await getPool().query(`UPDATE app_users SET business_name = $1 WHERE id = $2`, [businessName.trim(), userId]);
}

/**
 * Partner branding used when a realtor leaves White Label blank:
 * partner white-label first, then partner company name.
 */
export async function getPartnerBranding(
  partnerId: string | null
): Promise<{ whiteLabel: string; partnerName: string; inheritedWhiteLabel: string }> {
  if (!partnerId || !hasDatabase()) {
    return { whiteLabel: "", partnerName: "", inheritedWhiteLabel: "" };
  }
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT company_name, business_name FROM app_users WHERE id = $1 AND deleted_at IS NULL`,
    [partnerId]
  );
  const partnerName = String(rows[0]?.company_name || "").trim();
  const whiteLabel = String(rows[0]?.business_name || "").trim();
  return {
    whiteLabel,
    partnerName,
    inheritedWhiteLabel: whiteLabel || partnerName,
  };
}

export async function updatePartnerUpgradeSettings(
  userId: string,
  values: { viewsToTrigger: number | null; minDaysBetween: number | null; idleSeconds: number | null }
): Promise<void> {
  await ensureTables();
  // null clears the override (falls back to global); otherwise clamp to the
  // allowed range so a partner can never exceed the maximums.
  const clamp = (key: UpgradePromptLimitKey, v: number | null): number | null => {
    if (v == null || !Number.isFinite(v)) return null;
    const { min, max } = UPGRADE_PROMPT_LIMITS[key];
    return Math.max(min, Math.min(max, Math.floor(v)));
  };
  await getPool().query(
    `UPDATE app_users
       SET upgrade_views_to_trigger = $1,
           upgrade_min_days_between = $2,
           upgrade_idle_seconds = $3
     WHERE id = $4`,
    [
      clamp("viewsToTrigger", values.viewsToTrigger),
      clamp("minDaysBetween", values.minDaysBetween),
      clamp("idleSeconds", values.idleSeconds),
      userId,
    ]
  );
}

export type TokenPurpose = "verify" | "reset";

// A one-time magic-link token; returns the RAW token to embed in the email URL.
export async function createToken(userId: string, purpose: TokenPurpose = "verify"): Promise<string> {
  await ensureTables();
  const pool = getPool();
  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFY_TTL_HOURS * 3600 * 1000);
  await pool.query(
    `INSERT INTO app_verify_tokens (token_hash, user_id, expires_at, purpose) VALUES ($1,$2,$3,$4)`,
    [sha256(raw), userId, expires, purpose]
  );
  return raw;
}

export function createVerificationToken(userId: string): Promise<string> {
  return createToken(userId, "verify");
}

export function createResetToken(userId: string): Promise<string> {
  return createToken(userId, "reset");
}

// Consume a one-time token of the given purpose; returns its user id (or null).
async function consumeToken(raw: string, purpose: TokenPurpose): Promise<string | null> {
  if (!hasDatabase() || !raw) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(
    `DELETE FROM app_verify_tokens
       WHERE token_hash = $1 AND purpose = $2 AND expires_at > NOW()
       RETURNING user_id`,
    [sha256(raw), purpose]
  );
  return rows[0]?.user_id ?? null;
}

// Consume a verification token: mark the user verified, delete the token, and
// return the user (or null if invalid/expired).
export async function consumeVerificationToken(raw: string): Promise<AppUser | null> {
  const userId = await consumeToken(raw, "verify");
  if (!userId) return null;
  const upd = await getPool().query(
    `UPDATE app_users SET email_verified = TRUE WHERE id = $1 RETURNING *`,
    [userId]
  );
  return upd.rows[0] ? rowToUser(upd.rows[0]) : null;
}

// Consume a reset token and return the user. Receiving the reset email proves
// ownership, so we also mark the address verified.
export async function consumeResetToken(raw: string): Promise<AppUser | null> {
  const userId = await consumeToken(raw, "reset");
  if (!userId) return null;
  const upd = await getPool().query(
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

// Self-service soft-disable: the account owner disables their own login. The row
// is retained (deleted_at set) so an admin can re-enable it. All of the account's
// sessions are also destroyed so they are signed out everywhere.
export async function disableOwnAccount(userId: string): Promise<boolean> {
  if (!hasDatabase() || !userId) return false;
  await ensureTables();
  const pool = getPool();
  const res = await pool.query(
    `UPDATE app_users SET deleted_at = COALESCE(deleted_at, NOW())
      WHERE id = $1 AND deleted_at IS NULL AND is_owner = FALSE`,
    [userId]
  );
  if ((res.rowCount ?? 0) === 0) return false;
  // Match admin disable: turn off the widget so deleted accounts stop serving
  // embed/popup traffic immediately (re-enable on admin restore when domain set).
  await pool
    .query(`UPDATE embed_partners SET enabled = FALSE, updated_at = NOW() WHERE partner_id = $1`, [userId])
    .catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE user_id = $1`, [userId]).catch(() => {});
  return true;
}

export async function getUserBySession(raw: string | undefined | null): Promise<AppUser | null> {
  if (!hasDatabase() || !raw) return null;
  await ensureTables();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.* FROM app_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
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

// The public origin for building email links / redirects. Behind Heroku's router
// request.url is the internal dyno address, so prefer APP_URL or the forwarded host.
export function publicOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "app.dreamneighborhoodschools.com";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
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

// Cookie holding the impersonator's own session token during impersonation.
export function impersonatorCookie(value: string, maxAgeSeconds = SESSION_TTL_DAYS * 24 * 3600) {
  return {
    name: IMPERSONATOR_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function impersonatorTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)dn_imp=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** The impersonator (partner/admin) behind the current session, if any. */
export async function impersonatorFromRequest(request: Request): Promise<AppUser | null> {
  const token = impersonatorTokenFromRequest(request);
  if (!token) return null;
  return getUserBySession(token);
}
