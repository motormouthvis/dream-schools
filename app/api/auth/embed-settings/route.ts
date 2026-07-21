import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  getEmbedGlobalSettings,
  setEmbedGlobalSettings,
  NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN,
  NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX,
} from "@/lib/embedSettings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isOwner) {
    return NextResponse.json({ error: "Admin account required." }, { status: 403 });
  }
  const settings = await getEmbedGlobalSettings();
  return NextResponse.json({
    ...settings,
    limits: {
      neighborhoodExplorerGraceMs: {
        min: NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN,
        max: NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX,
      },
    },
  });
}

export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isOwner) {
    return NextResponse.json({ error: "Admin account required." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const saved = await setEmbedGlobalSettings({
    neighborhoodExplorerGraceMs: Number(body.neighborhoodExplorerGraceMs),
  });
  return NextResponse.json({ ok: true, ...saved });
}
