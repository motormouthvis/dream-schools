import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getReminderSettings, setReminderInterval, sendCustomerReminder } from "@/lib/upgradePrompt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const settings = await getReminderSettings(me.id);
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const me = await currentUser(request);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { intervalDays?: number; send?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.intervalDays !== "undefined") {
    const days = await setReminderInterval(me.id, Number(body.intervalDays));
    if (!body.send) return NextResponse.json({ ok: true, intervalDays: days });
  }
  if (body.send) {
    const result = await sendCustomerReminder(me.id, { manual: true });
    return NextResponse.json({ ok: true, ...result });
  }
  return NextResponse.json({ ok: true });
}
