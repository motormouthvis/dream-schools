import { NextResponse } from "next/server";
import { currentUser, updateRealtorProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Customer (realtor) accounts: save Realtor Name → company_name. */
export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.isPartner || me.isOwner) {
    return NextResponse.json(
      { error: "Realtor Name applies to realtor accounts. Partners use Partner Name." },
      { status: 403 }
    );
  }

  let body: { realtorName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const realtorName = String(body.realtorName || "").trim();
  if (realtorName.length > 120) {
    return NextResponse.json({ error: "Realtor name is too long." }, { status: 400 });
  }
  await updateRealtorProfile(me.id, realtorName);
  return NextResponse.json({ ok: true, realtorName });
}
