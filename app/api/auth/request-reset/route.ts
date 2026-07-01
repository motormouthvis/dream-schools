import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { isValidEmail, getUserByEmail, createResetToken, publicOrigin } from "@/lib/auth";
import { sendResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Start a password reset. Always returns a generic success so we never reveal
// whether an email is registered.
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  try {
    const user = await getUserByEmail(email);
    if (user) {
      const token = await createResetToken(user.id);
      await sendResetEmail(email, `${publicOrigin(request)}/reset?token=${token}`);
    }
  } catch (err) {
    console.error("request-reset failed:", err);
    // Fall through to the generic response either way.
  }
  return NextResponse.json({ ok: true });
}
