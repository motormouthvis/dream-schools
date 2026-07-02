import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import {
  listUpgradeRequests,
  sendUpgradeDigestNow,
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
  const includeSent = new URL(request.url).searchParams.get("include_sent") === "1";
  const requests = await listUpgradeRequests({ includeSent });
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  let body: { variant?: UpgradeDigestVariant };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const variant = body.variant || "soft_nudge";
  if (!["soft_nudge", "strong_sales", "partner_summary", "admin_summary"].includes(variant)) {
    return NextResponse.json({ error: "Invalid template variant." }, { status: 400 });
  }
  const result = await sendUpgradeDigestNow(variant);
  return NextResponse.json({ ok: true, ...result });
}
