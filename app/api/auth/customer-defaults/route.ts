import { NextResponse } from "next/server";
import {
  currentUser,
  getCustomerDefaultAccentColor,
  setCustomerDefaultAccentColor,
  getCustomerLoginEmailText,
  setCustomerLoginEmailText,
} from "@/lib/auth";
import { DEFAULT_CUSTOMER_LOGIN_INTRO } from "@/lib/customerLoginEmail";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_INTRO = 1200;

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
  const [accentColor, loginEmailText] = await Promise.all([
    getCustomerDefaultAccentColor(me.id),
    getCustomerLoginEmailText(me.id),
  ]);
  return NextResponse.json({
    accentColor,
    loginEmailText,
    defaultLoginEmailText: DEFAULT_CUSTOMER_LOGIN_INTRO,
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

  if ("accentColor" in body) {
    const color = normalizeColor(body.accentColor);
    if (color === null) {
      return NextResponse.json({ error: "Enter a valid hex color like #1fa55f." }, { status: 400 });
    }
    await setCustomerDefaultAccentColor(me.id, color);
  }

  if ("loginEmailText" in body) {
    const text = String(body.loginEmailText ?? "").slice(0, MAX_INTRO);
    await setCustomerLoginEmailText(me.id, text);
  }

  const [accentColor, loginEmailText] = await Promise.all([
    getCustomerDefaultAccentColor(me.id),
    getCustomerLoginEmailText(me.id),
  ]);
  return NextResponse.json({ ok: true, accentColor, loginEmailText });
}
