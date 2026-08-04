import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/lruCache";
import { dnAddressEnabled, dnSuggest } from "@/lib/dnAddress";
import { bumpMetric } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// Address autocomplete.
//
// Dream Neighborhood answers, from the Census TIGER file it holds locally, with
// its own fallback to the Census geocoder and Nominatim behind it. The U.S.
// Census geocoder is the only thing left on our side, and only for when DN
// cannot answer at all.
//
// Geoapify (paid) and Photon (donated public infrastructure, and not ours to
// lean on commercially) have been removed.
//
// **We fall back on an outage, never on an empty answer.** An empty list from
// DN is an answer: it has already asked its own data, the Census geocoder and
// Nominatim. Falling back on empty undoes every guard DN added — it is what put
// "123, Franklin Township, Ohio" in the dropdown for the query "123".
//
// Census cannot do typeahead; it is one-shot and needs a fairly complete line.
// So during a DN outage the honest answer is usually no suggestions, and the
// caller is told the search is limited rather than left with a dropdown that
// silently stopped appearing.

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
  /**
   * What to send back when this suggestion is picked, when that differs from
   * what we show. DN asks for its `description` verbatim and it matters: a
   * reconstructed address is matched afresh, and their suggestions carry the
   * ZIP where they have it.
   */
  value?: string;
}

const autocompleteCache = new TtlCache<Suggestion[]>(2000, 5 * 60 * 1000);

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/**
 * The last resort. Census needs a nearly complete address line and returns
 * nothing for partial input, so this is not typeahead — it is the reason a
 * degraded search can still resolve a full street address somebody pastes in.
 */
async function fromCensus(q: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({ address: q, benchmark: "Public_AR_Current", format: "json" });
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
      out.push({ label: m.matchedAddress ?? "", lat, lon, zip: m.addressComponents?.zip ?? "" });
    }
    return out.filter((s) => s.label);
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
  const latN = Number(searchParams.get("lat"));
  const lonN = Number(searchParams.get("lon"));
  const bias =
    Number.isFinite(latN) && Number.isFinite(lonN) && latN !== 0 ? { lat: latN, lon: lonN } : undefined;

  const cacheKey = `${q.toLowerCase()}|${bias ? `${bias.lat.toFixed(1)},${bias.lon.toFixed(1)}` : ""}`;
  const cached = autocompleteCache.get(cacheKey);
  if (cached) {
    bumpMetric("autocomplete_calls");
    bumpMetric("autocomplete_cache_hits");
    return NextResponse.json({ suggestions: cached });
  }
  bumpMetric("autocomplete_calls");
  bumpMetric("autocomplete_cache_misses");

  if (dnAddressEnabled()) {
    const dn = await dnSuggest(q, bias, 8);
    if (dn.status === "ok") {
      // Including an empty list. DN looked; there is nothing.
      const suggestions = dn.value.map((s) => ({
        // Show the tidy two-line form; send back exactly what DN gave us.
        label: [s.main_text, s.secondary_text].filter(Boolean).join(", ") || s.description,
        lat: NaN,
        lon: NaN,
        zip: (s.secondary_text.match(/\b(\d{5})\b/) || [])[1] || "",
        value: s.description,
      }));
      autocompleteCache.set(cacheKey, suggestions);
      bumpMetric("autocomplete_from_dn");
      return NextResponse.json({ suggestions });
    }

    // DN gave no answer at all. Census cannot do typeahead, so for a partial
    // query there is genuinely nothing to offer — say so rather than let the
    // dropdown quietly stop appearing.
    bumpMetric("autocomplete_dn_unavailable");
    const viaCensus = await fromCensus(q);
    if (viaCensus.length) return NextResponse.json({ suggestions: viaCensus, limited: true });
    return NextResponse.json({ suggestions: [], limited: true });
  }

  // DN_ADDRESS_API is off. Census only, by instruction.
  const viaCensus = await fromCensus(q);
  autocompleteCache.set(cacheKey, viaCensus);
  return NextResponse.json({ suggestions: viaCensus });
}
