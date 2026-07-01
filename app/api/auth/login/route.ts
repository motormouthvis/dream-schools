import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { getUserByEmail, verifyPassword, createSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  try {
    const user = await getUserByEmail(email);
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
