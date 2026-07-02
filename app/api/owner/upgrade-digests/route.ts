import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getSentDigestEmail, listSentDigestEmails, sendDigestCopy } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const id = Number(new URL(request.url).searchParams.get("id") || 0);
  if (id) {
    const email = await getSentDigestEmail(id);
    if (!email) return NextResponse.json({ error: "Sent email not found." }, { status: 404 });
    return NextResponse.json({ email });
  }
  return NextResponse.json({ emails: await listSentDigestEmails() });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  let body: { id?: number; to?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = Number(body.id || 0);
  const to = String(body.to || "").trim();
  if (!id || !to) return NextResponse.json({ error: "id and to are required." }, { status: 400 });
  await sendDigestCopy(id, to);
  return NextResponse.json({ ok: true });
}
