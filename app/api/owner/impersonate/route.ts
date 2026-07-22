import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { requireCustomerListAccess, getCustomerScope } from "@/lib/owner";
import {
  createSession,
  sessionCookie,
  impersonatorCookie,
  sessionTokenFromRequest,
  impersonatorTokenFromRequest,
} from "@/lib/auth";
import { logUserEventAsync } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Start impersonating a realtor so a partner/admin can configure their account.
//   POST /api/owner/impersonate  { customerId }
// Swaps dn_sess to the target and stashes the actor's own session in dn_imp.
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }
  const actor = await requireCustomerListAccess(request);
  if (!actor) {
    return NextResponse.json({ error: "Customer List access required." }, { status: 403 });
  }
  // Block nested "View as": once impersonating a partner (who has Customer List
  // access), the impersonated session could otherwise start another impersonation
  // and clobber the original actor's stashed session. Exit first.
  if (impersonatorTokenFromRequest(request)) {
    return NextResponse.json(
      { error: "You're already viewing as another account. Exit that first." },
      { status: 400 }
    );
  }

  let body: { customerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const customerId = String(body.customerId || "").trim();
  if (!customerId) return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  if (customerId === actor.id) {
    return NextResponse.json({ error: "You can't impersonate your own account." }, { status: 400 });
  }

  // Authorize: admins may impersonate any non-admin (customers AND partners);
  // partners only their own realtors (never another partner or admin).
  const scope = await getCustomerScope(customerId);
  if (!scope) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  if (scope.isOwner) {
    return NextResponse.json({ error: "You can't impersonate an admin." }, { status: 403 });
  }
  if (!actor.isOwner) {
    if (scope.partnerId !== actor.id || scope.isPartner) {
      return NextResponse.json({ error: "Not authorized for this customer." }, { status: 403 });
    }
  }

  const myToken = sessionTokenFromRequest(request) || "";
  const targetToken = await createSession(customerId);
  logUserEventAsync(customerId, "impersonation_started", `by ${actor.email}`);

  const res = NextResponse.json({ ok: true, redirect: "/dashboard" });
  res.cookies.set(sessionCookie(targetToken));
  if (myToken) res.cookies.set(impersonatorCookie(myToken));
  return res;
}

// Stop impersonating: restore the actor's session and drop the realtor session.
//   DELETE /api/owner/impersonate
export async function DELETE(request: Request) {
  const impToken = impersonatorTokenFromRequest(request);
  const currentToken = sessionTokenFromRequest(request);
  const res = NextResponse.json({ ok: true, redirect: "/owner" });
  if (impToken) {
    res.cookies.set(sessionCookie(impToken));
  }
  // Best-effort cleanup of the short-lived impersonation session.
  if (currentToken && currentToken !== impToken) {
    const { deleteSession } = await import("@/lib/auth");
    await deleteSession(currentToken).catch(() => {});
  }
  res.cookies.set({ ...impersonatorCookie("", 0), maxAge: 0 });
  return res;
}
