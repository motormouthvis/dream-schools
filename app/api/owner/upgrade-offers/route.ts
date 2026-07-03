import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listUpgradeOfferEmails, sendUpgradeOfferEmail } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

async function managerGuard(request: Request) {
  const user = await currentUser(request);
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!user.isOwner && !user.isPartner) {
    return { error: NextResponse.json({ error: "Admin or partner access required." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const g = await managerGuard(request);
  if (g.error) return g.error;
  return NextResponse.json({ emails: await listUpgradeOfferEmails(g.user!) });
}

export async function POST(request: Request) {
  const g = await managerGuard(request);
  if (g.error) return g.error;
  let body: { customerId?: string; offerText?: string; discountCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const customerId = String(body.customerId || "").trim();
  const offerText = String(body.offerText || "").trim();
  const discountCode = String(body.discountCode || "").trim();
  if (!customerId) return NextResponse.json({ error: "Select a customer." }, { status: 400 });
  if (!offerText) return NextResponse.json({ error: "Offer text is required." }, { status: 400 });
  try {
    const result = await sendUpgradeOfferEmail({ viewer: g.user!, customerId, offerText, discountCode });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not send offer email." }, { status: 400 });
  }
}
