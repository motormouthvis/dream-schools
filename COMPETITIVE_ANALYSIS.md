# Dream Neighborhood Schools vs. GreatSchools.org — Competitive Analysis

_Last updated: this build._

GreatSchools.org is the dominant US school-ratings site. Below is what they
surface on a school profile, whether we now match it, and the data source.

## Rating system

| GreatSchools | Dream Neighborhood (this build) | Source |
|---|---|---|
| **Summary Rating (1–10)** | ✅ 1–10 summary rating per school | Composite of test scores + college readiness (HS) + climate |
| **Test Scores rating** | ✅ Test-score rating + % proficient (math/reading) | EDFacts assessments |
| **Student/Academic Progress** | ⚠️ Partial — growth needs multi-year state data | EDFacts (year-over-year) — roadmap |
| **College Readiness rating** (HS) | ✅ Grad rate + AP/IB participation + SAT/ACT participation | EDFacts + CRDC |
| **Equity rating** (subgroup gaps) | ⚠️ Partial — low-income % + discipline shown; full subgroup test gaps = roadmap | CRDC/EDFacts subgroups |

## School profile sections

| GreatSchools section | Us | Source |
|---|---|---|
| Test scores (math/reading/science % proficient) | ✅ | EDFacts assessments |
| College readiness (grad rate, AP/IB, SAT/ACT) | ✅ | EDFacts + CRDC |
| Advanced courses (AP, IB, gifted/talented) | ✅ | CRDC |
| Students — race/ethnicity & gender | ✅ | NCES CCD / PSS |
| Students — low-income (%) | ✅ free/reduced lunch | NCES CCD |
| Students — English learners (%) | ✅ | CRDC |
| Teachers & staff (ratio, certified %, counselors, security) | ✅ | NCES CCD + CRDC |
| Discipline & safety (incidents, suspensions, bullying) | ✅ | CRDC |
| Attendance / chronic absenteeism | ✅ | CRDC |
| Contact, grades, type, enrollment | ✅ | NCES CCD / PSS |
| Nearby schools + map + district boundary | ✅ (we have an interactive map; GS has a list) | PostGIS + OSM |
| Private schools | ✅ (NCES PSS) | NCES PSS |
| **Parent / student reviews** | ✅ capability (submit + display); starts empty | Our own UGC |
| Homes for sale near school | ❌ (out of scope; GS partners with Zillow) | — |
| "Quality" / neighborhood data | ➕ our differentiator (Dream Neighborhood) | — |

## Where we already beat GreatSchools

- **Address-first, map-first** experience with the **school-district boundary** drawn and public+private pins — GreatSchools is school-first.
- **Public + private in one nationwide search** (~119k schools).
- **Fair Housing Compliant mode** — a real-estate-specific view that hides
  protected-class data to prevent steering. GreatSchools has no such mode; this
  is a key differentiator for the real-estate audience.
- **Transparent, open federal data** with sources cited on every figure.

## Honest gaps remaining (roadmap)

1. **Academic growth / student progress** — needs multiple years of state test
   data per school; the federal feed (EDFacts via Urban) currently tops out at
   2019–20 for assessments. Best fixed with **state-by-state** report-card feeds.
2. **Full equity rating** — subgroup-by-subgroup test gaps (e.g., low-income vs
   not). Data exists (EDFacts/CRDC subgroups) but is a larger pull; partial today.
3. **Freshest test scores** — GreatSchools licenses current-year state data
   (2022–23/2023–24). Federal public data lags. To match, ingest **state DOE
   report cards** per state (FL, CA, TX, …) — the big "state-by-state" effort.
4. **Reviews volume** — our review system exists but starts with no content;
   GreatSchools has years of accumulated reviews.
5. **Homes-for-sale** integration — intentionally out of scope.

## Recommended next investments

1. **State-by-state report-card ingestion** for current-year test scores +
   growth (start with high-population states). This closes the biggest data gap.
2. **Full equity rating** from federal subgroup data (no new source needed).
3. **Seed/curate reviews** and promote submissions.
