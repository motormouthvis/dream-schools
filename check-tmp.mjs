import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:4200";
const ADDRESS = "1500 N 23rd St, Fort Pierce, FL 34950";
const QS = `address=${encodeURIComponent(ADDRESS)}&school=${process.env.SCHOOL || ""}`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });

for (const path of ["/parents", "/"]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 110)));

  // Watch from the first script that runs, before React hydrates, and record
  // whether the landing hero is ever in the DOM.
  await page.addInitScript(() => {
    window.__heroSeen = false;
    const check = () => {
      if (document.querySelector('img[src*="hero-banner"]')) window.__heroSeen = true;
    };
    const iv = setInterval(check, 10);
    setTimeout(() => clearInterval(iv), 6000);
    document.addEventListener("DOMContentLoaded", check);
  });

  await page.goto(`${BASE}${path}?${QS}`, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => ({
    heroSeen: window.__heroSeen,
    heroNow: !!document.querySelector('img[src*="hero-banner"]'),
    schools: document.body.innerText.includes("Dream Rating") || /schools?/i.test(document.body.innerText),
    stillLoading: document.body.innerText.includes("Looking up schools"),
  }));
  console.log(
    `${path.padEnd(9)} landing hero ever painted: ${r.heroSeen ? "YES — flash" : "no"}` +
      `   results shown: ${r.schools && !r.stillLoading ? "yes" : "no"}` +
      `   errors: ${errors.length ? errors[0] : "none"}`
  );
  await ctx.close();
}
await browser.close();
