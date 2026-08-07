import { preflight, withCors } from "@/lib/embedCors";
import { getDnConfig, normalizeDnHost } from "@/lib/dnConfig";
import { recordUsageAsync } from "@/lib/embedUsage";

export const dynamic = "force-dynamic";

// LEGACY. Superseded by /api/embed/dn-config.
//
// Kept alive only for copies of embed.js still in browser caches: the bundle is
// served with `stale-while-revalidate=86400`, so a visitor can run a day-old
// copy that still calls this. Delete it once nothing has asked for a day, and
// not before.
//
// It relays Dream Neighborhood exactly as the new endpoint does, rather than
// answering from our own `embed_partners` table. Reading that table for one
// more day would mean sites on a cached bundle kept showing the wrong address
// and kept serving customers who had been switched off — the two bugs this
// whole change exists to fix, left running for the length of the transition.
//
// It answers in the OLD shape, because the old bundle is what reads it: an
// `enabled: false` body is what that bundle understands as "render nothing",
// where the new one reads a 404.

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = request.headers.get("origin") || "";
  let host = normalizeDnHost(searchParams.get("host") || "");
  if (origin) {
    try {
      host = normalizeDnHost(new URL(origin).hostname);
    } catch {
      /* keep the parameter */
    }
  }
  if (!host) {
    return withCors(request, { error: "host query parameter is required" }, { status: 400 });
  }

  const surfaceRaw = (searchParams.get("surface") || "").trim();
  const surface = surfaceRaw === "popup" || surfaceRaw === "embed" ? surfaceRaw : undefined;

  const result = await getDnConfig(host);
  if (result.outcome === "unknown" || result.outcome === "unavailable" || !result.body) {
    const res = withCors(request, { enabled: false, reason: "unknown_host" });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Local counting only, keyed on the hostname now that customer ids live in
  // DN. Nothing is pushed anywhere; DN counts views on its own resolve.
  recordUsageAsync(`host:${host}`, 1, surface);

  const body = result.body as Record<string, unknown>;
  const payload = {
    ...body,
    // The old bundle treats `enabled === false` as "disabled" and bails, so a
    // free schools customer — whom DN reports as enabled:false with
    // product:"school" — has to be reported as enabled here or their School
    // Explorer would vanish for the length of the transition.
    enabled: true,
    partnerId: `host:${host}`,
    widgetNumber: 1,
  };
  const res = withCors(request, payload);
  res.headers.set(
    "Cache-Control",
    result.outcome === "stale" ? "no-store" : "public, max-age=60, s-maxage=60"
  );
  return res;
}
