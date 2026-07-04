import { NextResponse } from "next/server";
import { currentUser, disableOwnAccount, sessionTokenFromRequest, deleteSession, SESSION_COOKIE } from "@/lib/auth";
import { logUserEventAsync } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Self-service account deletion. This soft-disables the account (sets deleted_at)
// so the user can no longer sign in, but the record is retained and an admin can
// re-enable it later.
export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.isOwner) {
    return NextResponse.json({ error: "Owner accounts cannot be deleted here." }, { status: 403 });
  }
  const ok = await disableOwnAccount(me.id);
  if (!ok) return NextResponse.json({ error: "Could not delete your account." }, { status: 400 });
  logUserEventAsync(me.id, "account_deleted", "Self-service delete from Account Settings");
  try {
    const token = sessionTokenFromRequest(request);
    if (token) await deleteSession(token);
  } catch {
    /* ignore */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
