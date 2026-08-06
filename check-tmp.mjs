import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const P = "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com";
// A host DN staging recognises, so the SDK actually mounts.
const HOST = "https://dn-qa-alpha-8eb7204ac5a4.herokuapp.com";

const IDX_MARKER = `<div id="idx-details-content">MLS# 12717406</div>`;
const ONE = `<script>var coords=[{"address":"301 Channel Drive","cityName":"Island Lake","stateAbrv":"IL","zipcode":"60042","lat":42.281979,"lng":-88.193459}];<\/script>`;
const MANY = `<script>var coords=[
 {"id":"1","latitude":42.452621,"longitude":-88.244789,"address":"2412 Elk Drive"},
 {"id":"2","latitude":42.28,"longitude":-88.19,"address":"301 Channel Drive"},
 {"id":"3","latitude":42.30,"longitude":-88.20,"address":"9 Somewhere Else"}];<\/script>`;

const PAGES = {
  "/idx/details/listing/c019/12717406": `<title>Residential for sale in Island Lake, Illinois, 12717406</title>${IDX_MARKER}${ONE}`,
  "/idx/results/listings": `<title>idx-wrapper - Home Sweet Home Realty</title>${IDX_MARKER}${MANY}`,
  "/idx/details/listing/c019/none": `<title>Residential for sale, 99999999</title>${IDX_MARKER}`,
  "/about-us": `<title>About Our Agency</title><h1>Serving buyers since 1998</h1>`,
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [path, body] of Object.entries(PAGES)) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(`${HOST}/**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8">${body}<script src="${P}/embed.js" async></script></head><body><p>listing page</p></body></html>`,
    })
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 70)));
  await page.goto(HOST + path, { waitUntil: "load", timeout: 45000 });

  let src = "";
  for (let i = 0; i < 40 && !src; i += 1) {
    await page.waitForTimeout(500);
    src = await page.evaluate(() => {
      const f = document.querySelector("#dse-root iframe.dse-iframe");
      if (f && f.getAttribute("src")) return f.getAttribute("src");
      const root = document.getElementById("dse-root");
      // The popup only sets src on open; the bubble appearing means it resolved.
      return root && getComputedStyle(root).display !== "none" ? "READY" : "";
    });
  }
  if (src === "READY") {
    await page.evaluate(() => document.querySelector("#dse-root .dse-bubble")?.click());
    await page.waitForTimeout(1500);
    src = await page.evaluate(() => {
      const f = document.querySelector("#dse-root iframe.dse-iframe");
      return f ? f.getAttribute("src") || "" : "";
    });
  }
  const u = src ? new URL(src, HOST) : null;
  console.log(
    `${path.padEnd(38)} address=${JSON.stringify(u && u.searchParams.get("address"))}`.padEnd(90) +
      ` general=${u && u.searchParams.get("general")}  lat=${u && u.searchParams.get("lat")}  errors=${errors[0] || "none"}`
  );
  await ctx.close();
}
await browser.close();
