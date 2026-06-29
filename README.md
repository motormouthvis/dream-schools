# Dream Neighborhood — Schools tab (demo)

A working, standalone demo of the **Schools tab** for Dream Neighborhood, scoped to
**10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL)**:

```
34946  34947  34950  34951  34981  34982  34983  34984  34986  34987
```

**Live (nationwide):** https://dream-schools-c2ccd302adef.herokuapp.com — all ~97k
U.S. public schools on Heroku Postgres + PostGIS.

**Now with GreatSchools-style depth** (see `COMPETITIVE_ANALYSIS.md`): per-school
**1–10 ratings** (Summary, Test Scores, College Readiness), state **test-score
proficiency** (EDFacts), **college readiness** (grad rate + AP/IB + SAT/ACT),
**advanced courses**, **low-income & English-learner %**, **teacher certification
/ counselors / security**, full **CRDC safety**, race/gender **demographics**, an
interactive **map** with the district boundary, **public + private** schools
(~119k), a **Fair Housing Compliant** mode, and **community reviews**.

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

That's it — the demo ships with a **real** data bundle in `data/` (committed to the
repo) and needs **no database and no API keys**. Geocoding uses the free **U.S.
Census Geocoder** when the network is available and falls back to the **zip‑code
centroid** otherwise, so it works fully offline.

---

## How it maps to the brief

**Part 1 — Data pipeline (10 zips only).** `pipeline/fetch_real_data.py` pulls
**real, per‑school federal data** for The School District of St. Lucie County
(NCES LEAID `1201770`) and filters to schools in/near the 10 zip codes. Tables
modeled: `schools`, `school_districts`, `school_safety`, `school_graduation`.
Sources (all via the free Urban Institute Education Data Portal, which mirrors the
official collections):

| Data | Source | Year |
|---|---|---|
| Roster, location, enrollment, teacher FTE, grade span | NCES **CCD** directory | 2023‑24 |
| Safety: offenses, suspensions, harassment/bullying, chronic absenteeism | U.S. DOE **CRDC** | 2021‑22 |
| 4‑year adjusted‑cohort graduation rate | **EDFacts** | latest served (2018‑19) |

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
  scoring.ts              3-category quality index (pure, source-agnostic)
  buildResult.ts          assembles LookupResult (shared by both data paths)
  lookup.ts               JSON-bundle lookup (10-zip demo)
  lookupDb.ts             Postgres + PostGIS lookup (nationwide)
  db.ts                   pg connection pool (used when DATABASE_URL is set)
  data.ts / types.ts      loads the data bundle / shared types
data/                     committed JSON bundle (10-zip demo)
pipeline/
  fetch_real_data.py      10-zip demo bundle (stdlib only)
  load_postgres.py        NATIONWIDE ETL -> Postgres + PostGIS
  load_boundaries.py      optional: national district boundary polygons (pyshp)
  build_sql_inserts.py    10-zip SQL for Supabase
sql/                      schema.sql (Postgres+PostGIS) + generated seed_data.sql
Procfile, app.json        Heroku deploy
scripts/screenshot.mjs    optional: render screenshots with headless Chrome
```

## Two ways to run

| Mode | When | Data |
|---|---|---|
| **JSON demo** (default) | `DATABASE_URL` unset | committed 10-zip bundle in `data/` |
| **Nationwide** | `DATABASE_URL` set | Postgres + PostGIS, ~102k US schools |

The app auto-detects: if `DATABASE_URL` is present it serves nationwide from
Postgres (`lib/lookupDb.ts`); otherwise it serves the 10-zip JSON demo
(`lib/lookup.ts`). Both produce the identical Schools-tab UI.

## Regenerate the data bundle (real data)

```bash
python3 pipeline/fetch_real_data.py     # pulls real federal data -> data/*.json (needs network)
python3 pipeline/build_sql_inserts.py   # writes sql/seed_data.sql (for Supabase)
```

`fetch_real_data.py` uses only the Python standard library. The committed `data/`
bundle is the output of this script, so the app runs offline; you only need
network access to re‑pull fresh data.

---

## Nationwide data on Postgres + PostGIS

`pipeline/load_postgres.py` downloads **all ~102k U.S. public schools** with real
per-school federal data and loads them into Postgres + PostGIS:

| Table | Rows (nationwide) | Source |
|---|---|---|
| `schools` | ~100k | NCES CCD directory 2023-24 |
| `school_safety` | ~98k | U.S. DOE CRDC 2021-22 |
| `school_graduation` | ~20k | EDFacts 2018-19 |
| `school_districts` | ~19k | derived from CCD (+ optional boundary polygons) |

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/dbname
pip install -r requirements.txt

python3 pipeline/load_postgres.py            # nationwide full refresh (~5-10 min)
python3 pipeline/load_postgres.py --fips 12  # one state (FL) for a quick test

# optional: real district boundary polygons for exact point-in-polygon
python3 pipeline/load_boundaries.py
```

