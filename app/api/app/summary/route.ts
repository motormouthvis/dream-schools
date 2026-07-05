import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPool, hasDatabase } from "@/lib/db";
import { getByPartner } from "@/lib/embedConfig";
import { getUsage } from "@/lib/embedUsage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: "Database required." }, { status: 503 });
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const pool = getPool();
  const config = await getByPartner(user.id, 1);
  const usage = await getUsage(user.id, 1);

  // Detection status for the signed-in account's own widget (shown on Configure
  // Explorer for every role — admins/partners can also install the widget).
  const detection = {
    enabled: Boolean(config?.enabled),
    detected: Boolean(usage.firstSeen || usage.lastSeen),
    firstSeen: usage.firstSeen,
    lastSeen: usage.lastSeen,
    popupDetected: Boolean(usage.popupLastSeen),
    embedDetected: Boolean(usage.embedLastSeen),
    popupLastSeen: usage.popupLastSeen,
    embedLastSeen: usage.embedLastSeen,
  };

  if (user.isOwner) {
    const [customers, partners, views, requests] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM app_users WHERE deleted_at IS NULL AND is_partner = FALSE AND is_owner = FALSE`),
      pool.query(`SELECT COUNT(*)::int AS n FROM app_users WHERE deleted_at IS NULL AND is_partner = TRUE`),
      pool.query(
        `SELECT COALESCE(SUM(usg.views), 0)::bigint AS n
           FROM app_users u
           JOIN embed_usage usg ON usg.partner_id = u.id
          WHERE u.is_partner = FALSE`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n
           FROM app_upgrade_requests r
           JOIN app_users u ON u.id = r.customer_id
          WHERE u.is_partner = FALSE`
      ),
    ]);
    return NextResponse.json({
      role: "admin",
      createdAt: user.createdAt,
      domain: config?.allowedHosts?.[0] ?? "",
      active: Boolean(config?.enabled && config?.allowedHosts?.length),
      ...detection,
      metrics: {
        customers: customers.rows[0].n,
        partners: partners.rows[0].n,
        views: Number(views.rows[0].n) || 0,
        requests: requests.rows[0].n,
      },
    });
  }

  if (user.isPartner) {
    const [customers, views, requests] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM app_users WHERE deleted_at IS NULL AND partner_id = $1`, [user.id]),
      pool.query(
        `SELECT COALESCE(SUM(usg.views), 0)::bigint AS n
           FROM app_users u
           JOIN embed_usage usg ON usg.partner_id = u.id
          WHERE u.partner_id = $1`,
        [user.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n
           FROM app_upgrade_requests r
           JOIN app_users u ON u.id = r.customer_id
          WHERE u.partner_id = $1`,
        [user.id]
      ),
    ]);
    return NextResponse.json({
      role: "partner",
      createdAt: user.createdAt,
      domain: config?.allowedHosts?.[0] ?? "",
      active: Boolean(config?.enabled && config?.allowedHosts?.length),
      ...detection,
      metrics: {
        customers: customers.rows[0].n,
        views: Number(views.rows[0].n) || 0,
        requests: requests.rows[0].n,
      },
    });
  }

  const requests = await pool.query(`SELECT COUNT(*)::int AS n FROM app_upgrade_requests WHERE customer_id = $1`, [user.id]);
  return NextResponse.json({
    role: "customer",
    createdAt: user.createdAt,
    domain: config?.allowedHosts?.[0] ?? "",
    active: Boolean(config?.enabled && config?.allowedHosts?.length),
    ...detection,
    metrics: {
      views: usage.views,
      requests: requests.rows[0].n,
    },
  });
}
