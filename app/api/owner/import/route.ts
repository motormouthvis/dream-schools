import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  requireCustomerListAccess,
  createManagedCustomer,
  type ManagedCustomerInput,
  type ManagedCustomerResult,
} from "@/lib/owner";

export const dynamic = "force-dynamic";

// Partner/admin bulk import + manual add of realtor accounts.
//
//   POST /api/owner/import
//   { rows: [{ email, name, authorizedDomain, defaultAddress }], partnerId? }
//
// Each account is created VERIFIED + ACTIVE with no password. Partners always
// create under their own account; admins may target a partner via body.partnerId.

const MAX_ROWS = 500;

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }
  const actor = await requireCustomerListAccess(request);
  if (!actor) {
    return NextResponse.json({ error: "Customer List access required." }, { status: 403 });
  }

  let body: { rows?: unknown; partnerId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (!rawRows.length) {
    return NextResponse.json({ error: "Add at least one realtor (email required)." }, { status: 400 });
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Please import at most ${MAX_ROWS} rows at a time.` }, { status: 400 });
  }

  // Partners can only create under themselves; admins may target a partner.
  const by = actor.isOwner ? "admin" : "partner";
  const targetPartnerId = actor.isOwner
    ? String(body.partnerId || "").trim() || null
    : actor.id;

  const rows: ManagedCustomerInput[] = rawRows.map((r: any) => ({
    email: String(r?.email ?? "").trim(),
    name: String(r?.name ?? r?.customerName ?? "").trim(),
    authorizedDomain: String(r?.authorizedDomain ?? r?.domain ?? "").trim(),
    defaultAddress: String(r?.defaultAddress ?? r?.address ?? "").trim(),
  }));

  const results: ManagedCustomerResult[] = [];
  // De-dupe emails within the batch so we don't create + then "skip" the same one.
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (key && seen.has(key)) {
      results.push({ email: row.email, status: "skipped", reason: "Duplicate row in this import" });
      continue;
    }
    if (key) seen.add(key);
    try {
      results.push(await createManagedCustomer(row, targetPartnerId, by));
    } catch (err: any) {
      if (err?.code === "23505") {
        results.push({ email: row.email, status: "skipped", reason: "An account with this email already exists" });
      } else {
        console.error("import row failed:", err);
        results.push({ email: row.email, status: "error", reason: "Could not create this account" });
      }
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ ok: true, created, skipped, errored, results });
}
