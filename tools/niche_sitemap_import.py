#!/usr/bin/env python3
"""
Fetch Niche's sitemap and upload the set of valid K-12 school slugs to
Dream Neighborhood Schools.

WHY A REAL BROWSER IS NEEDED:
  Niche is fronted by PerimeterX bot protection, which (a) blocks datacenter
  IPs and (b) serves a JavaScript challenge that a plain HTTP client (Python
  `requests`, curl) cannot solve — so those get a 403 even from a home network.
  A real browser solves the challenge transparently. This script therefore has
  three acquisition modes:

    --browser     Drive a real Chromium via Playwright (RECOMMENDED). Opens a
                  window; if a "press & hold" check appears, complete it once and
                  the script continues automatically.
    --from-files  Parse sitemap files you downloaded yourself in your browser
                  (100% reliable, fully manual). Point it at a folder.
    (default)     Plain `requests` — only works on sites without PerimeterX;
                  kept for completeness.

  Fetching the sitemap is allowed by Niche's robots.txt (only named AI/scraper
  bots are disallowed; /sitemap/ and /k12/ are open to general agents).

SETUP (Windows PowerShell):
    python -m pip install requests playwright
    python -m playwright install chromium

USAGE:
    # Recommended: real browser, then upload
    $env:NICHE_IMPORT_PASSWORD = "<EMBED_ADMIN_PASSWORD>"
    python tools/niche_sitemap_import.py --browser

    # Just collect (no upload), save the slug list:
    python tools/niche_sitemap_import.py --browser --dry-run --out niche-slugs.txt

    # Manual fallback: download sitemap files in Chrome into a folder, then:
    python tools/niche_sitemap_import.py --from-files sitemaps
"""

import argparse
import glob
import gzip
import io
import os
import re
import sys
import time
import xml.etree.ElementTree as ET

try:
    import requests
except ImportError:
    sys.exit("Install dependencies first: python -m pip install requests playwright")

SITEMAP_INDEX = "https://www.niche.com/sitemap/index.xml"
SCHOOL_RE = re.compile(r"^https?://www\.niche\.com/k12/([^/?#]+)/?$", re.I)
DENY = {"search", "survey", "rankings", "schools-near-you", "about", "compare"}
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def maybe_gunzip(url, content):
    if url.endswith(".gz") or content[:2] == b"\x1f\x8b":
        try:
            return gzip.GzipFile(fileobj=io.BytesIO(content)).read()
        except OSError:
            pass
    return content


def localname(tag):
    return tag.rsplit("}", 1)[-1]


