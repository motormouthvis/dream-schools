import { NextResponse } from "next/server";
import {
  currentUser,
  getCustomerDefaultAccentColor,
  setCustomerDefaultAccentColor,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  if (v === "") return ""; // reset to system default
  const hex = v.startsWith("#") ? v : `#${v}`;
  if (!HEX.test(hex)) return null;
  return hex.toLowerCase();
}

export async function GET(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!me.isOwner && !me.isPartner) {
    return NextResponse.json({ error: "Admin or Partner account required." }, { status: 403 });
  }
  const accentColor = await getCustomerDefaultAccentColor(me.id);
  return NextResponse.json({ accentColor });
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
  const color = normalizeColor(body.accentColor);
  if (color === null) {
    return NextResponse.json({ error: "Enter a valid hex color like #1fa55f." }, { status: 400 });
  }
  await setCustomerDefaultAccentColor(me.id, color);
  return NextResponse.json({ ok: true, accentColor: color });
}
