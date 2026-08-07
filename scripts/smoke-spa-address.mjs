#!/usr/bin/env node
/**
 * Does the popup follow the address across a client-side navigation?
 *
 * This is the failure mode worth testing hardest, because it is silently wrong
 * rather than visibly broken: on a single-page-app listing site, a visitor
 * clicks from one listing to another and the School Explorer keeps showing the
 * PREVIOUS listing's schools. Nothing errors, nothing looks off, and the
 * answer is confidently about the wrong house.
 *
 * Self-contained: a local origin serves embed.js plus stubs of the endpoints it
 * calls, so nothing here depends on a deployed environment or a geocoder. The
 * scrape stub echoes back whatever address the SDK scraped, which is precisely
 * the thing under test.
 *
 * Four shapes of SPA, because they fail differently:
 *   1. pushState with the DOM updated immediately.
 *   2. pushState with the DOM updated ~1.2s later — a data fetch, which is what
 *      a real listing site does, and the case a naive implementation gets wrong
 *      by scraping the old DOM under the new URL.
 *   3. Back button (popstate) rather than a forward click.
 *   4. A navigation to a page with NO address, which must not silently leave
 *      the previous listing's address showing.
 *
 * Usage: node scripts/smoke-spa-address.mjs
 */
import { readFileSync } from "fs";
import { createServer } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBED_JS = readFileSync(join(__dirname, "..", "public", "embed.js"), "utf8");

const LISTING_A = "1500 N 23rd St, Fort Pierce, FL 34950";
const LISTING_B = "742 Evergreen Terrace, Springfield, OR 97477";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const CONFIG_JSON = JSON.stringify({
  enabled: true,
  partnerId: "spa-partner",
  widgetNumber: 1,
  accentColor: "#1fa55f",
  popup: { position: "right", bottomOffset: 0, tooltipMessage: "" },
  inline: { minHeight: 540, showHeader: false },
});

/** A minimal listing SPA: pushState, then swap the title and heading. */
function fixturePage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${LISTING_A} | Listings</title></head>
<body>
  <h1 id="addr">${LISTING_A}</h1>
  <p>3 bed · 2 bath</p>
  <script>
    window.__navigate = function (address, path, delayMs, usePopstate) {
      if (usePopstate) {
        history.pushState({}, "", path);
        history.back();
      } else {
        history.pushState({}, "", path);
      }
      setTimeout(function () {
        document.title = address ? address + " | Listings" : "Our listings | Listings";
        document.getElementById("addr").textContent = address || "Browse our listings";
      }, delayMs);
    };
  <\/script>
  <script src="/embed.js" async></script>
</body></html>`;
}

function startOrigin() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, type, body, extra = {}) => {
      res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*", ...extra });
      res.end(body);
    };
    if (req.method === "OPTIONS") return send(204, "text/plain", "");
    if (url.pathname === "/embed.js") return send(200, "text/javascript", EMBED_JS);
    // The customer comes from DN now, relayed through /api/embed/dn-config.
    if (url.pathname === "/api/embed/dn-config") return send(200, "application/json", CONFIG_JSON);
    if (url.pathname === "/api/embed/scrape") {
      let body = "";
      req.on("data", (c) => (body += c));
      return req.on("end", () => {
        let scraped = "";
        try {
          scraped = JSON.parse(body).page_address || "";
        } catch {
          /* treated as "scraped nothing" */
        }
        // Echo the SDK's own scrape straight back. A real geocoder would
        // normalise it; here we want to see exactly what it found.
        if (!scraped) return send(200, "application/json", JSON.stringify({ success: false }));
        return send(200, "application/json", JSON.stringify({ success: true, address: scraped, lat: 27.4, lon: -80.3 }));
      });
    }
    if (url.pathname === "/embed") return send(200, "text/html", "<!doctype html><title>explorer</title>ok");
    return send(200, "text/html", fixturePage(), { "cache-control": "no-store" });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
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

/** Open the popup and read the address the explorer iframe was actually given. */
async function addressInPopup(page, budgetMs = 15000) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const addr = await page.evaluate(() => {
      const root = document.getElementById("dse-root");
      if (!root || getComputedStyle(root).display === "none") return null;
      const bubble = root.querySelector(".dse-bubble");
      if (bubble) bubble.click();
      const iframe = root.querySelector("iframe.dse-iframe");
      const src = iframe && iframe.getAttribute("src");
      if (!src) return null;
      return new URL(src, location.href).searchParams.get("address") || "";
    });
    if (addr !== null) return addr;
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(200);
  }
}

async function run() {
  const { server, base } = await startOrigin();
  const browser = await loadChromium();
  try {
    const context = await browser.newContext();

    // --- baseline: the first listing --------------------------------------
    {
      const p = await context.newPage();
      await p.goto(`${base}/listings/a`, { waitUntil: "load" });
      const addr = await addressInPopup(p);
      record(
        "the popup opens on the address of the listing it loaded with",
        addr === LISTING_A,
        addr === null ? "popup never opened" : addr
      );
      await p.close();
    }

    // --- 1 & 2: forward navigation, DOM updated now and later --------------
    for (const delay of [0, 1200]) {
      const p = await context.newPage();
      await p.goto(`${base}/listings/a`, { waitUntil: "load" });
      await addressInPopup(p); // let the first listing settle
      await p.evaluate(
        ([addr, delayMs]) => window.__navigate(addr, "/listings/b", delayMs, false),
        [LISTING_B, delay]
      );
      await p.waitForTimeout(delay + 6000);
      const addr = await addressInPopup(p);
      record(
        `client-side navigation re-scrapes (page renders after ${delay}ms)`,
        addr === LISTING_B,
        addr === null ? "popup never opened" : addr === LISTING_A ? `STALE — still ${LISTING_A}` : addr
      );
      await p.close();
    }

    // --- 3: back button ----------------------------------------------------
    {
      const p = await context.newPage();
      await p.goto(`${base}/listings/a`, { waitUntil: "load" });
      await addressInPopup(p);
      await p.evaluate(([addr]) => window.__navigate(addr, "/listings/b", 300, false), [LISTING_B]);
      await p.waitForTimeout(6000);
      await p.evaluate(
        ([addr]) => {
          history.pushState({}, "", "/listings/a");
          setTimeout(() => {
            document.title = addr + " | Listings";
            document.getElementById("addr").textContent = addr;
          }, 300);
        },
        [LISTING_A]
      );
      await p.waitForTimeout(6000);
      const addr = await addressInPopup(p);
      record(
        "going back re-scrapes too",
        addr === LISTING_A,
        addr === null ? "popup never opened" : addr === LISTING_B ? `STALE — still ${LISTING_B}` : addr
      );
      await p.close();
    }

    // --- 4: navigating to a page with no address ---------------------------
    {
      const p = await context.newPage();
      await p.goto(`${base}/listings/a`, { waitUntil: "load" });
      await addressInPopup(p);
      await p.evaluate(() => window.__navigate("", "/about", 300, false));
      await p.waitForTimeout(8000);
      const addr = await addressInPopup(p);
      record(
        "navigating to a page with no address does not keep the old one",
        addr !== LISTING_A,
        addr === null ? "popup hidden (acceptable)" : addr === "" ? "no address (correct)" : `showing ${addr}`
      );
      await p.close();
    }

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
