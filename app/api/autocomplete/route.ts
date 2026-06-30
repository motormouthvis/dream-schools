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

async function fromPhoton(q: string, bias?: { lat: number; lon: number }, limit = 8): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lang: "en",
    lat: String(bias?.lat ?? 39.5),
    lon: String(bias?.lon ?? -98.35),
  });
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

const STREET_TYPE =
  /\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|cir|circle|way|pl|place|ter|terrace|hwy|highway|pkwy|parkway|trl|trail|loop|sq|square|pike|run|pass|path|row|cv|cove|xing|crossing)\b/gi;

// Split a typed address into its parts. The trailing words after the street
// type (e.g. the "fort" in "3309 N Indian River Drive fort") are treated as a
// partial CITY hint — keeping them out of the street search (so Photon doesn't
// drift to "Fort Wayne") while still letting us float the right city up.
function parseAddress(q: string): { houseNo: string; street: string; cityHint: string } {
  const m = q.match(/^\s*(\d+)\s+(.*)$/);
  const houseNo = m ? m[1] : "";
  const rest = (m ? m[2] : q).trim();
  let end = -1;
  let mm: RegExpExecArray | null;
  STREET_TYPE.lastIndex = 0;
  while ((mm = STREET_TYPE.exec(rest)) !== null) end = mm.index + mm[0].length;
  if (end > 0 && end < rest.length) {
    return { houseNo, street: rest.slice(0, end).trim(), cityHint: rest.slice(end).replace(/^[,\s]+/, "").trim().toLowerCase() };
  }
  return { houseNo, street: rest, cityHint: "" };
}

function relevance(label: string, tokens: string[]): number {
  const l = label.toLowerCase();
  return tokens.reduce((n, t) => n + (l.includes(t) ? 1 : 0), 0);
}

// Title-case the typed street (preserving the house-number directional, e.g.
// "N INDIAN RIVER DRIVE" / "n indian river drive" -> "N Indian River Drive").
function titleStreet(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w)) return w;
      if (/^[nsew]{1,2}$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

// How well a (resolved) label matches the typed partial city, e.g. "fort" →
// "Fort Pierce". A full-substring match scores highest; a word-prefix next.
function cityScore(label: string, hint: string): number {
  if (!hint) return 0;
  const l = label.toLowerCase();
  if (l.includes(hint)) return 3;
  const first = hint.split(/\s+/)[0];
  return l.split(/[\s,]+/).some((w) => w.length > 1 && w.startsWith(first)) ? 2 : 0;
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

  const { houseNo, street, cityHint } = parseAddress(q);

  // Query Photon on the clean street (no house number, no partial-city tail) so
  // the real street segments surface. When there's a house number we rely on the
  // street search only — adding the full query just injects noise from the
  // partial city (e.g. "fort" → "Fort Wayne") that crowds out the real match.
  const photonQueries = houseNo
    ? [street].filter((s) => s.length >= 3)
    : Array.from(new Set([street, q].filter((s) => s.length >= 3)));

  // A wider net on the street search so the right city's segment is present even
  // without a location bias (there are many "Indian River Drive"s nationwide).
  const results = await Promise.allSettled([
    fromCensus(q),
    ...photonQueries.map((pq, idx) => fromPhoton(pq, bias, houseNo && idx === 0 ? 25 : 8)),
  ]);
  const census = results[0].status === "fulfilled" ? (results[0] as PromiseFulfilledResult<Suggestion[]>).value : [];
  let photon = results
    .slice(1)
    .flatMap((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<Suggestion[]>).value : []));

  // De-dupe Photon and rank by street-name match.
  const streetTokens = street.toLowerCase().split(/[\s,]+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  const pseen = new Set<string>();
  photon = photon.filter((s) => {
    const k = s.label.toLowerCase();
    if (pseen.has(k)) return false;
    pseen.add(k);
    return true;
  });
  photon.sort((a, b) => relevance(b.label, streetTokens) - relevance(a.label, streetTokens));

  // If a house number was typed, resolve exact house addresses for the best
  // street candidates via Census (keyed by each candidate's ZIP, which is
  // reliable even when Photon omits the city). This turns "North Indian River
  // Drive … 34946" into "3309 N Indian River Dr, Fort Pierce, FL, 34946".
  let enriched: Suggestion[] = [];
  if (houseNo && census.length === 0) {
    const candidates = photon.filter((c) => relevance(c.label, streetTokens) >= Math.min(2, streetTokens.length));
    const probes: string[] = [];
    const zipsSeen = new Set<string>();
    for (const c of candidates) {
      const street0 = c.label.split(",")[0].trim();
      const key = `${street0}|${c.zip}`;
      if (zipsSeen.has(key) || !c.zip) continue;
      zipsSeen.add(key);
      probes.push(`${houseNo} ${street0} ${c.zip}`);
      // When the user is typing a city, cast a wider net so the matching city is
      // among the resolved addresses; otherwise a few is enough.
      if (probes.length >= (cityHint ? 16 : 10)) break;
    }
    const probeRes = await Promise.allSettled(probes.map((p) => fromCensus(p)));
    enriched = probeRes.flatMap((r) =>
      r.status === "fulfilled" ? (r as PromiseFulfilledResult<Suggestion[]>).value : []
    );
    // Float the candidate whose city matches what the user is typing.
    if (cityHint) enriched.sort((a, b) => cityScore(b.label, cityHint) - cityScore(a.label, cityHint));
  }

  // Synthesize house-numbered suggestions from the street candidates so the typed
  // house number is ALWAYS reflected, even before a city/ZIP is typed (Census
  // exact-match needs those). Picking one geocodes the street area — fine for
  // "nearby schools". Ranked by typed-city match, then proximity to any bias
  // (the area being explored), then street relevance.
  let synthesized: Suggestion[] = [];
  if (houseNo) {
    const titledStreet = titleStreet(street);
    const seenCS = new Set<string>();
    for (const c of photon) {
      if (relevance(c.label, streetTokens) < Math.min(2, streetTokens.length)) continue;
      const rest = c.label
        .split(",")
        .slice(1)
        .map((p) => p.trim())
        .filter(Boolean)
        .join(", ");
      if (!rest) continue;
      const csKey = rest.toLowerCase();
      if (seenCS.has(csKey)) continue;
      seenCS.add(csKey);
      synthesized.push({ label: `${houseNo} ${titledStreet}, ${rest}`, lat: c.lat, lon: c.lon, zip: c.zip });
    }
    const score = (s: Suggestion) =>
      (cityHint ? cityScore(s.label, cityHint) * 1000 : 0) -
      (bias ? Math.hypot(s.lat - bias.lat, s.lon - bias.lon) : 0);
    synthesized.sort((a, b) => score(b) - score(a));
  }

  // Order. With a house number: exact Census → Census-resolved houses →
  // synthesized house-numbered streets (so the number is always honored); fall
  // back to bare streets only if nothing house-numbered surfaced. Without a
  // house number: exact Census → street suggestions.
  let ordered: Suggestion[];
  if (houseNo) {
    ordered = [...census, ...enriched, ...synthesized];
    if (ordered.length === 0) ordered = [...photon];
  } else {
    ordered = [...census, ...photon];
  }
  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const s of ordered) {
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
