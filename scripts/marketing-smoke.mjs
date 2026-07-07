import { chromium, devices } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.SMOKE_BASE || "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com";
const CALENDLY = "calendly.com/d/cvbg-myt-4x9/dream-neighborhood-demo-call";
const OUT = "scripts/smoke-shots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  {
    path: "/",
    placeholderIncludes: "Search, by any US address, city or zip code",
    mustInclude: [
      "for parents & home buyers",
      "School Explorer - Free",
      "instantly and free",
      "No account needed. No ads. No catch.",
      "Ratings for over 119,000 schools",
      "student to teacher ratios",
      "for any US address",
      "What you'll see",
      "College readiness information",
      "Why families love it",
      "How it works",
      "Search now",
      "Add our Free School Explorer to Every Listing",
      "Add to My Site - Free",
      "Installs in under 60 seconds",
      "White-label the free School Explorer across every client site",
      "Zero cost to white-label",
      "Up to 40% recurring revenue",
      "See Partnership Details",
      "Featured Partner: RealtyCandy",
    ],
    // No long dashes should remain on the homepage.
    mustExcludeChars: ["—", "–"],
    // The realtor "1-line install" line must not appear in the parents section.
    mustExclude: ["Easy 1-line install for real estate professionals"],
  },
  {
    path: "/realtors",
    mustInclude: [
      "For realtors & brokerages",
      "Neighborhood Explorer",
      "School Explorer",
      "38 hyperlocal insights",
      "Install on My Site",
      "See the Neighborhood Explorer in Action",
      "$50-$800/month",
    ],
    mustExclude: [],
  },
  {
    path: "/partners",
    mustInclude: [
      "What you'll offer your clients",
      "38 hyperlocal insights",
      "How the revenue share works",
      "Book a Demo",
      "$50-$800/month",
    ],
    mustExclude: [],
  },
  {
    // Realtor install page — must NOT show any revenue-share language.
    path: "/installation",
    mustInclude: [
      "Add the School Explorer to your site",
      "Save $100-$800/month",
      "See partner installation",
    ],
    mustExclude: ["40%", "revenue share", "revenue-share", "White-label", "white-label"],
  },
  {
    // Partner install page — the revenue-share details live here.
    path: "/installation/partners",
    mustInclude: [
      "Install the School Explorer across every client site",
      "up to 40% recurring",
      "Book a 15-Minute Demo",
    ],
    mustExclude: [],
  },
];

const viewports = [
  { name: "desktop", context: { viewport: { width: 1280, height: 900 } } },
  { name: "mobile", context: { ...devices["Pixel 7"] } },
];

let failures = 0;
const note = (ok, msg) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${msg}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
for (const vp of viewports) {
  console.log(`\n===== ${vp.name.toUpperCase()} =====`);
  const context = await browser.newContext(vp.context);
  for (const p of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const url = BASE + p.path;
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    console.log(`\n[${vp.name}] ${p.path} → HTTP ${resp?.status()}`);
    note(resp?.status() === 200, `status 200`);

    if (p.clickText) {
      await page.getByText(p.clickText, { exact: false }).first().click();
      await page.waitForTimeout(300);
    }

    // Visible text (entities decoded, only rendered content). Lowercased because
    // some badges use CSS text-transform:uppercase, which innerText reflects.
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    for (const s of p.mustInclude) note(body.includes(s.toLowerCase()), `contains "${s}"`);
    for (const s of p.mustExclude) note(!body.includes(s.toLowerCase()), `does NOT contain "${s}"`);
    for (const ch of p.mustExcludeChars || []) note(!body.includes(ch), `no long dash "${ch}" in visible text`);

    if (p.placeholderIncludes) {
      const placeholders = await page.$$eval("input", (els) =>
        els.map((e) => e.getAttribute("placeholder") || "")
      );
      note(
        placeholders.some((ph) => ph.includes(p.placeholderIncludes)),
        `search placeholder = "${p.placeholderIncludes}"`
      );
    }

    // Every Calendly-labeled booking button must point to the Calendly URL.
    const bookLinks = await page.$$eval("a", (as) =>
      as
        .filter((a) => /book a (demo|15-minute)/i.test(a.textContent || ""))
        .map((a) => a.getAttribute("href") || "")
    );
    if (bookLinks.length) {
      const allCalendly = bookLinks.every((h) => h.includes("calendly.com/d/cvbg-myt-4x9"));
      note(allCalendly, `all ${bookLinks.length} "Book a Demo" link(s) → Calendly`);
    }

    // Horizontal overflow check (mobile layout sanity).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    note(overflow <= 2, `no horizontal overflow (extra=${overflow}px)`);

    note(errors.length === 0, `no console/page errors${errors.length ? ": " + errors.join(" | ") : ""}`);

    await page.screenshot({ path: `${OUT}/${vp.name}${p.path === "/" ? "-home" : p.path.replace(/\//g, "-")}.png`, fullPage: true });
    await page.close();
  }
  await context.close();
}
await browser.close();

console.log(`\n================\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
