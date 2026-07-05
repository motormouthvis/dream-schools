import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sendPartnerRealtorEmail } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

// Partner/admin sends a reminder or special-offer email to one of their realtors.
export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isOwner && !me.isPartner) {
    return NextResponse.json({ error: "Admin or partner access required." }, { status: 403 });
  }
  let body: { realtorId?: string; kind?: string; offerText?: string; discountCode?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const realtorId = String(body.realtorId || "").trim();
  const kind = body.kind === "offer" ? "offer" : "reminder";
  if (!realtorId) return NextResponse.json({ error: "Select a realtor." }, { status: 400 });
  try {
    const result = await sendPartnerRealtorEmail({
      viewer: me,
      realtorId,
      kind,
      offerText: String(body.offerText || ""),
      discountCode: String(body.discountCode || ""),
      preview: Boolean(body.preview),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not send the email." }, { status: 400 });
  }
}
