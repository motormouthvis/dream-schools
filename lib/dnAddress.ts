import { dnOrigin } from "@/lib/appEnv";
import { TtlCache } from "@/lib/lruCache";
import { bumpMetric } from "@/lib/metrics";

// ---------------------------------------------------------------------------
// Addresses, resolved by Dream Neighborhood.
//
// DN holds the Census TIGER address file — 6.3m streets, 37.6m road blocks —
// and interpolates along the real street geometry. That replaces a chain of
// outside services: Geoapify, which we pay for; Photon, which is donated public
// infrastructure that can throttle a commercial consumer without notice; and
// the Census geocoder.
//
// Server-to-server only. The key must never reach a browser, so nothing here is
// importable from a client component — call it from route handlers.
//
// The status codes carry the meaning, and this is the part worth getting right:
//
//   200 success:true              an address → use it
//   200 success:false not_found   DN looked, and it does not exist → say so
//   502 / timeout / network       DN is broken → fall back to the old chain
//
// An empty answer and an outage look identical if you only ask "did I get an
// address back", and conflating them means either falling back constantly or
// going blank during DN's maintenance. Worse, falling back on not_found is how
// a school explorer ends up in the wrong state: a looser geocoder will happily
// place "99999 Nowhere Rd, Nowhere, FL" on a Nowhere Road in West Virginia. DN
// has already tried Census and Nominatim before saying not_found, so our own
// fallbacks would be asking the same services the same question.
// ---------------------------------------------------------------------------

const SUGGEST_PATH = "/explorer/address/suggest/";
const LOOKUP_PATH = "/explorer/address/lookup/";

/**
 * A box somebody is typing into cannot wait. DN is fast for addresses it holds
 * and slow for the rest, because those fall through to outside geocoders on
 * its side — that tail is the whole reason for a timeout here rather than
 * there. DN measured bounding it on their side and it was worse: abandoned
 * lookups keep holding a database connection and starve the live ones.
 */
const SUGGEST_TIMEOUT_MS = Math.max(200, Number(process.env.DN_ADDRESS_SUGGEST_TIMEOUT_MS) || 1_000);

/**
 * Deliberately generous. By now the user has chosen and is waiting on purpose,
 * and a wrong answer is worse than a slow one.
 */
const LOOKUP_TIMEOUT_MS = Math.max(1_000, Number(process.env.DN_ADDRESS_LOOKUP_TIMEOUT_MS) || 8_000);

// Addresses do not move, so caching by query text makes DN's maintenance
// invisible to our users and spares them the traffic.
const suggestCache = new TtlCache<DnSuggestion[]>(2_000, 30 * 60_000);
const lookupCache = new TtlCache<DnAddress>(2_000, 24 * 3600_000);

export interface DnSuggestion {
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface DnAddress {
  lat: number;
  lng: number;
  formatted_address: string;
  city: string;
  state: string;
  state_name: string;
  county: string;
  zip: string;
  in_the_usa: boolean;
  source: string;
}

/** `ok` and `not_found` are answers; `unavailable` is the absence of one. */
export type DnAddressOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

export function dnAddressEnabled(): boolean {
  return (
    process.env.DN_ADDRESS_API === "on" && Boolean((process.env.DN_INGEST_API_KEY || "").trim())
  );
}

function key(): string {
  return (process.env.DN_INGEST_API_KEY || "").trim();
}

async function ask(
  path: string,
  params: Record<string, string>,
  timeoutMs: number
): Promise<{ status: number; json: Record<string, unknown> | null } | null> {
  const url = `${dnOrigin()}${path}?${new URLSearchParams(params).toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Api-Key ${key()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status >= 500) return null;
    if (res.status === 401) {
      // Worth shouting about: every address on the site is failing over.
      console.error("[dn-address] 401 — the DN address key is missing, wrong or revoked");
      return null;
    }
    const text = await res.text();
    try {
      return { status: res.status, json: text ? JSON.parse(text) : null };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/** Suggestions for a partly typed address. */
export async function dnSuggest(
  q: string,
  bias?: { lat: number; lon: number },
  limit = 8
): Promise<DnAddressOutcome<DnSuggestion[]>> {
  const cacheKey = `${q.toLowerCase()}|${bias ? `${bias.lat.toFixed(1)},${bias.lon.toFixed(1)}` : ""}|${limit}`;
  const hit = suggestCache.get(cacheKey);
  if (hit) {
    bumpMetric("address_dn_suggest_cache_hit");
    return { status: "ok", value: hit };
  }

  const params: Record<string, string> = { q, limit: String(Math.min(8, Math.max(1, limit))) };
  if (bias) {
    params.lat = String(bias.lat);
    params.lng = String(bias.lon);
  }
  const res = await ask(SUGGEST_PATH, params, SUGGEST_TIMEOUT_MS);
  if (!res) {
    bumpMetric("address_dn_suggest_unavailable");
    return { status: "unavailable", reason: "no answer from DN" };
  }
  const list = Array.isArray(res.json?.suggestions) ? (res.json!.suggestions as DnSuggestion[]) : [];
  suggestCache.set(cacheKey, list);
  bumpMetric("address_dn_suggest_ok");
  return { status: "ok", value: list };
}

/** One address to a point and a place. */
export async function dnLookup(address: string): Promise<DnAddressOutcome<DnAddress>> {
  const cacheKey = address.trim().toLowerCase();
  const hit = lookupCache.get(cacheKey);
  if (hit) {
    bumpMetric("address_dn_lookup_cache_hit");
    return { status: "ok", value: hit };
  }

  const res = await ask(LOOKUP_PATH, { address }, LOOKUP_TIMEOUT_MS);
  if (!res) {
    bumpMetric("address_dn_lookup_unavailable");
    return { status: "unavailable", reason: "no answer from DN" };
  }
  const json = res.json || {};
  if (json.success !== true) {
    // DN looked, and there is no such address. It already tried its own data,
    // the Census geocoder and Nominatim before saying so.
    bumpMetric("address_dn_lookup_not_found");
    return { status: "not_found" };
  }
  const value: DnAddress = {
    lat: Number(json.lat),
    lng: Number(json.lng),
    formatted_address: String(json.formatted_address || address),
    city: String(json.city || ""),
    state: String(json.state || ""),
    state_name: String(json.state_name || ""),
    county: String(json.county || ""),
    zip: String(json.zip || ""),
    in_the_usa: json.in_the_usa !== false,
    source: String(json.source || ""),
  };
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) {
    bumpMetric("address_dn_lookup_unavailable");
    return { status: "unavailable", reason: "coordinates missing" };
  }
  lookupCache.set(cacheKey, value);
  bumpMetric(`address_dn_lookup_ok_${value.source || "unknown"}`);
  return { status: "ok", value };
}
