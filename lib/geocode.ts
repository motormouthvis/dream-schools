import { ZIPCODES, zipInfo } from "@/lib/data";
import { logBackendEventAsync } from "@/lib/backendLog";
import { bumpMetric } from "@/lib/metrics";
import type { GeocodeResult } from "@/lib/types";

// We use the free U.S. Census Geocoder (no API key required) as the primary
// geocoder, and fall back to the centroid of the target zip code so the demo
// always works offline. To use Mapbox/Google instead, set the relevant env var
// and add a branch here.

const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

function extractZip(address: string): string | undefined {
  const m = address.match(/\b(3\d{4})\b/g);
  if (!m) return undefined;
  // Prefer a zip that is one of our targets.
  const target = m.find((z) => ZIPCODES.some((zc) => zc.zip === z));
  return target ?? m[m.length - 1];
}

function zipFallback(address: string): GeocodeResult | null {
  const zip = extractZip(address);
  if (!zip) return null;
  const info = zipInfo(zip);
  if (!info) {
    // A FL zip we don't carry data for.
    return {
      matchedAddress: address,
      lat: NaN,
      lon: NaN,
      zip,
      source: "zip-centroid",
      approximate: true,
    };
  }
  return {
    matchedAddress: `${address} (approx. ${info.city}, FL ${zip})`,
    lat: info.lat,
    lon: info.lon,
    zip,
    source: "zip-centroid",
    approximate: true,
  };
}

async function censusGeocode(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CENSUS_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as any;
      const match = json?.result?.addressMatches?.[0];
      if (match) {
        const lon = match.coordinates?.x;
        const lat = match.coordinates?.y;
        const zip: string =
          match.addressComponents?.zip ?? extractZip(match.matchedAddress ?? address) ?? "";
        if (typeof lat === "number" && typeof lon === "number") {
          return {
            matchedAddress: match.matchedAddress ?? address,
            lat,
            lon,
            zip,
            source: "census",
            approximate: false,
          };
        }
      }
    }
  } catch {
    // fall through
  }
  return null;
}

const STATE_CODES = new Set(
  ("al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo " +
    "mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc")
    .split(" ")
);

// A two-letter state only counts when it sits where a state belongs: before a
// zip, before a country suffix, or at the end. Otherwise ordinary words ("in",
// "or", "me") would read as states.
const STATE_TOKEN_RE = /\b([A-Za-z]{2})\b(?=[\s,]*(?:\d{5}\b|usa?\b|united states\b|$))/gi;

function statesIn(address: string): Set<string> {
  const found = new Set<string>();
  for (const m of address.matchAll(STATE_TOKEN_RE)) {
    const code = m[1].toLowerCase();
    if (STATE_CODES.has(code)) found.add(code);
  }
  return found;
}

/**
 * Does this string name a US locality we can hold a geocoder to? A zip or a
 * state is what separates a real address from page furniture like "Homes For
 * Sale", which a paid geocoder will confidently match to a realty office.
 */
function hasLocalitySignal(address: string): boolean {
  return /\b\d{5}\b/.test(address) || statesIn(address).size > 0;
}

// Result types that describe a place. `amenity` (a business POI) is excluded on
// purpose — matching a listing to a shop with a similar name is worse than
// finding nothing.
const GEOAPIFY_PLACE_TYPES = new Set([
  "building", "street", "postcode", "city", "suburb", "district", "county", "state",
]);

// Geoapify — the same premium provider the address autocomplete already uses.
// Consulted ONLY when Census and Photon both miss, which is where rural roads,
// private lanes and land parcels fall through (e.g. "777 Rodeo Drive, Glenbrook,
// NV 89413"). Every result must be in the US, be a place rather than a business,
// and sit in the state the query asked for; anything else is rejected, which
// leaves the previous behaviour exactly as it was.
async function geoapifyGeocode(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return null;
  if (!hasLocalitySignal(address)) return null;
  try {
    const params = new URLSearchParams({
      text: address,
      filter: "countrycode:us",
      limit: "1",
      format: "json",
      apiKey: key,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const hit = json?.results?.[0];
    if (!hit) return null;
    if (String(hit.country_code ?? "").toLowerCase() !== "us") return null;
    const lat = hit.lat;
    const lon = hit.lon;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    const type = String(hit.result_type ?? "");
    if (!GEOAPIFY_PLACE_TYPES.has(type)) return null;
    const state = String(hit.state_code ?? "").toLowerCase();
    const wanted = statesIn(address);
    if (wanted.size > 0 && state && !wanted.has(state)) return null;
    const formatted = String(hit.formatted ?? "").replace(/,\s*United States of America$/i, "");
    return {
      matchedAddress: formatted || address,
      lat,
      lon,
      zip: typeof hit.postcode === "string" ? hit.postcode : "",
      source: "geoapify",
      approximate: type !== "building",
    };
  } catch {
    return null;
  }
}

// Photon (OpenStreetMap) — covers places/streets the Census file may miss.
async function photonGeocode(address: string): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({ q: address, limit: "1", lang: "en", lat: "39.5", lon: "-98.35" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const f = (json.features ?? []).find((x: any) => x.properties?.countrycode === "US");
    if (!f) return null;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    const p = f.properties ?? {};
    const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
    const matched = [line1, [p.city, p.state].filter(Boolean).join(", "), p.postcode]
      .filter(Boolean)
      .join(", ");
    return {
      matchedAddress: matched || address,
      lat,
      lon,
      zip: p.postcode ?? "",
      source: "census",
      approximate: false,
    };
  } catch {
    return null;
  }
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  // Census is best for US street addresses; Photon covers gaps; Geoapify covers
  // what both miss (rural/private roads, land parcels); zip-centroid is the last
  // resort for the offline demo.
  const viaCensus = await censusGeocode(address);
  if (viaCensus) return viaCensus;
  const viaPhoton = await photonGeocode(address);
  if (viaPhoton) return viaPhoton;
  const viaGeoapify = await geoapifyGeocode(address);
  if (viaGeoapify) {
    bumpMetric("geocode_premium_rescue");
    return viaGeoapify;
  }
  // Every geocoder missed — record it (they may be throttled/down) before
  // returning the coarse zip-centroid approximation.
  const zc = zipFallback(address);
  if (zc) {
    bumpMetric("geocode_fallback");
    logBackendEventAsync(
      "geocode_fallback",
      `Census + Photon both failed to geocode "${address}"; used approximate zip-centroid. Geocoders may be throttled or down.`
    );
    return zc;
  }
  // Nothing placed the address at all. Previously silent, which is how wrong
  // locations went unnoticed: the embed widget substitutes its fallback and the
  // visitor is never told.
  bumpMetric("geocode_failed");
  logBackendEventAsync(
    "geocode_failed",
    `No geocoder could place "${address}" (Census, Photon and Geoapify all missed). The explorer will open on manual search instead of this location.`
  );
  return null;
}
