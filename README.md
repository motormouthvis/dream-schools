# Dream Neighborhood — Schools tab (demo)

A working, standalone demo of the **Schools tab** for Dream Neighborhood, scoped to
**10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL)**:

```
34946  34947  34950  34951  34981  34982  34983  34984  34986  34987
```

A user types an address; the app finds the **school district** (point‑in‑polygon),
shows an **overall quality score**, a **3‑category quality index** (Academic &
Staffing, Safety & Climate, Scale & Stability), the **annual SSOCS‑style safety
data**, and a list of the **closest schools** with distance and a quick score.

| Schools tab | Safety details expanded |
|---|---|
| ![Schools tab](docs/schools-tab.png) | ![Safety details expanded](docs/schools-tab-safety-expanded.png) |

---

## Quick start (runs locally, no accounts needed)

```bash
npm install
npm run dev            # http://localhost:3000
```

Then enter an address such as `1500 N 23rd St, Fort Pierce, FL 34950`, or click one
of the sample chips. You can also deep‑link: `http://localhost:3000/?address=...`.

That's it — the demo ships with a generated data bundle in `data/` and needs **no
database and no API keys**. Geocoding uses the free **U.S. Census Geocoder** when
the network is available and falls back to the **zip‑code centroid** otherwise, so
it works fully offline.

---

## How it maps to the brief

**Part 1 — Data pipeline (10 zips only).** `pipeline/build_seed.py` produces the
data bundle for the target area. `pipeline/fetch_real_data.py` documents/performs
the real downloads (NCES Public School Characteristics via ArcGIS, district
boundaries, SSOCS, graduation) filtered to the 10 zips. Tables modeled:
`schools`, `school_districts`, `school_safety`, `school_graduation`.

**Part 2 — Widget design.** `components/SchoolsTab.tsx` implements the exact
layout: header (address → district → *X students • Y schools*), large overall
score with “Based on NCES 2023‑24 + 2021‑22 safety data”, three category cards,
the safety section with the **2021‑22** year label and a **“View full safety
details”** expander, the nearby‑schools list, and the footer note.

**Part 3 — Demo features.** Address input with geosearch, district name + stats,
nearby schools with distance, the full 3‑category widget, and a clearly labeled
safety timeframe.

**Part 4 — Cloud.** PostGIS schema + import are ready in `sql/` for Supabase, and
the app deploys to Vercel as‑is (see below).

---

## Project layout

```
app/                      Next.js App Router (UI + API routes)
  page.tsx                Address search + results
  api/lookup/route.ts     address -> geocode + district + scores + nearby schools
  api/geocode/route.ts    address -> lat/lon (Census, with zip fallback)
components/               SchoolsTab, ScoreGauge, CategoryCard, SafetySection, NearbySchools
lib/
  geocode.ts              Census geocoder + zip-centroid fallback
  geo.ts                  haversine distance + point-in-polygon (PostGIS equivalents)
  scoring.ts              3-category quality index + per-school quick score
  lookup.ts               orchestrates a full lookup -> LookupResult
  data.ts / types.ts      loads the data bundle / shared types
data/                     generated JSON bundle (zipcodes, district, schools, safety, graduation)
pipeline/                 build_seed.py, fetch_real_data.py, build_sql_inserts.py
sql/                      schema.sql (Postgres+PostGIS) + generated seed_data.sql
scripts/screenshot.mjs    optional: render screenshots with headless Chrome
```

## Regenerate the data bundle

```bash
python3 pipeline/build_seed.py          # writes data/*.json
python3 pipeline/build_sql_inserts.py   # writes sql/seed_data.sql (for Supabase)
```

---

## Cloud path (Supabase + Vercel)

The local demo replicates the two PostGIS queries (point‑in‑polygon for the
district, radius search for nearby schools) in TypeScript so it runs with no
database. To host the data in **Supabase**:

1. Create a project, open the SQL editor, run `sql/schema.sql` (enables PostGIS
   and creates the four tables), then run `sql/seed_data.sql`.
2. Confirm with the example queries at the bottom of `sql/schema.sql`.
3. To have the app read from Supabase instead of the JSON bundle, add a Postgres
   client and swap the lookups in `lib/lookup.ts` for the SQL in `schema.sql`
   (the `LookupResult` shape stays the same, so the UI is unchanged).

**Deploy the frontend + API to Vercel:** import the repo and deploy — no env vars
are required for the demo. To use Mapbox/Google geocoding instead of the Census
geocoder, add the key as an env var and extend `lib/geocode.ts`.

---

## Data provenance & honesty note

All 10 zip codes are served by **The School District of St. Lucie County**, and the
**school names, types, and grade spans are real**. Because the **SSOCS** public‑use
file is a de‑identified national *sample* (it cannot be joined to an individual
school), the per‑school **safety counts, enrollment, ratios, and graduation/
college‑going rates in this demo are representative/illustrative** and are
generated deterministically in `pipeline/build_seed.py`. The UI labels these as
illustrative. Wire `pipeline/fetch_real_data.py` (plus the official downloads in
its docstring) to replace them with production figures.
