# Dream Neighborhood — School Explorer: External Data Sources

Every figure in the product comes from **public, authoritative U.S. government
data**. This document lists each external source, how we access it, and exactly
where it is used. Nothing is fabricated; ratings are transparently computed from
these inputs (see "Derived ratings" at the end).

Pipelines that load this data live in `pipeline/`:
`load_postgres.py` (public schools), `load_private_pss.py` (private schools),
`load_boundaries.py` (district boundaries). Data is stored in Postgres + PostGIS.

---

## 1. NCES Common Core of Data (CCD) — public schools
- **What:** The universe of US public schools (directory, enrollment, staffing).
- **Vintage:** 2023–24 school year.
- **How accessed:** Urban Institute Education Data API (mirrors official NCES),
  no key required:
  - `GET /schools/ccd/directory/2023/`
  - `GET /schools/ccd/enrollment/2023/grade-99/race/`
  - `GET /schools/ccd/enrollment/2023/grade-99/sex/`
  - Base: `https://educationdata.urban.org/api/v1`
- **Used for:** school name, location (lat/lon), street/city/state/zip, **phone**,
  type, grade span, enrollment, teacher FTE → **student-teacher ratio**,
  charter/magnet/Title I/virtual flags, free/reduced-price **lunch %
  (low-income)**, **urbanicity/setting**, and **race & gender demographics**.

## 2. U.S. Dept. of Education — Civil Rights Data Collection (CRDC)
- **What:** Per-school safety, discipline, course, and staffing data.
- **Vintage:** 2021–22 collection (latest released).
- **How accessed:** Urban Institute Education Data API:
  - `/schools/crdc/offenses/2021/` — violent incidents, attacks, robbery, etc.
  - `/schools/crdc/discipline-instances/2021/` (disability=99) — suspensions
  - `/schools/crdc/harassment-or-bullying/2021/allegations/` — bullying
  - `/schools/crdc/chronic-absenteeism/2021/race/sex/` (totals) — absenteeism
  - `/schools/crdc/ap-ib-enrollment/2021/race/sex/` (totals) — AP/IB/gifted
  - `/schools/crdc/sat-act-participation/2021/race/sex/` (totals) — SAT/ACT
  - `/schools/crdc/teachers-staff/2021/` — certified teachers, counselors, security
  - `/schools/crdc/enrollment/2021/lep/sex/` (lep=1) — English-learner count
- **Used for:** the **Safety & discipline** section (incidents, suspensions,
  bullying, per-100-students rates), **chronic absenteeism**, **advanced
  courses** (AP/IB/gifted), **college readiness** (AP/IB + SAT/ACT participation),
  **teachers & staff** (certified %, counselors, security), and **English-learner %**.

## 3. U.S. Dept. of Education — EDFacts
- **What:** State assessment results and graduation rates.
- **Vintage:** Graduation 2018–19; assessments 2017–18 and 2019–20 (latest served;
  we use the most recent non-null per school).
- **How accessed:** Urban Institute Education Data API:
  - `/schools/edfacts/grad-rates/2019/` (totals)
  - `/schools/edfacts/assessments/2018/grade-99/` and `/2020/grade-99/`
- **Used for:** **4-year graduation rate** and **state test-score proficiency**
  (% proficient in reading/ELA and math) → the **Test Scores** rating.

## 4. NCES Private School Survey (PSS) — private schools
- **What:** The universe of US private schools that responded to the survey.
- **Vintage:** 2021–22 public-use file (22,345 schools).
- **How accessed:** **Direct file download** (no key):
  `https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip`
- **Used for (private schools):** name, address, **phone**, lat/lon, grade span,
  enrollment, `NUMTEACH` → **student-teacher ratio**, religious affiliation
  (`RELIG`), **coed status** (`P335`), **race & gender**, urbanicity.
- **Not available for private schools:** state test scores, graduation rates, and
  CRDC safety — those federal collections cover public schools only.

## 5. U.S. Census Bureau — school-district boundaries
- **What:** Cartographic boundary polygons for unified/elementary/secondary
  school districts.
- **Vintage:** 2023.
- **How accessed:** Direct file download:
  `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_unsd_500k.zip`
  (and `..._elsd_...`, `..._scsd_...`).
- **Used for:** **"which district is this address in?"** (PostGIS point-in-polygon)
  and the **district boundary drawn on the map**.

## 6. U.S. Census Bureau — Geocoder
- **What:** Authoritative US address → coordinates.
- **How accessed:** `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress`
  (no key).
- **Used for:** turning the address you type into a map point (primary geocoder),
  and as a source for address **autocomplete** suggestions.

## 7. Photon (OpenStreetMap) — autocomplete + geocode fallback
- **What:** Free OSM-based geocoder/typeahead.
- **How accessed:** `https://photon.komoot.io/api/` (no key).
- **Used for:** address **autocomplete** suggestions and a **fallback** geocoder
  when the Census geocoder has no match.

## 8. OpenStreetMap — map tiles
- **What:** Base map imagery.
- **How accessed:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (no key).
- **Used for:** the **map view** background.

---

## Derived (computed) — not external
The **Dream Rating** and component ratings (Overall, Test Scores, College
Readiness) are **computed by us** from the sources above (see `lib/ratings.ts`),
on a 1–10 scale. The area "quality index" (Academic / Safety / Scale) is computed
in `lib/scoring.ts`. These are transparent formulas over the federal inputs — not
a third-party rating.

## Access summary
| Source | Method | Key needed | Cost |
|---|---|---|---|
| NCES CCD, CRDC, EDFacts | Urban Institute Education Data API (JSON) | No | Free |
| NCES PSS (private) | Direct CSV download | No | Free |
| Census district boundaries | Direct shapefile download | No | Free |
| Census Geocoder | HTTP API | No | Free |
| Photon | HTTP API | No | Free |
| OpenStreetMap tiles | Tile server | No | Free |

All sources are public domain or open data. Refresh cadence: CCD annual; CRDC and
PSS biennial; EDFacts annual; Census boundaries annual.
