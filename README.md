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
  scoring.ts              3-category quality index + per-school quick score
  lookup.ts               orchestrates a full lookup -> LookupResult
  data.ts / types.ts      loads the data bundle / shared types
data/                     generated JSON bundle (zipcodes, district, schools, safety, graduation)
pipeline/                 fetch_real_data.py (real data), build_sql_inserts.py
sql/                      schema.sql (Postgres+PostGIS) + generated seed_data.sql
scripts/screenshot.mjs    optional: render screenshots with headless Chrome
```

## Regenerate the data bundle (real data)

```bash
python3 pipeline/fetch_real_data.py     # pulls real federal data -> data/*.json (needs network)
python3 pipeline/build_sql_inserts.py   # writes sql/seed_data.sql (for Supabase)
```

`fetch_real_data.py` uses only the Python standard library. The committed `data/`
bundle is the output of this script, so the app runs offline; you only need
network access to re‑pull fresh data.

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
