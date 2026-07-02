import { getPool, hasDatabase } from "@/lib/db";
import { currentUser, type AppUser } from "@/lib/auth";
import { deleteUsage } from "@/lib/embedUsage";
import { deletePartner } from "@/lib/embedConfig";
import { deleteUserEvents } from "@/lib/audit";

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
  createdAt: string;
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

export async function listCustomers(): Promise<CustomerRow[]> {
  if (!hasDatabase()) return [];
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
        u.id,
        u.email,
        u.email_verified,
        u.is_owner,
        u.created_at,
        p.allowed_hosts,
        p.enabled,
        p.default_address,
        usg.views,
        usg.first_seen,
        usg.last_seen
      FROM app_users u
      LEFT JOIN embed_partners p
        ON p.partner_id = u.id AND p.widget_number = 1
      LEFT JOIN embed_usage usg
        ON usg.partner_id = u.id AND usg.widget_number = 1
      ORDER BY u.created_at DESC`
  );
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    emailVerified: Boolean(r.email_verified),
    isOwner: Boolean(r.is_owner),
    createdAt: r.created_at,
    authorizedDomain:
      Array.isArray(r.allowed_hosts) && r.allowed_hosts.length ? r.allowed_hosts[0] : null,
    enabled: Boolean(r.enabled),
    defaultAddress: r.default_address ?? "",
    views: Number(r.views) || 0,
    firstSeen: r.first_seen ?? null,
    lastSeen: r.last_seen ?? null,
  }));
}

/** Update the account-level fields on a customer (email / owner flag). */
export async function updateCustomerAccount(
  id: string,
  fields: { email?: string; isOwner?: boolean }
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
  if (!sets.length) return;
  params.push(id);
  await getPool().query(`UPDATE app_users SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

/** Delete a customer and everything owned by them (config, usage, sessions). */
export async function deleteCustomer(id: string): Promise<boolean> {
  if (!hasDatabase() || !id) return false;
  const pool = getPool();
  // Widget config, usage, and audit events aren't FK-linked to app_users, so
  // clear them first.
  await deletePartner(id, 1).catch(() => {});
  await deleteUsage(id).catch(() => {});
  await deleteUserEvents(id).catch(() => {});
  // Sessions & verify tokens cascade via ON DELETE CASCADE.
  const res = await pool.query(`DELETE FROM app_users WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
