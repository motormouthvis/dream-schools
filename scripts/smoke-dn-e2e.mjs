#!/usr/bin/env node
/**
 * End-to-end check of the DN ↔ DNS integration, per the final section of
 * docs/DN_INTEGRATION.md. Against staging only — never DN production, never
 * dream-schools.
 *
 * Runs the REAL Dream Neighborhood staging sdk.js and the REAL Dream Schools
 * preview embed.js, against DN's REAL staging customer fixtures. Nothing is
 * stubbed: every entitlement answer comes from DN deciding for itself.
 *
 * The realtor's pages are served by Playwright on the fixture's own hostname,
 * because the whole thing keys on `location.hostname` and there is no other way
 * to be a specific customer's website. The fixtures use `.invalid`, which can
 * never resolve publicly, so nothing here can reach a real site.
 *
 * Usage:
 *   node scripts/smoke-dn-e2e.mjs
 *   DNS_BASE=… DN_BASE=… node scripts/smoke-dn-e2e.mjs
 */
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const DNS_BASE = (process.env.DNS_BASE || "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com").replace(/\/$/, "");
const DN_BASE = (process.env.DN_BASE || "https://staging.dreamneighborhood.com").replace(/\/$/, "");

if (/app\.dreamneighborhood\.com/.test(DN_BASE) || /dream-schools-c2ccd302adef|www\.dreamneighborhoodschools/.test(DNS_BASE)) {
  console.error("Refusing to run against production. DN production is frozen and dream-schools is off limits.");
  process.exit(2);
}

// DN staging's customer fixtures. Every one of these is a real DN account whose
// entitlement DN evaluates for itself; we only choose which customer we are.
const FIXTURE = {
  unentitled: "free-tier.invalid", // never had a trial → hand-off
  expiredTrial: "expired-trial.invalid", // trial ran out → hand-off
  entitled: "solo-paying.invalid", // subscribed → Neighborhood Explorer
  disabled: "disabled.invalid", // switched off → nothing at all
  unknown: "nosuch.invalid", // not a DN customer → 404 → nothing at all
};
const ADDRESS = "1500 N 23rd St, Fort Pierce, FL 34950";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// The install shapes, matching the fixture pages on the smoke sites. DN's popup
// snippet and DN's inline bundle are different files and behave differently:
// `sdk.js` is the one shared popup and hands off to us when unentitled,
// `inline.js` mounts a neighborhood embed and deliberately never hands off.
const POPUP_SNIPPET = `<script src="${DN_BASE}/explorer/sdk.js" async></script>`;
const NEIGHBORHOOD_EMBED = `<div id="dn-explorer"></div>
    <script src="${DN_BASE}/explorer/inline.js" async></script>`;
const SCHOOL_EMBED = `<div id="dream-schools-explorer"></div>
    <script src="${DNS_BASE}/embed.js" async></script>`;

function page(kind) {
  const shapes = {
    // A listing page with the one shared popup snippet and nothing else.
    listing: { head: POPUP_SNIPPET, body: `<h1>${ADDRESS}</h1><p>3 bed · 2 bath · $312,000</p>` },
    // The realtor's schools page: our embed, none of DN's.
    schools: { head: "", body: `<h1>Schools near ${ADDRESS}</h1>${SCHOOL_EMBED}` },
    // Their neighborhood page: DN's embed, none of ours.
    neighborhood: { head: "", body: `<h1>Neighborhood: ${ADDRESS}</h1>${NEIGHBORHOOD_EMBED}` },
    // The shared popup alongside a neighborhood embed on one page.
    "popup-and-embed": { head: POPUP_SNIPPET, body: `<h1>Neighborhood: ${ADDRESS}</h1>${NEIGHBORHOOD_EMBED}` },
  };
  const shape = shapes[kind] || shapes.listing;
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${ADDRESS} | E2E Realty</title>${shape.head}</head><body>${shape.body}</body></html>`;
}

async function loadChromium() {
  let pw;
  try {
    pw = require("playwright");
  } catch {
    require("child_process").execSync("npm install --no-save playwright@1.52.0", {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
    pw = require("playwright");
  }
  return pw.chromium.launch({ args: ["--no-sandbox"] });
}

/**
 * Open a page on one of DN's fixture customers' websites. Only the fixture's
 * own origin is served locally; DN and Dream Schools are both hit for real.
 *
 * `breakResolve` simulates DN being unreachable — the entitlement lookup fails
 * while DN's sdk.js itself still loads, which is what an outage looks like.
 *
 * @param {object} browser
 * @param {{ host: string, path?: string, breakResolve?: "timeout" | "error" }} opts
 */
async function openRealtorPage(browser, opts) {
  const origin = `https://${opts.host}`;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const kind = path.includes("popup-and-embed")
      ? "popup-and-embed"
      : path.includes("schools")
        ? "schools"
        : path.includes("neighborhood")
          ? "neighborhood"
          : "listing";
    return route.fulfill({ status: 200, contentType: "text/html", body: page(kind) });
  });
  if (opts.breakResolve === "error") {
    await context.route(`${DN_BASE}/explorer/resolve/**`, (route) =>
      route.fulfill({ status: 500, contentType: "text/plain", body: "upstream error" })
    );
  } else if (opts.breakResolve === "timeout") {
    await context.route(`${DN_BASE}/explorer/resolve/**`, (route) => route.abort("timedout"));
  }
  const p = await context.newPage();
  p.on("console", (m) => {
    if (process.env.VERBOSE) console.log("   [page]", m.text());
  });
  await p.goto(`${origin}${opts.path || "/listings/1500-n-23rd-st"}`, { waitUntil: "load", timeout: 45000 });
  return { context, page: p, origin };
}

