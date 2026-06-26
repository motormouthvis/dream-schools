import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://localhost:3000/";
const OUT = process.argv[3] || "screenshot.png";
const EXPAND = process.argv.includes("--expand");

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
// wait for the schools widget to render
await page.waitForSelector("h2", { timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
if (EXPAND) {
  const btns = await page.$$("button");
  for (const b of btns) {
    const txt = await page.evaluate((el) => el.textContent || "", b);
    if (txt.includes("View full safety details")) {
      await b.click();
      await new Promise((r) => setTimeout(r, 600));
      break;
    }
  }
}
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("wrote", OUT);
