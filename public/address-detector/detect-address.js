/**
 * Working out which house the visitor is looking at.
 *
 * This is the most-used thing we do: it runs on every page view, on every site, for both products.
 * When it is wrong the visitor sees somebody else's neighborhood, and nothing on screen says so.
 *
 * ## Why this module exists
 *
 * We used to read the page exactly once, at `DOMContentLoaded`, and never look again. Several
 * real-estate platforms build the listing in the browser *after* that. Measured on a live iHomeFinder
 * (Kestrel) customer page: nothing at 344ms, nothing at 756ms, address present by 1065ms. We looked at
 * 344ms and gave up, so it failed on every load of every page on that platform. Dream Schools hit the
 * same thing on iHomeFinder and again on IDX Broker; we have the identical fault and had simply not
 * been told yet, having fewer sites running the embed.
 *
 * So: read once, and if there is nothing, keep watching for a few seconds.
 *
 * ## Why waiting is safe here
 *
 * The embed already sits blank while it works the address out — the iframe is created but its `src` is
 * not set until coordinates resolve. Waiting extends a pause that already exists rather than
 * introducing a swap, so nothing moves under the visitor's cursor. Pages that render normally are
 * completely unaffected: they resolve on the first read, in the same millisecond as before.
 *
 * ## Why it also judges whether the page is a listing
 *
 * Because of what happens when the wait expires. Two situations look identical from in here and are
 * completely different for the customer:
 *
 * - The page genuinely has no address (a search results page, an agency home page). The realtor's
 *   configured address is exactly right; it is what they configured it for.
 * - The page has an address and we failed to read it. Their configured address is now wrong, and wrong
 *   in the worst way: a specific real place, shown with total confidence, possibly in another county.
 *
 * That second case is what showed a Lake Tahoe customer's visitors schools in Reno, 45 miles away. So
 * the caller needs to know which it is, and `looksLikeSingleListing` is that signal.
 */

import {
  extractAddressFromPage,
  extractCoordsFromPage,
  extractNeighborhoodFromTitle,
  extractNeighborhoodFromUrl,
} from './extract-address.js';

/**
 * Shared with Dream Neighborhood Schools, which vendors this file and `extract-address.js` verbatim.
 *
 * Dream Neighborhood is upstream. Every change lands here first, then gets copied over. The two files
 * have no imports beyond each other and read no DN configuration, which is what makes that copy safe.
 *
 * Bump this whenever either file changes in a way that alters behaviour. `detector.lock.json` records
 * the version alongside a hash of both files, `/explorer/address-detector.json` publishes it, and a test
 * fails if the files move without the version moving too. That is what stops the two copies drifting
 * silently, which is how the same platform bug came to be fixed twice already.
 */
export const DETECTOR_VERSION = 2;

//: How long to keep watching before giving up. Kestrel resolves around a second; three gives room for
//: a slower connection without leaving an address-less page blank for an uncomfortable time.
export const DETECT_WINDOW_MS = 3000;

//: How long to wait on a page that does not look like a single listing. There is probably no address
//: coming, so this only has to be long enough for late-arriving listing markers to declare themselves,
//: at which point the full window applies. Kept short because most page views are these.
export const NOT_A_LISTING_MS = 1000;

//: How often to re-read when the observer has not fired. A belt to the observer's braces: some
//: platforms set the title via the History API or a framework head-manager without touching a node we
//: are watching.
const POLL_MS = 150;

/**
 * Read whatever the page can tell us right now, without waiting.
 *
 * `title` and `url` matter as well as `address`: the server can pull an address out of either when the
 * structured data is absent, so "we have something to send" is broader than "we found an address".
 */
export function readPageNow({ searchPageContent = false } = {}) {
  let address = '';
  try {
    address = extractAddressFromPage({ searchPageContent }) || '';
  } catch {
    // A malformed page must not stop us sending the title and URL, which are often enough.
    address = '';
  }
  let coords = null;
  try {
    coords = extractCoordsFromPage();
  } catch {
    coords = null;
  }
  const title = (typeof document !== 'undefined' && document.title) || '';
  return {
    address,
    coords,
    title,
    url: (typeof window !== 'undefined' && window.location && window.location.href) || '',
    guessed: Boolean(address) && (address === urlSlugGuess() || address === titleGuess(title)),
  };
}

/**
 * The extractor's two last-resort strategies, which do not read an address so much as name a place.
 *
 * `/bradenton-fl/` becomes "Bradenton, FL", and "Featured Property | Kestrel Realty" becomes "Featured".
 * Recomputed here to find out whether one of those is all we got.
 */
function urlSlugGuess() {
  try {
    return extractNeighborhoodFromUrl(window.location.href) || '';
  } catch {
    return '';
  }
}

function titleGuess(title) {
  try {
    return extractNeighborhoodFromTitle(title) || '';
  } catch {
    return '';
  }
}

/**
 * Is there an address worth geocoding yet, or should we keep waiting?
 *
 * Only a real address counts. Two things that look like signals are not:
 *
 * - **A title existing.** Every page has one from its first byte, so accepting it means resolving at 0ms
 *   on every real site and never waiting for anything. This module shipped with `|| read.title` in this
 *   condition, which made the whole thing inert: it behaved exactly like the one-shot scrape it was
 *   written to replace, and passed its own browser check only because that check's fixture had an empty
 *   `<title>`, which no real page does. Found by Dream Schools before they wired it up.
 * - **A place name guessed from the URL or the title.** Same defect one step down: both are available
 *   before the page has rendered anything, so counting them means the wait never runs on any site whose
 *   paths or titles contain a word, which is all of them.
 *
 * A URL slug or title that spells out a full street address is different and does count: the extractor
 * returns those from strategies above the place-name guesses, so they never look like a bare guess.
 */
