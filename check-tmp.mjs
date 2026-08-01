import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PREVIEW = "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com";
const TARGETS = [
  ["smoke /embed-school", "https://dream-schools-smoke-p1-b208bf11e83e.herokuapp.com/embed-school"],
  ["/embed inline direct", `${PREVIEW}/embed?mode=inline&accent=%231fa55f&h=640&address=1500%20N%2023rd%20Street%2C%20Fort%20Pierce%2C%20FL%2034950`],
  ["/embed popup direct", `${PREVIEW}/embed?mode=popup&accent=%231fa55f&address=1500%20N%2023rd%20Street%2C%20Fort%20Pierce%2C%20FL%2034950`],
  ["/embed inline, no address", `${PREVIEW}/embed?mode=inline&accent=%231fa55f&h=640`],
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [label, url] of TARGETS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console.error: " + m.text().split("\n")[0]);
  });
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(6000);
  console.log(`\n=== ${label} ===`);
  if (!errors.length) console.log("  (no errors)");
  for (const e of [...new Set(errors)].slice(0, 6)) console.log("  " + e.slice(0, 220));
  await ctx.close();
}
await browser.close();
