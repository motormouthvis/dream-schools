import { randomBytes, randomUUID } from "crypto";
import { getPool, hasDatabase } from "@/lib/db";
import {
  ensureAuthTables,
  hashPassword,
  createSession,
  type AppUser,
} from "@/lib/auth";

/** Isolated smoke-test admin — passwordless login via /test only. */
export const SMOKE_ADMIN_EMAIL = "smoke-admin@dreamneighborhoodschools.com";

/** All automated smoke accounts live under this email prefix. */
export const SMOKE_EMAIL_PREFIX = "smoke-";
export const SMOKE_EMAIL_DOMAIN = "dreamneighborhoodschools.com";

export function smokeSecretConfigured(): boolean {
  return Boolean((process.env.SMOKE_TEST_SECRET || "").trim());
}

export function smokeSecretMatches(candidate: string | null | undefined): boolean {
  const expected = (process.env.SMOKE_TEST_SECRET || "").trim();
  if (!expected || !candidate) return false;
  return expected === String(candidate).trim();
}

export function isSmokeEmail(email: string): boolean {
  const e = String(email || "").trim().toLowerCase();
  return e.endsWith(`@${SMOKE_EMAIL_DOMAIN}`) && e.startsWith(SMOKE_EMAIL_PREFIX);
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
    upgradeViewsToTrigger: r.upgrade_views_to_trigger == null ? null : Number(r.upgrade_views_to_trigger),
    upgradeMinDaysBetween: r.upgrade_min_days_between == null ? null : Number(r.upgrade_min_days_between),
    upgradeIdleSeconds: r.upgrade_idle_seconds == null ? null : Number(r.upgrade_idle_seconds),
    reminderIntervalDays: r.reminder_interval_days == null ? null : Number(r.reminder_interval_days),
    reminderLastSentAt: r.reminder_last_sent_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Ensure the passwordless smoke admin exists (owner, verified).
 * Password hash is a random unusable value — login only via /test + SMOKE_TEST_SECRET.
 */
export async function ensureSmokeAdmin(): Promise<AppUser> {
  if (!hasDatabase()) throw new Error("Database required.");
  await ensureAuthTables();
  const pool = getPool();
  const email = SMOKE_ADMIN_EMAIL;
  const existing = await pool.query(`SELECT * FROM app_users WHERE email = $1`, [email]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE app_users
         SET deleted_at = NULL,
             email_verified = TRUE,
             is_owner = TRUE,
             is_partner = FALSE,
             partner_id = NULL,
             company_name = COALESCE(NULLIF(company_name, ''), 'Dream Neighborhood Smoke Admin')
       WHERE id = $1`,
      [existing.rows[0].id]
    );
    const refreshed = await pool.query(`SELECT * FROM app_users WHERE id = $1`, [existing.rows[0].id]);
    return rowToUser(refreshed.rows[0]);
  }
  const id = randomUUID();
  // Unusable password: random scrypt hash; no one knows the plaintext.
  const passwordHash = hashPassword(randomBytes(32).toString("hex"));
  const { rows } = await pool.query(
    `INSERT INTO app_users (id, email, password_hash, email_verified, is_owner, is_partner, company_name)
     VALUES ($1, $2, $3, TRUE, TRUE, FALSE, 'Dream Neighborhood Smoke Admin')
     RETURNING *`,
    [id, email, passwordHash]
  );
  return rowToUser(rows[0]);
}

export type SmokeProvisionRole = "partner" | "realtor" | "independent";

export interface SmokeProvisionInput {
  email: string;
  password: string;
  role: SmokeProvisionRole;
  /** Required when role is realtor (partner customer). */
  partnerId?: string | null;
  companyName?: string;
  businessName?: string;
}

/**
 * Create or reset a verified smoke test account. Only smoke-*@dreamneighborhoodschools.com emails.
 */
export async function provisionSmokeUser(input: SmokeProvisionInput): Promise<AppUser> {
  if (!hasDatabase()) throw new Error("Database required.");
  const email = String(input.email || "").trim().toLowerCase();
  if (!isSmokeEmail(email) || email === SMOKE_ADMIN_EMAIL) {
    throw new Error("Smoke provision only allows smoke-* customer emails (not the admin).");
  }
  if (!input.password || input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  await ensureAuthTables();
  const pool = getPool();
  const isPartner = input.role === "partner";
  const partnerId = input.role === "realtor" ? input.partnerId || null : null;
  if (input.role === "realtor" && !partnerId) {
    throw new Error("Realtor smoke accounts require partnerId.");
  }
  const companyName = (input.companyName || "").trim();
  const businessName = (input.businessName || "").trim();
  const passwordHash = hashPassword(input.password);

  const existing = await pool.query(`SELECT id FROM app_users WHERE email = $1`, [email]);
  if (existing.rows[0]) {
    const id = existing.rows[0].id as string;
    await pool.query(
      `UPDATE app_users
         SET password_hash = $1,
             email_verified = TRUE,
             deleted_at = NULL,
             is_owner = FALSE,
             is_partner = $2,
             partner_id = $3,
             company_name = $4,
             business_name = $5
       WHERE id = $6`,
      [passwordHash, isPartner, partnerId, companyName, businessName, id]
    );
    await pool.query(`DELETE FROM app_sessions WHERE user_id = $1`, [id]).catch(() => {});
    const refreshed = await pool.query(`SELECT * FROM app_users WHERE id = $1`, [id]);
    return rowToUser(refreshed.rows[0]);
  }

  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO app_users
       (id, email, password_hash, email_verified, is_owner, is_partner, partner_id, company_name, business_name)
     VALUES ($1,$2,$3,TRUE,FALSE,$4,$5,$6,$7)
     RETURNING *`,
    [id, email, passwordHash, isPartner, partnerId, companyName, businessName]
  );
  return rowToUser(rows[0]);
}

export async function loginAsUser(userId: string): Promise<string> {
  return createSession(userId);
}