async function waitForSchoolPopup(page, budgetMs) {
  const start = Date.now();
  for (;;) {
    const visible = await page.evaluate(() => {
      const root = document.getElementById("dse-root");
      return !!root && getComputedStyle(root).display !== "none";
    });
    if (visible) return Date.now() - start;
    if (Date.now() - start > budgetMs) return null;
    await page.waitForTimeout(100);
  }
}

async function handOffHappened(page) {
  return page.evaluate(() => !!document.querySelector('script[data-via="dn-explorer"]'));
}

async function neighborhoodExplorerMounted(page) {
  return page.evaluate(() =>
    Boolean(
      window.__DN_NEIGHBORHOOD_EXPLORER_READY__ ||
        document.querySelector("#dn-explorer iframe, .dn-explorer iframe, [data-dn-explorer] iframe")
    )
  );
}

/**
 * The explorer iframe must load without throwing. It threw React #418 on every
 * customer page carrying the inline embed for as long as the embed has existed:
 * /embed is prerendered with no query string, and the first client render read
 * window.location.search, so the two disagreed whenever an address was passed.
 * It still mounted and worked, which is why nobody noticed — an uncaught
 * exception on someone else's website that costs nothing visible until React
 * tightens, and then costs interactivity.
 */
async function checkExplorerPageIsClean(browser) {
  const cases = [
    ["inline, with an address", `${DNS_BASE}/embed?mode=inline&accent=%231fa55f&h=640&address=${encodeURIComponent(ADDRESS)}`],
    ["popup, with an address", `${DNS_BASE}/embed?mode=popup&accent=%231fa55f&address=${encodeURIComponent(ADDRESS)}`],
    ["inline, no address", `${DNS_BASE}/embed?mode=inline&accent=%231fa55f&h=640`],
  ];
  for (const [label, url] of cases) {
    const context = await browser.newContext();
    const p = await context.newPage();
    const thrown = [];
    p.on("pageerror", (e) => thrown.push(e.message.split("\n")[0]));
    await p.goto(url, { waitUntil: "load", timeout: 45000 });
    await p.waitForTimeout(6000);
    record(
      `the explorer page throws nothing (${label})`,
      thrown.length === 0,
      thrown[0] ? thrown[0].slice(0, 150) : "clean"
    );
    await context.close();
  }
}

