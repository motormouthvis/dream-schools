import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { currentUser } from "@/lib/auth";
import {
  listUpgradeRequests,
  sendUpgradeDigestNow,
  getUpgradeDigestSchedule,
  type UpgradeDigestVariant,
} from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  return null;
}

async function listGuard(request: Request) {
  const user = await currentUser(request);
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  return { user };
}

export async function GET(request: Request) {
  const g = await listGuard(request);
  if (g.error) return g.error;
  const includeSent = new URL(request.url).searchParams.get("include_sent") === "1";
  const requests = await listUpgradeRequests({ includeSent, viewer: g.user });
  const schedule = await getUpgradeDigestSchedule();
  return NextResponse.json({ requests, schedule, canSend: g.user!.isOwner });
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
  const result = await sendUpgradeDigestNow(variant);
  return NextResponse.json({ ok: true, ...result });
}
