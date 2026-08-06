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

import { extractAddressFromPage, extractNeighborhoodFromUrl } from './extract-address.js';

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
export const DETECTOR_VERSION = 1;

//: How long to keep watching before giving up. Kestrel resolves around a second; three gives room for
//: a slower connection without leaving an address-less page blank for an uncomfortable time.
export const DETECT_WINDOW_MS = 3000;

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
  return {
    address,
    title: (typeof document !== 'undefined' && document.title) || '',
    url: (typeof window !== 'undefined' && window.location && window.location.href) || '',
    fromUrlOnly: Boolean(address) && address === urlSlugGuess(),
  };
}

/**
 * The extractor's last-resort strategy: a place name guessed from a path segment, so `/bradenton-fl/`
 * becomes "Bradenton, FL". Recomputed here to find out whether that is all we got.
 */
function urlSlugGuess() {
  try {
    return extractNeighborhoodFromUrl(window.location.href) || '';
  } catch {
    return '';
  }
}

/**
 * Is there anything worth geocoding yet, or should we keep waiting?
 *
 * "Worth" is doing real work here. A guess made from the URL does not count, even though the extractor
 * will happily return one, because the URL is complete from the first millisecond and does not change
 * while we wait. Counting it would mean the wait never happens on any site whose paths contain a word
 * — which is most of them, and includes the client-rendered platforms this was written for. The one
 * that caught it locally was a page at `/late.html`, cheerfully reported as the neighborhood of "Late".
 *
 * A URL slug that spells out a full street address is different and does count: the extractor returns
 * that from a strategy above this one, so it never looks like a bare place-name guess.
 */
function haveSomething(read) {
  return Boolean((read.address && !read.fromUrlOnly) || read.title);
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
export function looksLikeSingleListing() {
  try {
    const href = window.location.href || '';
    if (LISTING_URL.some((pattern) => pattern.test(href))) return true;
    if (LISTING_CONTAINERS.some((selector) => document.querySelector(selector))) return true;
    // `textContent`, not `innerText`: the latter forces a layout pass, and this runs on every page view
    // on every customer site.
    const text = (document.body && document.body.textContent) || '';
    return MLS_ON_PAGE.test(text.slice(0, 4000));
  } catch {
    return false;
  }
}

/**
 * Read the page, and if it has nothing yet, watch until it does.
 *
 * Resolves as soon as there is something, so the overwhelming majority of sites are not delayed at all.
 * Always resolves; never rejects; never waits longer than `windowMs`.
 */
export function detectPageAddress({ searchPageContent = false, windowMs = DETECT_WINDOW_MS } = {}) {
  const startedAt = Date.now();

  const settle = (read, resolve, observer, timer, poll) => {
    if (observer) observer.disconnect();
    if (timer) clearTimeout(timer);
    if (poll) clearInterval(poll);
    resolve({
      ...read,
      waitedMs: Date.now() - startedAt,
      found: haveSomething(read),
      looksLikeListing: looksLikeSingleListing(),
    });
  };

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
    let timer = null;
    let poll = null;

    const check = () => {
      const read = readPageNow({ searchPageContent });
      if (haveSomething(read)) settle(read, resolve, observer, timer, poll);
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
    timer = setTimeout(
      () => settle(readPageNow({ searchPageContent }), resolve, observer, timer, poll),
      windowMs,
    );
  });
}
