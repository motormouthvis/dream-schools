import { preflight, withCors } from "@/lib/embedCors";
import { flushDnConfigCache, getDnConfig, normalizeDnHost } from "@/lib/dnConfig";

export const dynamic = "force-dynamic";

// The customer, relayed from Dream Neighborhood.
//
//   GET /api/embed/dn-config?host=example.com
//
// The SDK asks us rather than asking DN directly, for one reason: the stale
// cache that keeps a customer's site alive through a DN outage has to live
// somewhere a first-time visitor can reach, and a visitor's own browser cache
// is empty by definition on their first page load.
//
// It stays one DN request per browser request, so DN's per-visitor view count
// is unaffected: we send the same `max-age=60` DN does, so a visitor moving
// between listings inside a minute never reaches us either.
//
//   200  the customer's configuration, verbatim from DN
//   404  not a customer, switched off, or offboarded — render nothing
//
// A 404 is cached for a minute and never served stale, so offboarding lands
// within the minute while DN is healthy, and a host we have never seen renders
// nothing during an outage rather than guessing.

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * The browser's own Origin is better evidence of which site this is than a
 * query parameter it also supplied, so prefer it. Same-origin callers (our demo
 * page) send no Origin and fall back to the parameter.
 */
function hostFor(request: Request, param: string): string {
  const origin = request.headers.get("origin") || "";
  if (origin) {
    try {
      return normalizeDnHost(new URL(origin).hostname);
    } catch {
      /* fall through to the parameter */
    }
  }
  return normalizeDnHost(param);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = hostFor(request, searchParams.get("host") || "");
  if (!host) {
    return withCors(request, { error: "host query parameter is required" }, { status: 400 });
  }

  const result = await getDnConfig(host);

  if (result.outcome === "live" || result.outcome === "stale") {
    const res = withCors(request, result.body ?? {});
    if (result.outcome === "stale") {
      // Running on a memory of DN. Don't let browsers hold it: the moment DN is
      // back we want the next page load to get the real answer.
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("X-DN-Config", `stale; age=${result.ageSeconds}`);
    } else {
      res.headers.set("Cache-Control", `public, max-age=60, s-maxage=60`);
      res.headers.set("X-DN-Config", "live");
    }
    return res;
  }

  const res = withCors(request, { error: "unknown host" }, { status: 404 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-DN-Config", result.outcome);
  return res;
}

/**
 * Flush, so DN can force an offboarding through without waiting out the minute.
 *
 *   POST /api/embed/dn-config?secret=<CRON_SECRET>[&host=example.com]
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const given = url.searchParams.get("secret") || request.headers.get("x-cron-secret");
  if (secret && given !== secret) {
    return withCors(request, { error: "Unauthorized" }, { status: 401 });
  }
  const host = url.searchParams.get("host") || "";
  const removed = await flushDnConfigCache(host || undefined);
  return withCors(request, { ok: true, flushed: removed, host: host || "(all)" });
}
