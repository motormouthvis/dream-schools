import { ZIPCODES, zipInfo } from "@/lib/data";
import { logBackendEventAsync } from "@/lib/backendLog";
import { bumpMetric } from "@/lib/metrics";
import { dnAddressEnabled, dnLookup } from "@/lib/dnAddress";
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
  // Dream Neighborhood first, when DN_ADDRESS_API=on. DN interpolates along the
  // real street geometry from the Census TIGER file and agrees with the Census
  // Bureau's own geocoder to a median of 8 metres, in a fraction of the time
  // and without the bill or the borrowed public infrastructure.
  //
  // Only an outage falls through. A not_found is an answer — DN has already
  // asked its own data, the Census geocoder and Nominatim — so re-asking the
  // same services here would at best waste the round trip and at worst find a
  // confident wrong answer in another state.
  if (dnAddressEnabled()) {
    const dn = await dnLookup(address);
    if (dn.status === "ok") {
      return {
        matchedAddress: dn.value.formatted_address,
        lat: dn.value.lat,
        lon: dn.value.lng,
        zip: dn.value.zip,
        source: "census",
        approximate: false,
      };
    }
    if (dn.status === "not_found") return null;
    bumpMetric("geocode_dn_fallthrough");
  }

  // Census is best for US street addresses; Photon covers gaps; zip-centroid is
  // the last resort for the offline demo.
  const viaCensus = await censusGeocode(address);
  if (viaCensus) return viaCensus;
  const viaPhoton = await photonGeocode(address);
  if (viaPhoton) return viaPhoton;
  // Both real geocoders failed — record it (they may be throttled/down) before
  // returning the coarse zip-centroid approximation.
  const zc = zipFallback(address);
  if (zc) {
    bumpMetric("geocode_fallback");
    logBackendEventAsync(
      "geocode_fallback",
      `Census + Photon both failed to geocode "${address}"; used approximate zip-centroid. Geocoders may be throttled or down.`
    );
  }
  return zc;
}
