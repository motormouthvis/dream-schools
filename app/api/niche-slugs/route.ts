import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { adminPasswordConfigured, isAuthorized } from "@/lib/embedAuth";
import { importNicheSlugs, countNicheSlugs } from "@/lib/nicheSlugs";

export const dynamic = "force-dynamic";

// Validated Niche school-slug set, populated from Niche's sitemap by the local
// importer (tools/niche_sitemap_import.py). Same shared-secret auth as the embed
// admin (EMBED_ADMIN_PASSWORD).
//
//   GET  /api/niche-slugs                      → { count }
//   POST /api/niche-slugs  { slugs, replace? } → import a batch

function guard(request: Request): NextResponse | null {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "Not configured. Set EMBED_ADMIN_PASSWORD." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "A database is required (set DATABASE_URL)." },
      { status: 503 }
    );
  }
  return null;
}

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ count: 0, database: false });
  try {
    const count = await countNicheSlugs();
    return NextResponse.json({ count, database: true });
  } catch (err) {
    console.error("niche-slugs count failed:", err);
    return NextResponse.json({ error: "Failed to count." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: { slugs?: unknown; replace?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.slugs)) {
    return NextResponse.json({ error: "Provide { slugs: string[] }" }, { status: 400 });
  }
  if (body.slugs.length > 20000) {
    return NextResponse.json(
      { error: "Batch too large; send <= 20000 slugs per request." },
      { status: 413 }
    );
  }
  try {
    const result = await importNicheSlugs(
      body.slugs.map((s) => String(s)),
      body.replace === true
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("niche-slugs import failed:", err);
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
