import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { currentUser, getUserById, verifyPassword, updatePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Change the signed-in user's password (requires the current password).
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Accounts require a database." }, { status: 503 });
  }
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const full = await getUserById(me.id);
    if (!full || !verifyPassword(currentPassword, full.passwordHash)) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
    await updatePassword(me.id, newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("change-password failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
