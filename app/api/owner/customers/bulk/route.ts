import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  requireCustomerListAccess,
  getCustomerScope,
  deleteCustomer,
  purgeCustomer,
} from "@/lib/owner";
import type { AppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Bulk actions over multiple customers from the Customer List.
//
//   POST /api/owner/customers/bulk  { action: "disable" | "delete", ids: string[], reason? }
//
// - "disable": soft-disable (reversible). Admins any non-admin; partners only
//   their own customers.
// - "delete": permanent hard delete. Admins only.

const MAX_IDS = 500;

// Can this actor act on this target account?
function authorize(actor: AppUser, scope: { partnerId: string | null; isOwner: boolean; isPartner: boolean }, targetId: string): string | null {
  if (targetId === actor.id) return "You can't act on your own account.";
  if (scope.isOwner) return "Can't act on an admin account.";
  if (actor.isOwner) return null; // admins may act on any non-admin
  // Partner: only their own (non-partner) customers.
  if (scope.partnerId !== actor.id || scope.isPartner) return "Not authorized for this customer.";
  return null;
}

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }
  const actor = await requireCustomerListAccess(request);
  if (!actor) {
    return NextResponse.json({ error: "Customer List access required." }, { status: 403 });
  }

  let body: { action?: string; ids?: unknown; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = body.action === "delete" ? "delete" : body.action === "disable" ? "disable" : null;
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((x) => String(x || "").trim()).filter(Boolean)))
    : [];
  if (!ids.length) return NextResponse.json({ error: "Select at least one customer." }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Too many at once (max ${MAX_IDS}).` }, { status: 400 });
  }

  // Permanent delete is admin-only.
  if (action === "delete" && !actor.isOwner) {
    return NextResponse.json({ error: "Admin access required to delete." }, { status: 403 });
  }

  const reason = String(body.reason || "").trim() || undefined;
  const results: { id: string; ok: boolean; reason?: string }[] = [];
  let ok = 0;

  for (const id of ids) {
    const scope = await getCustomerScope(id);
    if (!scope) {
      results.push({ id, ok: false, reason: "Not found." });
      continue;
    }
    const denied = authorize(actor, scope, id);
    if (denied) {
      results.push({ id, ok: false, reason: denied });
      continue;
    }
    try {
      if (action === "disable") {
        const done = await deleteCustomer(id, reason);
        results.push({ id, ok: done, reason: done ? undefined : "Already disabled." });
        if (done) ok += 1;
      } else {
        const res = await purgeCustomer(id);
        results.push({ id, ok: res.ok, reason: res.ok ? undefined : res.reason });
        if (res.ok) ok += 1;
      }
    } catch (err) {
      console.error(`bulk ${action} failed for ${id}:`, err);
      results.push({ id, ok: false, reason: "Server error." });
    }
  }

  return NextResponse.json({
    action,
    ok,
    failed: results.length - ok,
    results,
  });
}
