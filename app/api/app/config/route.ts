import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import {
  getByPartner,
  upsertPartner,
  claimHostForPartner,
  hostsClaimedByOthers,
  normalizeHost,
  DEFAULT_PRESENTATION,
} from "@/lib/embedConfig";
import { getUsage } from "@/lib/embedUsage";

export const dynamic = "force-dynamic";

// The signed-in user's own School Explorer config. Keyed by the user id as the
// partner id, so the public per-host resolver keeps working unchanged.

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: "Database required." }, { status: 503 });
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const config = await getByPartner(user.id, 1);
  const usage = await getUsage(user.id, 1);
  return NextResponse.json({
    email: user.email,
    config: config ?? { ...DEFAULT_PRESENTATION, allowedHosts: [], defaultAddress: "", enabled: false },
    usage,
  });
}

export async function POST(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: "Database required." }, { status: 503 });
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const existing = await getByPartner(user.id, 1);
  // Authorized domain: accept a single base domain; the SDK matches all
  // sub-paths and (via parent-domain matching) subdomains of it.
  const domainRaw = body.authorizedDomain;
  const allowedHosts =
    domainRaw !== undefined
      ? [normalizeHost(String(domainRaw))].filter(Boolean)
      : existing?.allowedHosts ?? [];

  // A domain can only belong to one account.
  if (allowedHosts.length) {
    const taken = await hostsClaimedByOthers(allowedHosts, user.id);
    if (taken.length) {
      return NextResponse.json(
        {
          error: `${taken.join(", ")} is already registered to another account. Each domain can belong to only one account.`,
        },
        { status: 409 }
      );
    }
  }

  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);

  const p = existing ?? { ...DEFAULT_PRESENTATION, defaultAddress: "", enabled: false };

  const saved = await upsertPartner({
    partnerId: user.id,
    widgetNumber: 1,
    allowedHosts,
    defaultAddress: str(body.defaultAddress, existing?.defaultAddress ?? ""),
    accentColor: str(body.accentColor, p.accentColor),
    position: str(body.position, p.position),
    bottomOffset: num(body.bottomOffset, p.bottomOffset),
    tooltipMessage: str(body.tooltipMessage, p.tooltipMessage),
    requireAddress: bool(body.requireAddress, p.requireAddress),
    searchPageContent: bool(body.searchPageContent, p.searchPageContent),
    suppressIfNeighborhoodExplorer: bool(body.suppressIfNeighborhoodExplorer, p.suppressIfNeighborhoodExplorer),
    inlineMinHeight: num(body.inlineMinHeight, p.inlineMinHeight),
    inlineShowHeader: bool(body.inlineShowHeader, p.inlineShowHeader),
    showExternalLinks: bool(body.showExternalLinks, p.showExternalLinks),
    // The popup only turns on once a domain is authorized.
    enabled: allowedHosts.length > 0 ? bool(body.enabled, true) : false,
  });
  // Take over any stale legacy `host:` registration for these domains.
  if (allowedHosts.length) {
    await claimHostForPartner(user.id, allowedHosts).catch((err) =>
      console.error("claimHostForPartner failed:", err)
    );
  }
  return NextResponse.json({ ok: true, config: saved });
}
