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

// Title-case a label that arrived in ALL CAPS (the Census geocoder returns
// e.g. "3309 N INDIAN RIVER DR, FORT PIERCE, FL, 34946"). Mixed-case labels
// (Photon) are left untouched so we don't mangle names like "McAllen".
function normalizeLabel(label: string): string {
  if (/[a-z]/.test(label)) return label;
  return label
    .split(",")
    .map((part) => {
      const p = part.trim();
      if (/^\d{5}(-\d{4})?$/.test(p)) return p; // ZIP
      if (/^[A-Z]{2}$/.test(p)) return p; // state code (FL, OH…)
      return p
        .split(/\s+/)
        .map((w) => {
          if (/^\d/.test(w)) return w; // house numbers, "1st", "42nd"
          if (/^[NSEW]{1,2}$/i.test(w)) return w.toUpperCase(); // directionals
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(" ");
    })
    .join(", ");
}

function photonLabel(p: any): string {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
  const cityState = [p.city || p.county, p.state].filter(Boolean).join(", ");
  return [line1, cityState, p.postcode].filter(Boolean).join(", ");
}

async function fromPhoton(q: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, limit: "8", lang: "en", lat: "39.5", lon: "-98.35" });
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

// How many street-name tokens of the query appear in a label. Lets us rank
// "3309 N Indian River Drive" → "Indian River Drive" above "Saxon Drive",
// which Photon would otherwise surface just because it also has a #3309.
function relevance(label: string, tokens: string[]): number {
  const l = label.toLowerCase();
  return tokens.reduce((n, t) => n + (l.includes(t) ? 1 : 0), 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  // When a street address is typed without a city, Census returns nothing and
  // Photon over-weights the house number. So we also query Photon with the
  // leading house number stripped, which surfaces the actual street.
  const stripped = q.replace(/^\s*\d+\s+/, "").trim();
  const photonQueries = stripped && stripped.toLowerCase() !== q.toLowerCase() ? [q, stripped] : [q];

  const results = await Promise.allSettled([
    fromCensus(q),
    ...photonQueries.map((pq) => fromPhoton(pq)),
  ]);
  const census = results[0].status === "fulfilled" ? (results[0] as PromiseFulfilledResult<Suggestion[]>).value : [];
  const photon = results
    .slice(1)
    .flatMap((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<Suggestion[]>).value : []));

  // Rank Photon hits by how well they match the typed street name (ignore the
  // house number and tiny words); Census stays first as it's exact for the US.
  const tokens = q
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  photon.sort((a, b) => relevance(b.label, tokens) - relevance(a.label, tokens));

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const s of [...census, ...photon]) {
    if (!s.label) continue;
    const label = normalizeLabel(s.label);
    const key = label.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ ...s, label });
    if (suggestions.length >= 7) break;
  }
  return NextResponse.json({ suggestions });
}
