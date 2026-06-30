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
HTTP clients — a bare `requests`/`curl` gets a 403 even from home. The
`--browser` (Playwright) mode also tends to get **silently fingerprinted and
blocked**: the automated Chromium hangs on "waiting for verification" even
though your *real* Chrome loads the same sitemap instantly. So the reliable,
proven path is the **manual `--from-files` download** below.

Setup (once):

```powershell
# Windows PowerShell. Use `python` or `py`, whichever resolves.
python -m pip install requests playwright   # playwright only needed for --browser
```

#### Recommended: manual download + `--from-files` (this is what works)

Your real browser passes PerimeterX, so download the sitemaps by hand. Only the
three **K-12 school profile** sitemaps contain individual `/k12/<slug>/` school
URLs — the others (`_reviews`, `_rankings`, `_academics`, `_students`,
`school-districts`, `school-networks`, `search_*`, colleges, places) are
sub-pages/non-schools and are ignored by the importer, so you don't need them.

```powershell
# 1) Make a folder for the downloads (inside the repo is fine; it's untracked).
mkdir sitemaps

# 2) In your NORMAL Chrome, open each of these and save with Ctrl+S into
#    .\sitemaps\ (keep the .xml name; the styled "no style information" view
#    still saves raw XML correctly):
#      https://www.niche.com/sitemap/k12_schools_profiles_home_1.xml
#      https://www.niche.com/sitemap/k12_schools_profiles_home_2.xml
#      https://www.niche.com/sitemap/k12_schools_profiles_home_3.xml
#    (Confirm the full current list at https://www.niche.com/sitemap/index.xml —
#    the count of k12_schools_profiles_home_N files can grow over time.)

# 3) Dry run to sanity-check the count (expect ~120k+ slugs):
python tools/niche_sitemap_import.py --from-files .\sitemaps\ --dry-run --out niche-slugs.txt

# 4) Real upload to production:
$env:NICHE_IMPORT_PASSWORD = "<the EMBED_ADMIN_PASSWORD value>"
python tools/niche_sitemap_import.py --from-files .\sitemaps\

# 5) Verify, then clean up local artifacts (do NOT commit them):
Invoke-RestMethod "https://www.dreamneighborhoodschools.com/api/niche-slugs"
Remove-Item Env:\NICHE_IMPORT_PASSWORD; Remove-Item niche-slugs.txt; Remove-Item -Recurse sitemaps
```

`--from-files` parses **every** `.xml`/`.gz` file in the folder, so it's safe to
drop in extra sitemaps — only `/k12/<slug>/` URLs are kept.

#### Optional: `--browser` (often blocked, try only if you want)

```powershell
python -m playwright install chromium
# Opens a real Chromium window and waits up to 3 min for the bot check to clear.
# In practice PerimeterX fingerprints the automated browser and it times out;
# fall back to the manual --from-files steps above when that happens.
python tools/niche_sitemap_import.py --browser --dry-run --out niche-slugs.txt
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
