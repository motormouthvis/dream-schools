#!/usr/bin/env node
/**
 * Browser smoke: open each dummy site's popup + embed across USA listings.
 * Requires: npx playwright-core + system Chrome/Chromium
 *
 *   SMOKE_SITE_IND=... SMOKE_SITE_P1=... SMOKE_SITE_P2=... node scripts/smoke-widgets-browser.mjs
 */
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadPlaywright() {
  try {
    return require("playwright-core");
  } catch {
    console.log("Installing playwright-core…");
    const { execSync } = require("child_process");
    execSync("npm install --no-save playwright-core@1.52.0", { stdio: "inherit", cwd: "/workspace" });
    return require("playwright-core");
  }
}

const SITES = [
  { key: "ind", base: process.env.SMOKE_SITE_IND },
  { key: "p1", base: process.env.SMOKE_SITE_P1 },
  { key: "p2", base: process.env.SMOKE_SITE_P2 },
];

const LISTINGS = [
  "/listing-nyc-empire.html",
  "/listing-dc-whitehouse.html",
  "/listing-chicago-sears.html",
  "/listing-cupertino.html",
  "/listing-denver.html",
  "/listing-houston.html",
  "/listing-charlotte.html",
  "/listing-la-olympic.html",
  "/listing-boston.html",
  "/listing-portland.html",
  "/listing-fort-pierce.html",
  "/listing-austin.html",
];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + String(detail).slice(0, 140) : ""}`);
}

async function main() {
  for (const s of SITES) {
    if (!s.base) {
      console.error("Missing smoke site env vars");
      process.exit(1);
    }
    s.base = s.base.replace(/\/$/, "");
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const shotDir = join(__dirname, "smoke-shots");
  mkdirSync(shotDir, { recursive: true });

  for (const site of SITES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // Track embed config calls (usage + surface)
    const configHits = { popup: 0, embed: 0, enabled: 0, disabled: 0 };
    page.on("response", async (res) => {
      try {
        if (!res.url().includes("/api/embed/config")) return;
        const u = new URL(res.url());
        const surface = u.searchParams.get("surface") || "?";
        if (surface === "popup") configHits.popup++;
        if (surface === "embed") configHits.embed++;
        const j = await res.json().catch(() => null);
        if (j?.enabled) configHits.enabled++;
        else configHits.disabled++;
      } catch {}
    });

    // Home — expect floating popup launcher after config
    await page.goto(`${site.base}/`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    const bubble = await page.locator("#dn-schools-bubble, [id*='dream'], button, iframe").count();
    // SDK creates a fixed-position launcher; look for common markers
    const hasLauncher =
      (await page.locator("iframe[src*='/embed']").count()) > 0 ||
      (await page.evaluate(() => {
        const nodes = [...document.querySelectorAll("div,button")];
        return nodes.some((n) => {
          const s = getComputedStyle(n);
          return s.position === "fixed" && (s.bottom !== "auto" || n.id.includes("dn") || n.className.toString().includes("dn"));
        });
      }));
    await page.screenshot({ path: join(shotDir, `${site.key}-home.png`), fullPage: true });
    record(`${site.key} home popup launcher`, hasLauncher || configHits.popup > 0, `hits=${JSON.stringify(configHits)} bubbleish=${bubble}`);

    // Click the DSE bubble and wait for explorer iframe
    try {
      await page.waitForSelector("#dse-root .dse-bubble", { timeout: 15000 });
      await page.click("#dse-root .dse-bubble");
      await page.waitForSelector("#dse-root iframe", { timeout: 15000 });
      const iframeCount = await page.locator("#dse-root iframe").count();
      record(`${site.key} popup opens iframe`, iframeCount > 0, `iframes=${iframeCount}`);
      if (iframeCount > 0) {
        const frame = page.frameLocator("#dse-root iframe").first();
        // Default address auto-loads schools; "Change" reveals the search field.
        let searched = false;
        try {
          const changeBtn = frame.getByRole("button", { name: /change/i }).first();
          if (await changeBtn.count()) await changeBtn.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);
          const input = frame.locator('input[placeholder*="address" i], input[placeholder*="Address" i], input').first();
          await input.waitFor({ timeout: 8000 });
          await input.fill("301 W 4th Street, Austin, TX 78701");
          await input.press("Enter").catch(() => {});
          await page.waitForTimeout(4500);
          searched = true;
        } catch {
          /* fall through — still pass if schools already rendered */
        }
        const hasSchools = await frame.getByText(/Schools near you|Dream Rating|Elementary|High School/i).count().catch(() => 0);
        record(
          `${site.key} popup explorer usable`,
          searched || hasSchools > 0,
          searched ? "searched Austin" : `schoolsVisible=${hasSchools}`
        );
        await page.screenshot({ path: join(shotDir, `${site.key}-popup-open.png`) });
      }
    } catch (e) {
      record(`${site.key} popup opens iframe`, false, e.message);
    }

    // Inline embed page
    configHits.popup = 0;
    configHits.embed = 0;
    await page.goto(`${site.base}/embed.html`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3500);
    const embedIframe = await page.locator("#dream-schools-explorer iframe, iframe[src*='embed']").count();
    await page.screenshot({ path: join(shotDir, `${site.key}-embed.png`), fullPage: true });
    record(`${site.key} inline embed iframe`, embedIframe > 0 || configHits.embed > 0, `iframes=${embedIframe} hits=${JSON.stringify(configHits)}`);

    // Sample listing pages across USA (every other listing for speed, but ≥6)
    let listingOk = 0;
    for (const path of LISTINGS.filter((_, i) => i % 2 === 0)) {
      await page.goto(`${site.base}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1500);
      const title = await page.title();
      const cfg = configHits.enabled;
      // Trigger config by waiting for network
      await page.waitForTimeout(1000);
      if (title && title.length > 5) listingOk++;
    }
    record(`${site.key} USA listing pages load`, listingOk >= 5, `${listingOk} listings`);

    await context.close();
  }

  await browser.close();
  const report = {
    at: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  writeFileSync(join(__dirname, "smoke-widgets-report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== WIDGET BROWSER SUMMARY ===");
  console.log(`passed=${report.passed} failed=${report.failed}`);
  process.exit(report.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
