import { NextResponse } from "next/server";
import { currentUser, isValidEmail } from "@/lib/auth";
import { sendContactMessage } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/**
 * Public contact / feedback / data-correction inbox.
 *
 * - Signed-in users: allowed without Turnstile.
 * - Anonymous (www visitors): Turnstile required when enforced.
 */
export async function POST(request: Request) {
  let body: {
    email?: string;
    message?: string;
    phone?: string;
    name?: string;
    kind?: string;
    topic?: string;
    schoolName?: string;
    ncesId?: string;
    address?: string;
    url?: string;
    turnstileToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const me = await currentUser(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (!me) {
    if (!(await verifyTurnstile(String(body.turnstileToken || ""), ip))) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }
  }

  const email = String(body.email || me?.email || "")
    .trim()
    .toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const message = String(body.message || "").trim();
  if (message.length < 5) {
    return NextResponse.json({ error: "Please enter a more detailed message." }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const kindRaw = String(body.kind || body.topic || "contact")
    .trim()
    .toLowerCase();
  const kind =
    kindRaw === "feedback" || kindRaw === "data-error" || kindRaw === "contact" ? kindRaw : "contact";

  const phone = String(body.phone || "").trim().slice(0, 40);
  const name = String(body.name || "").trim().slice(0, 120);
  const schoolName = String(body.schoolName || "").trim().slice(0, 200);
  const ncesId = String(body.ncesId || "").trim().slice(0, 40);
  const address = String(body.address || "").trim().slice(0, 300);
  const pageUrl = String(body.url || "").trim().slice(0, 500);

  const extraLines = [
    name ? `Name: ${name}` : "",
    schoolName ? `School: ${schoolName}` : "",
    ncesId ? `NCES ID: ${ncesId}` : "",
    address ? `Address context: ${address}` : "",
    pageUrl ? `Page: ${pageUrl}` : "",
    me ? `Signed-in user id: ${me.id}` : "Visitor: anonymous (www/public form)",
  ].filter(Boolean);

  try {
    await sendContactMessage(email, message, phone || undefined, {
      kind,
      extraLines,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact send failed:", err);
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 });
  }
}
