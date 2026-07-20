import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { getUserByEmail, verifyPassword, createSession, sessionCookie, isPasswordless } from "@/lib/auth";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  let body: { email?: string; password?: string; turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (!(await verifyTurnstile(String(body.turnstileToken || ""), ip))) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }
  try {
    const user = await getUserByEmail(email);
    // Managed/imported realtors have no password yet — guide them to set one
    // (rather than a confusing "incorrect password"). The account is already
    // verified and their widget already works.
    if (user && isPasswordless(user.passwordHash)) {
      return NextResponse.json(
        {
          error: "Your account is ready — set a password to sign in. We'll email you a secure link.",
          needsPassword: true,
        },
        { status: 403 }
      );
    }
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Please verify your email first — check your inbox for the link.", needsVerification: true },
        { status: 403 }
      );
    }
    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, isOwner: user.isOwner });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (err) {
    console.error("login failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
