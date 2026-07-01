import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { consumeVerificationToken, createSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Magic-link target. Verifies the email, logs the user in, and sends them to
// onboarding. Invalid/expired links bounce to login with an error.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!hasDatabase()) {
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }
  try {
    const user = await consumeVerificationToken(token);
    if (!user) {
      return NextResponse.redirect(new URL("/login?error=verify", url.origin));
    }
    const session = await createSession(user.id);
    const res = NextResponse.redirect(new URL("/onboarding", url.origin));
    res.cookies.set(sessionCookie(session));
    return res;
  } catch (err) {
    console.error("verify failed:", err);
    return NextResponse.redirect(new URL("/login?error=verify", url.origin));
  }
}
