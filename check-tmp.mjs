import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

// Our own reader, lifted verbatim out of public/embed.js so it can be run in a
// page. Not a re-implementation — this is the code that ships today.
const OURS = `
function idxAddrFromObj(c) {
  if (!c || typeof c !== "object") return null;
  var street = (c.address || "").toString().trim();
  if (!street && (c.streetNumber || c.streetName)) {
    street = [c.streetNumber, c.streetDirection, c.streetName, c.unitNumber]
      .map(function (x) { return x == null ? "" : String(x).trim(); }).filter(Boolean).join(" ");
  }
  if (!street || !/\\d/.test(street)) return null;
  var city = (c.cityName || c.city || "").toString().trim();
  var state = (c.stateAbrv || c.stateAbbr || c.state || "").toString().trim();
  var zip = (c.zipcode || c.zip || c.postalCode || "").toString().trim();
  var out = street;
  if (city) out += ", " + city;
  if (state) out += ", " + state;
  if (zip) out += " " + zip;
  return out.trim() || null;
}
window.__oursIdx = function () {
  try {
    var g = typeof coords !== "undefined" && coords ? coords : window.coords || null;
    return { count: Array.isArray(g) ? g.length : (g ? 1 : 0), address: idxAddrFromObj(Array.isArray(g) ? g[0] : g) };
  } catch (e) { return { count: -1, address: null, err: String(e) }; }
};
`;

const detect = readFileSync("public/address-detector/detect-address.js", "utf8");
const extract = readFileSync("public/address-detector/extract-address.js", "utf8");
const THEIRS =
  extract.replace(/^\s*export\s+/gm, "") +
  "\n" +
  detect.replace(/^\s*import[^;]+;/gm, "").replace(/^\s*export\s+/gm, "") +
  "\nwindow.__dn = { detectPageAddress, extractFromIdxBroker, extractCoordsFromPage, DETECTOR_VERSION };";

const PAGES = [
  ["detail page  ", "https://search.homesweethomerr.com/idx/details/listing/c019/12717406/"],
  ["results page ", "https://search.homesweethomerr.com/idx/results/listings?pt=1&idxID=c019&start=0&per=25"],
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [label, url] of PAGES) {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(12000);
    await page.addScriptTag({ content: OURS });
    await page.addScriptTag({ content: THEIRS });
    const r = await page.evaluate(async () => {
      const ours = window.__oursIdx();
      const dn = await window.__dn.detectPageAddress();
      return {
        ours,
        dnAddress: dn.address,
        dnCoords: dn.coords || null,
        dnListing: dn.looksLikeListing,
        dnFound: dn.found,
        title: document.title.slice(0, 60),
      };
    });
    console.log(`\n=== ${label} ${url.replace("https://search.homesweethomerr.com", "")}`);
    console.log(`  title            : ${r.title}`);
    console.log(`  coords records   : ${r.ours.count}`);
    console.log(`  OURS (ships now) : ${JSON.stringify(r.ours.address)}`);
    console.log(`  DN v3            : ${JSON.stringify(r.dnAddress)}  coords=${JSON.stringify(r.dnCoords)}`);
    console.log(`  DN looksLikeListing=${r.dnListing} found=${r.dnFound}`);
  } catch (err) {
    console.log(`\n=== ${label} FAILED: ${err.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
