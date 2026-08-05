import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const P = "https://dream-schools-preview-b6b5fcaf4493.herokuapp.com";
const ADDR = "1500 N 23rd St, Fort Pierce, FL 34950";

function page(variant) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${ADDR} | Realty</title></head>
<body><h1>${ADDR}</h1><p>Some of the realtor's own content, which must not move.</p>
<div id="dream-schools-explorer"${variant ? ` data-variant="${variant}"` : ""}></div>
<p id="below">More of the realtor's content below the embed.</p>
<script src="${P}/embed.js" async></script></body></html>`;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });

for (const variant of ["minimalist", "classic", "full", null]) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 850 }, ignoreHTTPSErrors: true });
  await ctx.route("https://dn-qa-alpha-8eb7204ac5a4.herokuapp.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: page(variant) })
  );
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 80)));
  await p.goto("https://dn-qa-alpha-8eb7204ac5a4.herokuapp.com/probe-listing", { waitUntil: "load", timeout: 45000 });

  let src = "";
  for (let i = 0; i < 30 && !src; i += 1) {
    await p.waitForTimeout(500);
    src = await p.evaluate(() => {
      const f = document.querySelector("#dream-schools-explorer iframe");
      return f ? f.getAttribute("src") || "" : "";
    });
  }
  const v = src ? new URL(src).searchParams.get("variant") : "(none)";
  const beforeTop = await p.evaluate(() => document.getElementById("below").getBoundingClientRect().top);

  let opened = false;
  let overlayHasSchool = false;
  if (variant === "minimalist") {
    await p.waitForTimeout(3000);
    const frame = p.frames().find((f) => f.url().includes("/embed?"));
    if (frame) {
      await frame.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find((x) => /See details/i.test(x.textContent || ""));
        if (b) b.click();
      });
    }
    await p.waitForTimeout(3500);
    opened = await p.evaluate(() => {
      const o = document.querySelector("#dse-school-overlay .dse-backdrop");
      return !!o && getComputedStyle(o).display !== "none";
    });
    const ov = p.frames().find((f) => f.url().includes("school="));
    overlayHasSchool = !!ov;
  }
  const afterTop = await p.evaluate(() => document.getElementById("below").getBoundingClientRect().top);

  console.log(
    `data-variant=${String(variant).padEnd(11)} -> renders "${v}"` +
      (variant === "minimalist" ? `  overlay=${opened} school-iframe=${overlayHasSchool}` : "") +
      `  page moved=${Math.abs(afterTop - beforeTop) > 4}` +
      `  errors=${errors.length ? errors[0] : "none"}`
  );
  if (variant === "minimalist" && opened) await p.screenshot({ path: "/tmp/minimalist-overlay.png" });
  await ctx.close();
}
await browser.close();
