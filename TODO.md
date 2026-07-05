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

## Monetization / plan awareness
- [ ] **Integrate with the dreamneighborhood.com Stripe account** to check whether a
      Realtor already has an active (paid) Neighborhood Explorer subscription there.
      Use it to tailor upgrade prompts/emails (skip or soften the pitch for
      customers who already pay).
- [ ] **"Your Current Plan" badge** on the Home page School Explorer block (e.g.
      "Free — School Explorer" vs "Neighborhood Explorer — Active"), driven by the
      Stripe lookup above.

## Embed / popup
- [ ] **Minimalist embed + popup variant** that shows only school rating, distance,
      and address, then links out to `www.dreamneighborhoodschools.com/<school>` for
      full details (lightweight option for space-constrained listing pages).
- [ ] **Per-page usage analytics:** capture each unique page URL where the embed or
      popup is detected/used, so the customer sees not just total views but how many
      distinct listing/neighborhood pages each type appears on (breakdown by embed vs
      popup).

## Emails
- [ ] **Bulk email from the Upgrade Requests page:** let a partner email all their
      realtors at once, and let an admin email all realtors or all partners at once
      (reminder or special offer), instead of only a single selected recipient.
- [ ] **Auto-apply Stripe offer code from the email:** in the Special Offer email,
      make the Upgrade button carry the offer code so clicking it pre-fills /
      auto-applies the code at `app.dreamneighborhood.com/accounts/signup/`
      (e.g. `?offer=CODE` / Stripe promotion code), so the realtor doesn't type it.
- [ ] **Install reminder in reminder emails:** if a Realtor hasn't installed the
      embed/popup on their site yet (no detected usage / no authorized domain),
      include a friendly "finish setup — add it to your website" section with
      install instructions instead of usage stats.

## UI polish
- [ ] Remove the red text styling on the school detail page when a school is
      "Not rated" — it reads as an error/alert when it's just missing data.

## Tech / ops
- [ ] **Decide on editable email templates.** The Email Templates admin UI was
      removed (we now use fixed, code-driven reminder/offer emails). The backend
      (`EmailTemplateManager`, `app_upgrade_email_templates`, template APIs) is
      still in the code. Review whether to reinstate the UI or delete the code.
- [ ] Optional: Mapbox token for best-in-class address autocomplete (env-gated).