def parse_locs(xml_bytes):
    """Return (child_sitemaps, page_urls) from a sitemap or sitemap index."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return [], []
    locs = [
        (el.text or "").strip()
        for el in root.iter()
        if localname(el.tag) == "loc" and el.text
    ]
    if localname(root.tag) == "sitemapindex":
        return locs, []
    return [], locs


def extract_slugs(urls, into):
    for u in urls:
        m = SCHOOL_RE.match(u)
        if m:
            slug = m.group(1).lower()
            if slug not in DENY:
                into.add(slug)


# ---------------------------------------------------------------------------
# Acquisition: requests
# ---------------------------------------------------------------------------
def requests_fetcher():
    sess = requests.Session()
    sess.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

    def fetch(url):
        r = sess.get(url, timeout=45)
        if r.status_code == 403:
            raise PermissionError(
                "403 from Niche (PerimeterX). Plain requests can't solve their "
                "JS challenge — re-run with --browser, or use --from-files."
            )
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code} for {url}")
        return maybe_gunzip(url, r.content)

    return fetch


# ---------------------------------------------------------------------------
# Acquisition: real browser (Playwright)
# ---------------------------------------------------------------------------
def looks_like_sitemap(b):
    head = b[:4000].lower()
    return b"<loc>" in head or b"<sitemapindex" in head or b"<urlset" in head


def with_browser(headless, work):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit(
            "Playwright not installed. Run:\n"
            "  python -m pip install playwright\n"
            "  python -m playwright install chromium"
        )
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(user_agent=UA, locale="en-US")
        page = context.new_page()
        print("Opening Niche to clear the bot check…")
        page.goto(SITEMAP_INDEX, wait_until="domcontentloaded", timeout=60000)

        # Wait until the PerimeterX challenge clears. The context's cookies are
        # shared with context.request, so once the page is unblocked, API fetches
        # pass too. Give the user time to complete a press-&-hold if shown.
        deadline = time.time() + 180
        ok = False
        while time.time() < deadline:
            try:
                r = context.request.get(SITEMAP_INDEX, timeout=30000)
                if r.status == 200 and looks_like_sitemap(r.body()):
                    ok = True
                    break
            except Exception:
                pass
            print("  …waiting for verification (complete any 'press & hold' in the window)", end="\r")
            page.wait_for_timeout(3000)
        print()
        if not ok:
            browser.close()
            sys.exit(
                "Could not get past Niche's verification within 3 minutes.\n"
                "Try again with a visible window (omit --headless), or use the\n"
                "--from-files fallback (download the sitemaps in Chrome yourself)."
            )
        print("Verification cleared — fetching sitemaps.")

        def fetch(url):
            r = context.request.get(url, timeout=60000)
            if r.status == 403:
                raise PermissionError(f"403 for {url}")
            if r.status != 200:
                raise RuntimeError(f"HTTP {r.status} for {url}")
            return maybe_gunzip(url, r.body())

        try:
            return work(fetch)
        finally:
            browser.close()


# ---------------------------------------------------------------------------
# Acquisition: local files
# ---------------------------------------------------------------------------
def collect_from_files(path):
    if os.path.isdir(path):
        files = sorted(
            glob.glob(os.path.join(path, "**", "*.xml"), recursive=True)
            + glob.glob(os.path.join(path, "**", "*.xml.gz"), recursive=True)
            + glob.glob(os.path.join(path, "**", "*.gz"), recursive=True)
        )
    else:
        files = sorted(glob.glob(path))
    if not files:
        sys.exit(f"No .xml/.gz files found at {path}")
    print(f"Reading {len(files)} local sitemap file(s)…")
    slugs = set()
    for fp in files:
        with open(fp, "rb") as fh:
            content = maybe_gunzip(fp, fh.read())
        _, urls = parse_locs(content)
        extract_slugs(urls, slugs)
    return sorted(slugs)


# ---------------------------------------------------------------------------
# Shared: walk the sitemap tree with a given fetch() function
# ---------------------------------------------------------------------------
def collect_slugs(fetch):
    print(f"Reading sitemap index: {SITEMAP_INDEX}")
    children, _ = parse_locs(fetch(SITEMAP_INDEX))
    if not children:
        sys.exit("No child sitemaps found in the index.")
    k12 = [c for c in children if re.search(r"k12|school", c, re.I)]
    targets = k12 or children
    print(f"{len(children)} child sitemaps ({len(targets)} to scan).")
    slugs = set()
    for i, sm in enumerate(targets, 1):
        try:
            sub_children, urls = parse_locs(fetch(sm))
        except (PermissionError, RuntimeError) as e:
            print(f"  ! skip {sm}: {e}")
            continue
        nested_urls = []
        for ns in sub_children:
            if re.search(r"k12|school", ns, re.I) or not k12:
                try:
                    _, nu = parse_locs(fetch(ns))
                    nested_urls.extend(nu)
                except (PermissionError, RuntimeError):
                    pass
        extract_slugs(urls + nested_urls, slugs)
        print(f"  [{i}/{len(targets)}] {len(slugs)} slugs so far", end="\r")
        time.sleep(0.2)
    print()
    return sorted(slugs)


def upload(slugs, base_url, password, batch=10000):
    url = base_url.rstrip("/") + "/api/niche-slugs"
    headers = {"x-embed-admin-password": password, "Content-Type": "application/json"}
    total = 0
    for i in range(0, len(slugs), batch):
        chunk = slugs[i : i + batch]
        r = requests.post(url, json={"slugs": chunk, "replace": i == 0},
                          headers=headers, timeout=120)
        if r.status_code == 401:
            sys.exit("Unauthorized — check the password (EMBED_ADMIN_PASSWORD).")
        if r.status_code != 200:
            sys.exit(f"Upload failed ({r.status_code}): {r.text[:300]}")
        total = r.json().get("total", total)
        print(f"  uploaded {min(i + batch, len(slugs))}/{len(slugs)} (server total: {total})")
    return total


def main():
    ap = argparse.ArgumentParser(description="Import Niche K-12 slugs from their sitemap.")
    ap.add_argument("--browser", action="store_true", help="use a real Chromium (recommended)")
    ap.add_argument("--headless", action="store_true", help="run the browser hidden (less reliable)")
    ap.add_argument("--from-files", help="parse sitemap .xml/.gz files you downloaded yourself")
    ap.add_argument("--base-url", default="https://www.dreamneighborhoodschools.com")
    ap.add_argument("--password", default=os.environ.get("NICHE_IMPORT_PASSWORD")
                    or os.environ.get("EMBED_ADMIN_PASSWORD"))
    ap.add_argument("--batch", type=int, default=10000)
    ap.add_argument("--dry-run", action="store_true", help="collect only; don't upload")
    ap.add_argument("--out", help="write slugs to this file (one per line)")
    args = ap.parse_args()

    if args.from_files:
        slugs = collect_from_files(args.from_files)
    elif args.browser:
        slugs = with_browser(args.headless, collect_slugs)
    else:
        slugs = collect_slugs(requests_fetcher())

    print(f"Collected {len(slugs)} unique K-12 school slugs.")
    if not slugs:
        sys.exit("No slugs found — aborting (won't wipe the server set).")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write("\n".join(slugs) + "\n")
        print(f"Wrote {args.out}")
    if args.dry_run:
        print("Dry run — skipping upload.")
        return
    if not args.password:
        sys.exit("No password. Set NICHE_IMPORT_PASSWORD or pass --password.")
    print(f"Uploading to {args.base_url} …")
    total = upload(slugs, args.base_url, args.password, args.batch)
    print(f"Done. Server now has {total} validated Niche slugs.")


if __name__ == "__main__":
    main()
