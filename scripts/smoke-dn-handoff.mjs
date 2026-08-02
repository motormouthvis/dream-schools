#!/usr/bin/env node
/**
 * Dream Neighborhood hand-off smoke test (popup only).
 *
 * Self-contained: spins up a local origin that serves the LOCAL public/embed.js
 * plus stubs for /api/embed/dn-config, /api/embed/scrape and /embed, then drives it
 * with headless Chromium. Nothing here talks to a deployed environment, so it
 * can run on a branch before anything is pushed.
 *
 * The fixture page mimics DN's sdk.js under the shared-popup model: it sets
 * window.__DN_EXPLORER_API_BASE__, loads a script from a dreamneighborhood.com
 * host, and (when unentitled) appends embed.js to <head> at runtime carrying
 * data-via="dn-explorer" and the popup presentation attributes.
 *
 * Checks:
 *   1. Hand-off reveals the popup well inside the grace period (Task 1).
 *   2. Same page WITHOUT data-via still waits out the grace period (the old
 *      two-snippet install keeps its speculative wait).
 *   3. data-accent-color / data-position / data-bottom-offset /
 *      data-tooltip-message all apply to a runtime-injected tag (Task 2).
 *   4. Loading embed.js twice mounts exactly one popup (Task 2).
 *   5. A late NE ready signal still hides the popup even after a hand-off.
 *   6. data-via arriving late ends an already-running grace wait early.
 *
 * Usage: node scripts/smoke-dn-handoff.mjs
 */
import { readFileSync } from "fs";
import { createServer } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBED_JS = readFileSync(join(__dirname, "..", "public", "embed.js"), "utf8");

const GRACE_MS = 4000;
const ACCENT = "#ACEF00";
const TOOLTIP = "See schools near {{address}}";
const ADDRESS = "910 Fairway Dr NE, Warren, OH";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

// ---------------------------------------------------------------------------
// Local origin: embed.js + the endpoints it calls, and the fixture page.
// ---------------------------------------------------------------------------

const CONFIG_JSON = JSON.stringify({
  enabled: true,
  partnerId: "smoke-partner",
  widgetNumber: 1,
  accentColor: "#1fa55f",
  position: "right",
  bottomOffset: 0,
  tooltipMessage: "",
  popup: { position: "right", bottomOffset: 0, tooltipMessage: "" },
  inline: { minHeight: 540, showHeader: false },
  neighborhoodExplorerGraceMs: GRACE_MS,
});

/**
 * @param {{ via: boolean, twice?: boolean, viaDelayMs?: number }} opts
 */
