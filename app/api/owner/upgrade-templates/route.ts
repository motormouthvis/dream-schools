import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import {
  listUpgradeEmailTemplates,
  saveUpgradeEmailTemplate,
  type UpgradeDigestVariant,
} from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  return NextResponse.json({ templates: await listUpgradeEmailTemplates() });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const variant = (String(body.variant || "").trim() || `custom_${Date.now()}`) as UpgradeDigestVariant;
  const template = await saveUpgradeEmailTemplate({
    variant,
    label: String(body.label || (variant.startsWith("custom_") ? "Custom template" : "")),
    subject: String(body.subject || ""),
    intro: String(body.intro || ""),
    ctaText: String(body.ctaText || ""),
    ctaUrl: String(body.ctaUrl || ""),
    updatedAt: null,
  });
  return NextResponse.json({ ok: true, template });
}
