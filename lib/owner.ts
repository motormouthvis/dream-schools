import { getPool, hasDatabase } from "@/lib/db";
import { currentUser, type AppUser } from "@/lib/auth";
import { logUserEventAsync } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Owner-admin data access: the customers table with signup + usage, and the
// edit/delete operations behind /api/owner/*. Each customer's widget config is
// keyed by their user id (partner_id = app_users.id, widget_number = 1), so a
// LEFT JOIN across app_users / embed_partners / embed_usage yields one row per
// customer with everything the owner needs.
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id: string;
  email: string;
  emailVerified: boolean;
  isOwner: boolean;
  isPartner: boolean;
  partnerId: string | null;
  partnerName: string | null;
  companyName: string;
  createdAt: string;
  deletedAt: string | null;
  authorizedDomain: string | null;
  enabled: boolean;
  defaultAddress: string;
  views: number;
  firstSeen: string | null; // popup/embed code first detected
  lastSeen: string | null; // last active
}

/** Verify the request is from a signed-in owner; returns the owner or null. */
export async function requireOwner(request: Request): Promise<AppUser | null> {
  const user = await currentUser(request);
  return user && user.isOwner ? user : null;
}

export async function requireCustomerListAccess(request: Request): Promise<AppUser | null> {
  const user = await currentUser(request);
  return user && (user.isOwner || user.isPartner) ? user : null;
}

export async function listCustomers(viewer?: AppUser | null): Promise<CustomerRow[]> {
  if (!hasDatabase()) return [];
  const pool = getPool();
  const params: unknown[] = [];
  const where = viewer && !viewer.isOwner && viewer.isPartner ? `WHERE u.partner_id = $1` : "";
  if (where) params.push(viewer!.id);
  const { rows } = await pool.query(
    `SELECT
        u.id,
        u.email,
        u.email_verified,
        u.is_owner,
        u.is_partner,
        u.partner_id,
        u.company_name,
        u.created_at,
        u.deleted_at,
        partner.company_name AS partner_company_name,
        partner.email AS partner_email,
        p.allowed_hosts,
        p.enabled,
        p.default_address,
        usg.views,
        usg.first_seen,
        usg.last_seen
      FROM app_users u
      LEFT JOIN app_users partner
        ON partner.id = u.partner_id
      LEFT JOIN embed_partners p
        ON p.partner_id = u.id AND p.widget_number = 1
      LEFT JOIN embed_usage usg
        ON usg.partner_id = u.id AND usg.widget_number = 1
      ${where}
      ORDER BY (u.deleted_at IS NOT NULL) ASC, u.created_at DESC`
    , params
  );
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    emailVerified: Boolean(r.email_verified),
    isOwner: Boolean(r.is_owner),
    isPartner: Boolean(r.is_partner),
    partnerId: r.partner_id ?? null,
    partnerName: r.partner_company_name || r.partner_email || null,
    companyName: r.company_name ?? "",
    createdAt: r.created_at,
    deletedAt: r.deleted_at ?? null,
    authorizedDomain:
      Array.isArray(r.allowed_hosts) && r.allowed_hosts.length ? r.allowed_hosts[0] : null,
    enabled: Boolean(r.enabled),
    defaultAddress: r.default_address ?? "",
    views: Number(r.views) || 0,
    firstSeen: r.first_seen ?? null,
    lastSeen: r.last_seen ?? null,
  }));
}

export async function listPartnerAccounts(): Promise<{ id: string; email: string; companyName: string }[]> {
  if (!hasDatabase()) return [];
  const { rows } = await getPool().query(
    `SELECT id, email, company_name
       FROM app_users
      WHERE is_partner = TRUE AND deleted_at IS NULL
      ORDER BY COALESCE(NULLIF(company_name, ''), email)`
  );
  return rows.map((r: any) => ({ id: r.id, email: r.email, companyName: r.company_name ?? "" }));
}

/** Update the account-level fields on a customer (email / owner flag). */
export async function updateCustomerAccount(
  id: string,
  fields: { email?: string; isOwner?: boolean; isPartner?: boolean; partnerId?: string | null; companyName?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof fields.email === "string") {
    params.push(fields.email.trim().toLowerCase());
    sets.push(`email = $${params.length}`);
  }
  if (typeof fields.isOwner === "boolean") {
    params.push(fields.isOwner);
    sets.push(`is_owner = $${params.length}`);
  }
  if (typeof fields.isPartner === "boolean") {
    params.push(fields.isPartner);
    sets.push(`is_partner = $${params.length}`);
  }
  if ("partnerId" in fields) {
    params.push(fields.partnerId || null);
    sets.push(`partner_id = $${params.length}`);
  }
  if (typeof fields.companyName === "string") {
    params.push(fields.companyName.trim());
    sets.push(`company_name = $${params.length}`);
  }
  if (!sets.length) return;
  params.push(id);
  await getPool().query(`UPDATE app_users SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

/** Disable a customer: retain account/config/usage/history, remove access. */
export async function deleteCustomer(id: string, reason?: string): Promise<boolean> {
  if (!hasDatabase() || !id) return false;
  const pool = getPool();
  const res = await pool.query(
    `UPDATE app_users
       SET deleted_at = COALESCE(deleted_at, NOW()), is_owner = FALSE
       WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  await pool.query(`UPDATE embed_partners SET enabled = FALSE, updated_at = NOW() WHERE partner_id = $1`, [id]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE user_id = $1`, [id]).catch(() => {});
  await pool.query(`DELETE FROM app_verify_tokens WHERE user_id = $1`, [id]).catch(() => {});
  if ((res.rowCount ?? 0) > 0) logUserEventAsync(id, "account_deleted", reason || null);
  return (res.rowCount ?? 0) > 0;
}

/** Re-enable a disabled customer. If they have a domain, turn the Explorer back on too. */
export async function restoreCustomer(id: string, reason?: string): Promise<boolean> {
  if (!hasDatabase() || !id) return false;
  const pool = getPool();
  const res = await pool.query(
    `UPDATE app_users SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id]
  );
  if ((res.rowCount ?? 0) > 0) {
    await pool.query(
      `UPDATE embed_partners
         SET enabled = TRUE, updated_at = NOW()
       WHERE partner_id = $1
         AND array_length(allowed_hosts, 1) > 0`,
      [id]
    ).catch(() => {});
  }
  if ((res.rowCount ?? 0) > 0) logUserEventAsync(id, "account_restored", reason || null);
  return (res.rowCount ?? 0) > 0;
}