function fixturePage(opts) {
  const attrs = {
    ...(opts.via ? { "data-via": "dn-explorer" } : {}),
    "data-accent-color": ACCENT,
    "data-position": "left",
    "data-bottom-offset": "40",
    "data-tooltip-message": TOOLTIP,
  };
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${ADDRESS} | Listing</title>
<script src="https://staging.dreamneighborhood.com/explorer/sdk.js" async onerror="void 0"></script>
<script>
  // What DN's bundle puts on every page it is installed on, entitled or not.
  window.__DN_EXPLORER_API_BASE__ = "https://staging.dreamneighborhood.com";
  window.__DN_SCHOOL_EXPLORER_ORIGIN__ = location.origin;
  window.__DN_HANDOFF_AT__ = null;
  // DN resolves entitlement first, so the hand-off is always a runtime <head>
  // injection some way into the page's life — never a parser-inserted tag.
  setTimeout(function dnHandOff() {
    window.__DN_HANDOFF_AT__ = performance.now();
    var attrs = ${JSON.stringify(attrs)};
    function inject() {
      var s = document.createElement("script");
      s.src = "/embed.js";
      s.async = true;
      Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      document.head.appendChild(s);
    }
    inject();
    ${opts.twice ? "inject();" : ""}
  }, ${opts.viaDelayMs ?? 300});
</script>
</head>
<body><h1>${ADDRESS}</h1><p>3 bed / 2 bath</p></body></html>`;
}

function startOrigin() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, type, body, extra = {}) => {
      res.writeHead(status, {
        "content-type": type,
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        ...extra,
      });
      res.end(body);
    };
    if (req.method === "OPTIONS") return send(204, "text/plain", "");
    if (url.pathname === "/embed.js") return send(200, "text/javascript", EMBED_JS);
    // The customer comes from DN now, relayed through /api/embed/dn-config.
    if (url.pathname === "/api/embed/dn-config") return send(200, "application/json", CONFIG_JSON);
    if (url.pathname === "/api/embed/scrape") {
      return send(200, "application/json", JSON.stringify({ success: true, address: ADDRESS, lat: 41.24, lon: -80.82 }));
    }
    if (url.pathname === "/embed") return send(200, "text/html", "<!doctype html><title>explorer</title>ok");
    if (url.pathname.startsWith("/listing")) {
      const via = url.searchParams.get("via") === "1";
      const twice = url.searchParams.get("twice") === "1";
      const viaDelayMs = Number(url.searchParams.get("delay") || 300);
      return send(200, "text/html", fixturePage({ via, twice, viaDelayMs }), { "cache-control": "no-store" });
    }
    return send(404, "text/plain", "not found");
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

/** ms from DN's hand-off to the popup becoming visible, or null if it never did. */
async function timeToPopup(page, budgetMs) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const r = await page.evaluate(() => {
      const root = document.getElementById("dse-root");
      if (!root) return null;
      const cs = getComputedStyle(root);
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      return { now: performance.now(), handoff: window.__DN_HANDOFF_AT__ };
    });
    if (r) return r.handoff == null ? 0 : Math.round(r.now - r.handoff);
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(100);
  }
}

async function run() {
  const { server, base } = await startOrigin();
  const browser = await loadChromium();
  try {
    const context = await browser.newContext();

    // --- 1. Hand-off reveals immediately ------------------------------------
    {
      const page = await context.newPage();
      await page.goto(`${base}/listing?via=1`, { waitUntil: "load" });
      const ms = await timeToPopup(page, 15000);
      record(
        "hand-off: popup appears without the grace wait",
        ms !== null && ms < GRACE_MS / 2,
        ms === null ? "popup never appeared" : `${ms}ms after hand-off (grace is ${GRACE_MS}ms)`
      );
      await page.close();
    }

    // --- 2. No data-via → grace still applies -------------------------------
    {
      const page = await context.newPage();
      await page.goto(`${base}/listing?via=0`, { waitUntil: "load" });
      const ms = await timeToPopup(page, 20000);
      record(
        "no data-via: grace period is still honoured",
        ms !== null && ms >= GRACE_MS * 0.9,
        ms === null ? "popup never appeared" : `${ms}ms after injection (grace is ${GRACE_MS}ms)`
      );
      await page.close();
    }

    // --- 3. data-* on a runtime-injected tag ---------------------------------
    {
      const page = await context.newPage();
      await page.goto(`${base}/listing?via=1`, { waitUntil: "load" });
      await timeToPopup(page, 15000);
      await page.waitForTimeout(1200); // tooltip is revealed ~800ms after the popup
      const applied = await page.evaluate(() => {
        const root = document.getElementById("dse-root");
        const bubble = root && root.querySelector(".dse-bubble");
        const tip = document.querySelector(".dse-tooltip-text");
        return {
          accent: root && root.style.getPropertyValue("--dse-accent").trim(),
          bottom: root && root.style.getPropertyValue("--dse-bo").trim(),
          left: !!(bubble && bubble.classList.contains("dse-bubble--left")),
          tooltip: tip ? tip.textContent.trim() : "",
        };
      });
      record(
        "runtime-injected tag: data-accent-color applies",
        (applied.accent || "").toLowerCase() === ACCENT.toLowerCase(),
        `--dse-accent=${applied.accent}`
      );
      record("runtime-injected tag: data-position applies", applied.left, `left bubble=${applied.left}`);
      record("runtime-injected tag: data-bottom-offset applies", applied.bottom === "40px", `--dse-bo=${applied.bottom}`);
      record(
        "runtime-injected tag: data-tooltip-message applies",
        applied.tooltip.startsWith("See schools near") && !applied.tooltip.includes("{{address}}"),
        applied.tooltip || "(empty)"
      );
      await page.close();
    }

    // --- 4. Double load is harmless -----------------------------------------
    {
      const page = await context.newPage();
      await page.goto(`${base}/listing?via=1&twice=1`, { waitUntil: "load" });
      await timeToPopup(page, 15000);
      await page.waitForTimeout(1500);
      const counts = await page.evaluate(() => ({
        roots: document.querySelectorAll("#dse-root").length,
        bubbles: document.querySelectorAll(".dse-bubble").length,
        tags: document.querySelectorAll('script[data-via="dn-explorer"]').length,
      }));
      record(
        "loaded twice: exactly one popup mounts",
        counts.roots === 1 && counts.bubbles === 1,
        `${counts.tags} script tags → ${counts.roots} roots, ${counts.bubbles} bubbles`
      );
      await page.close();
    }

    // --- 5. Late NE ready still suppresses after a hand-off ------------------
    {
      const page = await context.newPage();
      await page.addInitScript(() => {
        setTimeout(() => {
          window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true;
          window.dispatchEvent(new Event("dn:neighborhood-explorer-ready"));
        }, 2500);
      });
      await page.goto(`${base}/listing?via=1`, { waitUntil: "load" });
      const shown = await timeToPopup(page, 15000);
      await page.waitForTimeout(3000);
      const stillVisible = await page.evaluate(() => {
        const root = document.getElementById("dse-root");
        return !!root && getComputedStyle(root).display !== "none";
      });
      record(
        "hand-off: a late NE ready signal still hides the popup",
        shown !== null && !stillVisible,
        shown === null ? "popup never appeared at all" : `shown at ${shown}ms, hidden after ready`
      );
      await page.close();
    }

    // --- 6. Late hand-off ends an in-flight grace wait -----------------------
    {
      const page = await context.newPage();
      // Our own tag boots first with no data-via and starts waiting; DN's
      // hand-off lands 1.5s later. The wait should end there, not at 4s.
      await page.goto(`${base}/listing?via=0&delay=0`, { waitUntil: "load" });
      await page.evaluate(() => {
        setTimeout(() => {
          const s = document.createElement("script");
          s.src = "/embed.js";
          s.async = true;
          s.setAttribute("data-via", "dn-explorer");
          document.head.appendChild(s);
        }, 1500);
      });
      const ms = await timeToPopup(page, 20000);
      record(
        "late hand-off: ends an already-running grace wait early",
        ms !== null && ms < GRACE_MS * 0.9,
        ms === null ? "popup never appeared" : `${ms}ms (grace is ${GRACE_MS}ms)`
      );
      await page.close();
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
