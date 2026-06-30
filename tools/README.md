# Tools

## `niche_sitemap_import.py` — validated Niche school links

The school detail page links out to a school's **Niche** profile. Niche has no
public API or per-school ID, and their bot protection (PerimeterX) blocks our
server with a 403 — so we can't verify links from Heroku. Instead we ingest
Niche's own **sitemap** (a legitimate, robots-allowed list of every valid
`/k12/` URL) from a residential machine and store the slug set on the server.

The backend then links a school's **specific** Niche profile when its slug is in
the imported set, and otherwise falls back to **Niche's K-12 home**. Before any
import, it uses a best-effort specific slug (so nothing regresses).

### Run it (from your own machine)

Niche's bot protection (PerimeterX) blocks both datacenter IPs **and** plain
HTTP clients — a bare `requests`/`curl` gets a 403 even from home, because it
can't solve Niche's JavaScript challenge. So use a **real browser** via
Playwright (recommended), or download the sitemaps yourself and parse them.

```powershell
# Windows PowerShell
python -m pip install requests playwright
python -m playwright install chromium
$env:NICHE_IMPORT_PASSWORD = "<the EMBED_ADMIN_PASSWORD value>"

# Recommended — drives a real Chromium. A window opens; if a "press & hold"
# check appears, complete it once and the script continues automatically.
python tools/niche_sitemap_import.py --browser

# Inspect first without uploading:
python tools/niche_sitemap_import.py --browser --dry-run --out niche-slugs.txt
```

**Manual fallback (100% reliable).** If the browser mode can't clear the check,
open these in Chrome yourself (your real browser passes PerimeterX), save the
XML/.gz files into a folder, then parse them locally:

```powershell
# 1) Open https://www.niche.com/sitemap/index.xml in Chrome, note the child
#    sitemap URLs, open/save the K-12 ones into .\sitemaps\
# 2) Parse the downloaded files and upload:
python tools/niche_sitemap_import.py --from-files .\sitemaps\
```

Re-run periodically (e.g. monthly) to pick up new/renamed schools; each full run
replaces the server's set.

### How the server uses it

- `GET  /api/niche-slugs` → `{ count }` (how many slugs are loaded)
- `POST /api/niche-slugs { slugs, replace? }` → import (password-protected; the
  importer calls this for you in batches)
- `/api/school` resolves each school's Niche link into `detail.niche =
  { url, specific }`.

### Notes / troubleshooting

- **403 from home too?** Your IP may be flagged (VPN/cloud/office proxy). Try a
  plain home connection. The sitemap is XML and low-volume, so this normally
  works without browser automation.
- **Pacing won't help on Heroku.** PerimeterX blocks on IP/fingerprint, not
  rate — every server request 403s regardless of delay. That's why this runs
  locally.
