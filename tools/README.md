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

### Run it (from your own machine, on a home/residential connection)

```bash
pip install requests
export NICHE_IMPORT_PASSWORD='<the EMBED_ADMIN_PASSWORD value>'

# Fetch Niche's sitemap and upload the slug set:
python3 tools/niche_sitemap_import.py

# Or just inspect what it finds, without uploading:
python3 tools/niche_sitemap_import.py --dry-run --out niche-slugs.txt
```

Re-run it periodically (e.g. monthly) to pick up new/renamed schools; each full
run replaces the server's set.

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
