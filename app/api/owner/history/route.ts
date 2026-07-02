import { NextResponse } from "next/server";
import { getPool, hasDatabase } from "@/lib/db";
import { requireCustomerListAccess } from "@/lib/owner";
import { getUserEvents } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Owner-only: the account history (creation + email/password changes) for one
// customer. GET /api/owner/history?id=<userId>
export async function GET(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }
  const viewer = await requireCustomerListAccess(request);
  if (!viewer) return NextResponse.json({ error: "Customer List access required." }, { status: 403 });

  const id = (new URL(request.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Customer id is required." }, { status: 400 });

  try {
    const { rows } = await getPool().query(`SELECT email, created_at, partner_id FROM app_users WHERE id = $1`, [id]);
    const user = rows[0];
    if (!user) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    if (!viewer.isOwner && user.partner_id !== viewer.id) {
      return NextResponse.json({ error: "Not authorized for this customer." }, { status: 403 });
    }
    const events = await getUserEvents(id);
    // Backfill: guarantee an "account created" entry for accounts that predate
    // the audit log (or where the create event wasn't recorded).
    if (!events.some((e) => e.event === "account_created")) {
      events.unshift({ event: "account_created", detail: null, createdAt: user.created_at });
    }
    return NextResponse.json({ email: user.email, events });
  } catch (err) {
    console.error("owner history failed:", err);
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 });
  }
}
