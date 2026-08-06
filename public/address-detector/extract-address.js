/**
 * Address extraction from the host page.
 *
 * Strategy order matches ``apps/explorer_popup/utils.py`` and is shared by
 * both the popup and inline SDK bundles:
 *
 *   1. document.title parse
 *   2. JSON-LD / OG meta / microdata
 *   3. (optional) visible body text — gated by ``searchPageContent`` so we
 *      don't waste cycles on sites where step 1/2 already wins.
 *   4. footer scan (HOA / office addresses on community pages)
 *   5. neighbourhood / city name from title or URL slug
 */

const _JSONLD_NON_PROPERTY_TYPES = new Set([
  'realestateagent',
  'organization',
  'corporation',
  'localbusiness',
  'person',
  'professionalservice',
  'webpage',
  'website',
  'breadcrumblist',
]);

function _isNonPropertyEntity(item) {
  const raw = item['@type'];
  if (!raw) return false;
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((t) => _JSONLD_NON_PROPERTY_TYPES.has(String(t).toLowerCase()));
}

function flattenLinkedData(data) {
  if (Array.isArray(data)) return data.flatMap(flattenLinkedData);
  if (data && typeof data === 'object') {
    const items = [data];
    if (data['@graph']) items.push(...flattenLinkedData(data['@graph']));
    return items;
  }
  return [];
}

function extractFromJsonLd() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const items = flattenLinkedData(JSON.parse(script.textContent));
      for (const item of items) {
        if (_isNonPropertyEntity(item)) continue;
        const addr = item.address || item.location?.address;
        if (typeof addr === 'string') return addr;
        if (addr?.streetAddress) {
          return [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter(Boolean)
            .join(', ');
        }
      }
    }
  } catch { /* best-effort */ }
  return null;
}

function extractFromOgMeta() {
  const street = document.querySelector('meta[property="og:street-address"]')?.content;
  if (!street) return null;
  const locality = document.querySelector('meta[property="og:locality"]')?.content;
  const region = document.querySelector('meta[property="og:region"]')?.content;
  const zip = document.querySelector('meta[property="og:postal-code"]')?.content;
  return [street, locality, region, zip].filter(Boolean).join(', ');
}

function extractFromMicrodata() {
  const street = document.querySelector('[itemprop="streetAddress"]')?.textContent?.trim();
  if (!street) return null;
  const locality = document.querySelector('[itemprop="addressLocality"]')?.textContent?.trim();
  const region = document.querySelector('[itemprop="addressRegion"]')?.textContent?.trim();
  const zip = document.querySelector('[itemprop="postalCode"]')?.textContent?.trim();
  return [street, locality, region, zip].filter(Boolean).join(', ');
}

const _DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

// Mirrors apps/explorer_popup/utils.py — US state abbreviations + street suffixes for no-comma titles
const _US_STATE_ABBREVS = new Set(
  'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'.split(
    ' ',
  ),
);

const _STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'blvd', 'boulevard', 'dr', 'drive',
  'rd', 'road', 'ln', 'lane', 'ct', 'court', 'pl', 'place', 'way',
  'cir', 'circle', 'pkwy', 'parkway', 'ter', 'terrace', 'trl', 'trail',
  'hwy', 'highway', 'cv', 'cove', 'pt', 'point', 'loop', 'path', 'run',
  'pass', 'walk', 'row', 'xing', 'crossing', 'vw', 'view', 'oval',
  'sq', 'square', 'aly', 'alley', 'rdg', 'ridge', 'gln', 'glen',
  'knl', 'knoll', 'holw', 'hollow', 'crst', 'crest', 'mnr', 'manor',
  'cres', 'crescent', 'brg', 'bridge', 'grn', 'green',
  'unit', 'apt', 'ste', 'suite',
]);

