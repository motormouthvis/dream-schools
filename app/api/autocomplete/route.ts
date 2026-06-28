import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Free address autocomplete. We merge two no-API-key sources for much better US
// coverage than either alone:
//   1. U.S. Census geocoder — authoritative US street addresses (TIGER), great
//      for exact house numbers once a city/state (or enough of the line) is typed.
//   2. Photon (OpenStreetMap) — fast typeahead for places/streets/partials.
// Census results are listed first because they're the most precise for the US.
const PHOTON_URL = "https://photon.komoot.io/api/";
const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

function photonLabel(p: any): string {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
  const cityState = [p.city || p.county, p.state].filter(Boolean).join(", ");
  return [line1, cityState, p.postcode].filter(Boolean).join(", ");
}

async function fromPhoton(q: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, limit: "6", lang: "en", lat: "39.5", lon: "-98.35" });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const out: Suggestion[] = [];
    for (const f of json.features ?? []) {
      const p = f.properties ?? {};
      if (p.countrycode !== "US") continue;
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const label = photonLabel(p);
      if (label) out.push({ label, lat, lon, zip: p.postcode ?? "" });
    }
    return out;
  } catch {
    return [];
  }
}

async function fromCensus(q: string): Promise<Suggestion[]> {
  // Census needs a fairly complete line; it returns nothing for very partial
  // input, which is fine — Photon covers early typing.
  const params = new URLSearchParams({
    address: q,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${CENSUS_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const out: Suggestion[] = [];
    for (const m of json?.result?.addressMatches ?? []) {
      const lon = m.coordinates?.x;
      const lat = m.coordinates?.y;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      out.push({
        label: m.matchedAddress ?? "",
        lat,
        lon,
        zip: m.addressComponents?.zip ?? "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  // Run both, but never let the slower one block the response beyond its own
  // timeout. Census is authoritative for US street addresses, so it leads.
  const [censusR, photonR] = await Promise.allSettled([fromCensus(q), fromPhoton(q)]);
  const census = censusR.status === "fulfilled" ? censusR.value : [];
  const photon = photonR.status === "fulfilled" ? photonR.value : [];

  // Census first (most precise for US), then Photon; de-dupe by normalized label.
  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const s of [...census, ...photon]) {
    const key = s.label.toLowerCase().replace(/\s+/g, " ").trim();
    if (!s.label || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(s);
    if (suggestions.length >= 7) break;
  }
  return NextResponse.json({ suggestions });
}
