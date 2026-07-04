import { NextResponse } from "next/server";
import { hasDatabase, getPool } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getUserEvents } from "@/lib/audit";

export const dynamic = "force-dynamic";

// The signed-in user's own account history (creation + email/password/config
// changes). GET /api/app/history
export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: "Database required." }, { status: 503 });
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const events = await getUserEvents(me.id);
    if (!events.some((e) => e.event === "account_created")) {
      const { rows } = await getPool().query(`SELECT created_at FROM app_users WHERE id = $1`, [me.id]);
      events.unshift({ event: "account_created", detail: null, createdAt: rows[0]?.created_at ?? me.createdAt ?? new Date().toISOString() });
    }
    return NextResponse.json({ events });
  } catch (err) {
    console.error("app history failed:", err);
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 });
  }
}
