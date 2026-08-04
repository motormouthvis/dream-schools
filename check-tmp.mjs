import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const P = "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
const calls = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("/api/autocomplete") || u.includes("/api/lookup")) calls.push(u.replace(P, ""));
});

await page.goto(`${P}/parents`, { waitUntil: "load", timeout: 45000 });
const box = page.locator('input[type="text"], input[type="search"]').first();
await box.click();
await box.type("1500 N 23rd St, Fort Pierce", { delay: 60 });
await page.waitForTimeout(2500);

const suggestions = await page.evaluate(() =>
  Array.from(document.querySelectorAll("li button, ul button")).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 4)
);
console.log("suggestions offered:");
for (const s of suggestions) console.log("   " + s);

if (suggestions.length) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("li button, ul button")).find((x) => x.textContent.trim());
    if (b) b.click();
  });
}
await page.waitForTimeout(9000);
const text = await page.evaluate(() => document.body.innerText);
const schools = /Dream Rating|Elementary|Academy|High School/i.test(text);
console.log("\nschools rendered after picking a suggestion:", schools);
console.log("error on page:", /Something went wrong|No match|couldn't find/i.test(text));
console.log("\nnetwork:");
for (const c of [...new Set(calls)]) console.log("   " + c.slice(0, 130));
await browser.close();
