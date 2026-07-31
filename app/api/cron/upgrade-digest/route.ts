import { NextResponse } from "next/server";
import { runScheduledUpgradeDigest, runDueCustomerReminders } from "@/lib/upgradePrompt";
import { runDnIngest } from "@/lib/dnIngest";

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
  // Piggyback the DN push on whatever schedule already calls this, so "at least
  // daily" holds even if nobody adds a second Heroku Scheduler entry. Rate
  // limited internally, and a DN failure must not fail the digest run.
  const dnIngest = await runDnIngest().catch((err) => ({
    ran: false,
    skippedReason: err instanceof Error ? err.message : String(err),
  }));
  return NextResponse.json({ ok: true, digest, reminders, dnIngest });
}

export async function POST(request: Request) {
  return GET(request);
}
