import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getTodayStats, listReports, getReport, generateReport, deleteReport } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// Owner-only server management data.
//   GET                -> { stats (today), reports: [...] }
//   GET ?id=<reportId> -> { report }
//   POST { type }      -> generate + save a report, returns { report }
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (id) {
      const report = await getReport(id);
      if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      return NextResponse.json({ report });
    }
    const [stats, reports] = await Promise.all([getTodayStats(), listReports(100)]);
    return NextResponse.json({ stats, reports });
  } catch {
    return NextResponse.json({ error: "Failed to load server data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  let body: { type?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }
  const type = body.type === "monthly" ? "monthly" : "daily";
  try {
    const report = await generateReport(type);
    if (!report) return NextResponse.json({ error: "Reports require a database." }, { status: 503 });
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing report id." }, { status: 400 });
  try {
    const ok = await deleteReport(id);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: "Failed to delete report." }, { status: 500 });
  }
}
