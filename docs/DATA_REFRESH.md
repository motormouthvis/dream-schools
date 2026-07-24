# Data refresh & upgrade guide

How the school data is sourced, **how often to refresh it, and exactly what to
run**. All figures are public U.S. federal data (see `DATA_SOURCES.md`); nothing is
licensed or fabricated. Data lives in Postgres + PostGIS and is loaded by the
scripts in `pipeline/`.

> TL;DR cadence: **public schools + graduation + equity → once a year** (new NCES/
> EDFacts vintages), **CRDC safety → every ~2 years**, **private (PSS) → every ~2
> years**, **district boundaries → once a year**. Everything is a re-run of a
> pipeline script pointed at `DATABASE_URL`.

---

## 1. What each source is, and how fresh it can be

| Data | Table(s) | Publisher | Publisher cadence | Our current vintage | Refresh when |
|---|---|---|---|---|---|
| Public school directory, enrollment, staffing, demographics, low-income, urbanicity (NCES CCD) | `schools` | NCES (via Urban Institute API) | Annual (~1 school year behind) | 2023–24 | Yearly, when the next CCD year appears |
| State test proficiency + graduation (EDFacts) | `schools.test_*`, `school_graduation` | U.S. DOE EDFacts (via Urban) | Annual, but **lags 2–3 yrs** | assessments 2019–20 / grad 2018–19 | Yearly, take the newest served year |
| **Equity: economically-disadvantaged grad rate** | `school_graduation.grad_rate_disadvantaged` | EDFacts grad subgroup (via Urban) | Same as graduation | grad 2018–19 | With each graduation refresh |
| Safety, discipline, AP/IB, SAT/ACT, absenteeism, staff (CRDC) | `schools.*`, `school_safety` | U.S. DOE CRDC (via Urban) | **Biennial** | 2021–22 | Every ~2 years, when a new collection releases |
| Private schools (NCES PSS) | `schools` (level='private') | NCES PSS (direct CSV) | **Biennial** | 2021–22 | Every ~2 years |
| School-district boundaries | `school_districts` | U.S. Census (direct shapefile) | Annual | 2023 | Yearly |
| Geocoding, autocomplete, map tiles | (runtime APIs, not loaded) | Census / Geoapify / Photon / OSM | Live | Live | n/a |

**Why we lag GreatSchools on test scores:** the federal public feed (EDFacts) tops
out ~2019–20 for assessments and ~2018–19 for graduation. To get **current-year**
scores and **academic growth**, we'd ingest per-state DOE report cards — see
"Roadmap" below. Everything else (CCD, CRDC, boundaries) is reasonably current.

---

## 2. The pipeline scripts

All read `DATABASE_URL` (Heroku Postgres or local). Run either locally with the env
var set, or on Heroku with `heroku run … -a dream-schools`. Install deps once:
`pip install -r pipeline/requirements.txt`.

| Script | Loads | Destructive? | Typical command |
|---|---|---|---|
| `load_postgres.py` | public schools + safety + graduation (incl. equity subgroup) + districts | **YES** — drops & recreates `schools, school_safety, school_graduation, school_districts` | `python3 pipeline/load_postgres.py` |
| `load_private_pss.py` | private schools (appends into `schools`) | Adds/updates private rows | `python3 pipeline/load_private_pss.py` |
| `load_boundaries.py` | district boundary polygons | Updates `school_districts` geometry | `python3 pipeline/load_boundaries.py` |
| `load_equity.py` | **only** `school_graduation.grad_rate_disadvantaged` | **No** — `ALTER … IF NOT EXISTS` + `UPDATE` that one column | `python3 pipeline/load_equity.py` |
| `gather_equity.py` | nothing (writes a local CSV for inspection) | No (no DB) | `python3 pipeline/gather_equity.py --fips 12` |

**Year selection** (defaults live at the top of `load_postgres.py`):
`CCD_YEAR_DEFAULT=2023`, `CRDC_YEAR_DEFAULT=2021`, `GRAD_YEAR_DEFAULT=2019`. Override
per run:
```
python3 pipeline/load_postgres.py --year-ccd 2024 --year-crdc 2023 --year-grad 2020
```
`load_equity.py` takes `--year` (graduation year) and both take `--fips <N>` to limit
to one state for a fast test (e.g. `--fips 12` = Florida).

