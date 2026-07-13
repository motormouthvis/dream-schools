import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { sessionCookie } from "@/lib/auth";
import {
  smokeSecretConfigured,
  smokeSecretMatches,
  ensureSmokeAdmin,
  provisionSmokeUser,
  loginAsUser,
  SMOKE_ADMIN_EMAIL,
  type SmokeProvisionRole,
} from "@/lib/smoke";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Smoke test access denied." }, { status: 403 });
}

function readSecret(request: Request, body?: Record<string, unknown>): string | null {
  const header = request.headers.get("x-smoke-secret");
  if (header) return header;
  const url = new URL(request.url);
  const q = url.searchParams.get("key");
  if (q) return q;
  if (body && typeof body.key === "string") return body.key;
  return null;
}

/**
 * Passwordless smoke-admin login + account provisioning for production smoke tests.
 *
 *   GET  /api/auth/smoke?key=SECRET           → log in as smoke admin (sets dn_sess)
 *   POST /api/auth/smoke { key, action, ... } → provision / login
 *
 * Disabled unless SMOKE_TEST_SECRET is set on the dyno.
 */
export async function GET(request: Request) {
  if (!hasDatabase() || !smokeSecretConfigured()) {
    return NextResponse.json({ error: "Smoke testing is not enabled." }, { status: 404 });
  }
  if (!smokeSecretMatches(readSecret(request))) return unauthorized();

  try {
    const admin = await ensureSmokeAdmin();
    const session = await loginAsUser(admin.id);
    const res = NextResponse.json({
      ok: true,
      email: admin.email,
      id: admin.id,
      isOwner: true,
      message: "Signed in as smoke admin (no password).",
    });
    res.cookies.set(sessionCookie(session));
    return res;
  } catch (err) {
    console.error("smoke login failed:", err);
    return NextResponse.json({ error: "Smoke login failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasDatabase() || !smokeSecretConfigured()) {
    return NextResponse.json({ error: "Smoke testing is not enabled." }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!smokeSecretMatches(readSecret(request, body))) return unauthorized();

  const action = String(body.action || "login-admin").trim();

  try {
    if (action === "login-admin" || action === "ensure-admin") {
      const admin = await ensureSmokeAdmin();
      const session = await loginAsUser(admin.id);
      const res = NextResponse.json({
        ok: true,
        email: admin.email,
        id: admin.id,
        isOwner: true,
      });
      res.cookies.set(sessionCookie(session));
      return res;
    }

    if (action === "provision") {
      const role = String(body.role || "") as SmokeProvisionRole;
      if (role !== "partner" && role !== "realtor" && role !== "independent") {
        return NextResponse.json({ error: "role must be partner|realtor|independent" }, { status: 400 });
      }
      const user = await provisionSmokeUser({
        email: String(body.email || ""),
        password: String(body.password || ""),
        role,
        partnerId: body.partnerId ? String(body.partnerId) : null,
        companyName: body.companyName ? String(body.companyName) : "",
        businessName: body.businessName ? String(body.businessName) : "",
      });
      // Optionally sign in as the provisioned user.
      if (body.login === true) {
        const session = await loginAsUser(user.id);
        const res = NextResponse.json({ ok: true, user });
        res.cookies.set(sessionCookie(session));
        return res;
      }
      return NextResponse.json({ ok: true, user });
    }

    if (action === "login-as") {
      const email = String(body.email || "").trim().toLowerCase();
      const { getUserByEmail } = await import("@/lib/auth");
      const user = await getUserByEmail(email);
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
      // Only smoke accounts (or the smoke admin) may be impersonated this way.
      const { isSmokeEmail } = await import("@/lib/smoke");
      if (!isSmokeEmail(user.email) && user.email !== SMOKE_ADMIN_EMAIL) {
        return NextResponse.json({ error: "Can only login-as smoke accounts." }, { status: 403 });
      }
      const session = await loginAsUser(user.id);
      const res = NextResponse.json({
        ok: true,
        email: user.email,
        id: user.id,
        isOwner: user.isOwner,
        isPartner: user.isPartner,
      });
      res.cookies.set(sessionCookie(session));
      return res;
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("smoke provision failed:", err);
    return NextResponse.json({ error: err?.message || "Smoke action failed." }, { status: 500 });
  }
}
