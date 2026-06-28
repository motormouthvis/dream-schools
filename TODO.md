# Dream Neighborhood — School Explorer · TODO

A living backlog. Check items off as they ship; add new ones at the bottom.

## Data
- [ ] **Find data for private schools to create a more confident rating.** Private
      schools (NCES PSS) have no federal test scores, graduation, or safety data,
      so they currently show "Limited data." Investigate sources to produce a real
      rating: state private-school report cards, accreditation bodies (e.g.,
      Cognia, regional/religious accreditors), Niche/Private School Review style
      datasets, or self-reported outcomes. Goal: ≥1 outcome measure per private
      school so the Dream Rating isn't "Limited data."
- [ ] Refresh freshest state test scores (federal EDFacts lags ~2019-20) via
      state DOE report cards — closes the biggest accuracy gap vs GreatSchools.
- [ ] Add academic **growth** + full **equity** (subgroup) ratings.
- [ ] School **websites** (not in federal data) — add a source.

## Ratings
- [x] Option 3: show data-coverage indicator ("based on N of M measures") + ⓘ info popup.
- [ ] Consider unifying the list-chip 0–100 score with the 1–10 Dream Rating
      (see `RATING_METHODOLOGY.md`, Option 1) so private/charter schools don't
      show an unearned "Excellent."

## Features
- [ ] Custom parent rating weights (user-defined) shown beside the "Dream Rating."
- [ ] "Show all schools in district" view (beyond the nearest 30).
- [ ] Scheduled data auto-updates (Heroku Scheduler).

## Tech / ops
- [ ] Optional: Mapbox token for best-in-class address autocomplete (env-gated).
