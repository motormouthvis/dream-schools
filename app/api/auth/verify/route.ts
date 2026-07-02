import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { consumeVerificationToken, createSession, sessionCookie, publicOrigin } from "@/lib/auth";
import { logUserEventAsync } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Magic-link target. Verifies the email, logs the user in, and sends them to
// onboarding. Invalid/expired links bounce to login with an error.
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!hasDatabase()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }
  try {
    const user = await consumeVerificationToken(token);
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=verify`);
    }
    logUserEventAsync(user.id, "email_verified");
    const session = await createSession(user.id);
    const res = NextResponse.redirect(`${origin}/onboarding`);
    res.cookies.set(sessionCookie(session));
    return res;
  } catch (err) {
    console.error("verify failed:", err);
    return NextResponse.redirect(`${origin}/login?error=verify`);
  }
}
