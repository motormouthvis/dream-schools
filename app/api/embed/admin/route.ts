import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { adminPasswordConfigured, isAuthorized } from "@/lib/embedAuth";
import {
  deletePartner,
  listPartners,
  upsertPartner,
  type PartnerUpsert,
} from "@/lib/embedConfig";

export const dynamic = "force-dynamic";

// Password-protected CRUD for partner widget configs. Same-origin only (the
// admin page lives on this site), so no CORS headers are emitted here.
//
//   GET    /api/embed/admin                 → list all partner configs
//   POST   /api/embed/admin   { ...config } → create / update a partner
//   DELETE /api/embed/admin?partner=&widget_number=  → delete a partner

function guard(request: Request): NextResponse | null {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "Admin is not configured. Set EMBED_ADMIN_PASSWORD." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "A database is required for the admin (set DATABASE_URL)." },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    const partners = await listPartners();
    return NextResponse.json({ partners });
  } catch (err) {
    console.error("embed admin list failed:", err);
    return NextResponse.json({ error: "Failed to list partners." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: PartnerUpsert;
  try {
    body = (await request.json()) as PartnerUpsert;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.partnerId || !String(body.partnerId).trim()) {
    return NextResponse.json({ error: "partnerId is required" }, { status: 400 });
  }
  try {
    const partner = await upsertPartner(body);
    return NextResponse.json({ partner });
  } catch (err) {
    console.error("embed admin upsert failed:", err);
    return NextResponse.json({ error: "Failed to save partner." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { searchParams } = new URL(request.url);
  const partnerId = (searchParams.get("partner") || "").trim();
  const widgetNumber = Number.parseInt(searchParams.get("widget_number") || "1", 10);
  if (!partnerId) {
    return NextResponse.json({ error: "partner query parameter is required" }, { status: 400 });
  }
  try {
    const deleted = await deletePartner(partnerId, Number.isFinite(widgetNumber) ? widgetNumber : 1);
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("embed admin delete failed:", err);
    return NextResponse.json({ error: "Failed to delete partner." }, { status: 500 });
  }
}
