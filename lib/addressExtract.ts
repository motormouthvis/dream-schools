// Server-side address extraction from a page URL / title.
//
// Mirrors the heuristics in the reference DN explorer (`apps/explorer_popup/
// utils.py`): listing slugs, title formats (comma / single-comma / no-comma),
// neighbourhood names, and a permissive slug-as-address fallback. Used by the
// /api/embed/scrape endpoint to turn what the client SDK scraped (or the raw
// URL/title) into a geocodable string.

const US_STATES = new Set(
  ("al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo " +
    "mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc")
    .split(" ")
);

const DIRECTIONALS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);

const STREET_SUFFIXES = new Set([
  "st", "street", "ave", "avenue", "blvd", "boulevard", "dr", "drive", "rd",
  "road", "ln", "lane", "ct", "court", "pl", "place", "way", "cir", "circle",
  "pkwy", "parkway", "ter", "terrace", "trl", "trail", "hwy", "highway", "cv",
  "cove", "pt", "point", "loop", "path", "run", "pass", "walk", "row", "xing",
  "crossing", "vw", "view", "oval", "sq", "square", "aly", "alley", "rdg",
  "ridge", "gln", "glen", "knl", "knoll", "holw", "hollow", "crst", "crest",
  "mnr", "manor", "cres", "crescent", "brg", "bridge", "grn", "green", "unit",
  "apt", "ste", "suite",
]);

const NON_NEIGHBORHOOD_SLUGS = new Set([
  "listings", "listing", "search", "results", "homes", "homes-for-sale",
  "for-sale", "for-rent", "buy", "rent", "properties", "property", "details",
  "detail", "real-estate", "realestate", "mls", "idx", "featured", "sold",
  "pending", "new-construction", "luxury", "residential", "commercial",
  "about", "contact", "team", "blog", "news", "page", "home", "services",
  "resources", "agents", "agent", "buyers", "sellers", "market", "community",
  "communities", "neighborhoods", "neighborhood", "areas", "area", "map",
  "gallery", "photos", "video", "virtual-tour", "login", "register", "signup",
  "account", "profile", "privacy", "terms", "sitemap", "faq", "help", "index",
  "estate", "estates",
]);

const ADDRESS_QUERY_PARAMS = new Set([
  "address", "addr", "location", "prop_address", "property_address",
]);

const SLUG_ADDRESS_RE =
  /(\d+[-–][a-zA-Z0-9]+(?:[-–][a-zA-Z0-9]+)*[-–][a-zA-Z]{2,})(?:[-–](\d{5}))?/;

