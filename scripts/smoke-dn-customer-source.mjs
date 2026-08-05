#!/usr/bin/env node
/**
 * The customer now comes from Dream Neighborhood. These are DN's acceptance
 * cases for that change, run against their real QA sites and a real customer's
 * site, all of which already load the preview bundle.
 *
 * The one that matters most is charlie: a host DN does not know must render
 * nothing. Before this change it rendered a working School Explorer, because we
 * were answering from our own copy of the customer — so a customer we had
 * offboarded kept the product for ever.
 *
 * Usage: node scripts/smoke-dn-customer-source.mjs
 */
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
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

/** What the inline embed actually mounted, and with what settings. */
async function inspect(page) {
  for (let i = 0; i < 30; i += 1) {
    const s = await page.evaluate(() => {
      const frame = document.querySelector("#dream-schools-explorer iframe");
      const src = frame ? frame.getAttribute("src") || "" : "";
      let accent = "";
      let address = "";
      if (src) {
        try {
          const u = new URL(src, location.href);
          accent = u.searchParams.get("accent") || "";
          address = u.searchParams.get("address") || "";
        } catch {
          /* leave blank */
        }
      }
      return { mounted: !!frame, hasSrc: !!src, accent, address };
    });
    // initInline creates the iframe and sets src a moment later, so "an iframe
    // exists" is not yet "the explorer was told what to show".
    if (s.mounted && s.hasSrc) return s;
    await page.waitForTimeout(500);
  }
  return { mounted: false, accent: "", address: "" };
}

/**
 * What DN says right now. These are live fixtures DN edits, so asserting a
 * colour we baked in only tests that nobody has touched it since — which is not
 * the claim. The claim is that we render whatever DN currently says.
 */
const DN_BASE = process.env.DN_BASE || "https://staging.dreamneighborhood.com";

async function dnSaysFor(host) {
  const res = await fetch(`${DN_BASE}/explorer/resolve/?host=${host}&widget_number=1`);
  return res.ok ? res.json() : {};
}

async function run() {
  const browser = await loadChromium();
  try {
    // --- 1. A free schools-only customer DN knows about --------------------
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto("https://dn-qa-alpha-8eb7204ac5a4.herokuapp.com/embed-school", {
        waitUntil: "load",
        timeout: 45000,
      });
      const s = await inspect(page);
      record("alpha: a customer DN knows renders the School Explorer", s.mounted, `mounted=${s.mounted}`);
      const dnAlpha = await dnSaysFor("dn-qa-alpha-8eb7204ac5a4.herokuapp.com");
      record(
        "alpha: it uses DN's accent colour, not ours",
        s.accent.toLowerCase() === String(dnAlpha.accentColor || "").toLowerCase(),
        `accent=${s.accent || "(none)"} — DN says ${dnAlpha.accentColor}`
      );
      await ctx.close();
    }

    // --- 2. A host DN has never heard of ----------------------------------
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto("https://dn-qa-charlie-8a2ed1c99348.herokuapp.com/embed-school", {
        waitUntil: "load",
        timeout: 45000,
      });
      await page.waitForTimeout(9000);
      const s = await page.evaluate(() => ({
        embed: !!document.querySelector("#dream-schools-explorer iframe"),
        popup: !!document.getElementById("dse-root"),
      }));
      record(
        "charlie: a host DN does not know renders nothing",
        !s.embed && !s.popup,
        `embed=${s.embed}, popup=${s.popup}`
      );
      await ctx.close();
    }

    // --- 3. A real customer whose address we had wrong ---------------------
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto("https://wdmtaj-realty.netlify.app/schools", { waitUntil: "load", timeout: 45000 });
      const s = await inspect(page);
      const frame = page.frames().find((f) => f.url().includes("/embed?"));
      const text = frame ? await frame.evaluate(() => document.body.innerText).catch(() => "") : "";
      const warren = /warren/i.test(s.address) || /warren/i.test(text);
      const florida = /green cove|walnut/i.test(s.address) || /green cove/i.test(text);
      record(
        "wdmtaj: shows DN's address, not the one from our dead table",
        s.mounted && !warren,
        `address=${s.address || "(scraped from page)"}${warren ? " — STILL WARREN, OH" : ""}${florida ? " — Green Cove Springs" : ""}`
      );
      const dnWdmtaj = await dnSaysFor("wdmtaj-realty.netlify.app");
      record(
        "wdmtaj: uses DN's accent colour",
        s.accent.toLowerCase() === String(dnWdmtaj.accentColor || "").toLowerCase(),
        `accent=${s.accent || "(none)"} — DN says ${dnWdmtaj.accentColor}`
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  console.log("Two cases need DN: disabling qa-alpha, and pointing us at a dead DN host.");
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
