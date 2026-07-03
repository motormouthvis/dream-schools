import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  isValidEmail,
  getUserByEmail,
  getUserById,
  createUser,
  setUserPartner,
  verifyPassword,
  createSession,
  sessionCookie,
  createVerificationToken,
  publicOrigin,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { logUserEventAsync } from "@/lib/audit";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  let body: { email?: string; password?: string; partner?: string; turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const partnerId = String(body.partner || "").trim() || null;
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (!(await verifyTurnstile(String(body.turnstileToken || ""), ip))) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }
  try {
    const existing = await getUserByEmail(email);
    // Account already exists → do NOT create a duplicate or spam verify emails.
    if (existing) {
      const passwordOk = verifyPassword(password, existing.passwordHash);
      if (existing.emailVerified) {
        // Verified: correct password logs in; otherwise ask them to log in.
        if (!passwordOk) {
          return NextResponse.json(
            { error: "An account with this email already exists. Enter the account password to log in." },
            { status: 401 }
          );
        }
        const session = await createSession(existing.id);
        const res = NextResponse.json({ ok: true, loggedIn: true, isOwner: existing.isOwner });
        res.cookies.set(sessionCookie(session));
        return res;
      }
      // Unverified: only (re)send verification to the genuine owner (correct
      // password). A wrong password never triggers a verification email.
      if (!passwordOk) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists but isn't verified yet. Log in with the original password, or use “Forgot password?” to set a new one.",
          },
          { status: 401 }
        );
      }
      if (partnerId && !existing.partnerId) {
        const partner = await getUserById(partnerId);
        if (partner?.isPartner) await setUserPartner(existing.id, partner.id);
      }
      const token = await createVerificationToken(existing.id);
      await sendVerificationEmail(email, `${publicOrigin(request)}/api/auth/verify?token=${token}`);
      return NextResponse.json({ ok: true, message: "Check your email to verify your account." });
    }

    // Brand-new account.
    let validPartnerId: string | null = null;
    if (partnerId) {
      const partner = await getUserById(partnerId);
      if (partner?.isPartner) validPartnerId = partner.id;
    }
    const user = await createUser(email, password, validPartnerId);
    logUserEventAsync(user.id, "account_created");
    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(email, `${publicOrigin(request)}/api/auth/verify?token=${token}`);
    return NextResponse.json({ ok: true, message: "Check your email to verify your account." });
  } catch (err) {
    console.error("signup failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