function haveSomething(read) {
  // Coordinates the page states outright settle it on their own: they are the position, so there is
  // nothing left to geocode and nothing to wait for.
  return Boolean(read.coords || (read.address && !read.guessed));
}

//: URL shapes that mean "one property", not a list of them. Matched against the path and query.
const LISTING_URL = [
  /\/listing[s]?[/?]/i,
  /\/property[/?-]/i,
  /\/properties\/[^/]+/i,
  /\/home-?details?/i,
  /\/homes?\/[^/]+\/[^/]+/i,
  /\/idx\/[^/]*(detail|listing|property)/i,
  /[?&](listingid|listing_id|mlsid|mls_id|propertyid)=/i,
  /[?&]id=\d/i,
];

//: Containers the big IDX platforms mount a listing into. Their presence says the page is theirs; the
//: address arriving late is exactly the behaviour we are waiting for.
const LISTING_CONTAINERS = [
  '.ihf-container', '.ihf-detail', '[class*="ihf-listing"]',   // iHomeFinder / Kestrel
  '#idx-details-content', '.IDX-detailsField', '[id^="idx-"]',  // IDX Broker
  '[class*="ylopo"]', '[data-ylopo]',                            // Ylopo
  '[class*="sierra-listing"]',                                   // Sierra Interactive
  '[itemtype*="SingleFamilyResidence"]', '[itemtype*="Residence"]',
];

//: An MLS number on the page. Strong: index pages list many, detail pages name one, and neither a home
//: page nor a blog post carries one at all.
const MLS_ON_PAGE = /\bMLS\s*#?\s*[:\s]?\s*[A-Z0-9-]{5,}/i;

/**
 * Does this page look like one property rather than a list of them or a marketing page?
 *
 * Only ever used to decide whether an unreadable page gets a label. A false positive puts an
 * explanatory line on a page that had no listing, which is mild; a false negative silently substitutes
 * the realtor's configured address, which is the failure we are trying to stop. Even so this is kept
 * conservative, because a label that appears on the wrong pages stops being read.
 */
export function looksLikeSingleListing({ scanText = true } = {}) {
  try {
    const href = window.location.href || '';
    if (LISTING_URL.some((pattern) => pattern.test(href))) return true;
    if (LISTING_CONTAINERS.some((selector) => document.querySelector(selector))) return true;
    if (!scanText) return false;
    // `textContent`, not `innerText`: the latter forces a layout pass, and this runs on every page view
    // on every customer site. `scanText: false` skips even this while polling, because reading the whole
    // body builds the entire string before the slice and we would be doing it several times a second.
    const text = (document.body && document.body.textContent) || '';
    return MLS_ON_PAGE.test(text.slice(0, 4000));
  } catch {
    return false;
  }
}

/**
 * Read the page, and if it has no address yet, watch until it does.
 *
 * Resolves the moment a real address appears, so a server-rendered page is not delayed at all. Always
 * resolves; never rejects; never waits longer than `windowMs`.
 *
 * How long it is worth waiting depends on what kind of page this is, and that is why the listing check
 * is in here rather than only in the result. A single listing with no address yet is a page still
 * building, and worth the full window. A search page or an agency home page has no address coming, and
 * making every one of those sit through three seconds would be a real cost paid on most page views to
 * fix a problem they do not have. So they get a short grace period instead, long enough for the listing
 * markers themselves to arrive late, which is re-checked as the page fills in: a page that declares
 * itself a listing during the grace period gets the full window after all.
 */
export function detectPageAddress({
  searchPageContent = false,
  windowMs = DETECT_WINDOW_MS,
  graceMs = NOT_A_LISTING_MS,
} = {}) {
  const startedAt = Date.now();

  const first = readPageNow({ searchPageContent });
  if (haveSomething(first) || typeof MutationObserver === 'undefined') {
    return Promise.resolve({
      ...first,
      waitedMs: 0,
      found: haveSomething(first),
      looksLikeListing: looksLikeSingleListing(),
    });
  }

  return new Promise((resolve) => {
    let observer = null;
    let poll = null;
    let backstop = null;
    //: Sticky: once a page has looked like a listing it keeps the longer deadline, so markers that come
    //: and go during rendering cannot shorten the wait.
    let listing = looksLikeSingleListing();

    const settle = (read) => {
      if (observer) observer.disconnect();
      if (poll) clearInterval(poll);
      if (backstop) clearTimeout(backstop);
      resolve({
        ...read,
        waitedMs: Date.now() - startedAt,
        found: haveSomething(read),
        looksLikeListing: listing || looksLikeSingleListing(),
      });
    };

    const check = () => {
      // Cheap re-check only: the URL and container tests, not the whole-body text scan, which would
      // build the page's entire text several times a second.
      if (!listing) listing = looksLikeSingleListing({ scanText: false });
      const read = readPageNow({ searchPageContent });
      const deadline = listing ? windowMs : graceMs;
      if (haveSomething(read) || Date.now() - startedAt >= deadline) settle(read);
    };

    // The title is in <head> and the listing is in <body>, so both are watched. `characterData` because
    // a framework updating <title> often mutates the existing text node rather than replacing it.
    try {
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
      });
    } catch {
      observer = null;
    }
    poll = setInterval(check, POLL_MS);
    backstop = setTimeout(() => settle(readPageNow({ searchPageContent })), windowMs);
  });
}
