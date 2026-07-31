#!/usr/bin/env node
/**
 * End-to-end check of the DN ↔ DNS integration, per the final section of
 * docs/DN_INTEGRATION.md. Against staging only — never DN production, never
 * dream-schools.
 *
 * Runs the REAL Dream Neighborhood staging sdk.js and the REAL Dream Schools
 * preview embed.js. The pages themselves are served by Playwright on a fake
 * origin, because the whole thing keys on `location.hostname` and the test
 * needs to be a specific realtor's domain.
 *
 * `GET /explorer/resolve/` is stubbed per case, because DN staging has no
 * unentitled customer fixture and creating one is DN's side of the fence. The
 * stub bodies are copied verbatim from the "how DN decides" table in the
 * document; everything downstream of the response — DN's decision to hand off,
 * the attributes it sets, our reaction to them — is real code.
 *
 * Case 4 uses the real, un-stubbed resolve for `staging.dreamneighborhood.com`,
 * which is an entitled DN staging account.
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

const REALTOR_HOST = "e2e-realtor.test";
const REALTOR_ORIGIN = `https://${REALTOR_HOST}`;
const ADDRESS = "1500 N 23rd St, Fort Pierce, FL 34950";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// Bodies straight out of the "how DN decides" table.
const RESOLVE = {
  never_had_trial: { enabled: false, reason: "subscription_required", product: "school" },
  trial_expired: { enabled: false, reason: "trial_expired", product: "school" },
  no_widget: { enabled: false, reason: "no_widget" },
};

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
 * @param {object} browser
 * @param {{ resolve?: object|null, path?: string }} opts
 */
async function openRealtorPage(browser, opts = {}) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  // Serve the realtor's site ourselves; everything else goes to the real hosts.
  await context.route(`${REALTOR_ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const kind = path.includes("schools") ? "schools" : path.includes("neighborhood") ? "neighborhood" : "listing";
    return route.fulfill({ status: 200, contentType: "text/html", body: page(kind) });
  });
  if (opts.resolve) {
    await context.route(`${DN_BASE}/explorer/resolve/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
        body: JSON.stringify(opts.resolve),
      })
    );
  }
  const p = await context.newPage();
  p.on("console", (m) => {
    if (process.env.VERBOSE) console.log("   [page]", m.text());
  });
  await p.goto(`${REALTOR_ORIGIN}${opts.path || "/listings/1500-n-23rd-st"}`, { waitUntil: "load", timeout: 45000 });
  return { context, page: p };
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
      const res = await fetch(`${DN_BASE}/explorer/resolve/?host=${REALTOR_HOST}&widget_number=1`);
      const live = await res.text();
      record(
        "1. DN staging resolve is reachable and answers a negative for an unknown host",
        res.status === 404,
        `HTTP ${res.status} ${live.slice(0, 80)}`
      );
      console.log(
        "     note: DN staging has no unentitled-customer fixture, so cases 1-3 stub the\n" +
          "     resolve body from the document's table and let the real sdk.js decide."
      );
    }

    // --- 2. Hand-off, with no four-second pause ----------------------------
    {
      const { context, page: p } = await openRealtorPage(browser, { resolve: RESOLVE.never_had_trial });
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
      const { context, page: p } = await openRealtorPage(browser, { resolve: RESOLVE.trial_expired });
      const ms = await waitForSchoolPopup(p, 20000);
      record(
        "2b. an expired trial also hands off, and also without the pause",
        ms !== null && ms < 4000,
        ms === null ? "popup never appeared" : `${ms}ms`
      );
      await context.close();
    }

    // --- 3. Explorer switched off → nothing at all -------------------------
    {
      const { context, page: p } = await openRealtorPage(browser, { resolve: RESOLVE.no_widget });
      await p.waitForTimeout(8000);
      const handed = await handOffHappened(p);
      const popup = await p.evaluate(() => {
        const root = document.getElementById("dse-root");
        return !!root && getComputedStyle(root).display !== "none";
      });
      record(
        "3. an Explorer switched off in DN shows nothing, not even schools",
        !handed && !popup,
        `hand-off=${handed}, school popup=${popup}`
      );
      await context.close();
    }

    // --- 4. Entitled → Neighborhood Explorer, real resolve ------------------
    {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      // An entitled DN staging account, resolved for real: DN's own domain.
      await context.route(`${DN_BASE}/e2e/**`, (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: page("listing") })
      );
      const p = await context.newPage();
      await p.goto(`${DN_BASE}/e2e/listing`, { waitUntil: "load", timeout: 45000 });
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
      const { context, page: schoolsPage } = await openRealtorPage(browser, {
        resolve: RESOLVE.never_had_trial,
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
      await neighborhoodPage.goto(`${REALTOR_ORIGIN}/neighborhoods/downtown`, { waitUntil: "load", timeout: 45000 });
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
