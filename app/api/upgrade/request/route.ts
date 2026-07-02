import { NextResponse } from "next/server";
import { recordUpgradeRequest } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const customerId = String(body.customerId || "").trim();
  if (!customerId) return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  await recordUpgradeRequest({
    customerId,
    partnerId: String(body.partnerId || "").trim() || null,
    providerName: String(body.providerName || "").trim(),
    requesterKey: String(body.requesterKey || "").trim(),
    address: String(body.address || "").trim(),
    source: String(body.source || "").trim(),
  });
  return NextResponse.json({ ok: true });
}
