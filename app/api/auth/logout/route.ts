import { NextResponse } from "next/server";
import { deleteSession, sessionTokenFromRequest, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = sessionTokenFromRequest(request);
    if (token) await deleteSession(token);
  } catch {
    /* ignore */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
