# Dream Neighborhood — School Explorer · TODO

A living backlog. Check items off as they ship; add new ones at the bottom.

## Ship to first big customer (production readiness) — TOP PRIORITY

Assumption: **low volume at start**; keep current Heroku size and **upgrade dynos/DB
as traffic grows**. Do not block first customer on Standard dynos or HA Postgres.

### Must do before go-live with the customer
- [ ] **End-to-end customer funnel smoke test** (on production hosts):
      signup → partner dropdown → configure authorized domain → install embed/popup
      on a test page → search schools → upgrade prompt → reminder email →
      `/parents?address=…&school=…` deep link opens the right school.
- [ ] **Onboard the partner record correctly:** set `company_name` (so they appear in
      signup partner search), create admin/realtor accounts as needed, authorize their
      real domain(s), and walk them through `/installation` or `/installation/partners`.
- [ ] **Email deliverability:** confirm Mailgun SPF/DKIM/DMARC for the sending domain;
      send a real reminder + special-offer to a customer mailbox and verify inbox
      (not spam). Confirm `OWNER_EMAILS` receives Server Management alerts.
- [ ] **Auth / bot protection on app host:** Turnstile works on
      `app.dreamneighborhoodschools.com`; `ADMIN_ENFORCE_HOST` / `APP_URL` match the
      live app subdomain; login/signup/password-reset all work.
- [ ] **Legal / compliance for first ship:** Terms + Privacy linked and accurate;
      Fair Housing posture clear for demographics (see hamburger menu task below —
      at least Limited default before Full data goes live with this customer).
- [ ] **Owner watchlist for week 1:** use **Server Management** (`/server`) daily —
      searches, top areas, Geoapify fallback events, saved daily reports. Escalate if
      fallback alerts fire or autocomplete quality drops.
- [ ] **Customer runbook (short doc or email):** how to install, authorize domains,
      where usage/upgrade requests appear, who to contact, and how revenue share works
      for partners.

### Nice-to-have before / during first customer (not blockers if volume stays low)
- [ ] **Uptime + error visibility:** simple uptime check (e.g. UptimeRobot) on
      `www` + `app` + one public API; optional Sentry for uncaught errors.
- [ ] **Heroku alerts:** dyno memory / 5xx / response-time thresholds so outages
      email you without waiting for the customer.
- [ ] **Public API rate limits (light):** soft limits on `/api/autocomplete`,
      `/api/lookup`, `/api/school` to blunt scrapers (auth routes already limited).
- [ ] **Lookup/school result caching:** autocomplete already has in-memory TTL cache;
      extend similar caching to geocode lookup + hot school payloads if Server
      Management shows repeated hits.
- [ ] **Hamburger Fair Housing gate** (marketing site) — see Marketing launch below.
      Prefer shipping this with the first customer rather than deferring.

### Scale when volume grows (upgrade path — do NOT require for first ship)
Current prod baseline: **1× Basic web dyno**, Postgres **essential-1** (~158 MB used,
healthy indexes), Geoapify **free tier** primary + Census/Photon fallback, in-memory
autocomplete cache, Server Management metrics/alerts.

- [ ] **Upgrade web dynos when needed:** Basic → Standard-1x, then ≥2 dynos for
      redundancy; Performance + autoscaling only if spikes demand it.
- [ ] **Upgrade Postgres when needed:** essential-1 → Standard-0 (HA, more
      connections, PITR) when connection limits, backup needs, or write load hurt;
      add PgBouncer if multi-dyno connection count approaches the plan limit.
- [ ] **Paid Geoapify (or Mapbox) when free 3k/day is hit.** Keep Geoapify as
      primary (Option A). Server Management fallback alerts are the early warning.
      Optional later: add Geoapify to `lib/geocode.ts` lookup path (today Census →
      Photon → zip-centroid).
- [ ] **Shared cache across dynos (Redis)** once you run >1 dyno and want cache
      hit-rate to survive restarts / share across instances.
- [ ] **Server-side pagination for Upgrade Requests** before high-volume partners
      (list is client-side today with a hard LIMIT) — see Priority below.
- [ ] **Scheduled digests / auto daily report snapshot** (Heroku Scheduler) so
      Server Management history builds without manual "generate report."

### Already done (keep checked for context)
- [x] Geoapify primary autocomplete + Census/Photon fallback (Option A).
- [x] In-memory TTL cache on autocomplete; recents reuse lat/lon (skip geocode).
- [x] Sustained Geoapify fallback alerts (real HTTP errors only) → owner email + `/server`.
- [x] Server Management page: today stats, daily/monthly reports, top visitors/areas,
      backend event log, delete reports.
- [x] Public marketing site + `/parents` explorer + partner/realtor install paths.
- [x] App on `app.dreamneighborhoodschools.com`; Mailgun + owner alerts wired.

## Marketing launch
- [ ] **Enhance the marketing-site hamburger (settings) menu.**
  - Remove the default **Map / List** view toggle for schools from the menu.
  - Rename **"Data Display"** to **"Demographics"**.
  - Default to **Limited** demographics. If the user chooses **Full data**, show a
    warning that they must comply with all applicable laws and **Fair Housing**
    requirements (no steering/redlining, etc.).
  - Require an **"I agree"** checkbox to enable Full data; store the choice **plus a
    timestamp** in a cookie, and re-prompt if it's cleared or expired.

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
