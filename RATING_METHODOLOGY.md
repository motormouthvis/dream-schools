# Dream Neighborhood — School Rating Methodology (LIVING DOCUMENT)

> **Status:** working draft for discussion. This file is the single source of
> truth for how ratings are computed. Update it whenever the formulas change.
> Code lives in `lib/ratings.ts` (1–10 "Dream Rating") and `lib/scoring.ts`
> (0–100 quick/area scores).

## Principles (proposed)

1. **Outcomes over inputs.** A rating should reflect *student outcomes* (test
   proficiency, graduation, growth), not just inputs like class size.
2. **No data → no rating.** If we don't have outcome data, we should say
   "Limited data," not infer a high score from defaults.
3. **Transparent + reproducible.** Every number traces to a federal source
   (see `DATA_SOURCES.md`); the formula is published here.
4. **Comparable.** Same scale and method across schools where data exists.

---

## Two rating systems exist today (this is part of the problem)

### A) "Dream Rating" — 1–10, shown in the school **detail** (`lib/ratings.ts`)
GreatSchools-style. **Returns `null` ("Limited data") when outcome data is absent.**

- **Test-score rating (1–10):** `round(avg(reading%, math%) / 10)`, floored to 1.
  `null` if no EDFacts assessment data.
- **College-readiness rating (1–10, high schools):** weighted average of
  graduation rate (50%), AP/IB participation ×2 capped at 100 (25%), SAT/ACT
  participation (25%), then `/10`. `null` if none present.
- **Summary rating (1–10):**
  - test + college present → `0.6·test + 0.4·college`
  - test only → `0.7·test + 0.3·safety10`
  - college only → `0.6·college + 0.4·safety10`
  - **neither → `null`** (shown as "Limited data")
  - where `safety10 = clamp(round(safetyScore0to100 / 10), 1, 10)`

### B) Quick / Area score — 0–100, shown on the **list chips** and the area index (`lib/scoring.ts`)
This is the colored number + word label ("Excellent", etc.) on each school card.

- **Academic sub-score (0–100):**
  - `ratioScore = clamp(95 − (studentTeacherRatio − 12)·4, 45, 98)`; if ratio
    missing → `78`.
  - if graduation present → `0.5·ratioScore + 0.5·gradRate`; **else → `ratioScore` alone.**
- **Safety sub-score (0–100):** starts at 100, subtracts per-1,000-student rates
  of CRDC incidents (violent ×4, weapon attacks ×10, firearm/explosive ×15,
  rape/sexual battery ×10, robbery ×6, suspensions ×0.08, bullying ×0.8), −4 if
  any firearm incident; clamped 45–99. **If no CRDC data → defaults to `80`.**
- **Scale & stability sub-score (0–100):** size band (mid-size best) + ratio
  stability around 16:1.
- **Overall quick score = `0.45·academic + 0.35·safety + 0.20·scale`.**
- **Label thresholds:** ≥85 Excellent · ≥75 Very good · ≥65 Good · ≥55 Fair · else Needs attention.

---

## Data availability: public vs private

| Input | Public (CCD/CRDC/EDFacts) | Private (PSS) |
|---|---|---|
| Test scores (reading/math) | ✅ (where reported) | ❌ not collected |
| Graduation rate | ✅ (high schools) | ❌ not collected |
| Safety/discipline (CRDC) | ✅ | ❌ not collected |
| Student-teacher ratio | ✅ | ✅ (from PSS NUMTEACH) |
| Enrollment, demographics, coed | ✅ | ✅ |

**Consequence:** private schools have **no outcome data** (test, graduation,
safety). They only have inputs (ratio, size, demographics).

---

## ⚠️ The bug you found: private school rated "Excellent" with almost no data

A private school with only a student-teacher ratio gets a **high 0–100 quick
score** because system **(B)** fills the gaps with favorable defaults:

Worked example — small religious school, ratio ≈ 13:1, ~300 students, no test/grad/safety:
- academic = ratioScore = `95 − (13−12)·4 = 91` (no graduation to temper it)
- safety = **80** (default, because no CRDC data — *absence treated as "good"*)
- scale ≈ 82
- **overall = 0.45·91 + 0.35·80 + 0.20·82 ≈ 85 → "Excellent"**

Meanwhile system **(A)** correctly returns **`null` → "Limited data"** for the
same school in the detail view.

**So the list says "85 / Excellent" while the detail says "Limited data" — an
inconsistency, and the list number is not justified by the data.**

Root causes:
1. **Missing safety defaults to 80** (treats "unknown" as "good").
2. **Academic = class-size alone** when there's no graduation/test data — an
   *input* masquerades as an *outcome*.
3. **Two parallel scoring systems** (0–100 list vs 1–10 detail) that disagree.

---

## Options for discussion (no code changed yet)

**Option 1 — Single source of truth (recommended).**
Make the list chip use the same **1–10 Dream Rating** as the detail. Schools with
no outcome data show a neutral **"NR / Limited data"** chip (gray), never a green
"Excellent." Pros: consistent, honest. Cons: many private (and some charter)
schools show "NR".

**Option 2 — Keep 0–100 but fix the defaults.**
- Don't default missing safety to 80; treat unknown as unknown (exclude from the
  weighted average and renormalize).
- Don't let student-teacher ratio alone yield a high academic score — cap the
  academic sub-score when no test/graduation data exists (e.g., ratio-only
  academic capped at ~60, labeled "insufficient data").
- Never show the word "Excellent" without at least one outcome metric.

**Option 3 — Separate "Data coverage" indicator.**
Show the rating **and** a small "based on N of 4 measures" coverage badge, so a
score from one input is visibly low-confidence.

**Recommendation:** Option 1 for the headline rating + Option 3's coverage badge.
Private schools would show their real data (ratio, size, demographics, religious
affiliation, coed) with an explicit "Not rated — outcome data not collected for
private schools" note, rather than a misleading green score.

---

## Change log
- **Option 3 adopted:** the detail view now shows a **data-coverage indicator**
  ("Based on N of M outcome measures") with filled/empty dots and an **ⓘ popover**
  explaining exactly which measures (test scores, college readiness, safety) are
  included or missing. Schools with 0 measures show "Limited data." Implemented in
  `lib/ratings.ts` (`coverage`) + `components/SchoolDetailModal.tsx`. Option 1
  (unifying the list 0–100 chip with the 1–10 rating) remains open — see `TODO.md`.
- _(draft)_ Documented current dual system and the private-school "Excellent"
  inconsistency; proposed options.
