import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Free address autocomplete via Photon (OpenStreetMap-based, no API key).
// Returns a small list of US suggestions with coordinates so the lookup can skip
// a second geocode. Swap PHOTON_URL for Mapbox/Google here if you add a key.
const PHOTON_URL = "https://photon.komoot.io/api/";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

function formatLabel(p: any): string {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
  const cityState = [p.city || p.county, p.state].filter(Boolean).join(", ");
  return [line1, cityState, p.postcode].filter(Boolean).join(", ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  // Bias toward the continental US center.
  const params = new URLSearchParams({
    q,
    limit: "6",
    lang: "en",
    lat: "39.5",
    lon: "-98.35",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const json = (await res.json()) as any;
    const seen = new Set<string>();
    const suggestions: Suggestion[] = [];
    for (const f of json.features ?? []) {
      const p = f.properties ?? {};
      if (p.countrycode !== "US") continue;
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const label = formatLabel(p);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      suggestions.push({ label, lat, lon, zip: p.postcode ?? "" });
      if (suggestions.length >= 6) break;
    }
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
