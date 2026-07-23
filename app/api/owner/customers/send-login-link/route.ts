import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { requireCustomerListAccess, getCustomerScope } from "@/lib/owner";
import {
  getUserById,
  createResetToken,
  publicOrigin,
  getCustomerLoginEmailText,
  type AppUser,
} from "@/lib/auth";
import { getByPartner } from "@/lib/embedConfig";
import { sendCustomerLoginLinkEmail } from "@/lib/customerLoginEmail";
import { logUserEventAsync } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Email one or more customers a secure "manage your School Explorer" link
// (set-password + sign-in). Single send = one id; bulk = many.
//
//   POST /api/owner/customers/send-login-link  { ids: string[] }

const MAX_IDS = 500;

function authorize(
  actor: AppUser,
  scope: { partnerId: string | null; isOwner: boolean; isPartner: boolean },
  targetId: string
): string | null {
  if (targetId === actor.id) return "That's your own account.";
  if (scope.isOwner) return "Can't send to an admin account.";
  if (actor.isOwner) return null; // admins may send to any non-admin
  if (scope.partnerId !== actor.id || scope.isPartner) return "Not authorized for this customer.";
  return null;
}

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }
  const actor = await requireCustomerListAccess(request);
  if (!actor) {
    return NextResponse.json({ error: "Customer List access required." }, { status: 403 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((x) => String(x || "").trim()).filter(Boolean)))
    : [];
  if (!ids.length) return NextResponse.json({ error: "Select at least one customer." }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Too many at once (max ${MAX_IDS}).` }, { status: 400 });
  }

  const origin = publicOrigin(request);
  // Cache the intro text / provider name per source account (partner or admin).
  const sourceCache = new Map<string, { providerName: string; introText: string }>();
  async function source(sourceId: string) {
    let s = sourceCache.get(sourceId);
    if (!s) {
      const u = await getUserById(sourceId);
      const providerName = (u?.businessName || u?.companyName || "").trim();
      const introText = await getCustomerLoginEmailText(sourceId);
      s = { providerName, introText };
      sourceCache.set(sourceId, s);
    }
    return s;
  }

  const results: { id: string; ok: boolean; reason?: string }[] = [];
  let ok = 0;

  for (const id of ids) {
    const scope = await getCustomerScope(id);
    if (!scope) {
      results.push({ id, ok: false, reason: "Not found." });
      continue;
    }
    const denied = authorize(actor, scope, id);
    if (denied) {
      results.push({ id, ok: false, reason: denied });
      continue;
    }
    try {
      const user = await getUserById(id);
      if (!user?.email) {
        results.push({ id, ok: false, reason: "No email on file." });
        continue;
      }
      const sourceId = scope.partnerId || actor.id;
      const { providerName, introText } = await source(sourceId);
      const token = await createResetToken(id);
      const ctaUrl = `${origin}/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
      let domain = "";
      try {
        const cfg = await getByPartner(id, 1);
        domain = cfg?.allowedHosts?.[0] || "";
      } catch {
        /* domain is optional */
      }
      await sendCustomerLoginLinkEmail({
        to: user.email,
        customerName: user.companyName || "",
        providerName,
        introText,
        ctaUrl,
        domain,
      });
      logUserEventAsync(id, "password_reset", `login link sent by ${actor.isOwner ? "admin" : "partner"} (${actor.email})`);
      results.push({ id, ok: true });
      ok += 1;
    } catch (err) {
      console.error(`send-login-link failed for ${id}:`, err);
      results.push({ id, ok: false, reason: "Send failed." });
    }
  }

  return NextResponse.json({ ok, failed: results.length - ok, results });
}