> **Important — `load_postgres.py` is destructive.** It `DROP … CASCADE`s and
> rebuilds the core tables from the API. Run it during low traffic; it re-derives
> everything from scratch. Because it rebuilds `school_graduation`, it **includes**
> the equity subgroup, so after a full reload you do **not** need `load_equity.py`.
> `load_equity.py` exists to backfill/refresh equity on an **existing** DB without a
> full destructive reload (how the column was first populated).

---

## 3. Step-by-step: the yearly refresh (public schools + test/grad + equity)

1. **Find the newest vintages served.** Bump `--year-ccd` / `--year-grad` to the
   latest year the Urban API returns (assessments/grad lag; take the newest
   non-null). Leave CRDC unless a new biennial collection dropped.
2. **Dry-run on one state:** `python3 pipeline/load_postgres.py --fips 12 --year-ccd <Y> --year-grad <Y>`
   against a **non-prod** DB (or accept that `--fips` still rebuilds the tables —
   prefer a staging DB for the dry run).
3. **Full nationwide load** against prod (low-traffic window):
   `DATABASE_URL=… python3 pipeline/load_postgres.py --year-ccd <Y> --year-grad <Y>`
4. **Verify** (see §6).

## 4. Step-by-step: CRDC (every ~2 years) and private PSS (every ~2 years)

- **CRDC:** a new collection means new safety/AP/SAT/absenteeism. It's folded into
  `load_postgres.py` via `--year-crdc <Y>` — so a CRDC refresh is just the yearly
  full load with the new CRDC year.
- **Private (PSS):** when NCES publishes a new PSS file, update the download URL/
  vintage in `load_private_pss.py`, then run it after the public load (it appends
  private rows into `schools`).

## 5. Step-by-step: equity-only refresh (no full reload)

Use this to (re)populate just the disadvantaged graduation column — e.g., after a
new grad year, without a destructive rebuild:
```
DATABASE_URL=… python3 pipeline/load_equity.py --fips 12   # test one state first
DATABASE_URL=… python3 pipeline/load_equity.py             # nationwide
```
It runs `ALTER TABLE school_graduation ADD COLUMN IF NOT EXISTS grad_rate_disadvantaged`
then `UPDATE`s only that column, and prints how many rows are populated.

To eyeball the raw equity distribution before/without loading, use the read-only
gatherer: `python3 pipeline/gather_equity.py --fips 12` → writes
`pipeline/out/equity_grad_gap_fips12.csv` + summary stats (no DB writes).

---

## 6. Verifying a refresh

- Row counts printed by the loader (schools / safety / graduation / districts).
- Spot-check a known school via the app API:
  `GET https://www.dreamneighborhoodschools.com/api/school?ncesId=<id>` — confirm
  test scores, graduation, and (for a high school) `graduation.gradRateDisadvantaged`.
- Direct SQL sanity checks, e.g.:
  ```sql
  select count(*) from schools;                              -- ~119k (public+private)
  select count(*) from school_graduation
    where grad_rate_disadvantaged is not null;               -- HS with equity data
  ```
- Load the UI: a high-school detail should show the **Equity** callout; the
  "Data sources" menu vintages should reflect the new years.

---

## 7. Operational notes / risks

- **Destructive reload:** `load_postgres.py` drops and rebuilds core tables. There's
  a brief window where the site has partial/empty school data mid-load. Prefer a
  low-traffic window; consider loading into a staging DB and promoting if you want
  zero interruption.
- **Connection budget:** the loaders use a single connection; safe alongside the web
  app on the current Postgres plan (see `docs/SCALING.md`).
- **API etiquette:** the Urban Institute API is free and paginated; the scripts retry
  with backoff. Nationwide pulls take several minutes.
- **`postdeploy`** in `app.json` (`load_postgres.py`) runs only for Heroku
  Button / Review Apps / CI — **not** on a normal `git push heroku`. Routine data
  refreshes are run manually with the commands above, so loaded data persists across
  code deploys.

---

## 8. Roadmap — closing the freshness/growth gap ("Fresh & Fair Ratings")

Federal data can't give us current-year scores or academic growth. The next data
upgrade is **per-state DOE report-card ingestion** (Track A): current-year
proficiency + growth + (for voucher/scholarship states) some private-school
outcomes. It's free but per-state engineering with annual upkeep; phase by student
coverage (start FL/CA/TX). The **Equity** indicator shipped here (HS low-income
graduation gap) is the first, free step; state report cards would extend equity and
freshness to elementary/middle. Track it in `TODO.md`.
