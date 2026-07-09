# Dream Neighborhood — School Explorer · TODO

A living backlog. Check items off as they ship; add new ones at the bottom.

## Marketing launch (priority)
- [ ] **Enhance the marketing-site hamburger (settings) menu.**
  - Remove the default **Map / List** view toggle for schools from the menu.
  - Rename **"Data Display"** to **"Demographics"**.
  - Default to **Limited** demographics. If the user chooses **Full data**, show a
    warning that they must comply with all applicable laws and **Fair Housing**
    requirements (no steering/redlining, etc.).
  - Require an **"I agree"** checkbox to enable Full data; store the choice **plus a
    timestamp** in a cookie, and re-prompt if it's cleared or expired.

### Scale readiness before a big push (from the Jul 9, 2026 infra deep-dive)
- [ ] **Wire in a real geocoding/autocomplete provider (P0).** `GEOAPIFY_API_KEY` is
      set on Heroku but is **not referenced anywhere in code** — geocoding
      (`lib/geocode.ts`) and autocomplete (`app/api/autocomplete/route.ts`) rely only
      on the free, keyless **US Census geocoder + Photon/OSM**, which have no SLA and
      will throttle/fail under load. Make Geoapify (or Mapbox) the primary provider
      with Census/Photon as fallback. A marketing push will blow past Geoapify's
      3,000/day free tier, so budget a paid plan.
- [ ] **Add caching (P0).** There is no caching on `/api/autocomplete`, `/api/lookup`,
      or `/api/school`. Add an in-memory LRU (per dyno) — and optionally Redis — for
      autocomplete (short TTL) and geocode/lookup results (longer TTL, keyed by
      normalized address / rounded lat-lon / zip) to cut external API calls and DB load.
- [ ] **Add rate limiting (P1)** on the public endpoints (autocomplete/lookup/school)
      to prevent abuse and external-API exhaustion. (Auth endpoints already limited.)
- [ ] **Scale web dynos (P1).** Currently **1 Basic dyno** — a throughput bottleneck
      and single point of failure with no autoscaling. Move to Standard-1x/2x, run ≥2
      for redundancy, and enable autoscaling (Performance tier) for spikes.
- [ ] **Upgrade Postgres (P1).** Currently `essential-1` (158 MB used of 10 GB, ~20
      connection limit, **no high-availability / fast failover**). Move to Standard-0
      (HA, ~120 connections, metrics, point-in-time recovery) before heavy traffic;
      add PgBouncer if the dyno count pushes connections past the limit (pool is
      max=5/dyno). Data size + indexes are healthy today.
- [ ] **Monitoring:** add error tracking (Sentry), uptime checks, and Heroku metrics
      alerts so launch-day issues surface fast.

## Priority
- [ ] **Server-side pagination for the Upgrade Requests list.** Today the list is
      loaded into the browser with a `LIMIT` (currently 2,000) and sorted/filtered
      client-side; totals/graph come from server-side aggregates. This won't scale
      as request volume grows. Move to true server-side paging: API accepts
      `page`, `pageSize`, `sort`, `dir` (plus existing scope/filter) and returns
      `{ rows, total }`; the client fetches only the current page. Add DB indexes
      on `app_upgrade_requests(requested_at, customer_id)` and provide a separate
      export for "download everything." Do this before onboarding high-volume partners.

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
- [ ] **Homebuyer settings (gear icon) in the popup/embed.** Add a small gear icon
      somewhere in the School Explorer UI that opens a settings panel for the
      individual homebuyer: font size and other display/accessibility options.
      Persist choices in cookies/localStorage so they stick across visits (no
      account needed).
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
