import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  isValidEmail,
  getUserByEmail,
  createUser,
  createVerificationToken,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

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
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  try {
    const existing = await getUserByEmail(email);
    if (existing && existing.emailVerified) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }
    // New user, or an unverified one re-signing up → (re)send the verification link.
    const user = existing ?? (await createUser(email, password));
    const token = await createVerificationToken(user.id);
    const origin = new URL(request.url).origin;
    await sendVerificationEmail(email, `${origin}/api/auth/verify?token=${token}`);
    return NextResponse.json({ ok: true, message: "Check your email to verify your account." });
  } catch (err) {
    console.error("signup failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
