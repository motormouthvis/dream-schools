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
};
const ADDRESS = "1500 N 23rd St, Fort Pierce, FL 34950";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

function page(kind) {
  const body = {
    listing: `<h1>${ADDRESS}</h1><p>3 bed · 2 bath · $312,000</p>`,
    schools: `<h1>Schools near ${ADDRESS}</h1><div id="dream-schools-explorer"></div>
              <script src="${DNS_BASE}/embed.js" async></script>`,
    neighborhood: `<h1>Neighborhood: ${ADDRESS}</h1><div id="dn-explorer"></div>`,
  }[kind];
  // The neighborhood page carries DN's tag (its inline embed); the listing page
  // carries DN's tag as the one shared popup snippet; the schools page carries
  // OUR embed snippet and nothing of DN's.
  const dnTag = kind === "schools" ? "" : `<script src="${DN_BASE}/explorer/sdk.js" async></script>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${ADDRESS} | E2E Realty</title>${dnTag}</head><body>${body}</body></html>`;
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
 * @param {object} browser
 * @param {{ host: string, path?: string }} opts
 */
async function openRealtorPage(browser, opts) {
  const origin = `https://${opts.host}`;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const kind = path.includes("schools") ? "schools" : path.includes("neighborhood") ? "neighborhood" : "listing";
    return route.fulfill({ status: 200, contentType: "text/html", body: page(kind) });
  });
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

async function run() {
  const browser = await loadChromium();
  try {
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

      // The neighborhood page carries DN's snippet with DN's inline container.
      // Unentitled, so DN renders nothing there — and must NOT be replaced by us.
      const neighborhoodPage = await context.newPage();
      await neighborhoodPage.goto(`${origin}/neighborhoods/downtown`, { waitUntil: "load", timeout: 45000 });
      await neighborhoodPage.waitForTimeout(9000);
      const swapped = await neighborhoodPage.evaluate(() =>
        Boolean(document.querySelector("#dn-explorer iframe[src*='dreamneighborhoodschools'], #dn-explorer iframe[src*='dream-schools']"))
      );
      const schoolPopupOverEmbed = await neighborhoodPage.evaluate(() => {
        const root = document.getElementById("dse-root");
        return !!root && getComputedStyle(root).display !== "none";
      });
      record(
        "5. the neighborhood embed is never substituted with a schools one",
        !swapped,
        `schools iframe inside #dn-explorer=${swapped}`
      );
      record(
        "5. no floating school popup appears over a neighborhood embed",
        !schoolPopupOverEmbed,
        `popup=${schoolPopupOverEmbed}`
      );
      await context.close();
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
