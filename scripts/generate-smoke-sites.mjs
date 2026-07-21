#!/usr/bin/env node
/**
 * Generate bare-bones realtor listing sites with popup + embed snippets.
 * Run: node scripts/generate-smoke-sites.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const EMBED_JS = "https://www.dreamneighborhoodschools.com/embed.js";

// Optional Neighborhood Explorer simulator for coexistence QA. Inert unless the
// page is loaded with `?ne` in the query string. Mirrors the real NE contract:
// after a delay it sets the ready flag and dispatches the ready event once.
//   ?ne          → fire after 1200ms (typical "signal arrives later")
//   ?ne=<ms>     → fire after <ms> (e.g. ?ne=0 near-immediate, ?ne=6000 slow)
const NE_SIMULATOR = `<script>
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (!q.has("ne")) return;
    var raw = q.get("ne");
    var delay = parseInt(raw, 10);
    if (!isFinite(delay) || delay < 0) delay = 1200;
    setTimeout(function () {
      window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true;
      window.dispatchEvent(new Event("dn:neighborhood-explorer-ready"));
      if (window.console && console.log) console.log("[NE-SIM] ready fired after " + delay + "ms");
    }, delay);
  } catch (e) {}
})();
</script>`;

const SITES = [
  {
    dir: "independent-realtor",
    brand: "Lone Star Independent Realty",
    tagline: "Independent realtor smoke site (no partner)",
    accent: "#0f6e4c",
  },
  {
    dir: "partner-realtor-1",
    brand: "Harbor View Homes",
    tagline: "Partner customer #1 smoke site",
    accent: "#1a4f8b",
  },
  {
    dir: "partner-realtor-2",
    brand: "Summit Street Realty",
    tagline: "Partner customer #2 smoke site",
    accent: "#8a3b12",
  },
];

const LISTINGS = [
  { slug: "nyc-empire", address: "350 5th Avenue, New York, NY 10118", city: "New York, NY" },
  { slug: "dc-whitehouse", address: "1600 Pennsylvania Avenue NW, Washington, DC 20500", city: "Washington, DC" },
  { slug: "chicago-sears", address: "233 S Wacker Drive, Chicago, IL 60606", city: "Chicago, IL" },
  { slug: "cupertino", address: "1 Apple Park Way, Cupertino, CA 95014", city: "Cupertino, CA" },
  { slug: "denver", address: "200 E Colfax Avenue, Denver, CO 80203", city: "Denver, CO" },
  { slug: "houston", address: "600 Travis Street, Houston, TX 77002", city: "Houston, TX" },
  { slug: "charlotte", address: "100 N Tryon Street, Charlotte, NC 28202", city: "Charlotte, NC" },
  { slug: "la-olympic", address: "800 W Olympic Boulevard, Los Angeles, CA 90015", city: "Los Angeles, CA" },
  { slug: "boston", address: "225 Beacon Street, Boston, MA 02116", city: "Boston, MA" },
  { slug: "portland", address: "1420 NW Lovejoy Street, Portland, OR 97209", city: "Portland, OR" },
  { slug: "fort-pierce", address: "1500 N 23rd Street, Fort Pierce, FL 34950", city: "Fort Pierce, FL" },
  { slug: "austin", address: "301 W 4th Street, Austin, TX 78701", city: "Austin, TX" },
];

function layout({ brand, tagline, accent, title, body, extraHead = "", scripts = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { --accent: ${accent}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; background: #f7f4ef; }
    header { background: linear-gradient(120deg, #1a1a1a 0%, #2c2c2c 60%, var(--accent) 160%); color: #fff; padding: 1.25rem 1.5rem; }
    header a { color: #fff; text-decoration: none; font-weight: 700; }
    header .brand { font-size: 1.4rem; letter-spacing: 0.02em; }
    header .tag { opacity: 0.85; font-size: 0.85rem; margin-top: 0.25rem; font-family: system-ui, sans-serif; }
    nav { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.75rem; font-family: system-ui, sans-serif; font-size: 0.85rem; }
    nav a { opacity: 0.9; border-bottom: 1px solid rgba(255,255,255,0.35); }
    main { max-width: 880px; margin: 0 auto; padding: 1.5rem; }
    .card { background: #fff; border: 1px solid #e4ddd2; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.75rem; }
    h2 { margin: 0 0 0.75rem; font-size: 1.2rem; }
    .addr { font-size: 1.05rem; color: #333; }
    .meta { font-family: system-ui, sans-serif; font-size: 0.8rem; color: #666; margin-top: 0.5rem; }
    ul.listings { list-style: none; padding: 0; margin: 0; }
    ul.listings li { margin: 0.4rem 0; }
    ul.listings a { color: var(--accent); font-family: system-ui, sans-serif; font-weight: 600; }
    #dream-schools-explorer { min-height: 720px; border: 1px dashed #cbbfae; background: #faf8f5; }
    footer { text-align: center; padding: 2rem 1rem; font-family: system-ui, sans-serif; font-size: 0.75rem; color: #777; }
  </style>
  ${extraHead}
</head>
<body>
  <header>
    <div class="brand"><a href="/">${brand}</a></div>
    <div class="tag">${tagline}</div>
    <nav>
      <a href="/">Home</a>
      <a href="/listings.html">Listings</a>
      <a href="/embed.html">Inline Embed Demo</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>Smoke-test listing site for Dream Neighborhood Schools · not a real brokerage</footer>
  ${NE_SIMULATOR}
  ${scripts}
</body>
</html>`;
}

function writeSite(site) {
  const root = join("smoke-sites", site.dir);
  mkdirSync(root, { recursive: true });

  const listingLinks = LISTINGS.map(
    (l) => `<li><a href="/listing-${l.slug}.html">${l.address}</a></li>`
  ).join("\n");

  writeFileSync(
    join(root, "index.html"),
    layout({
      ...site,
      title: `${site.brand} · Home`,
      body: `
        <div class="card">
          <h1>${site.brand}</h1>
          <p class="addr">Bare-bones smoke site with the School Explorer <strong>floating popup</strong> (one-line install).</p>
          <p class="meta">Open any listing below, then use the popup to search schools. Usage should appear in the customer admin.</p>
        </div>
        <div class="card">
          <h2>Featured listings (USA)</h2>
          <ul class="listings">${listingLinks}</ul>
        </div>`,
      scripts: `<script src="${EMBED_JS}" async></script>`,
    })
  );

  writeFileSync(
    join(root, "listings.html"),
    layout({
      ...site,
      title: `${site.brand} · Listings`,
      body: `
        <div class="card">
          <h1>All listings</h1>
          <ul class="listings">${listingLinks}</ul>
        </div>`,
      scripts: `<script src="${EMBED_JS}" async></script>`,
    })
  );

  writeFileSync(
    join(root, "embed.html"),
    layout({
      ...site,
      title: `${site.brand} · Inline Embed`,
      body: `
        <div class="card">
          <h1>Inline School Explorer embed</h1>
          <p class="addr">This page mounts the explorer inline (embed surface) instead of the floating popup.</p>
          <p class="meta">Default address for scrape fallback is set on the account; this page also includes a sample address in the title/JSON-LD.</p>
        </div>
        <div class="card">
          <h2>1500 N 23rd Street, Fort Pierce, FL 34950</h2>
          <div id="dream-schools-explorer"></div>
        </div>`,
      extraHead: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Residence","address":{"@type":"PostalAddress","streetAddress":"1500 N 23rd Street","addressLocality":"Fort Pierce","addressRegion":"FL","postalCode":"34950"}}</script>`,
      scripts: `<script src="${EMBED_JS}" async></script>`,
    })
  );

  for (const l of LISTINGS) {
    writeFileSync(
      join(root, `listing-${l.slug}.html`),
      layout({
        ...site,
        title: `${l.address} | ${site.brand}`,
        body: `
          <div class="card">
            <h1>${l.address}</h1>
            <p class="addr">${l.city}</p>
            <p class="meta">Smoke listing · use the School Explorer popup (bottom-right) to explore nearby schools.</p>
            <p>Beautiful home in ${l.city}. Schedule a tour with ${site.brand}.</p>
          </div>`,
        extraHead: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"RealEstateListing","name":"${l.address}","address":{"@type":"PostalAddress","streetAddress":"${l.address.split(",")[0]}","addressLocality":"${l.city.split(",")[0].trim()}","addressRegion":"${l.city.split(",")[1]?.trim() || ""}"}}</script>
<meta property="og:title" content="${l.address}" />`,
        scripts: `<script src="${EMBED_JS}" async></script>`,
      })
    );
  }

  // Static server entry for Heroku (Node http without deps).
  writeFileSync(
    join(root, "server.js"),
    `const http = require("http");
const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 3000;
const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => console.log("smoke site on " + port));
`
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: `dn-smoke-${site.dir}`,
        private: true,
        version: "1.0.0",
        scripts: { start: "node server.js" },
        engines: { node: "22.x" },
      },
      null,
      2
    )
  );
  writeFileSync(join(root, "Procfile"), "web: node server.js\n");
  console.log("Wrote", root, "with", LISTINGS.length, "listings");
}

for (const site of SITES) writeSite(site);
console.log("Done.");
