#!/usr/bin/env node
/**
 * Does Dream Neighborhood's address detector cover what our scraper covers?
 *
 * DN is handing us its detector so both products read listing addresses with
 * one piece of code. Before swapping, the question that matters is whether ours
 * recognises anything theirs does not — and the answer has to survive the fact
 * that theirs *waits*, so something our one-shot scraper needed a special case
 * for might now simply be found by waiting.
 *
 * The fixtures reproduce the shapes, not the sites: a real listing page is a
 * moving target that needs a search interaction to reach, and a flaky page is
 * poor evidence either way.
 *
 * Usage: node scripts/probe-address-detector.mjs
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(__dirname, "..", "public", "address-detector");

for (const f of ["detect-address.js", "extract-address.js"]) {
  if (!existsSync(join(VENDOR, f))) {
    console.error(`Missing ${join(VENDOR, f)} — vendor DN's detector first.`);
    process.exit(2);
  }
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// --- Fixtures -------------------------------------------------------------

/** IDX Broker: MLS id in the title, WordPress JSON-LD, address only in its own globals. */
const IDX_BROKER = `<!doctype html><html><head><meta charset="utf-8">
<title>MLS# 11987654 | Home Sweet Home Realty</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Home Sweet Home Realty","url":"https://example.test"}</script>
</head><body>
<div id="idx-details-content"><h1>MLS# 11987654</h1><p>4 bed · 3 bath</p></div>
<script>var coords = [{"address":"812 Hillside Ave","cityName":"Barrington","stateAbrv":"IL","zipcode":"60010","latitude":"42.153","longitude":"-88.136"}];</script>
<form><input type="hidden" name="address" value="812 Hillside Ave">
<input type="hidden" name="cityName" value="Barrington">
<input type="hidden" name="state" value="IL">
<input type="hidden" name="zipcode" value="60010"></form>
</body></html>`;

/** A platform that renders the listing after DOMContentLoaded. */
const LATE_RENDER = `<!doctype html><html><head><meta charset="utf-8"><title>Listing | Realty</title></head>
<body><div id="app">Loading…</div>
<script>
  setTimeout(function () {
    document.title = "3309 N Indian River Dr, Fort Pierce, FL 34946 | Realty";
    document.getElementById("app").textContent = "3309 N Indian River Dr, Fort Pierce, FL 34946";
  }, 1000);
</script></body></html>`;

/** A normally rendered listing — must not be slowed down. */
const IMMEDIATE = `<!doctype html><html><head><meta charset="utf-8">
<title>1500 N 23rd St, Fort Pierce, FL 34950 | Realty</title></head>
<body><h1>1500 N 23rd St, Fort Pierce, FL 34950</h1></body></html>`;

/** A listing page that never reveals an address anywhere. */
const LISTING_NO_ADDRESS = `<!doctype html><html><head><meta charset="utf-8">
<title>Featured Property | Realty</title></head>
<body><div id="idx-details-content"><h1>Beautiful home</h1><p>MLS # 11223344</p></div></body></html>`;

/** Not a listing at all — the configured fallback is correct here. */
const NOT_A_LISTING = `<!doctype html><html><head><meta charset="utf-8">
<title>About Our Agency | Realty</title></head>
<body><h1>Serving buyers since 1998</h1></body></html>`;

const PAGES = {
  "/idx-broker/idx/details/listing/a123/11987654": IDX_BROKER,
  "/listings/late-render": LATE_RENDER,
  "/listings/1500-n-23rd-st": IMMEDIATE,
  "/featured-homes/beautiful-home": LISTING_NO_ADDRESS,
  "/about": NOT_A_LISTING,
};

function startOrigin() {
  const detect = readFileSync(join(VENDOR, "detect-address.js"));
  const extract = readFileSync(join(VENDOR, "extract-address.js"));
  const server = createServer((req, res) => {
    const path = req.url.split("?")[0];
    const send = (type, body) => {
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    if (path === "/address-detector/detect-address.js") return send("text/javascript", detect);
    if (path === "/address-detector/extract-address.js") return send("text/javascript", extract);
    const page = PAGES[path];
    if (page) return send("text/html", page);
    res.writeHead(404).end("not found");
  });
  return new Promise((r) =>
    server.listen(0, "127.0.0.1", () => r({ server, base: `http://127.0.0.1:${server.address().port}` }))
  );
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

async function detectOn(browser, base, path) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  const out = await page.evaluate(async (b) => {
    const started = performance.now();
    const mod = await import(`${b}/address-detector/detect-address.js`);
    const r = await mod.detectPageAddress();
    return { ...r, ms: Math.round(performance.now() - started), version: mod.DETECTOR_VERSION };
  }, base);
  await ctx.close();
  return out;
}

async function run() {
  const { server, base } = await startOrigin();
  const browser = await loadChromium();
  try {
    // These three fail against DETECTOR_VERSION 1 and the failures are the
    // report, not a broken test: haveSomething() counts document.title, which
    // every page has from the first millisecond, so the wait never happens.
    const late = await detectOn(browser, base, "/listings/late-render");
    record(
      "waits for a page that renders its address after ~1s",
      late.found && /3309 N Indian River/i.test(late.address || ""),
      `${JSON.stringify(late.address)} after ${late.waitedMs}ms`
    );

    const now = await detectOn(browser, base, "/listings/1500-n-23rd-st");
    record(
      "a normally rendered page is not slowed down",
      now.found && now.ms < 400,
      `${now.ms}ms total, waitedMs=${now.waitedMs}`
    );

    const none = await detectOn(browser, base, "/featured-homes/beautiful-home");
    record(
      "a listing with no address says so, and does not invent one from the URL",
      !none.found && none.looksLikeListing === true,
      `found=${none.found} looksLikeListing=${none.looksLikeListing} address=${JSON.stringify(none.address)}`
    );

    const other = await detectOn(browser, base, "/about");
    record(
      "an agency page is not treated as a listing",
      other.looksLikeListing === false,
      `looksLikeListing=${other.looksLikeListing}`
    );

    // The one that decides whether our IDX Broker reader can be dropped.
    const idx = await detectOn(browser, base, "/idx-broker/idx/details/listing/a123/11987654");
    record(
      "IDX Broker: DN's detector reads the address our own reader was added for",
      idx.found && /812 Hillside/i.test(idx.address || ""),
      `found=${idx.found} looksLikeListing=${idx.looksLikeListing} address=${JSON.stringify(idx.address)} waited=${idx.waitedMs}ms`
    );

    console.log(`\nDETECTOR_VERSION reported by the vendored copy: ${late.version}`);
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
