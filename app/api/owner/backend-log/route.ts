import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { listBackendEvents } from "@/lib/backendLog";

export const dynamic = "force-dynamic";

// Owner-only: recent backend-health events (provider fallbacks, etc.).
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }
  try {
    const events = await listBackendEvents(300);
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
