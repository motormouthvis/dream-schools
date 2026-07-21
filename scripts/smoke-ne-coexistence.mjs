#!/usr/bin/env node
/**
 * Neighborhood Explorer coexistence smoke test (popup only).
 *
 * Loads the LOCAL (new) public/embed.js against the LIVE smoke sites by
 * intercepting the embed.js request, so we test the exact code in this branch
 * against the real /api/embed/config for each authorized smoke hostname.
 *
 * For each site it checks:
 *   - NO NE  → the floating School popup (#dse-root) becomes visible.
 *   - ?ne    → NE signals ready; the popup stays hidden.
 *   - inline (/embed.html) still mounts even with ?ne (never suppressed).
 *
 * Env (defaults are the live smoke URLs from docs/SMOKE_TEST_PLAN.md):
 *   SMOKE_SITE_IND, SMOKE_SITE_P1, SMOKE_SITE_P2
 *
 * Usage: node scripts/smoke-ne-coexistence.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBED_JS = readFileSync(join(__dirname, "..", "public", "embed.js"), "utf8");

const SITES = [
  { key: "ind", base: process.env.SMOKE_SITE_IND || "https://dream-schools-smoke-ind-43304e4a96aa.herokuapp.com" },
  { key: "p1", base: process.env.SMOKE_SITE_P1 || "https://dream-schools-smoke-p1-b208bf11e83e.herokuapp.com" },
  { key: "p2", base: process.env.SMOKE_SITE_P2 || "https://dream-schools-smoke-p2-da2515146e4c.herokuapp.com" },
];

const LISTING = "/listing-nyc-empire.html";
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function loadChromium() {
  let pw;
  try {
    pw = require("playwright");
  } catch {
    console.log("Installing playwright…");
    require("child_process").execSync("npm install --no-save playwright@1.52.0", {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
    pw = require("playwright");
  }
  try {
    return await pw.chromium.launch({ args: ["--no-sandbox"] });
  } catch {
    console.log("Downloading Chromium…");
    require("child_process").execSync("npx --yes playwright install chromium", {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
    return await pw.chromium.launch({ args: ["--no-sandbox"] });
  }
}

// Serve the local embed.js in place of the CDN one; let everything else pass.
async function interceptEmbed(context) {
  await context.route("**/embed.js**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/javascript", "access-control-allow-origin": "*" },
      body: EMBED_JS,
    })
  );
}

// Inject the Neighborhood Explorer ready handshake into the page itself, so the
// test is self-contained and doesn't depend on the live smoke site having the
// `?ne` simulator deployed. Mirrors the real NE contract: fire once after delayMs.
async function injectNeReady(target, delayMs) {
  await target.addInitScript((delay) => {
    setTimeout(() => {
      window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true;
      window.dispatchEvent(new Event("dn:neighborhood-explorer-ready"));
    }, delay);
  }, delayMs);
}

async function popupVisible(page) {
  return page.evaluate(() => {
    const root = document.getElementById("dse-root");
    if (!root) return { present: false, visible: false };
    const cs = getComputedStyle(root);
    return { present: true, visible: cs.display !== "none" && cs.visibility !== "hidden" };
  });
}

async function run() {
  const browser = await loadChromium();
  try {
    for (const site of SITES) {
      const context = await browser.newContext();
      await interceptEmbed(context);

      // --- Case 1: no NE → popup should appear ---
      {
        const page = await context.newPage();
        await page.goto(site.base + LISTING, { waitUntil: "load", timeout: 30000 });
        // Wait for geocode + reveal (Census can be slow); poll up to 10s.
        let v = { present: false, visible: false };
        for (let i = 0; i < 20; i++) {
          v = await popupVisible(page);
          if (v.visible) break;
          await page.waitForTimeout(500);
        }
        record(`${site.key}: popup shows with NO Neighborhood Explorer`, v.visible,
          v.present ? (v.visible ? "visible" : "present but hidden") : "#dse-root absent (config disabled?)");
        await page.close();
      }

      // --- Case 2: NE signals ready (~1.2s) → popup should stay hidden ---
      {
        const page = await context.newPage();
        await injectNeReady(page, 1200);
        await page.goto(site.base + LISTING, { waitUntil: "load", timeout: 30000 });
        // Give it well past both the ready signal and any geocode/grace.
        await page.waitForTimeout(7000);
        const v = await popupVisible(page);
        record(`${site.key}: popup hidden WHEN Neighborhood Explorer is present`, !v.visible,
          v.visible ? "popup visible (should be hidden)" : "hidden");
        await page.close();
      }

      // --- Case 2b: NE already ready before mount → popup never shows ---
      {
        const page = await context.newPage();
        await injectNeReady(page, 0);
        await page.goto(site.base + LISTING, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(6000);
        const v = await popupVisible(page);
        record(`${site.key}: popup hidden when NE ready BEFORE mount`, !v.visible,
          v.visible ? "popup visible (should be hidden)" : "hidden");
        await page.close();
      }

      // --- Case 2c: an NE embed on the page → School popup must not appear
      //     (even with NO ready signal) — never a popup over an embed. ---
      {
        const page = await context.newPage();
        // Insert an NE inline container (#dn-explorer) before embed.js resolves.
        await page.addInitScript(() => {
          const add = () => {
            if (!document.getElementById("dn-explorer")) {
              const d = document.createElement("div");
              d.id = "dn-explorer";
              (document.body || document.documentElement).appendChild(d);
            }
          };
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", add);
          } else {
            add();
          }
        });
        await page.goto(site.base + LISTING, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(7000);
        const v = await popupVisible(page);
        record(`${site.key}: popup hidden when an NE EMBED is on the page`, !v.visible,
          v.visible ? "popup visible (should be hidden)" : "hidden");
        await page.close();
      }

      // --- Case 3: NE present but inline embed still mounts ---
      {
        const page = await context.newPage();
        await injectNeReady(page, 1200);
        await page.goto(site.base + "/embed.html", { waitUntil: "load", timeout: 30000 });
        let mounted = false;
        for (let i = 0; i < 16; i++) {
          mounted = await page.evaluate(() => {
            const c = document.getElementById("dream-schools-explorer");
            return !!(c && c.querySelector("iframe"));
          });
          if (mounted) break;
          await page.waitForTimeout(500);
        }
        record(`${site.key}: inline embed still mounts with NE present`, mounted,
          mounted ? "iframe mounted" : "no inline iframe");
        await page.close();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
