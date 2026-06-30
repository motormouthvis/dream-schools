#!/usr/bin/env python3
"""
Fetch Niche's sitemap from a residential machine and upload the set of valid
K-12 school slugs to Dream Neighborhood Schools.

WHY THIS RUNS LOCALLY (not on the server):
  Niche fronts its site with PerimeterX bot protection, which blocks our
  datacenter (Heroku) IPs with a 403 CAPTCHA regardless of request pacing. A
  normal residential connection is not blocked, so this script must run on your
  own machine. Fetching the sitemap is allowed by Niche's robots.txt (only named
  AI/scraper bots are disallowed; /sitemap/ and /k12/ are open to general agents).

WHAT IT DOES:
  1. Reads Niche's sitemap index, walks every child sitemap.
  2. Extracts each valid /k12/<slug>/ school URL.
  3. Uploads the de-duplicated slug set to /api/niche-slugs in batches.

The server then links a school's specific Niche profile when its slug is in this
set, and otherwise falls back to Niche's K-12 home page.

USAGE:
  pip install requests
  export NICHE_IMPORT_PASSWORD='<your EMBED_ADMIN_PASSWORD>'
  python3 niche_sitemap_import.py                      # fetch + upload
  python3 niche_sitemap_import.py --dry-run --out slugs.txt   # fetch only

If you hit a 403 even from home, your IP may be flagged; try a different network
or run from a browser-automation tool (Playwright) — but a normal home
connection almost always works for the sitemap.
"""

import argparse
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
    sys.exit("This script needs 'requests'. Install it with: pip install requests")

SITEMAP_INDEX = "https://www.niche.com/sitemap/index.xml"
SCHOOL_RE = re.compile(r"^https?://www\.niche\.com/k12/([^/?#]+)/?$", re.I)
# Single-segment /k12/ pages that are not schools.
DENY = {"search", "survey", "rankings", "schools-near-you", "about", "compare"}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/xml,application/xml,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def fetch(url, tries=3):
    """GET a URL, transparently gunzip .gz sitemaps, with simple retries."""
    last = None
    for attempt in range(tries):
        try:
            r = SESSION.get(url, timeout=45)
        except requests.RequestException as e:
            last = str(e)
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code == 403:
            raise SystemExit(
                f"\n403 Forbidden for {url}\n"
                "Niche's bot protection is blocking this network. Run from a normal\n"
                "home/residential connection (not a VPN, cloud, or office proxy)."
            )
        if r.status_code != 200:
            last = f"HTTP {r.status_code}"
            time.sleep(2 * (attempt + 1))
            continue
        content = r.content
        if url.endswith(".gz") or content[:2] == b"\x1f\x8b":
            try:
                content = gzip.GzipFile(fileobj=io.BytesIO(content)).read()
            except OSError:
                pass
        return content
    raise SystemExit(f"Failed to fetch {url}: {last}")


def localname(tag):
    return tag.rsplit("}", 1)[-1]


def parse_locs(xml_bytes):
    """Return (child_sitemaps, page_urls) from a sitemap or sitemap index."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return [], []
    root_name = localname(root.tag)
    locs = [
        (el.text or "").strip()
        for el in root.iter()
        if localname(el.tag) == "loc" and el.text
    ]
    if root_name == "sitemapindex":
        return locs, []
    return [], locs


def collect_slugs(verbose=True):
    print(f"Reading sitemap index: {SITEMAP_INDEX}")
    children, _ = parse_locs(fetch(SITEMAP_INDEX))
    if not children:
        raise SystemExit("No child sitemaps found in the index.")

    # Prefer child sitemaps that look K-12 related; fall back to all.
    k12_children = [c for c in children if re.search(r"k12|school", c, re.I)]
    targets = k12_children or children
    print(f"{len(children)} child sitemaps ({len(targets)} to scan).")

    slugs = set()
    for i, sm in enumerate(targets, 1):
        try:
            sub_children, urls = parse_locs(fetch(sm))
        except SystemExit:
            raise
        except Exception as e:  # noqa: BLE001
            print(f"  ! skip {sm}: {e}")
            continue
        # A child can itself be an index (nested); walk one level deeper.
        nested = []
        if sub_children:
            for ns in sub_children:
                if re.search(r"k12|school", ns, re.I) or not k12_children:
                    _, nurls = parse_locs(fetch(ns))
                    nested.extend(nurls)
        for u in urls + nested:
            m = SCHOOL_RE.match(u)
            if m:
                slug = m.group(1).lower()
                if slug not in DENY:
                    slugs.add(slug)
        if verbose:
            print(f"  [{i}/{len(targets)}] {len(slugs)} slugs so far", end="\r")
        time.sleep(0.3)  # be polite
    print()
    return sorted(slugs)


def upload(slugs, base_url, password, batch=10000):
    url = base_url.rstrip("/") + "/api/niche-slugs"
    headers = {"x-embed-admin-password": password, "Content-Type": "application/json"}
    total = 0
    for i in range(0, len(slugs), batch):
        chunk = slugs[i : i + batch]
        payload = {"slugs": chunk, "replace": i == 0}
        r = requests.post(url, json=payload, headers=headers, timeout=120)
        if r.status_code == 401:
            raise SystemExit("Unauthorized — check your password (EMBED_ADMIN_PASSWORD).")
        if r.status_code != 200:
            raise SystemExit(f"Upload failed ({r.status_code}): {r.text[:300]}")
        data = r.json()
        total = data.get("total", total)
        print(f"  uploaded {min(i + batch, len(slugs))}/{len(slugs)} (server total: {total})")
    return total


def main():
    ap = argparse.ArgumentParser(description="Import Niche K-12 slugs from their sitemap.")
    ap.add_argument("--base-url", default="https://www.dreamneighborhoodschools.com")
    ap.add_argument("--password", default=os.environ.get("NICHE_IMPORT_PASSWORD")
                    or os.environ.get("EMBED_ADMIN_PASSWORD"))
    ap.add_argument("--batch", type=int, default=10000)
    ap.add_argument("--dry-run", action="store_true", help="fetch only; don't upload")
    ap.add_argument("--out", help="also write slugs to this file (one per line)")
    args = ap.parse_args()

    slugs = collect_slugs()
    print(f"Collected {len(slugs)} unique K-12 school slugs.")
    if not slugs:
        raise SystemExit("No slugs found — aborting (won't wipe the server set).")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write("\n".join(slugs) + "\n")
        print(f"Wrote {args.out}")

    if args.dry_run:
        print("Dry run — skipping upload.")
        return
    if not args.password:
        raise SystemExit("No password. Set NICHE_IMPORT_PASSWORD or pass --password.")
    print(f"Uploading to {args.base_url} …")
    total = upload(slugs, args.base_url, args.password, args.batch)
    print(f"Done. Server now has {total} validated Niche slugs.")


if __name__ == "__main__":
    main()
