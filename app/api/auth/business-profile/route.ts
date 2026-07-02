import { NextResponse } from "next/server";
import { currentUser, updateBusinessProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { businessName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const businessName = String(body.businessName || "").trim();
  if (businessName.length > 120) {
    return NextResponse.json({ error: "Business/agent name is too long." }, { status: 400 });
  }
  await updateBusinessProfile(me.id, businessName);
  return NextResponse.json({ ok: true, businessName });
}