function _normalizeTitleToken(tok) {
  return tok.trim().replace(/[.,#]+$/g, '');
}

/**
 * Parse "7444 River Bend Cir Nashville TN 37221" (no commas). Returns comma-separated address or null.
 */
function parseTitleAddressNoCommas(title) {
  let main = title.trim();
  if (!main) return null;
  if (main.includes(' | ')) main = main.split(' | ', 1)[0].trim();
  if (!main) return null;

  const m = main.match(/\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (!m) return null;
  const stateTok = m[1];
  if (!_US_STATE_ABBREVS.has(stateTok.toLowerCase())) return null;
  const zipTok = m[2];

  const prefix = main.slice(0, m.index).trimEnd();
  const parts = prefix.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const first = _normalizeTitleToken(parts[0]);
  if (!/^\d+$/.test(first)) return null;
  parts[0] = first;

  let suffixIdx = null;
  for (let i = 1; i < parts.length; i += 1) {
    const t = _normalizeTitleToken(parts[i]).toLowerCase();
    if (_STREET_SUFFIXES.has(t)) suffixIdx = i;
    if (['unit', 'apt', 'ste', 'suite'].includes(t) && i + 1 < parts.length) suffixIdx = i + 1;
  }

  if (suffixIdx !== null && suffixIdx + 1 < parts.length) {
    if (_DIRECTIONALS.has(_normalizeTitleToken(parts[suffixIdx + 1]).toLowerCase())) suffixIdx += 1;
  }

  let streetWords;
  let cityWords;
  if (suffixIdx !== null && suffixIdx + 1 < parts.length) {
    streetWords = parts.slice(0, suffixIdx + 1);
    cityWords = parts.slice(suffixIdx + 1);
  } else {
    if (parts.length < 3) return null;
    streetWords = parts.slice(0, -1);
    cityWords = parts.slice(-1);
  }
  if (!cityWords.length) return null;

  const capWord = (w) => {
    const n = _normalizeTitleToken(w);
    if (!n) return n;
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  };
  const street = streetWords.map(capWord).join(' ');
  const city = cityWords.map(capWord).join(' ');
  const state = stateTok.toUpperCase();
  return `${street}, ${city}, ${state} ${zipTok}`;
}

/** Comma-form title prefix (aligned with extract_address_from_title in utils.py) */
const _TITLE_COMMA_ADDR_RE =
  /^(\d+\s+[A-Za-z0-9\s.#]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)/;

/** Single-comma / "in" form: "8255 Longbay Blvd in Sarasota, FL – Acreage" */
const _TITLE_SINGLE_COMMA_RE =
  /^(\d+\s+[A-Za-z0-9\s.#]+?)(?:\s+in\s+|\s*,\s*)([A-Za-z][A-Za-z\s]*?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?/;

function extractFromDocumentTitle() {
  const title = (document.title || '').trim();
  if (!title) return null;
  const main = title.includes(' | ') ? title.split(' | ', 1)[0].trim() : title;
  const commaM = main.match(_TITLE_COMMA_ADDR_RE);
  if (commaM) return commaM[1].trim().replace(/,\s*$/, '');

  const scM = main.match(_TITLE_SINGLE_COMMA_RE);
  if (scM && _US_STATE_ABBREVS.has(scM[3].toLowerCase())) {
    const street = scM[1].trim();
    const city = scM[2].trim();
    const state = scM[3].toUpperCase();
    const zip = scM[4] || '';
    if (street && city) {
      return zip ? `${street}, ${city}, ${state} ${zip}` : `${street}, ${city}, ${state}`;
    }
  }

  return parseTitleAddressNoCommas(main);
}

function tryNoCommaAddressInText(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const addr = parseTitleAddressNoCommas(line);
    if (addr) return addr;
  }
  return null;
}

const _ADDR_RE = /\d{1,6}\s+[A-Za-z0-9#'.]+(?:\s+[A-Za-z0-9#'.]+)*\s*,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?/;

const _SKIP_SELECTORS = [
  'footer', 'nav', '[class*="contact"]', '[class*="agent"]',
  '[class*="footer"]', '[class*="nav"]', '[id*="contact"]',
  '[id*="agent"]', '[id*="footer"]',
].join(',');

function extractFromVisibleText() {
  const skip = new Set();
  for (const el of document.querySelectorAll(_SKIP_SELECTORS)) {
    skip.add(el);
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let parent = node.parentElement;
      while (parent) {
        if (skip.has(parent)) return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const raw = node.textContent;
    const match = raw.match(_ADDR_RE);
    if (match) return match[0].trim();
    const noComma = tryNoCommaAddressInText(raw);
    if (noComma) return noComma;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Address extraction from URL slug (mirrors apps/explorer_popup/utils.py)
// ---------------------------------------------------------------------------

// Matches a slug that starts with a street number followed by address parts and a 2-letter state.
// e.g. "3309-n-indian-river-drive-fort-pierce-fl-34946" or "123-main-st-austin-tx-78701"
const _SLUG_ADDRESS_RE = /(\d+[-–][a-zA-Z0-9]+(?:[-–][a-zA-Z0-9]+)*[-–][a-zA-Z]{2,})(?:[-–](\d{5}))?/;

const _ADDRESS_QUERY_PARAMS = new Set(['address', 'addr', 'location', 'prop_address', 'property_address']);

function _capWord(w) {
  const n = w.replace(/[.,#]+$/, '');
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function _tryParseSlugAddress(segment) {
  const match = _SLUG_ADDRESS_RE.exec(segment);
  if (!match) return null;

  const slug = match[0]; // full match including optional zip
  const parts = slug.split(/[-–]/);

  // Need at least: number, street-word, city-word, state
  if (parts.length < 4) return null;

  // Scan right-to-left for the state abbreviation (avoids confusing
  // directionals like "NE" with Nebraska)
  let stateIdx = null;
  for (let i = parts.length - 1; i > 1; i--) {
    if (parts[i].length === 2 && _US_STATE_ABBREVS.has(parts[i].toLowerCase())) {
      stateIdx = i;
      break;
    }
  }
  if (stateIdx === null) return null;

  const streetParts = parts.slice(0, stateIdx);

  // Find the last street suffix to split street from city
  let suffixIdx = null;
  for (let i = 0; i < streetParts.length; i++) {
    const p = streetParts[i].toLowerCase();
    if (_STREET_SUFFIXES.has(p)) suffixIdx = i;
    if (['unit', 'apt', 'ste', 'suite'].includes(p) && i + 1 < streetParts.length) suffixIdx = i + 1;
  }

  // Include a directional (N/S/E/W etc.) that follows the street type suffix
  if (suffixIdx !== null && suffixIdx + 1 < streetParts.length &&
      _DIRECTIONALS.has(streetParts[suffixIdx + 1].toLowerCase())) {
    suffixIdx += 1;
  }

  let street, city;
  if (suffixIdx !== null && suffixIdx + 1 < stateIdx) {
    street = streetParts.slice(0, suffixIdx + 1).map(_capWord).join(' ');
    city = streetParts.slice(suffixIdx + 1, stateIdx).map(_capWord).join(' ');
  } else {
    const cityStart = Math.max(2, stateIdx - 2);
    street = streetParts.slice(0, cityStart).map(_capWord).join(' ');
    city = streetParts.slice(cityStart, stateIdx).map(_capWord).join(' ');
  }

  if (!street || !city) return null;

  const state = parts[stateIdx].toUpperCase();
  const zip = (stateIdx + 1 < parts.length && /^\d{5}$/.test(parts[stateIdx + 1]))
    ? ' ' + parts[stateIdx + 1]
    : '';

  return `${street}, ${city}, ${state}${zip}`;
}

/**
 * Extract a property address from a URL path or query parameters.
 * Handles listing slugs like /3309-n-indian-river-drive-fort-pierce-fl-34946/.
 * Mirrors apps/explorer_popup/utils.py extract_address_from_url.
 */
function extractAddressFromUrl(url) {
  try {
    const parsed = new URL(url);

    // Check address-bearing query params first — they're an explicit signal
    for (const [key, value] of parsed.searchParams) {
      if (_ADDRESS_QUERY_PARAMS.has(key.toLowerCase())) {
        const addr = _tryParseSlugAddress(decodeURIComponent(value));
        if (addr) return addr;
      }
    }

    const path = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, '');
    if (!path) return null;

    for (const segment of path.split('/')) {
      const addr = _tryParseSlugAddress(segment);
      if (addr) return addr;
    }
  } catch { /* best-effort */ }
  return null;
}

// ---------------------------------------------------------------------------
// Neighbourhood / city-name extraction (for area pages with no street number)
// ---------------------------------------------------------------------------

/** "Bradenton Homes for Sale", "Melbourne, FL Real Estate", etc. */
const _NEIGHBORHOOD_TITLE_RE =
  /^([A-Za-z][A-Za-z\s'.]{1,60}?)(?:,\s*([A-Z]{2}))?\s+(?:homes?\s+for\s+sale|real\s+estate(?:\s*&\s*homes?\s+for\s+sale)?|propert(?:y|ies)(?:\s+for\s+sale)?|listings?|condos?(?:\s+for\s+sale)?|townhomes?(?:\s+for\s+sale)?|houses?\s+for\s+sale|neighborhoods?|communit(?:y|ies)|realty|market\s+trends?)/i;

/** "Homes for Sale in Austin, TX", "Properties in Bradenton" */
const _NEIGHBORHOOD_IN_RE =
  /^(?:homes?\s+for\s+sale|propert(?:y|ies)|listings?|condos?(?:\s+for\s+sale)?|houses?\s+for\s+sale)\s+in\s+([A-Za-z][A-Za-z\s'.]{1,60}?)(?:,\s*([A-Z]{2}))?(?:\s*[-–|].*)?$/i;

const _NON_NEIGHBORHOOD_SLUGS = new Set([
  'listings', 'listing', 'search', 'results', 'homes', 'homes-for-sale',
  'for-sale', 'for-rent', 'buy', 'rent', 'properties', 'property',
  'details', 'detail', 'real-estate', 'realestate', 'mls', 'idx',
  'featured', 'sold', 'pending', 'new-construction', 'luxury',
  'residential', 'commercial', 'about', 'contact', 'team', 'blog',
  'news', 'page', 'home', 'services', 'resources', 'agents', 'agent',
  'buyers', 'sellers', 'market', 'community', 'communities',
  'neighborhoods', 'neighborhood', 'areas', 'area', 'map', 'gallery',
  'photos', 'video', 'virtual-tour', 'login', 'register', 'signup',
  'account', 'profile', 'privacy', 'terms', 'sitemap', 'faq', 'help',
  'index', 'estate', 'estates',
]);

function _titleCaseWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract a city/neighbourhood name from area page titles, e.g.:
 *   "Bradenton Homes for Sale"      → "Bradenton"
 *   "Bradenton, FL Real Estate"     → "Bradenton, FL"
 *   "Homes for Sale in Austin, TX"  → "Austin, TX"
 */
export function extractNeighborhoodFromTitle(rawTitle) {
  if (!rawTitle) return null;
  let title = rawTitle.trim();
  if (title.includes(' | ')) title = title.split(' | ', 1)[0].trim();
  if (title.includes(' – ')) title = title.split(' – ', 1)[0].trim();
  if (!title) return null;

  const m1 = title.match(_NEIGHBORHOOD_TITLE_RE);
  if (m1) {
    const city = m1[1].trim().replace(/,\s*$/, '');
    const state = m1[2] || '';
    if (city && !/^\d/.test(city) && city.length >= 4) {
      if (state && _US_STATE_ABBREVS.has(state.toLowerCase())) {
        return `${_titleCaseWords(city)}, ${state.toUpperCase()}`;
      }
      return _titleCaseWords(city);
    }
  }

  const m2 = title.match(_NEIGHBORHOOD_IN_RE);
  if (m2) {
    const city = m2[1].trim().replace(/,\s*$/, '');
    const state = m2[2] || '';
    if (city && !/^\d/.test(city) && city.length >= 4) {
      if (state && _US_STATE_ABBREVS.has(state.toLowerCase())) {
        return `${_titleCaseWords(city)}, ${state.toUpperCase()}`;
      }
      return _titleCaseWords(city);
    }
  }

  return null;
}

/**
 * Extract a city/neighbourhood from URLs like:
 *   /bradenton-fl/               → "Bradenton, FL"
 *   /neighborhoods/melbourne-fl  → "Melbourne, FL"
 *   /neighborhoods/bradenton     → "Bradenton"
 *   /bradenton/                  → "Bradenton"
 */
export function extractNeighborhoodFromUrl(url) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, '');
    if (!path) return null;

    const segments = path.split('/').filter(Boolean);

    // Walk from deepest segment upward (most specific first)
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const raw = segments[i].toLowerCase().replace(/\.(html?|php|aspx?)$/, '');
      if (!raw || /^\d/.test(raw) || raw.length < 3 || raw.length > 60) continue;
      if (_NON_NEIGHBORHOOD_SLUGS.has(raw)) continue;
      if (/\d/.test(raw)) continue;
      if (!/^[a-z]+(?:-[a-z]+)*$/.test(raw)) continue;

      const parts = raw.split('-');
      if (parts.length >= 2 && _US_STATE_ABBREVS.has(parts[parts.length - 1])) {
        const state = parts[parts.length - 1].toUpperCase();
        const name = parts.slice(0, -1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        if (name) return `${name}, ${state}`;
      }

      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
  } catch { /* best-effort */ }
  return null;
}

// CSS selectors that target footer elements on any website layout
const _FOOTER_SELECTORS = [
  'footer',
  '[role="contentinfo"]',
  '[class*="footer"]',
  '[id*="footer"]',
  '[class*="Footer"]',
  '[id*="Footer"]',
].join(',');

/**
 * Scan the page footer for a US street address.
 * Useful for community/neighbourhood pages where the footer contains
 * the HOA or office address (e.g. "3500 Bishops Gate Blvd, Mt Laurel, NJ 08054").
 */
function extractFromFooter() {
  const footerEls = document.querySelectorAll(_FOOTER_SELECTORS);
  if (!footerEls.length) return null;

  for (const footer of footerEls) {
    const text = (footer.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const match = text.match(_ADDR_RE);
    if (match) return match[0].trim();

    const noComma = tryNoCommaAddressInText(text);
    if (noComma) return noComma;
  }
  return null;
}

/**
 * Top-level entry point used by the popup/inline SDK bundles.
 *
 * ``opts.searchPageContent`` enables the (relatively expensive) full-document
 * text walk after the cheaper structured extractors fail. Defaults off so
 * sites that already expose JSON-LD or OG tags don't pay for it.
 */
export function extractAddressFromPage(opts = {}) {
  // Title is checked first: on listing pages the address is the page subject
  // and appears at the start of document.title — the most reliable signal.
  // JSON-LD may contain agent/office addresses unrelated to the listing.
  const fromTitle = extractFromDocumentTitle();
  if (fromTitle) return fromTitle;

  const fromStructured = extractFromJsonLd() || extractFromOgMeta() || extractFromMicrodata();
  if (fromStructured) return fromStructured;

  if (opts.searchPageContent) {
    const fromText = extractFromVisibleText();
    if (fromText) return fromText;
  }

  // Footer scan: catches pages where the address is only in the footer
  // (e.g. community pages with a footer showing the HOA/office line).
  const fromFooter = extractFromFooter();
  if (fromFooter) return fromFooter;

  // URL slug address: handles listing pages where the address is embedded in
  // the URL path (e.g. /3309-n-indian-river-drive-fort-pierce-fl-34946/).
  // Must run before neighborhood extraction to prevent non-geographic path
  // segments like "popup" or "bill" from being returned as fake locations.
  const fromUrlSlug = extractAddressFromUrl(window.location.href);
  if (fromUrlSlug) return fromUrlSlug;

  return extractNeighborhoodFromTitle(document.title)
    || extractNeighborhoodFromUrl(window.location.href)
    || null;
}
