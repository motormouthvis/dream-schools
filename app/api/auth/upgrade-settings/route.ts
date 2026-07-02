import { NextResponse } from "next/server";
import { currentUser, updatePartnerUpgradeSettings } from "@/lib/auth";
import { getGlobalUpgradeSettings, setGlobalUpgradeSettings } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

function nullableInt(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

export async function GET(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const global = await getGlobalUpgradeSettings();
  return NextResponse.json({
    global,
    partnerOverride: {
      viewsToTrigger: me.upgradeViewsToTrigger,
      minDaysBetween: me.upgradeMinDaysBetween,
      idleSeconds: me.upgradeIdleSeconds,
    },
  });
}

export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isOwner && !me.isPartner) {
    return NextResponse.json({ error: "Admin or Partner account required." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const values = {
    viewsToTrigger: Number(body.viewsToTrigger),
    minDaysBetween: Number(body.minDaysBetween),
    idleSeconds: Number(body.idleSeconds),
  };

  if (me.isOwner && body.scope !== "partner") {
    const saved = await setGlobalUpgradeSettings(values);
    return NextResponse.json({ ok: true, global: saved });
  }

  await updatePartnerUpgradeSettings(me.id, {
    viewsToTrigger: nullableInt(body.viewsToTrigger),
    minDaysBetween: nullableInt(body.minDaysBetween),
    idleSeconds: nullableInt(body.idleSeconds),
  });
  return NextResponse.json({ ok: true });
}
