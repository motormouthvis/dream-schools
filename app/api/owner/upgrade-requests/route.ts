import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { currentUser } from "@/lib/auth";
import {
  listUpgradeRequests,
  getUpgradeRequestSummary,
  getUpgradeRequestSeries,
  sendUpgradeDigestNow,
  getUpgradeDigestSchedule,
  type UpgradeDigestVariant,
} from "@/lib/upgradePrompt";

const INCLUDE_SENT_LIMIT = 200;
const SCOPED_LIMIT = 2000;

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
  // Admins can see every customer's requests (potentially huge), so cap their
  // list. A scoped viewer (partner/realtor) only sees their own, so allow more.
  const effectiveLimit = g.user!.isOwner ? INCLUDE_SENT_LIMIT : SCOPED_LIMIT;
  const requests = await listUpgradeRequests({
    includeSent,
    viewer: g.user,
    limit: includeSent ? effectiveLimit : undefined,
  });
  const schedule = await getUpgradeDigestSchedule();
  const summary = await getUpgradeRequestSummary(g.user);
  const series = await getUpgradeRequestSeries(g.user);
  return NextResponse.json({
    requests,
    schedule,
    summary,
    series,
    limit: effectiveLimit,
    truncated: includeSent && requests.length >= effectiveLimit,
    canSend: g.user!.isOwner,
  });
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
