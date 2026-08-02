import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://127.0.0.1:4200";
const url = (extra = "") =>
  `${BASE}/embed?mode=popup&accent=%231fa55f` +
  `&address=${encodeURIComponent("1500 N 23rd St, Fort Pierce, FL 34950")}` +
  `&customer=demo-customer&provider=${encodeURIComponent("Ann's FP Realty")}` +
  `&uv=1&ud=0&ui=3&ur=0${extra}`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 780 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 120)); });
await page.goto(url(), { waitUntil: "load", timeout: 45000 });

for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => ({
    ad: document.body.innerText.includes("What you"),
    text: document.body.innerText.slice(0, 90).replace(/\s+/g, " "),
  }));
  if (s.ad) { console.log(`ad appeared after ~${i + 1}s`); break; }
  if (i === 9 || i === 19) console.log(`  ${i + 1}s — on screen: ${s.text}`);
  if (i === 29) console.log("  never appeared");
}
await page.screenshot({ path: "/tmp/ad-430.png" });
await browser.close();
