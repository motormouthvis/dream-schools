/*!
 * Dream Neighborhood Schools — embeddable "School Rating Explorer" SDK.
 *
 * One-line embed (floating popup) on any partner site:
 *   <script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
 *
 * Inline embed (mounts into a container instead of a floating bubble):
 *   <div id="dream-schools-explorer"></div>
 *   <script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
 *
 * Optional data-* on the <script> (popup) or container (inline) override the
 * server-resolved config:
 *   data-partner-id, data-widget-number, data-accent-color, data-position,
 *   data-bottom-offset, data-tooltip-message, data-require-address,
 *   data-search-page-content, data-suppress-on-inline, data-min-height,
 *   data-show-header, data-address, data-lat, data-lng, data-api-base
 *
 * data-via="dn-explorer" on the <script> marks a hand-off: Dream Neighborhood's
 * sdk.js loaded us because it evaluated entitlement and decided its own
 * Neighborhood Explorer will not render. See VIA_DN_EXPLORER below.
 *
 * The SDK resolves per-host config from /api/embed/config, best-effort scrapes
 * the listing address from the page, and opens a chrome-less explorer iframe
 * (/embed) scoped to that address. Self-contained: no external CSS/deps.
 */
(function () {
  "use strict";

  var SCRIPT_EL = document.currentScript;
  var INLINE_SELECTORS = [
    "#dream-schools-explorer",
    ".dream-schools-explorer",
    "[data-dream-schools-explorer]",
  ];

  // Hand-off from Dream Neighborhood's sdk.js. Under the shared-popup model a
  // realtor pastes only DN's tag; DN resolves entitlement and, when the answer
  // is "not entitled", injects this script with data-via="dn-explorer". The
  // attribute therefore means DN has ALREADY decided its Neighborhood Explorer
  // will not render — no ready signal is coming.
  //
  // Published on window as well as read off our own tag, so a page carrying the
  // old two-snippet install (our tag parsed early, DN's hand-off injected
  // later) can tell its already-running instance to stop waiting.
  var VIA_DN_EXPLORER_FLAG = "__DSE_VIA_DN_EXPLORER__";
  var VIA_DN_EXPLORER_EVENT = "dse:via-dn-explorer";

  function viaDnExplorer() {
    try {
      return !!window[VIA_DN_EXPLORER_FLAG];
    } catch (e) {
      return false;
    }
  }

  try {
    if (String((SCRIPT_EL && SCRIPT_EL.getAttribute("data-via")) || "").trim().toLowerCase() === "dn-explorer") {
      window[VIA_DN_EXPLORER_FLAG] = true;
      window.dispatchEvent(new Event(VIA_DN_EXPLORER_EVENT));
    }
  } catch (e) {}

  // Loading embed.js twice must be harmless. DN guards with its own window flag,
  // but a site can still end up with two tags (their own popup snippet plus DN's
  // hand-off). Inline mode is already idempotent; the floating popup is not — a
  // second boot would append a second #dse-root and a second bubble. Bail after
  // publishing the hand-off flag above, so the running instance still benefits.
  var LOADED_FLAG = "__DSE_EMBED_LOADED__";
  try {
    if (window[LOADED_FLAG]) return;
    window[LOADED_FLAG] = true;
  } catch (e) {}

  function deriveApiBase(el) {
    var attr = el && el.getAttribute("data-api-base");
    if (attr) return attr.replace(/\/$/, "");
    try {
      if (el && el.src) return new URL(el.src).origin;
    } catch (e) {}
    return "";
  }

  // -------------------------------------------------------------------------
  // Config attribute parsing
  // -------------------------------------------------------------------------

  function boolAttr(el, name) {
    if (!el || !el.hasAttribute(name)) return null;
    return el.getAttribute(name) === "true";
  }
  function intAttr(el, name, min) {
    if (!el || !el.hasAttribute(name)) return null;
    var n = parseInt(el.getAttribute(name), 10);
    if (!isFinite(n)) return null;
    return min != null ? Math.max(min, n) : n;
  }

  function escHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  function floatAttr(el, name) {
    if (!el || !el.hasAttribute(name)) return null;
    var n = parseFloat(el.getAttribute(name));
    return isFinite(n) ? n : null;
  }
  function normPosition(v) {
    return String(v || "right").toLowerCase() === "left" ? "left" : "right";
  }

  var DEFAULTS = {
    accentColor: "#1fa55f",
    position: "right",
    bottomOffset: 0,
    tooltipMessage: "",
    requireAddress: false,
    searchPageContent: false,
    suppressOnInline: false,
    showExternalLinks: false,
    inlineMinHeight: 540,
    inlineMinHeightExplicit: false,
    inlineShowHeader: false,
    inlineVariant: "classic", // "classic" (existing) | "full" (new Nearby Schools design)
    neighborhoodExplorerGraceMs: 4000,
  };

  function presentationFromRemote(remote) {
    if (!remote || typeof remote !== "object") return Object.assign({}, DEFAULTS);
    var popup = remote.popup && typeof remote.popup === "object" ? remote.popup : remote;
    var inline = remote.inline && typeof remote.inline === "object" ? remote.inline : {};
    var grace = typeof remote.neighborhoodExplorerGraceMs === "number"
      ? remote.neighborhoodExplorerGraceMs
      : DEFAULTS.neighborhoodExplorerGraceMs;
    return {
      accentColor: typeof remote.accentColor === "string" && remote.accentColor ? remote.accentColor : DEFAULTS.accentColor,
      position: normPosition(popup.position),
      bottomOffset: typeof popup.bottomOffset === "number" ? Math.max(0, popup.bottomOffset | 0) : DEFAULTS.bottomOffset,
      tooltipMessage: typeof popup.tooltipMessage === "string" ? popup.tooltipMessage : DEFAULTS.tooltipMessage,
      requireAddress: typeof popup.requireAddress === "boolean" ? popup.requireAddress : DEFAULTS.requireAddress,
      suppressOnInline: typeof popup.suppressOnInline === "boolean" ? popup.suppressOnInline : DEFAULTS.suppressOnInline,
      showExternalLinks: typeof remote.showExternalLinks === "boolean" ? remote.showExternalLinks : DEFAULTS.showExternalLinks,
      searchPageContent: typeof remote.searchPageContent === "boolean" ? remote.searchPageContent : DEFAULTS.searchPageContent,
      inlineMinHeight: typeof inline.minHeight === "number" ? Math.max(200, inline.minHeight | 0) : DEFAULTS.inlineMinHeight,
      inlineMinHeightExplicit: false,
      inlineShowHeader: typeof inline.showHeader === "boolean" ? inline.showHeader : DEFAULTS.inlineShowHeader,
      inlineVariant:
        inline.variant === "full" ? "full" : inline.variant === "minimalist" ? "minimalist" : DEFAULTS.inlineVariant,
      neighborhoodExplorerGraceMs: Math.max(2000, Math.min(15000, grace | 0) || DEFAULTS.neighborhoodExplorerGraceMs),
    };
  }

  function applyOverrides(p, el) {
    if (!el) return p;
    var next = Object.assign({}, p);
    if (el.hasAttribute("data-accent-color") && el.getAttribute("data-accent-color")) next.accentColor = el.getAttribute("data-accent-color");
    if (el.hasAttribute("data-position")) next.position = normPosition(el.getAttribute("data-position"));
    var bo = intAttr(el, "data-bottom-offset", 0);
    if (bo !== null) next.bottomOffset = bo;
    if (el.hasAttribute("data-tooltip-message")) next.tooltipMessage = el.getAttribute("data-tooltip-message") || "";
    var ra = boolAttr(el, "data-require-address");
    if (ra !== null) next.requireAddress = ra;
    var sp = boolAttr(el, "data-search-page-content");
    if (sp !== null) next.searchPageContent = sp;
    var soi = boolAttr(el, "data-suppress-on-inline");
    if (soi !== null) next.suppressOnInline = soi;
    var sxl = boolAttr(el, "data-show-external-links");
    if (sxl !== null) next.showExternalLinks = sxl;
    var mh = intAttr(el, "data-min-height", 200);
    if (mh !== null) {
      next.inlineMinHeight = mh;
      next.inlineMinHeightExplicit = true;
    }
    var sh = boolAttr(el, "data-show-header");
    if (sh !== null) next.inlineShowHeader = sh;
    if (el.hasAttribute("data-variant")) {
      var v = (el.getAttribute("data-variant") || "").trim().toLowerCase();
      next.inlineVariant = v === "full" ? "full" : v === "minimalist" ? "minimalist" : "classic";
    }
    return next;
  }

  function readIdentity(el, apiBase) {
    return {
      partnerId: (el && el.getAttribute("data-partner-id")) || "",
      widgetNumber: (el && el.getAttribute("data-widget-number")) || "1",
      apiBase: apiBase,
    };
  }

  // The customer comes from Dream Neighborhood, keyed on this page's hostname.
  // DN holds customers; we hold school data and keep no copy of who anybody is.
  //
  // Three answers, three meanings. A 404 says "not a customer, switched off, or
  // offboarded" and must render nothing — that is what makes switching a
  // customer off actually reach this widget. Anything else that isn't an answer
  // is an outage, and is handled server-side by falling back to DN's own last
  // good answer rather than by us guessing.
  function fetchConfig(apiBase, host) {
    var url = apiBase + "/api/embed/dn-config?host=" + encodeURIComponent(host);
    return fetch(url, { method: "GET", mode: "cors", credentials: "omit" })
      .then(function (r) {
        if (r.status === 404) return { unknownHost: true };
        if (!r.ok) return null;
        return r.json();
      })
      .catch(function () { return null; });
  }

  /**
   * DN hands off with the customer's settings already on the tag, so there is
   * nothing left to look up — asking again would only be a second chance to get
   * a different answer.
   */
  function configFromHandOff(anchorEl) {
    var pres = applyOverrides(presentationFromRemote(null), anchorEl);
    var fallback = (SCRIPT_EL && SCRIPT_EL.getAttribute("data-fallback-address")) || "";
    return {
      widgetNumber: "1",
      // Only used when the page itself yields no address — a real listing
      // address on the page must still win.
      defaultAddress: fallback,
      presentation: pres,
    };
  }

  function resolveConfig(anchorEl, apiBase) {
    var identity = readIdentity(anchorEl, apiBase);
    var widgetNumber = identity.widgetNumber;

    if (viaDnExplorer()) {
      var handed = configFromHandOff(anchorEl);
      return Promise.resolve(buildConfig(handed.presentation, apiBase, handed.widgetNumber, {
        defaultAddress: handed.defaultAddress,
      }));
    }

    return fetchConfig(apiBase, location.hostname).then(function (remote) {
      // Not a customer. Nothing renders — this is the off switch reaching us.
      if (!remote || remote.unknownHost) return { disabledReason: "unknown_host" };
      if (remote.widgetNumber != null) widgetNumber = String(remote.widgetNumber);
      var pres = applyOverrides(presentationFromRemote(remote), anchorEl);
      return buildConfig(pres, apiBase, widgetNumber, {
        defaultAddress: remote.defaultAddress || "",
        defaultLat: typeof remote.defaultLat === "number" ? remote.defaultLat : null,
        defaultLng: typeof remote.defaultLng === "number" ? remote.defaultLng : null,
        partnerId: identity.partnerId || remote.partnerId || "",
        // The white-label name is what a visitor should see: for a realtor under
        // a partner it is the partner's brand, which is the whole point of white
        // labelling. displayName is the realtor's own name and companyName is
        // for DN's dashboard, so neither belongs in front of a homebuyer.
        providerName: remote.whiteLabelName || remote.displayName || "",
        // When the upgrade prompt may appear, decided per customer in DN.
        upgradePrompt: remote.upgradePrompt || null,
      });
    });
  }

  function buildConfig(pres, apiBase, widgetNumber, extra) {
    extra = extra || {};
    var partnerId = extra.partnerId || "";
    return (function () {
      return {
        partnerId: partnerId,
        widgetNumber: widgetNumber,
        apiBase: apiBase,
        defaultAddress: extra.defaultAddress || "",
        defaultLat: extra.defaultLat != null ? extra.defaultLat : null,
        defaultLng: extra.defaultLng != null ? extra.defaultLng : null,
        providerName: extra.providerName || "",
        businessName: "",
        customerId: partnerId,
        customerPartnerId: "",
        upgradePrompt: extra.upgradePrompt || null,
        accentColor: pres.accentColor,
        position: pres.position,
        bottomOffset: pres.bottomOffset,
        tooltipMessage: pres.tooltipMessage,
        requireAddress: pres.requireAddress,
        searchPageContent: pres.searchPageContent,
        suppressOnInline: pres.suppressOnInline,
        showExternalLinks: pres.showExternalLinks,
        inlineMinHeight: pres.inlineMinHeight,
        inlineMinHeightExplicit: pres.inlineMinHeightExplicit,
        inlineShowHeader: pres.inlineShowHeader,
        inlineVariant: pres.inlineVariant,
        neighborhoodExplorerGraceMs: pres.neighborhoodExplorerGraceMs,
      };
    })();
  }

  // -------------------------------------------------------------------------
  // Address scraping (mirrors lib/addressExtract.ts + the reference SDK)
  // -------------------------------------------------------------------------

  var US_STATES = {};
  ("al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc").split(" ").forEach(function (s) { US_STATES[s] = true; });
  var DIRECTIONALS = { n: 1, s: 1, e: 1, w: 1, ne: 1, nw: 1, se: 1, sw: 1 };
  var STREET_SUFFIXES = {};
  ["st","street","ave","avenue","blvd","boulevard","dr","drive","rd","road","ln","lane","ct","court","pl","place","way","cir","circle","pkwy","parkway","ter","terrace","trl","trail","hwy","highway","cv","cove","pt","point","loop","path","run","pass","walk","row","xing","crossing","vw","view","oval","sq","square","aly","alley","rdg","ridge","gln","glen","knl","knoll","holw","hollow","crst","crest","mnr","manor","cres","crescent","brg","bridge","grn","green","unit","apt","ste","suite"].forEach(function (s) { STREET_SUFFIXES[s] = true; });

  var JSONLD_NON_PROPERTY = { realestateagent:1, organization:1, corporation:1, localbusiness:1, person:1, professionalservice:1, webpage:1, website:1, breadcrumblist:1 };
  var ADDR_RE = /\d{1,6}\s+[A-Za-z0-9#'.]+(?:\s+[A-Za-z0-9#'.]+)*\s*,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?/;
  var TITLE_COMMA_RE = /^(\d+\s+[A-Za-z0-9\s.#]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)/;
  var TITLE_SINGLE_COMMA_RE = /^(\d+\s+[A-Za-z0-9\s.#]+?)(?:\s+in\s+|\s*,\s*)([A-Za-z][A-Za-z\s]*?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?/;
  var SLUG_ADDRESS_RE = /(\d+[-–][a-zA-Z0-9]+(?:[-–][a-zA-Z0-9]+)*[-–][a-zA-Z]{2,})(?:[-–](\d{5}))?/;

  function capWord(w) { var n = w.replace(/[.,#]+$/, ""); return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : n; }
  function normTok(t) { return t.trim().replace(/[.,#]+$/g, ""); }

  function flattenLd(data) {
    if (Array.isArray(data)) return data.reduce(function (a, x) { return a.concat(flattenLd(x)); }, []);
    if (data && typeof data === "object") {
      var items = [data];
      if (data["@graph"]) items = items.concat(flattenLd(data["@graph"]));
      return items;
    }
    return [];
  }
  function isNonProperty(item) {
    var raw = item["@type"];
    if (!raw) return false;
    var types = Array.isArray(raw) ? raw : [raw];
    return types.some(function (t) { return JSONLD_NON_PROPERTY[String(t).toLowerCase()]; });
  }
  function fromJsonLd() {
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        var items = flattenLd(JSON.parse(scripts[i].textContent));
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          if (isNonProperty(item)) continue;
          var addr = item.address || (item.location && item.location.address);
          if (typeof addr === "string") return addr;
          if (addr && addr.streetAddress) {
            return [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", ");
          }
        }
      }
    } catch (e) {}
    return null;
  }
  function metaContent(sel) { var el = document.querySelector(sel); return el ? el.getAttribute("content") : null; }
  function fromOg() {
    var street = metaContent('meta[property="og:street-address"]');
    if (!street) return null;
    return [street, metaContent('meta[property="og:locality"]'), metaContent('meta[property="og:region"]'), metaContent('meta[property="og:postal-code"]')].filter(Boolean).join(", ");
  }
  function microText(sel) { var el = document.querySelector(sel); return el ? (el.textContent || "").trim() : null; }
  function fromMicrodata() {
    var street = microText('[itemprop="streetAddress"]');
    if (!street) return null;
    return [street, microText('[itemprop="addressLocality"]'), microText('[itemprop="addressRegion"]'), microText('[itemprop="postalCode"]')].filter(Boolean).join(", ");
  }

  function parseNoComma(title) {
    var main = (title || "").trim();
    if (!main) return null;
    if (main.indexOf(" | ") >= 0) main = main.split(" | ")[0].trim();
    var m = main.match(/\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (!m) return null;
    if (!US_STATES[m[1].toLowerCase()]) return null;
    var prefix = main.slice(0, m.index).replace(/\s+$/, "");
    var parts = prefix.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    if (!/^\d+$/.test(normTok(parts[0]))) return null;
    parts[0] = normTok(parts[0]);
    var sIdx = null;
    for (var i = 1; i < parts.length; i++) {
      var t = normTok(parts[i]).toLowerCase();
      if (STREET_SUFFIXES[t]) sIdx = i;
      if ((t === "unit" || t === "apt" || t === "ste" || t === "suite") && i + 1 < parts.length) sIdx = i + 1;
    }
    if (sIdx !== null && sIdx + 1 < parts.length && DIRECTIONALS[normTok(parts[sIdx + 1]).toLowerCase()]) sIdx += 1;
    var streetW, cityW;
    if (sIdx !== null && sIdx + 1 < parts.length) { streetW = parts.slice(0, sIdx + 1); cityW = parts.slice(sIdx + 1); }
    else { if (parts.length < 3) return null; streetW = parts.slice(0, -1); cityW = parts.slice(-1); }
    if (!cityW.length) return null;
    return streetW.map(function (w) { return capWord(normTok(w)); }).join(" ") + ", " + cityW.map(function (w) { return capWord(normTok(w)); }).join(" ") + ", " + m[1].toUpperCase() + " " + m[2];
  }
  function fromTitle() {
    var title = (document.title || "").trim();
    if (!title) return null;
    var main = title.indexOf(" | ") >= 0 ? title.split(" | ")[0].trim() : title;
    var cm = main.match(TITLE_COMMA_RE);
    if (cm) return cm[1].trim().replace(/,\s*$/, "");
    var sc = main.match(TITLE_SINGLE_COMMA_RE);
    if (sc && US_STATES[sc[3].toLowerCase()]) {
      var street = sc[1].trim(), city = sc[2].trim();
      if (street && city) return street + ", " + city + ", " + sc[3].toUpperCase() + (sc[4] ? " " + sc[4] : "");
    }
    return parseNoComma(main);
  }

  function trySlug(segment) {
    var match = SLUG_ADDRESS_RE.exec(segment);
    if (!match) return null;
    var parts = match[0].split(/[-–]/);
    if (parts.length < 4) return null;
    var stateIdx = null;
    for (var i = parts.length - 1; i > 1; i--) {
      if (parts[i].length === 2 && US_STATES[parts[i].toLowerCase()]) { stateIdx = i; break; }
    }
    if (stateIdx === null) return null;
    var streetParts = parts.slice(0, stateIdx);
    var sIdx = null;
    for (var k = 0; k < streetParts.length; k++) {
      var p = streetParts[k].toLowerCase();
      if (STREET_SUFFIXES[p]) sIdx = k;
      if ((p === "unit" || p === "apt" || p === "ste" || p === "suite") && k + 1 < streetParts.length) sIdx = k + 1;
    }
    if (sIdx !== null && sIdx + 1 < streetParts.length && DIRECTIONALS[streetParts[sIdx + 1].toLowerCase()]) sIdx += 1;
    var street, city;
    if (sIdx !== null && sIdx + 1 < stateIdx) {
      street = streetParts.slice(0, sIdx + 1).map(capWord).join(" ");
      city = streetParts.slice(sIdx + 1, stateIdx).map(capWord).join(" ");
    } else {
      var cs = Math.max(2, stateIdx - 2);
      street = streetParts.slice(0, cs).map(capWord).join(" ");
      city = streetParts.slice(cs, stateIdx).map(capWord).join(" ");
    }
    if (!street || !city) return null;
    var zip = stateIdx + 1 < parts.length && /^\d{5}$/.test(parts[stateIdx + 1]) ? " " + parts[stateIdx + 1] : "";
    return street + ", " + city + ", " + parts[stateIdx].toUpperCase() + zip;
  }
  function fromUrl(href) {
    try {
      var u = new URL(href);
      var path = decodeURIComponent(u.pathname).replace(/^\/|\/$/g, "");
      if (!path) return null;
      var segs = path.split("/");
      for (var i = 0; i < segs.length; i++) { var a = trySlug(segs[i]); if (a) return a; }
    } catch (e) {}
    return null;
  }

  var SKIP_SELECTORS = 'footer,nav,[class*="contact"],[class*="agent"],[class*="footer"],[class*="nav"],[id*="contact"],[id*="agent"],[id*="footer"]';
  function fromVisibleText() {
    try {
      var skip = new Set();
      var sk = document.querySelectorAll(SKIP_SELECTORS);
      for (var i = 0; i < sk.length; i++) skip.add(sk[i]);
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var par = node.parentElement;
          while (par) { if (skip.has(par)) return NodeFilter.FILTER_REJECT; par = par.parentElement; }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      var node;
      while ((node = walker.nextNode())) {
        var m = node.textContent.match(ADDR_RE);
        if (m) return m[0].trim();
      }
    } catch (e) {}
    return null;
  }
  function fromFooter() {
    var els = document.querySelectorAll('footer,[role="contentinfo"],[class*="footer"],[id*="footer"]');
    for (var i = 0; i < els.length; i++) {
      var text = (els[i].textContent || "").replace(/\s+/g, " ").trim();
      var m = text.match(ADDR_RE);
      if (m) return m[0].trim();
    }
    return null;
  }

  // IDX Broker (idxbroker.com) powers a large share of realtor sites. Its
  // listing detail pages put only an MLS id in the <title>/URL and emit
  // WordPress-only JSON-LD, so none of the generic sources above find the
  // address. It does, however, reliably expose the full address (+ lat/lng)
  // in a global `coords` array and in the lead-capture form's hidden inputs.
  function inputVal(sel) {
    var el = document.querySelector(sel);
    var v = el && (el.value || el.getAttribute("value"));
    return v ? String(v).trim() : null;
  }
  function idxAddrFromObj(c) {
    if (!c || typeof c !== "object") return null;
    var street = (c.address || "").toString().trim();
    if (!street && (c.streetNumber || c.streetName)) {
      street = [c.streetNumber, c.streetDirection, c.streetName, c.unitNumber]
        .map(function (x) { return x == null ? "" : String(x).trim(); })
        .filter(Boolean)
        .join(" ");
    }
    if (!street || !/\d/.test(street)) return null;
    var city = (c.cityName || c.city || "").toString().trim();
    var state = (c.stateAbrv || c.stateAbbr || c.state || "").toString().trim();
    var zip = (c.zipcode || c.zip || c.postalCode || "").toString().trim();
    var out = street;
    if (city) out += ", " + city;
    if (state) out += ", " + state;
    if (zip) out += " " + zip;
    out = out.trim();
    return out || null;
  }
  function fromIdxBroker() {
    // 1) Global `coords` binding IDX declares at page top (best: has stateAbrv).
    try {
      var g = typeof coords !== "undefined" && coords ? coords : window.coords || null;
      var a = idxAddrFromObj(Array.isArray(g) ? g[0] : g);
      if (a) return a;
    } catch (e) {}
    // 2) Parse the inline `coords = [ {...} ];` script text (scope-independent).
    try {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var txt = scripts[i].textContent || "";
        if (txt.indexOf("coords") === -1) continue;
        var m = txt.match(/coords\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*;/);
        if (!m) continue;
        try {
          var data = JSON.parse(m[1]);
          var a2 = idxAddrFromObj(Array.isArray(data) ? data[0] : data);
          if (a2) return a2;
        } catch (e2) {}
      }
    } catch (e) {}
    // 3) IDX lead-capture hidden inputs.
    try {
      var street = inputVal('input[name="address"]');
      if (street && /\d/.test(street)) {
        var city = inputVal('input[name="cityName"]') || inputVal('input[name="city"]');
        var state = inputVal('input[name="state"]');
        var zip = inputVal('input[name="zipcode"]') || inputVal('input[name="zip"]');
        var out = street;
        if (city) out += ", " + city;
        if (state) out += ", " + state;
        if (zip) out += " " + zip;
        out = out.trim();
        if (out) return out;
      }
    } catch (e) {}
    return null;
  }

  function scrapeAddress(opts) {
    var a = fromTitle();
    if (a) return a;
    a = fromIdxBroker();
    if (a) return a;
    a = fromJsonLd() || fromOg() || fromMicrodata();
    if (a) return a;
    if (opts && opts.searchPageContent) { a = fromVisibleText(); if (a) return a; }
    a = fromFooter();
    if (a) return a;
    return fromUrl(location.href);
  }

  function currentScrape(config) {
    try { return scrapeAddress({ searchPageContent: config.searchPageContent }) || ""; }
    catch (e) { return ""; }
  }

  // On SPA route changes the SDK is notified at pushState time — BEFORE the
  // framework has committed the new DOM and updated <title>/JSON-LD/microdata.
  // Scraping then yields the previous page's address (or nothing, forcing the
  // default-address fallback). Poll briefly until the page reflects the new
  // route: the title changes, a new address appears, or we hit the timeout.
  function waitForRouteSettle(config, prevAddr, prevTitle) {
    return new Promise(function (resolve) {
      var start = Date.now();
      var MAX_MS = 2000, STEP_MS = 50;
      (function tick() {
        var title = document.title || "";
        var addr = currentScrape(config);
        var titleChanged = prevTitle ? title !== prevTitle : !!title;
        var addrChanged = !!addr && addr !== prevAddr;
        if (titleChanged || addrChanged || Date.now() - start >= MAX_MS) {
          resolve(currentScrape(config));
          return;
        }
        setTimeout(tick, STEP_MS);
      })();
    });
  }

  // Resolve the page to coordinates via the backend (validates + geocodes,
  // with server-side URL/title fallback). Returns {address, lat, lon} or null.
  // Pass opts.spa (with opts.prevAddr / opts.prevTitle) after a client-side
  // navigation so we wait for the new route to render before scraping.
  /**
   * Where to point when the page yields no address of its own. DN sends
   * coordinates alongside the address, so this costs no geocode.
   */
  function fallbackTarget(config) {
    return {
      address: config.defaultAddress,
      lat: config.defaultLat != null ? config.defaultLat : null,
      lon: config.defaultLng != null ? config.defaultLng : null,
    };
  }

  function geocodePage(config, opts) {
    opts = opts || {};
    var scrapedPromise = opts.spa
      ? waitForRouteSettle(config, opts.prevAddr || "", opts.prevTitle || "")
      : Promise.resolve(currentScrape(config));
    return scrapedPromise.then(function (scraped) {
      scraped = scraped || "";
      return fetch(config.apiBase + "/api/embed/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify({ page_url: location.href, page_title: document.title || "", page_address: scraped }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.success) return { address: d.address || scraped, lat: d.lat, lon: d.lon };
          if (config.defaultAddress) return fallbackTarget(config);
          if (scraped) return { address: scraped, lat: null, lon: null };
          return null;
        })
        .catch(function () {
          if (config.defaultAddress) return fallbackTarget(config);
          return scraped ? { address: scraped, lat: null, lon: null } : null;
        });
    });
  }

  // -------------------------------------------------------------------------
  // Iframe URL
  // -------------------------------------------------------------------------

  /**
   * A homebuyer asking their realtor for the full Neighborhood Explorer.
   *
   * The ask belongs to DN and DN identifies the customer from the Origin of
   * whoever calls it — which is why this runs here, on the realtor's page,
   * rather than inside the explorer iframe, whose origin is ours. We send no
   * identifier of any kind; we do not have one and do not want one.
   *
   * Fire and forget. The visitor has already been told nothing is pending, and
   * DN de-duplicates, so a retry we can't see is not worth a spinner.
   */
  var wiredConfig = null;
  function wireUpgradeRequests(config) {
    wiredConfig = config;
    var apiBase = config.apiBase;
    var expected;
    try {
      expected = new URL(apiBase, location.href).origin;
    } catch (e) {
      return;
    }
    window.addEventListener("message", function (e) {
      if (e.origin !== expected) return;
      if (e.data && e.data.type === "dse:open-school") {
        openSchoolOverlay(wiredConfig, e.data.ncesId, e.data.address);
        return;
      }
      if (!e.data || e.data.type !== "dse:upgrade-request") return;
      try {
        fetch(apiBase + "/api/embed/upgrade-request", {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: String(e.data.address || ""),
            requester_key: String(e.data.requesterKey || ""),
            source: e.data.source === "inline" ? "inline" : "popup",
          }),
        }).catch(function () {});
      } catch (err) {}
    });
  }

  /**
   * Open one school over the realtor's page.
   *
   * The minimalist embed is deliberately short — a few rows — so rendering a
   * school's detail inside it would shove the page's own content down by most
   * of a screen. It asks for this instead, and the visitor never leaves.
   *
   * Built alongside the floating popup rather than inside it, on purpose. The
   * popup carries a bubble, a tooltip, a grace period and a coexistence
   * handshake, none of which apply to something a visitor deliberately opened.
   * Reusing only its stylesheet keeps this from being able to break it.
   */
  var schoolOverlay = null;
  function openSchoolOverlay(config, ncesId, address) {
    if (!config || !config.apiBase || !ncesId) return;
    if (!document.querySelector("style[data-dse-overlay]")) {
      var style = document.createElement("style");
      style.setAttribute("data-dse-overlay", "");
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    if (!schoolOverlay) {
      var root = document.createElement("div");
      root.id = "dse-school-overlay";
      root.style.setProperty("--dse-accent", config.accentColor);
      var title = "Dream Neighborhood School Explorer" + (config.providerName ? " provided by " + config.providerName : "");
      root.innerHTML =
        '<div class="dse-backdrop" style="display:none"><div class="dse-panel">' +
        '<div class="dse-header"><div class="dse-hl"><div class="dse-hicon">' + ICON_PIN + '</div>' +
        '<div class="dse-tw"><span class="dse-title" title="' + escHtml(title) + '">' + escHtml(title) + "</span></div></div>" +
        '<button class="dse-close" aria-label="Close">' + ICON_CLOSE + "</button></div>" +
        '<iframe class="dse-iframe" allow="geolocation" allowfullscreen></iframe></div></div>';
      document.body.appendChild(root);
      var backdrop = root.querySelector(".dse-backdrop");
      function close() {
        backdrop.classList.remove("dse-open");
        backdrop.style.display = "none";
        var f = root.querySelector("iframe.dse-iframe");
        if (f) f.removeAttribute("src");
      }
      root.querySelector(".dse-close").addEventListener("click", close);
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && backdrop.classList.contains("dse-open")) close();
      });
      schoolOverlay = { root: root, backdrop: backdrop, close: close };
    }
    var iframe = schoolOverlay.root.querySelector("iframe.dse-iframe");
    var url = buildIframeUrl(config, address ? { address: address } : null, "popup") + "&school=" + encodeURIComponent(ncesId);
    iframe.setAttribute("src", url);
    schoolOverlay.backdrop.style.display = "";
    void schoolOverlay.backdrop.offsetHeight;
    schoolOverlay.backdrop.classList.add("dse-open");
  }

  function buildIframeUrl(config, coords, mode) {
    var url = config.apiBase + "/embed?mode=" + encodeURIComponent(mode) + "&accent=" + encodeURIComponent(config.accentColor);
    function promptValue(value, fallback) {
      return typeof value === "number" && isFinite(value) ? value : fallback;
    }
    if (mode === "inline" && config.inlineShowHeader) url += "&header=1";
    if (mode === "inline" && (config.inlineVariant === "full" || config.inlineVariant === "minimalist")) {
      url += "&variant=" + config.inlineVariant;
    }
    // The "full" design is a fixed-height window; pass its height (data-min-height, default 640).
    if (mode === "inline") {
      url += "&h=" + (config.inlineMinHeightExplicit ? config.inlineMinHeight : 640);
    }
    if (config.showExternalLinks) url += "&links=1";
    if (config.providerName) url += "&provider=" + encodeURIComponent(config.providerName);
    if (config.upgradePrompt) {
      var up = config.upgradePrompt;
      if (isFinite(up.minViews)) url += "&uv=" + encodeURIComponent(up.minViews);
      if (isFinite(up.minDays)) url += "&ud=" + encodeURIComponent(up.minDays);
      if (isFinite(up.minSeconds)) url += "&ui=" + encodeURIComponent(up.minSeconds);
    }
    // The hostname, not an identity: it namespaces the explorer's own
    // suppression keys so dismissing the upgrade prompt on one realtor's site
    // doesn't silence it on another's. Who the customer is stays with DN.
    url += "&site=" + encodeURIComponent(location.hostname);
    if (coords) {
      if (coords.address) url += "&address=" + encodeURIComponent(coords.address);
      if (coords.lat != null && coords.lon != null) url += "&lat=" + encodeURIComponent(coords.lat) + "&lng=" + encodeURIComponent(coords.lon);
    }
    return url;
  }

  // Ask the iframe to retire transient fixed layers before detaching (iOS).
  function requestIframeClose(iframe, timeoutMs) {
    return new Promise(function (resolve) {
      if (!iframe || !iframe.contentWindow) { resolve(); return; }
      var settled = false;
      function finish() { if (settled) return; settled = true; window.removeEventListener("message", onAck); resolve(); }
      function onAck(e) { if (e && e.data && e.data.type === "dse:close-ack") finish(); }
      window.addEventListener("message", onAck);
      try { iframe.contentWindow.postMessage({ type: "dse:close" }, "*"); } catch (e) { finish(); return; }
      setTimeout(finish, timeoutMs || 120);
    });
  }

  // -------------------------------------------------------------------------
  // SPA navigation watcher
  // -------------------------------------------------------------------------

  function watchSpa(onChange) {
    if (typeof onChange !== "function") return;
    if (!window.__DSE_SPA_WATCHED__) {
      var op = history.pushState, or = history.replaceState;
      history.pushState = function () { var r = op.apply(this, arguments); window.dispatchEvent(new Event("dse:urlchange")); return r; };
      history.replaceState = function () { var r = or.apply(this, arguments); window.dispatchEvent(new Event("dse:urlchange")); return r; };
      window.addEventListener("popstate", function () { window.dispatchEvent(new Event("dse:urlchange")); });
      window.__DSE_SPA_WATCHED__ = true;
    }
    window.addEventListener("dse:urlchange", onChange);
  }

  // -------------------------------------------------------------------------
  // Styles (popup)
  // -------------------------------------------------------------------------

  var CSS =
    "@keyframes dse-title-marquee{0%,15%{transform:translateX(0)}85%,100%{transform:translateX(calc(-100% + 220px))}}" +
    "#dse-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5}" +
    "#dse-root .dse-bubble{position:fixed;bottom:calc(24px + var(--dse-bo,0px));z-index:2147483646;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--dse-accent,#1fa55f);color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.18);transition:transform .2s,box-shadow .2s}" +
    "#dse-root .dse-bubble--right{right:24px}#dse-root .dse-bubble--left{left:24px}" +
    "#dse-root .dse-bubble:hover{transform:scale(1.07);box-shadow:0 6px 28px rgba(0,0,0,.24)}" +
    "#dse-root .dse-bubble svg{width:28px;height:28px}" +
    "#dse-root .dse-backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s}" +
    "#dse-root .dse-backdrop.dse-open{opacity:1;pointer-events:auto}" +
    "#dse-root .dse-panel{width:1100px;max-width:calc(100vw - 32px);max-height:min(680px,95vh);border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 12px 56px rgba(0,0,0,.22);display:flex;flex-direction:column;transform:scale(.97);transition:transform .28s cubic-bezier(.22,1,.36,1)}" +
    "#dse-root .dse-open .dse-panel{transform:scale(1)}" +
    "#dse-root .dse-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--dse-accent,#1fa55f);color:#fff;flex-shrink:0}" +
    "#dse-root .dse-hl{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;overflow:hidden}" +
    "#dse-root .dse-hicon{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
    // Title clipping window — starts AFTER the logo so a marquee never runs over it.
    "#dse-root .dse-tw{min-width:0;flex:1 1 auto;overflow:hidden}" +
    "#dse-root .dse-hicon svg{width:18px;height:18px}#dse-root .dse-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600}" +
    "@media(max-width:520px){#dse-root .dse-title{display:inline-block;min-width:max-content;animation:dse-title-marquee 12s linear infinite}}" +
    "#dse-root .dse-close{background:none;border:none;color:#fff;cursor:pointer;padding:6px;border-radius:8px;display:flex;flex-shrink:0;position:relative;z-index:1}" +
    "#dse-root .dse-close:hover{background:rgba(255,255,255,.15)}#dse-root .dse-close svg{width:18px;height:18px}" +
    "@media(max-width:767px){#dse-root .dse-close{background:rgba(255,255,255,.22);padding:9px;margin-left:6px}#dse-root .dse-close svg{width:22px;height:22px}}" +
    "#dse-root .dse-iframe{width:100%;border:none;background:#fff;height:520px;transition:height .3s cubic-bezier(.22,1,.36,1)}" +
    "#dse-root .dse-loading{height:520px;display:flex;align-items:center;justify-content:center;background:#f8fafc}" +
    "#dse-root .dse-spinner{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:var(--dse-accent,#1fa55f);border-radius:50%;animation:dse-spin .7s linear infinite}" +
    "@keyframes dse-spin{to{transform:rotate(360deg)}}" +
    "#dse-root .dse-footer{padding:6px 14px 8px;text-align:center;font-size:11px;color:#94a3b8;background:#fff;border-top:1px solid #f1f5f9}" +
    "#dse-root .dse-footer a{color:#64748b;text-decoration:none;font-weight:500}" +
    "#dse-root .dse-tooltip{position:fixed;bottom:calc(96px + var(--dse-bo,0px));z-index:2147483646;display:flex;align-items:flex-start;gap:6px;background:#fff;color:#1e293b;font-size:13px;font-weight:500;padding:10px 14px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);max-width:300px;opacity:0;transform:translateY(4px);transition:opacity .3s,transform .3s;pointer-events:none}" +
    "#dse-root .dse-tooltip.dse-tv{opacity:1;transform:translateY(0);pointer-events:auto}" +
    "#dse-root .dse-tooltip--right{right:24px}#dse-root .dse-tooltip--left{left:24px}" +
    "#dse-root .dse-tooltip-text{cursor:pointer}" +
    "#dse-root .dse-tooltip-x{background:none;border:none;color:#94a3b8;cursor:pointer;padding:0;margin-left:4px;display:flex}" +
    "#dse-root .dse-hidden{display:none!important}" +
    "@media (max-width:767px){#dse-root .dse-backdrop{align-items:stretch;justify-content:stretch}#dse-root .dse-panel{width:100%;height:100dvh;max-width:100%;max-height:100dvh;border-radius:0}#dse-root .dse-iframe{flex:1;height:auto}#dse-root .dse-loading{flex:1;height:auto}#dse-root .dse-bubble{bottom:calc(16px + var(--dse-bo,0px));width:54px;height:54px}#dse-root .dse-bubble--right{right:16px}#dse-root .dse-bubble--left{left:16px}#dse-root .dse-tooltip{bottom:calc(80px + var(--dse-bo,0px))}#dse-root .dse-tooltip--right{right:16px}#dse-root .dse-tooltip--left{left:16px}}";

  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 8.5"/><path d="M12 3 21.5 8.5"/><path d="M5 9.5V20h14V9.5"/><path d="M3 20h18"/><rect x="10" y="14.5" width="4" height="5.5"/><path d="M12 3V1.2"/><path d="M11 2h2"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function inlinePresent() {
    return !!document.querySelector(INLINE_SELECTORS.join(",") + ",.dse-inline-iframe");
  }

  // Author-placed Neighborhood Explorer INLINE container(s). Element-based (not a
  // script-tag check) so it means "an NE embed is on this page", which is a reason
  // for the School popup to step aside — never show a popup over any embed.
  var NE_INLINE_SELECTORS =
    "#dn-explorer,.dn-explorer,[data-dn-explorer],[data-dream-neighborhood-explorer]," +
    "#dream-neighborhood-explorer,.dream-neighborhood-explorer,[data-dream-neighborhood]";
  function neighborhoodExplorerInlinePresent() {
    try {
      return !!document.querySelector(NE_INLINE_SELECTORS);
    } catch (e) {
      return false;
    }
  }

  /** Pages that intentionally show popup + inline together (e.g. neighborhood demos). */
  function allowPopupWithInline() {
    var el = document.querySelector(INLINE_SELECTORS.join(","));
    if (!el) return false;
    var v = (el.getAttribute("data-with-popup") || "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }

  // Neighborhood Explorer ready handshake (from www.dreamneighborhood.com):
  //   window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true
  //   window.dispatchEvent(new Event("dn:neighborhood-explorer-ready"))
  // Fires at most once per page load, only when NE is actually showing (entitled +
  // geocode settled + bubble/iframe mounted). Script-tag presence alone means nothing.
  var NE_READY_FLAG = "__DN_NEIGHBORHOOD_EXPLORER_READY__";
  var NE_READY_EVENT = "dn:neighborhood-explorer-ready";

  // The School popup steps aside for an inline School Explorer embed on the same page.
  // Neighborhood Explorer coexistence is handled separately via the ready signal.
  // The floating School popup must never appear over an inline embed on the same
  // page — whether that's a School embed OR a Neighborhood Explorer embed.
  //
  // Except on a hand-off. `data-via="dn-explorer"` means DN evaluated this
  // customer's entitlement and found them unentitled, so their Neighborhood
  // Explorer embed will render nothing — DN's inline bundle has no hand-off of
  // its own, by design. Stepping aside for an empty container would leave the
  // page with nothing at all, on a page where the realtor pasted the one-line
  // popup precisely so that something would always be there.
  function neighborhoodEmbedBlocksPopup() {
    if (!neighborhoodExplorerInlinePresent()) return false;
    return !viaDnExplorer();
  }
  function popupShouldStepAsideForInline() {
    if (neighborhoodEmbedBlocksPopup()) return true;   // NE embed that will render
    return inlinePresent() && !allowPopupWithInline(); // School embed (unless opt-in)
  }

  // Cheap hint: is Neighborhood Explorer plausibly on this page? Used ONLY to
  // decide whether it's worth waiting out the grace period for NE's async ready
  // signal. Per the DN contract this NEVER suppresses on its own — a script tag
  // alone means nothing; only the ready flag/event actually hides the popup. On
  // pages with no sign of NE we skip the wait entirely so the popup shows
  // immediately, exactly as before.
  var DN_HOST_RE = /(^|\.)dreamneighborhood\.com$/i; // never matches dreamneighborhoodschools.com
  function neighborhoodExplorerMaybePresent() {
    try {
      if (
        window[NE_READY_FLAG] ||
        window.__DN_EXPLORER_API_BASE__ ||
        window.DreamNeighborhood ||
        window.__DREAM_NEIGHBORHOOD__ ||
        window.DreamNeighborhoodExplorer
      ) {
        return true;
      }
      if (
        document.querySelector(
          "#dn-explorer,.dn-explorer,[data-dn-explorer],[data-dream-neighborhood-explorer]," +
            "#dream-neighborhood-explorer,.dream-neighborhood-explorer,[data-dream-neighborhood]"
        )
      ) {
        return true;
      }
      var nodes = document.querySelectorAll("script[src],iframe[src],link[href]");
      for (var i = 0; i < nodes.length; i++) {
        var url = nodes[i].getAttribute("src") || nodes[i].getAttribute("href") || "";
        if (!url) continue;
        try {
          if (DN_HOST_RE.test(new URL(url, location.href).hostname)) return true;
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  // -------------------------------------------------------------------------
  // Popup mode
  // -------------------------------------------------------------------------

  function initPopup(config) {
    if (!config.apiBase) return;
    var isOpen = false, started = false, loaded = false, tooltipDismissed = false;
    var coords = null, coordsPromise = null, lastUrl = location.href, savedY = 0;
    var lastUsedAddr = "";
    var root, bubble, backdrop, iframe, loadingEl, tooltip, hideTimer = null;

    // Coexistence with Neighborhood Explorer (popup only — inline School Explorer
    // is never suppressed by this handshake).
    // Cases: signal already fired; signal fires later; signal never comes.
    var neSuppressed = false;
    var graceDone = false;
    var geoDone = false;
    var graceTimer = null;
    var graceMs = typeof config.neighborhoodExplorerGraceMs === "number"
      ? config.neighborhoodExplorerGraceMs
      : DEFAULTS.neighborhoodExplorerGraceMs;

    function onNeighborhoodExplorerReady() {
      neSuppressed = true;
      hidePopup();
    }

    // The hand-off arrived after we started waiting (old two-snippet install).
    function endGraceEarly() {
      if (graceDone) return;
      if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
      graceDone = true;
      tryRevealPopup();
    }

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "dse-root";
    root.style.setProperty("--dse-accent", config.accentColor);
    root.style.setProperty("--dse-bo", config.bottomOffset + "px");
    root.style.display = "none";

    bubble = document.createElement("button");
    bubble.className = "dse-bubble " + (config.position === "left" ? "dse-bubble--left" : "dse-bubble--right");
    bubble.setAttribute("aria-label", "Explore school ratings");
    bubble.innerHTML = ICON_PIN;

    backdrop = document.createElement("div");
    backdrop.className = "dse-backdrop";
    backdrop.style.display = "none";
    var title = "Dream Neighborhood School Explorer" + (config.providerName ? " provided by " + config.providerName : "");
    backdrop.innerHTML =
      '<div class="dse-panel"><div class="dse-header"><div class="dse-hl"><div class="dse-hicon">' + ICON_PIN + '</div><div class="dse-tw"><span class="dse-title" title="' + escHtml(title) + '">' + escHtml(title) + '</span></div></div>' +
      '<button class="dse-close" aria-label="Close">' + ICON_CLOSE + '</button></div>' +
      '<div class="dse-loading dse-hidden"><div class="dse-spinner"></div></div>' +
      '<iframe class="dse-iframe" allow="geolocation" allowfullscreen></iframe></div>';

    root.appendChild(bubble);
    root.appendChild(backdrop);
    document.body.appendChild(root);
    iframe = backdrop.querySelector(".dse-iframe");
    loadingEl = backdrop.querySelector(".dse-loading");

    // Two fixed panel sizes (avoids the content-height feedback loop and the
    // "jumping"): a "home" size tall enough to show the recent-searches dropdown,
    // and a viewport-sized "expanded" size for results/detail. On mobile the panel
    // is full-screen via CSS, so we leave the height to the stylesheet there.
    var popupScreen = "home";
    function applyPopupHeight() {
      if (window.matchMedia("(max-width:767px)").matches) { iframe.style.height = ""; return; }
      var header = backdrop.querySelector(".dse-header");
      var headH = (header && header.offsetHeight) || 52;
      var expanded = Math.min(680, Math.round(window.innerHeight * 0.95)) - headH;
      var home = Math.min(520, expanded); // enough for the recents dropdown
      iframe.style.height = (popupScreen === "expanded" ? expanded : home) + "px";
    }
    window.addEventListener("message", function (e) {
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (!e.data || e.data.type !== "dse:screen") return;
      popupScreen = e.data.screen === "expanded" ? "expanded" : "home";
      applyPopupHeight();
    });
    window.addEventListener("resize", applyPopupHeight);
    applyPopupHeight();

    tooltip = document.createElement("div");
    tooltip.className = "dse-tooltip " + (config.position === "left" ? "dse-tooltip--left" : "dse-tooltip--right");
    tooltip.innerHTML = '<span class="dse-tooltip-text">See nearby school ratings</span><button class="dse-tooltip-x" aria-label="Dismiss">' + ICON_CLOSE + "</button>";
    root.appendChild(tooltip);

    function lockScroll() { savedY = window.scrollY; document.body.style.overflow = "hidden"; document.body.style.position = "fixed"; document.body.style.top = "-" + savedY + "px"; document.body.style.width = "100%"; }
    function unlockScroll() { document.body.style.overflow = ""; document.body.style.position = ""; document.body.style.top = ""; document.body.style.width = ""; window.scrollTo(0, savedY); }
    function prevent(e) { e.preventDefault(); }

    function open() {
      isOpen = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      backdrop.style.display = "";
      void backdrop.offsetHeight;
      lockScroll();
      backdrop.addEventListener("wheel", prevent, { passive: false });
      backdrop.addEventListener("touchmove", prevent, { passive: false });
      backdrop.classList.add("dse-open");
      bubble.classList.add("dse-hidden");
      tooltip.classList.remove("dse-tv");
      if (!started) {
        started = true;
        loadingEl.classList.remove("dse-hidden");
        iframe.classList.add("dse-hidden");
        Promise.resolve(coordsPromise).then(function () {
          iframe.src = buildIframeUrl(config, coords, "popup");
        });
      }
    }
    function scheduleDetach() { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(function () { hideTimer = null; if (!isOpen) backdrop.style.display = "none"; }, 280); }
    function close() {
      isOpen = false;
      backdrop.removeEventListener("wheel", prevent, { passive: false });
      backdrop.removeEventListener("touchmove", prevent, { passive: false });
      backdrop.classList.remove("dse-open");
      bubble.classList.remove("dse-hidden");
      if (!loaded || !iframe.contentWindow) { unlockScroll(); scheduleDetach(); return; }
      requestIframeClose(iframe).then(function () { unlockScroll(); scheduleDetach(); });
    }

    bubble.addEventListener("click", open);
    backdrop.querySelector(".dse-close").addEventListener("click", close);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
    iframe.addEventListener("load", function () { if (!loaded && iframe.src) { loaded = true; loadingEl.classList.add("dse-hidden"); iframe.classList.remove("dse-hidden"); } });
    tooltip.querySelector(".dse-tooltip-text").addEventListener("click", function () { tooltipDismissed = true; tooltip.classList.remove("dse-tv"); open(); });
    tooltip.querySelector(".dse-tooltip-x").addEventListener("click", function (e) { e.stopPropagation(); tooltipDismissed = true; tooltip.classList.remove("dse-tv"); });

    function showTooltip() {
      var textEl = tooltip.querySelector(".dse-tooltip-text");
      var short = coords && coords.address ? coords.address.split(",")[0].trim() : "";
      if (config.tooltipMessage) textEl.textContent = config.tooltipMessage.replace(/\{\{address\}\}/g, short || "this location");
      else if (short) textEl.textContent = "See school ratings near " + short;
      tooltip.querySelector(".dse-tooltip-x").style.display = tooltipDismissed ? "none" : "";
      tooltip.classList.add("dse-tv");
    }

    function hidePopup() {
      if (!root) return;
      root.style.display = "none";
      if (tooltip) tooltip.classList.remove("dse-tv");
    }

    function tryRevealPopup(initial) {
      if (neSuppressed) { hidePopup(); return; }
      if (!geoDone || !root) return;
      // Before grace elapses, keep hidden (waiting for NE ready or timeout).
      if (!graceDone) { hidePopup(); return; }
      if (popupShouldStepAsideForInline()) { hidePopup(); return; }
      if (config.requireAddress && !coords) { hidePopup(); return; }
      root.style.display = "";
      setTimeout(showTooltip, initial ? 800 : 0);
    }

    function refresh(initial) {
      coords = null; started = false; loaded = false; geoDone = false;
      iframe.removeAttribute("src"); iframe.classList.add("dse-hidden"); loadingEl.classList.add("dse-hidden");
      // Catch up if NE signaled while we were mid-refresh (SPA or late load).
      if (window[NE_READY_FLAG]) onNeighborhoodExplorerReady();
      if (neSuppressed) { hidePopup(); return; }
      // On SPA navigations, wait for the new route to render before scraping so
      // we don't geocode the previous listing (or fall back to the default).
      var geoOpts = initial ? {} : { spa: true, prevTitle: document.title || "", prevAddr: lastUsedAddr };
      coordsPromise = geocodePage(config, geoOpts).then(function (c) {
        coords = c;
        lastUsedAddr = (c && c.address) || lastUsedAddr;
        geoDone = true;
        tryRevealPopup(initial);
      });
    }

    // Wire NE ready handshake after DOM exists so hidePopup can run safely.
    // Contract (www.dreamneighborhood.com): the ready flag/event is the ONLY
    // thing that suppresses us. We only *delay* the popup (wait out the grace
    // period) when NE is plausibly on the page — otherwise School-only pages,
    // the vast majority, show with no artificial delay.
    try {
      // Always listen: if NE loads late and signals, we hide even after showing.
      // This holds even for a hand-off — a page can carry both DN's hand-off and
      // a separately installed DN popup, and stepping aside is still right.
      window.addEventListener(NE_READY_EVENT, onNeighborhoodExplorerReady, { once: true });
      if (window[NE_READY_FLAG]) {
        onNeighborhoodExplorerReady();
      } else if (viaDnExplorer()) {
        // DN handed off to us, so it has already evaluated entitlement and
        // decided not to render. Waiting for a signal that cannot come would
        // delay every hand-off by the full grace period: DN's injected
        // __DN_EXPLORER_API_BASE__ and its own script tag both make
        // neighborhoodExplorerMaybePresent() true on every such page.
        graceDone = true;
      } else if (neighborhoodExplorerMaybePresent()) {
        // No hand-off, but DN might be here and might still announce itself.
        // Still the right behaviour for the old two-snippet install.
        window.addEventListener(VIA_DN_EXPLORER_EVENT, endGraceEarly, { once: true });
        graceTimer = setTimeout(function () {
          graceTimer = null;
          graceDone = true;
          tryRevealPopup();
        }, graceMs);
      } else {
        graceDone = true;
      }
    } catch (e) {
      graceDone = true;
    }

    lastUrl = location.href;
    watchSpa(function () { if (location.href !== lastUrl) { lastUrl = location.href; refresh(false); } });
    refresh(true);
  }

  // -------------------------------------------------------------------------
  // Inline mode
  // -------------------------------------------------------------------------

  function findContainer() {
    for (var i = 0; i < INLINE_SELECTORS.length; i++) { var el = document.querySelector(INLINE_SELECTORS[i]); if (el) return el; }
    return null;
  }

  function initInline(container, config) {
    if (!config.apiBase) return;
    // Idempotent: React/Next client navigations may call ensureInline again.
    if (container.getAttribute("data-dse-mounted") === "1") {
      var existing = container.querySelector("iframe.dse-inline-iframe");
      if (existing) {
        var lat0 = floatAttr(container, "data-lat"), lng0 = floatAttr(container, "data-lng");
        var addr0 = (container.getAttribute("data-address") || "").trim();
        if (addr0 || (lat0 != null && lng0 != null)) {
          var nextSrc = buildIframeUrl(config, { address: addr0, lat: lat0, lon: lng0 }, "inline");
          // Compare path+query; browsers absolutize iframe.src.
          var cur = existing.getAttribute("src") || "";
          if (cur !== nextSrc && existing.src.indexOf(nextSrc) === -1) {
            existing.src = nextSrc;
          }
        }
      }
      return;
    }
    container.setAttribute("data-dse-mounted", "1");
    if (!document.querySelector("style[data-dse-inline]")) {
      var style = document.createElement("style");
      style.setAttribute("data-dse-inline", "");
      style.textContent = ".dse-inline-iframe{min-height:" + DEFAULTS.inlineMinHeight + "px}@media (max-width:767px){.dse-inline-iframe{min-height:640px}}";
      document.head.appendChild(style);
    }
    var lastUrl = location.href;
    var currentIframe = null;
    var lastUsedAddr = "";
    var frameless = boolAttr(container, "data-frameless") === true;

    // The iframe reports its content height so we can size it to fit (short for
    // the home screen, capped with internal scroll for long lists).
    window.addEventListener("message", function (e) {
      if (!currentIframe || e.source !== currentIframe.contentWindow) return;
      if (e.data && e.data.type === "dse:height") {
        var h = Math.max(200, Math.min(1400, parseInt(e.data.height, 10) || 0));
        currentIframe.style.height = h + "px";
        // Keep a sensible floor so auto-boot loaders don't collapse to a white sliver.
        currentIframe.style.minHeight = Math.max(h, 320) + "px";
      }
    });

    function mount(spa) {
      container.innerHTML = "";
      var iframe = document.createElement("iframe");
      currentIframe = iframe;
      iframe.className = "dse-inline-iframe";
      iframe.setAttribute("allow", "geolocation");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("title", "Dream Neighborhood School Explorer");
      // Eager: lazy deferral left the demo embed blank until scroll/hard refresh.
      iframe.setAttribute("loading", "eager");
      // Width: default caps at 840px; partner can set data-max-width="720" (px).
      var maxW = intAttr(container, "data-max-width", 280);
      var wideVariant = config.inlineVariant === "full" || config.inlineVariant === "minimalist";
      var maxWidthCss = maxW != null ? maxW + "px" : (wideVariant ? "1040px" : "840px");
      // The "full" and "minimalist" designs sit natively in the page — flat, no
      // card border/shadow. (Full is a fixed-height window; minimalist flows with
      // the page like the classic inline embed.)
      var flat = frameless || config.inlineVariant === "full" || config.inlineVariant === "minimalist";
      var chrome = flat
        ? "display:block;width:100%;max-width:" + maxWidthCss + ";margin:0;border:0;border-radius:0;background:#fff;color-scheme:light;overflow:hidden;box-shadow:none"
        : "display:block;width:100%;max-width:" + maxWidthCss + ";margin:20px auto;border:1px solid #e2e8f0;border-radius:16px;background:#fff;color-scheme:light;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08)";
      iframe.style.cssText = config.inlineMinHeightExplicit
        ? chrome + ";min-height:" + config.inlineMinHeight + "px"
        : chrome + ";min-height:" + DEFAULTS.inlineMinHeight + "px";
      container.appendChild(iframe);

      // data-address / data-lat / data-lng on the container bypass scraping.
      var lat = floatAttr(container, "data-lat"), lng = floatAttr(container, "data-lng");
      var dataAddr = (container.getAttribute("data-address") || "").trim();
      // Set src immediately when the host page already knows the address — do not
      // leave a blank iframe while geocode/scrape runs.
      if (dataAddr || (lat != null && lng != null)) {
        iframe.src = buildIframeUrl(config, { address: dataAddr, lat: lat, lon: lng }, "inline");
        return;
      }
      // On SPA navigations, wait for the new route to render before scraping.
      var geoOpts = spa ? { spa: true, prevTitle: document.title || "", prevAddr: lastUsedAddr } : {};
      geocodePage(config, geoOpts).then(function (coords) {
        lastUsedAddr = (coords && coords.address) || lastUsedAddr;
        iframe.src = buildIframeUrl(config, coords, "inline");
      });
    }

    mount(false);
    watchSpa(function () { if (location.href !== lastUrl) { lastUrl = location.href; mount(true); } });
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  function boot() {
    var container = findContainer();
    var anchor = container || SCRIPT_EL;
    var apiBase = deriveApiBase(SCRIPT_EL) || deriveApiBase(anchor);
    if (!apiBase) { console.warn("[Dream Schools Explorer] Could not determine API base URL."); return; }

    resolveConfig(anchor, apiBase).then(function (config) {
      if (!config) return;
      if (config.disabledReason) { console.info("[Dream Schools Explorer] Disabled by server (" + config.disabledReason + ")."); return; }

      var popupStarted = false;
      wireUpgradeRequests(config);

      function ensureInline() {
        var el = findContainer();
        if (!el) return false;
        initInline(el, config);
        return true;
      }

      function ensurePopup() {
        if (popupStarted) return;
        // Never mount the popup over an inline embed on the page — a Neighborhood
        // Explorer embed, or a School embed (unless the page opts into both).
        if (neighborhoodEmbedBlocksPopup()) return;
        if (findContainer() && !allowPopupWithInline()) return;
        popupStarted = true;
        initPopup(config);
      }

      if (findContainer()) {
        ensureInline();
        if (allowPopupWithInline()) ensurePopup();
      } else {
        ensurePopup();
      }

      // Next.js / SPA: script often boots on a page without #dream-schools-explorer,
      // then the container appears after client navigation. Mount when it shows up.
      var lateTimer = null;
      function onMaybeInline() {
        var el = findContainer();
        if (!el) return;
        if (el.querySelector("iframe.dse-inline-iframe")) return;
        ensureInline();
        if (allowPopupWithInline()) ensurePopup();
      }
      function scheduleMaybeInline() {
        if (lateTimer) clearTimeout(lateTimer);
        lateTimer = setTimeout(onMaybeInline, 50);
      }
      watchSpa(scheduleMaybeInline);
      if (typeof MutationObserver !== "undefined") {
        var mo = new MutationObserver(scheduleMaybeInline);
        mo.observe(document.documentElement, { childList: true, subtree: true });
      }
    }).catch(function (err) {
      console.warn("[Dream Schools Explorer] Failed to initialize.", err);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