function capWord(w: string): string {
  const n = w.replace(/[.,#]+$/, "");
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function tryParseSlugAddress(segment: string): string | null {
  const match = SLUG_ADDRESS_RE.exec(segment);
  if (!match) return null;
  const parts = match[0].split(/[-–]/);
  if (parts.length < 4) return null;

  let stateIdx: number | null = null;
  for (let i = parts.length - 1; i > 1; i -= 1) {
    if (parts[i].length === 2 && US_STATES.has(parts[i].toLowerCase())) {
      stateIdx = i;
      break;
    }
  }
  if (stateIdx === null) return null;

  const streetParts = parts.slice(0, stateIdx);
  let suffixIdx: number | null = null;
  for (let i = 0; i < streetParts.length; i += 1) {
    const p = streetParts[i].toLowerCase();
    if (STREET_SUFFIXES.has(p)) suffixIdx = i;
    if (["unit", "apt", "ste", "suite"].includes(p) && i + 1 < streetParts.length) {
      suffixIdx = i + 1;
    }
  }
  if (
    suffixIdx !== null &&
    suffixIdx + 1 < streetParts.length &&
    DIRECTIONALS.has(streetParts[suffixIdx + 1].toLowerCase())
  ) {
    suffixIdx += 1;
  }

  let street: string;
  let city: string;
  if (suffixIdx !== null && suffixIdx + 1 < stateIdx) {
    street = streetParts.slice(0, suffixIdx + 1).map(capWord).join(" ");
    city = streetParts.slice(suffixIdx + 1, stateIdx).map(capWord).join(" ");
  } else {
    const cityStart = Math.max(2, stateIdx - 2);
    street = streetParts.slice(0, cityStart).map(capWord).join(" ");
    city = streetParts.slice(cityStart, stateIdx).map(capWord).join(" ");
  }
  if (!street || !city) return null;

  const state = parts[stateIdx].toUpperCase();
  const zip =
    stateIdx + 1 < parts.length && /^\d{5}$/.test(parts[stateIdx + 1])
      ? ` ${parts[stateIdx + 1]}`
      : "";
  return `${street}, ${city}, ${state}${zip}`;
}

export function extractAddressFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  for (const [key, value] of parsed.searchParams) {
    if (ADDRESS_QUERY_PARAMS.has(key.toLowerCase())) {
      const addr = tryParseSlugAddress(decodeURIComponent(value));
      if (addr) return addr;
    }
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, "");
  if (!path) return null;
  for (const segment of path.split("/")) {
    const addr = tryParseSlugAddress(segment);
    if (addr) return addr;
  }
  return null;
}

const TITLE_COMMA_ADDR_RE =
  /^(\d+\s+[A-Za-z0-9\s.#]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)/;
const TITLE_SINGLE_COMMA_RE =
  /^(\d+\s+[A-Za-z0-9\s.#]+?)(?:\s+in\s+|\s*,\s*)([A-Za-z][A-Za-z\s]*?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?/;

function normalizeTitleToken(tok: string): string {
  return tok.trim().replace(/[.,#]+$/g, "");
}

function parseTitleAddressNoCommas(title: string): string | null {
  let main = title.trim();
  if (!main) return null;
  if (main.includes(" | ")) main = main.split(" | ", 1)[0].trim();
  if (!main) return null;

  const m = main.match(/\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (!m || m.index === undefined) return null;
  if (!US_STATES.has(m[1].toLowerCase())) return null;
  const zipTok = m[2];

  const prefix = main.slice(0, m.index).trimEnd();
  const parts = prefix.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const first = normalizeTitleToken(parts[0]);
  if (!/^\d+$/.test(first)) return null;
  parts[0] = first;

  let suffixIdx: number | null = null;
  for (let i = 1; i < parts.length; i += 1) {
    const t = normalizeTitleToken(parts[i]).toLowerCase();
    if (STREET_SUFFIXES.has(t)) suffixIdx = i;
    if (["unit", "apt", "ste", "suite"].includes(t) && i + 1 < parts.length) {
      suffixIdx = i + 1;
    }
  }
  if (
    suffixIdx !== null &&
    suffixIdx + 1 < parts.length &&
    DIRECTIONALS.has(normalizeTitleToken(parts[suffixIdx + 1]).toLowerCase())
  ) {
    suffixIdx += 1;
  }

  let streetWords: string[];
  let cityWords: string[];
  if (suffixIdx !== null && suffixIdx + 1 < parts.length) {
    streetWords = parts.slice(0, suffixIdx + 1);
    cityWords = parts.slice(suffixIdx + 1);
  } else {
    if (parts.length < 3) return null;
    streetWords = parts.slice(0, -1);
    cityWords = parts.slice(-1);
  }
  if (!cityWords.length) return null;

  const street = streetWords.map((w) => capWord(normalizeTitleToken(w))).join(" ");
  const city = cityWords.map((w) => capWord(normalizeTitleToken(w))).join(" ");
  return `${street}, ${city}, ${m[1].toUpperCase()} ${zipTok}`;
}

export function extractAddressFromTitle(title: string): string | null {
  if (!title) return null;
  const stripped = title.trim();

  const commaM = stripped.match(TITLE_COMMA_ADDR_RE);
  if (commaM) {
    const addr = commaM[1].trim().replace(/,\s*$/, "");
    const stateM = addr.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (stateM && US_STATES.has(stateM[1].toLowerCase())) return addr;
  }

  const scM = stripped.match(TITLE_SINGLE_COMMA_RE);
  if (scM && US_STATES.has(scM[3].toLowerCase())) {
    const street = scM[1].trim();
    const city = scM[2].trim();
    if (street && city) {
      const zip = scM[4] ? ` ${scM[4]}` : "";
      return `${street}, ${city}, ${scM[3].toUpperCase()}${zip}`;
    }
  }

  return parseTitleAddressNoCommas(stripped);
}

const NEIGHBORHOOD_TITLE_RE =
  /^([A-Za-z][A-Za-z\s'.]{1,60}?)(?:,\s*([A-Z]{2}))?\s+(?:homes?\s+for\s+sale|real\s+estate(?:\s*&\s*homes?\s+for\s+sale)?|propert(?:y|ies)(?:\s+for\s+sale)?|listings?|condos?(?:\s+for\s+sale)?|townhomes?(?:\s+for\s+sale)?|houses?\s+for\s+sale|neighborhoods?|communit(?:y|ies)|realty|market\s+trends?)/i;
const NEIGHBORHOOD_IN_RE =
  /^(?:homes?\s+for\s+sale|propert(?:y|ies)|listings?|condos?(?:\s+for\s+sale)?|houses?\s+for\s+sale)\s+in\s+([A-Za-z][A-Za-z\s'.]{1,60}?)(?:,\s*([A-Z]{2}))?(?:\s*[-–|].*)?$/i;

function titleCaseWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractNeighborhoodFromTitle(rawTitle: string): string | null {
  if (!rawTitle) return null;
  let title = rawTitle.trim();
  if (title.includes(" | ")) title = title.split(" | ", 1)[0].trim();
  if (title.includes(" – ")) title = title.split(" – ", 1)[0].trim();
  if (!title) return null;

  for (const re of [NEIGHBORHOOD_TITLE_RE, NEIGHBORHOOD_IN_RE]) {
    const m = title.match(re);
    if (m) {
      const city = m[1].trim().replace(/,\s*$/, "");
      const state = m[2] || "";
      if (city && !/^\d/.test(city) && city.length >= 4) {
        if (state && US_STATES.has(state.toLowerCase())) {
          return `${titleCaseWords(city)}, ${state.toUpperCase()}`;
        }
        return titleCaseWords(city);
      }
    }
  }
  return null;
}

export function extractNeighborhoodFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, "");
  if (!path) return null;
  const segments = path.split("/").filter(Boolean);

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const raw = segments[i].toLowerCase().replace(/\.(html?|php|aspx?)$/, "");
    if (!raw || /^\d/.test(raw) || raw.length < 3 || raw.length > 60) continue;
    if (NON_NEIGHBORHOOD_SLUGS.has(raw)) continue;
    if (/\d/.test(raw)) continue;
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(raw)) continue;

    const parts = raw.split("-");
    if (parts.length >= 2 && US_STATES.has(parts[parts.length - 1])) {
      const state = parts[parts.length - 1].toUpperCase();
      const name = parts
        .slice(0, -1)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      if (name) return `${name}, ${state}`;
    }
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return null;
}

/** Last-resort: longest URL slug starting with a street number → spaced string. */
export function slugAsAddress(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, "");
  if (!path) return null;
  let best: string | null = null;
  for (const seg of path.split("/")) {
    const cleaned = seg.replace(/\.(html?|php|aspx?)$/i, "");
    if (/^\d+[-–]/.test(cleaned) && (best === null || cleaned.length > best.length)) {
      best = cleaned;
    }
  }
  if (!best) return null;
  const address = best.replace(/[-–_]+/g, " ").trim();
  if (address.split(/\s+/).length < 3) return null;
  return address;
}

/** Full extraction chain used by the scrape endpoint. */
export function getPageAddress(pageUrl: string, pageTitle: string): string | null {
  return (
    extractAddressFromTitle(pageTitle) ||
    extractAddressFromUrl(pageUrl) ||
    extractNeighborhoodFromTitle(pageTitle) ||
    extractNeighborhoodFromUrl(pageUrl)
  );
}
