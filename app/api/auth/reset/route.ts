import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  consumeResetToken,
  updatePassword,
  createSession,
  sessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Complete a password reset: consume the token, set the new password, and sign
// the user in.
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  try {
    const user = await consumeResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }
    await updatePassword(user.id, password);
    const session = await createSession(user.id);
    const res = NextResponse.json({ ok: true, isOwner: user.isOwner });
    res.cookies.set(sessionCookie(session));
    return res;
  } catch (err) {
    console.error("reset failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
