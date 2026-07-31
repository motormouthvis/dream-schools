import { NextResponse } from "next/server";
import { runDnIngest } from "@/lib/dnIngest";

export const dynamic = "force-dynamic";

// Push usage + upgrade requests to Dream Neighborhood. Call at least daily
// (Heroku Scheduler); /api/cron/upgrade-digest also piggybacks on this, subject
// to DN_INGEST_MIN_INTERVAL_HOURS.
//
//   GET /api/cron/dn-ingest?secret=<CRON_SECRET>[&force=1][&dry=1]
//
// `dry=1` builds and counts the payloads without contacting DN — useful for
// checking what would be sent before an API key exists.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const summary = await runDnIngest({
    force: url.searchParams.get("force") === "1",
    dryRun: url.searchParams.get("dry") === "1",
  });
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}