async function run() {
  const browser = await loadChromium();
  try {
    await checkExplorerPageIsClean(browser);

    // --- 1. DN answers "product": "school" for an unentitled customer -------
    {
      const res = await fetch(`${DN_BASE}/explorer/resolve/?host=${FIXTURE.unentitled}&widget_number=1`);
      const body = await res.json();
      record(
        `1. DN answers "product": "school" for an unsubscribed customer`,
        res.ok && body.enabled === false && body.product === "school",
        `${FIXTURE.unentitled} → ${JSON.stringify(body)}`
      );
    }

    // --- 2. Hand-off, with no four-second pause ----------------------------
    {
      const { context, page: p } = await openRealtorPage(browser, { host: FIXTURE.unentitled });
      const ms = await waitForSchoolPopup(p, 20000);
      const handed = await handOffHappened(p);
      record("2. DN hands off to the School Explorer when unentitled", handed);
      record(
        "2. the school popup appears with no four-second pause",
        ms !== null && ms < 4000,
        ms === null ? "popup never appeared" : `${ms}ms from page load (grace is 4000ms)`
      );
      const attrs = await p.evaluate(() => {
        const s = document.querySelector('script[data-via="dn-explorer"]');
        const root = document.getElementById("dse-root");
        return {
          src: s ? s.getAttribute("src") : "",
          accent: root ? root.style.getPropertyValue("--dse-accent").trim() : "",
        };
      });
      record(
        "2. DN loaded embed.js from the staging School Explorer origin",
        attrs.src.startsWith(DNS_BASE),
        attrs.src || "(no hand-off tag)"
      );
      await context.close();
    }

    // Same again for an expired trial, the other route to "product": "school".
    {
      const { context, page: p } = await openRealtorPage(browser, { host: FIXTURE.expiredTrial });
      const ms = await waitForSchoolPopup(p, 20000);
      record(
        "2b. an expired trial also hands off, and also without the pause",
        ms !== null && ms < 4000,
        ms === null ? "popup never appeared" : `${ms}ms`
      );
      await context.close();
    }

    // --- 3. Explorer switched off → nothing at all -------------------------
    // A soft-disabled account. Until DN fixed this it answered
    // subscription_required with product "school", so a customer switched off
    // for non-payment was handed a working free School Explorer.
    {
      const { context, page: p } = await openRealtorPage(browser, { host: FIXTURE.disabled });
      await p.waitForTimeout(8000);
      const handed = await handOffHappened(p);
      const popup = await p.evaluate(() => {
        const root = document.getElementById("dse-root");
        return !!root && getComputedStyle(root).display !== "none";
      });
      record(
        "3. a switched-off account shows nothing, not even schools",
        !handed && !popup,
        `hand-off=${handed}, school popup=${popup}`
      );
      await context.close();
    }

    // --- 4. Entitled → Neighborhood Explorer -------------------------------
    {
      const { context, page: p } = await openRealtorPage(browser, { host: FIXTURE.entitled });
      await p.waitForTimeout(9000);
      const ne = await neighborhoodExplorerMounted(p);
      const handed = await handOffHappened(p);
      const schoolPopup = await p.evaluate(() => {
        const root = document.getElementById("dse-root");
        return !!root && getComputedStyle(root).display !== "none";
      });
      record(
        "4. an entitled account gets the Neighborhood Explorer, with no code change",
        ne && !handed && !schoolPopup,
        `NE=${ne}, hand-off=${handed}, school popup=${schoolPopup}`
      );
      await context.close();
    }

    // --- 5. A schools embed and a neighborhood embed coexist ---------------
    {
      // The schools page carries OUR inline snippet and none of DN's.
      const { context, page: schoolsPage, origin } = await openRealtorPage(browser, {
        host: FIXTURE.unentitled,
        path: "/schools",
      });
      let inlineMounted = false;
      for (let i = 0; i < 40 && !inlineMounted; i += 1) {
        inlineMounted = await schoolsPage.evaluate(() => {
          const c = document.getElementById("dream-schools-explorer");
          return !!(c && c.querySelector("iframe"));
        });
        if (!inlineMounted) await schoolsPage.waitForTimeout(500);
      }
      const schoolsSubstituted = await schoolsPage.evaluate(() =>
        Boolean(document.querySelector("#dream-schools-explorer iframe[src*='dreamneighborhood.com']"))
      );
      record(
        "5. the schools embed renders the School Explorer on its own page",
        inlineMounted && !schoolsSubstituted,
        `mounted=${inlineMounted}, substituted=${schoolsSubstituted}`
      );

      // Their neighborhood page: DN's inline bundle, none of our code. Unentitled,
      // so it renders nothing — and must never be replaced with a schools embed.
      const neighborhoodPage = await context.newPage();
      await neighborhoodPage.goto(`${origin}/neighborhoods/downtown`, { waitUntil: "load", timeout: 45000 });
      await neighborhoodPage.waitForTimeout(9000);
      const swapped = await neighborhoodPage.evaluate(() =>
        Boolean(document.querySelector("#dn-explorer iframe[src*='dreamneighborhoodschools'], #dn-explorer iframe[src*='dream-schools']"))
      );
      record(
        "5. the neighborhood embed is never substituted with a schools one",
        !swapped,
        `schools iframe inside #dn-explorer=${swapped}`
      );
      await context.close();
    }

    // --- 5b. The shared popup on a page that also has a neighborhood embed --
    {
      // Unentitled: the embed renders nothing, so the popup SHOULD appear.
      // There is nothing to cover, and the realtor pasted the one-line popup
      // precisely so something would always be there. Suppressing it here left
      // the page blank, which is the bug DN's install-shape fixtures found.
      const un = await openRealtorPage(browser, { host: FIXTURE.unentitled, path: "/popup-and-embed" });
      await un.page.waitForTimeout(10000);
      const unentitled = await un.page.evaluate(() => {
        const root = document.getElementById("dse-root");
        return { popup: !!root && getComputedStyle(root).display !== "none" };
      });
      record(
        "5b. popup + an unentitled neighborhood embed does not leave the page blank",
        unentitled.popup,
        `schools popup=${unentitled.popup}`
      );
      await un.context.close();

      // Entitled: the embed renders, which is the case the rule exists for.
      // Nothing of ours may appear over it — and DN never hands off, so our
      // code is not loaded at all.
      const ent = await openRealtorPage(browser, { host: FIXTURE.entitled, path: "/popup-and-embed" });
      await ent.page.waitForTimeout(10000);
      const entitled = await ent.page.evaluate(() => {
        const root = document.getElementById("dse-root");
        return {
          neighborhood: !!document.querySelector("#dn-explorer iframe"),
          popup: !!root && getComputedStyle(root).display !== "none",
        };
      });
      record(
        "5b. no floating school popup over a neighborhood embed that renders",
        entitled.neighborhood && !entitled.popup,
        `NE embed=${entitled.neighborhood}, schools popup=${entitled.popup}`
      );
      await ent.context.close();
    }

    // --- 6. A 404 is an answer; a 500 is the absence of one ----------------
    // The distinction that makes the fallback safe. "Nobody has registered this
    // domain" is a decision, and folding it into the fallback would quietly
    // overturn it — every unregistered site on the internet would start showing
    // a School Explorer. Only the absence of an answer falls back.
    {
      const { context, page: p } = await openRealtorPage(browser, { host: FIXTURE.unknown });
      await p.waitForTimeout(8000);
      const state = await p.evaluate(() => {
        const root = document.getElementById("dse-root");
        return {
          handedOff: !!document.querySelector('script[data-via="dn-explorer"]'),
          schoolPopup: !!root && getComputedStyle(root).display !== "none",
        };
      });
      record(
        "6. a 404 is an answer: an unregistered domain still renders nothing",
        !state.handedOff && !state.schoolPopup,
        `hand-off=${state.handedOff}, school popup=${state.schoolPopup}`
      );
      await context.close();
    }

    // DN's TEST_PLAN requires that an entitlement lookup failing behaves as
    // though unentitled and shows schools — never a blank page. We could not
    // honour that from here: DN's sdk.js is what loads our embed.js, so if DN
    // could not answer, our code never ran. Fixed on the DN side.
    for (const mode of ["error", "timeout"]) {
      const { context, page: p } = await openRealtorPage(browser, {
        host: FIXTURE.unentitled,
        breakResolve: mode,
      });
      await p.waitForTimeout(9000);
      const state = await p.evaluate(() => {
        const root = document.getElementById("dse-root");
        return {
          handedOff: !!document.querySelector('script[data-via="dn-explorer"]'),
          schoolPopup: !!root && getComputedStyle(root).display !== "none",
          neighborhood: !!document.querySelector("#dn-explorer iframe, .dn-explorer iframe"),
        };
      });
      record(
        `6. DN unreachable (${mode}): the free School Explorer still appears`,
        state.schoolPopup,
        `hand-off=${state.handedOff}, school popup=${state.schoolPopup}, NE=${state.neighborhood}`
      );
      await context.close();
    }

    // --- 7. The Explorer switched off in DN's dashboard --------------------
    //
    // A standalone schools embed is the only one of the four widgets DN cannot
    // stop directly, because it is our script talking to our server. It has to
    // stop itself, off the reason DN already sends.
    //
    // The reason is stubbed rather than driven from a real account: DN has no
    // permanently switched-off fixture, and a test that needs someone to toggle
    // a dashboard is a test that stops being run. The stub is DN's own payload
    // shape, taken from a live resolve response.
    {
      const cases = [
        ["no_widget", false, "switched off: the schools embed stops too"],
        ["subscription_required", true, "not paying: free schools, as today"],
        ["trial_expired", true, "trial over: free schools, as today"],
        ["something_we_have_never_seen", true, "unrecognised reason renders"],
      ];
      for (const [reason, shouldRender, what] of cases) {
        const host = FIXTURE.unentitled;
        const origin = `https://${host}`;
        const context = await browser.newContext();
        await context.route(`${origin}/**`, (route) =>
          route.fulfill({ status: 200, contentType: "text/html", body: page("schools") })
        );
        await context.route(`${DNS_BASE}/api/embed/dn-config**`, (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              enabled: false,
              reason,
              product: reason === "no_widget" ? "neighborhood" : "school",
              accentColor: "#222222",
              searchPageContent: false,
              displayName: "E2E Realty",
            }),
          })
        );
        const p = await context.newPage();
        await p.goto(`${origin}/schools`, { waitUntil: "load", timeout: 45000 });
        let mounted = false;
        for (let i = 0; i < 24 && !mounted; i += 1) {
          await p.waitForTimeout(500);
          mounted = await p.evaluate(() => {
            const c = document.getElementById("dream-schools-explorer");
            return !!(c && c.querySelector("iframe"));
          });
        }
        record(`7. ${what}`, mounted === shouldRender, `reason=${reason}, embed rendered=${mounted}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  console.log("Step 6 (ingest replay → already_had) is scripts/smoke-dn-ingest.mjs plus a live run.");
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