Without boundary polygons, address→district uses the **nearest school's
district** (a good approximation); with them, it uses true `ST_Contains`
point-in-polygon. Either way nearby-school search uses the PostGIS KNN operator.

Then run the app pointed at the database:

```bash
DATABASE_URL=postgresql://... npm run start
```

### Deploy to Heroku (Postgres + PostGIS)

You normally host on Heroku, so this is wired up:

```bash
heroku create your-app
heroku addons:create heroku-postgresql:essential-1   # ~$9/mo; holds the ~240k rows
heroku buildpacks:add heroku/python                  # for the loader
heroku buildpacks:add heroku/nodejs                  # for the Next.js app
git push heroku HEAD:main

# enable PostGIS + load all data (one-off dyno; DATABASE_URL is injected by Heroku)
heroku pg:psql -c "create extension if not exists postgis;"
heroku run "python3 pipeline/load_postgres.py"
heroku run "python3 pipeline/load_boundaries.py"     # optional boundaries
heroku open
```

Notes:
- `app.json` declares the buildpacks + addon and a `postdeploy` that runs the
  loader automatically for one-click / review-app deploys. If `postdeploy` times
  out on the full nationwide load, just run `heroku run "python3 pipeline/load_postgres.py"`.
- **Heroku Postgres row limits:** `essential-0` caps at 10k rows (too small);
  the nationwide dataset (~240k rows) needs `essential-1` (10M rows) or higher.
- You can also load from your laptop straight into the Heroku DB:
  `DATABASE_URL="$(heroku config:get DATABASE_URL)" python3 pipeline/load_postgres.py`
  (the loader adds `sslmode=require` automatically for managed Postgres).

### Supabase / Vercel (alternative)

For the 10-zip demo you can instead load `sql/schema.sql` + `sql/seed_data.sql`
into Supabase, or deploy the JSON demo to Vercel with no env vars. For nationwide
on Vercel, point `DATABASE_URL` at Supabase/Neon and run `load_postgres.py`
against it.

---

## Data provenance & honesty note

All figures are **real, per‑school federal data** for The School District of St.
Lucie County (NCES LEAID `1201770`), joined on NCES school id — see the sources
table above. Two honest caveats:

- **Why CRDC, not SSOCS:** the **SSOCS** public‑use file is a de‑identified
  national *sample* and cannot be joined to a specific school, so it is **not**
  used. **CRDC** is a universe collection reported per school, so the safety
  numbers are real for each named school.
- **Facility‑security indicators** (security cameras, controlled building access)
  are an SSOCS‑only concept and are **not published per‑school** in federal data.
  The brief listed them, but rather than fabricate values, the Safety card reports
  verified CRDC incident counts (violent incidents, attacks with a weapon,
  firearm/explosive possession, out‑of‑school suspensions, harassment/bullying)
  and notes the omission in the UI.
- **College‑going rate** is likewise not in federal per‑school public data; the
  Academic card shows real **chronic absenteeism** (CRDC) as the third metric
  instead of a fabricated college‑going rate.

The 3‑category quality scores are a transparent composite computed in
`lib/scoring.ts` from these real inputs.
