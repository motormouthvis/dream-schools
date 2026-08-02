import { preflight, withCors } from "@/lib/embedCors";
import { dnOrigin } from "@/lib/appEnv";
import { normalizeDnHost } from "@/lib/dnConfig";

export const dynamic = "force-dynamic";

// A homebuyer asking their realtor for the full Neighborhood Explorer.
//
//   POST /api/embed/upgrade-request  { address, requester_key, source }
//
// Relayed to DN, which owns upgrade requests. We record nothing: the ask is
// about a customer, and we no longer hold customers.
//
// DN identifies the customer from the caller's Origin, so the only thing that
// decides whose request this is, is the browser's own Origin header — never a
// value in the body, and never a query parameter. A request with no Origin has
// nothing to attribute and is refused rather than guessed at.

const UPGRADE_PATH = "/explorer/upgrade-request/";
const TIMEOUT_MS = 5_000;

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin") || "";
  let host = "";
  try {
    host = origin ? normalizeDnHost(new URL(origin).hostname) : "";
  } catch {
    host = "";
  }
  if (!host) {
    return withCors(request, { error: "origin required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(request, { error: "invalid request" }, { status: 400 });
  }

  const source = body.source === "inline" ? "inline" : "popup";
  const payload = {
    address: String(body.address || "").slice(0, 500),
    requester_key: String(body.requester_key || "").slice(0, 64),
    source,
  };

  try {
    const res = await fetch(`${dnOrigin()}${UPGRADE_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `https://${host}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // The visitor has already been told nothing is pending and DN de-duplicates,
    // so the only thing worth relaying is whether it landed at all.
    return withCors(request, { ok: res.ok }, { status: res.ok ? 200 : 502 });
  } catch {
    return withCors(request, { ok: false }, { status: 502 });
  }
}
