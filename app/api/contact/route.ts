import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sendContactMessage } from "@/lib/email";

export const dynamic = "force-dynamic";

// Contact form → emails support (Reply-To = the sender). Requires a signed-in
// user to keep it abuse-resistant.
export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { email?: string; message?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || me.email).trim();
  const message = String(body.message || "").trim();
  const phone = String(body.phone || "").trim();
  if (message.length < 2) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  try {
    await sendContactMessage(email, message, phone || undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact send failed:", err);
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 });
  }
}
