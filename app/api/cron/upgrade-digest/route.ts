import { NextResponse } from "next/server";
import { runScheduledUpgradeDigest, runDueCustomerReminders } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const digest = await runScheduledUpgradeDigest();
  const reminders = await runDueCustomerReminders();
  return NextResponse.json({ ok: true, digest, reminders });
}

export async function POST(request: Request) {
  return GET(request);
}
