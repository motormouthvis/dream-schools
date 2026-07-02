import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  currentUser,
  getUserById,
  getUserByEmail,
  verifyPassword,
  updateEmail,
  isValidEmail,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Change the signed-in user's email. Requires the current password (email is
// the login identity), and enforces uniqueness.
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { newEmail?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const newEmail = String(body.newEmail || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const full = await getUserById(me.id);
    if (!full || !verifyPassword(password, full.passwordHash)) {
      return NextResponse.json({ error: "Your password is incorrect." }, { status: 400 });
    }
    if (newEmail === full.email) {
      return NextResponse.json({ ok: true, email: newEmail });
    }
    const taken = await getUserByEmail(newEmail);
    if (taken) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    await updateEmail(me.id, newEmail);
    return NextResponse.json({ ok: true, email: newEmail });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    console.error("change-email failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
