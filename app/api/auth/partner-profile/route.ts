import { NextResponse } from "next/server";
import { currentUser, updatePartnerProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isPartner && !me.isOwner) {
    return NextResponse.json({ error: "Partner account required." }, { status: 403 });
  }

  let body: { companyName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const companyName = String(body.companyName || "").trim();
  if (companyName.length > 120) {
    return NextResponse.json({ error: "Company name is too long." }, { status: 400 });
  }
  await updatePartnerProfile(me.id, companyName);
  return NextResponse.json({ ok: true, companyName });
}
