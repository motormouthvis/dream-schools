import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getUpgradeDigestSchedule, setUpgradeDigestSchedule } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  return NextResponse.json({ schedule: await getUpgradeDigestSchedule() });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  let body: { digestIntervalWeeks?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const schedule = await setUpgradeDigestSchedule(Number(body.digestIntervalWeeks || 1));
  return NextResponse.json({ ok: true, schedule });
}
