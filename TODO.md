# Dream Neighborhood — School Explorer · TODO

A living backlog, organized into three prioritized sections:

1. **Scaling the product** — what to do as traffic grows, and the signal that tells you it's time.
2. **Bug fixes** — known defects / limitations.
3. **New features** — in priority order.

A "Recently shipped" log is kept at the bottom for reference.

---

# 1) Scaling the product

**Current production baseline (`dream-schools`):**
- Web: **Standard-1x × 2 dynos** (redundancy + throughput).
- Postgres: **essential-1** (20-connection limit, ~1 GB / 10M rows).
- `PG_POOL_MAX=6` per dyno → 2 × 6 = **12 connections** in use (safe under 20).
- Usage writes are **batched**; `/embed.js` + `/api/embed/config` send **CDN-ready** cache headers.
- Full command reference: **`docs/SCALING.md`**.

Each widget pageview = one `embed.js` fetch + one `/api/embed/config` call, so load
scales with **partner sites × pageviews**. Watch that path first.

### The steps, in the order you'll likely need them

- [ ] **CDN in front of `www` (Cloudflare).** Biggest load reducer; no code change
      (headers already set). **Do before the first big customer's full rollout.**
      *How I know it's time:* you're onboarding a customer with many sites, OR
      origin request volume / response times start climbing.
- [ ] **Bigger / more dynos.** Standard-1x ×2 → Standard-2x, then Performance-M
      with autoscaling. *How I know it's time:* `heroku logs` shows **R14/R15**
      (memory) or **H12** (timeout) errors, or p95 response time creeps up under load.
- [ ] **Postgres essential-1 → standard-0** (120 connections, 64 GB, HA). Copy +
      promote migration — **needs a maintenance window** (see `docs/SCALING.md`).
      *How I know it's time:* `heroku pg:info` connection count approaches **~15 of
      20**, storage nears 1 GB / 10M rows, or backups/queries get slow.
- [ ] **PgBouncer / connection pooling** if you add many dynos and
      `dynos × PG_POOL_MAX` would exceed the DB connection limit.
- [ ] **Redis for shared state** once >1 dyno needs a *shared* cache or shared
      rate-limit counters (today each dyno caches independently with a 60s TTL,
      which is fine). *How I know it's time:* you add real rate limiting or a cache
      that must be consistent across dynos.
- [ ] **Server-side pagination for the Upgrade Requests list.** Today it loads up to
      a `LIMIT` (2,000) into the browser and sorts/filters client-side. Move to true
      server-side paging (`page`, `pageSize`, `sort`, `dir` → `{ rows, total }`), add
      indexes on `app_upgrade_requests(requested_at, customer_id)`, and a separate
      "export everything." *How I know it's time:* any single partner's request count
      approaches ~2,000 (before onboarding high-volume partners).
- [ ] **Geocoding headroom.** Currently the free **U.S. Census** geocoder with a
      zip-centroid fallback (no key). *How I know it's time:* geocode latency or
      failure rate rises → add a keyed provider (Mapbox/Geoapify) behind an env flag.
- [ ] **Light rate limits** on public autocomplete/lookup/school endpoints, plus
      lookup/school result caching. *How I know it's time:* abuse or a traffic spike
      shows up in logs.

### Monitoring / go-live hygiene (do around launch)
- [ ] Manual spot-checks in `smoketest.md`: real-inbox email, Turnstile signup/login,
      week-1 `/server` watch.
- [ ] Uptime check on `www` + `app`; optional Sentry; Heroku 5xx/memory alerts.

---

# 2) Bug fixes

- [ ] **"Not rated" school detail shows red text** — reads as an error/alert when
      it's just missing data. Use a neutral style.
- [ ] **Neighborhood Explorer "hidden" event for SPA routes.** NE sets
      `__DN_NEIGHBORHOOD_EXPLORER_READY__` once when it shows and never clears it. On
      single-page-app listing sites, if NE shows on listing A then hides on listing B
      without a full reload (e.g. `requireAddress` with no address), the School popup
      stays suppressed for the rest of the tab session. Needs a coordinated
      `dn:neighborhood-explorer-hidden` event on both NE and Schools. Documented in
      `EMBED.md`. Low urgency — only affects SPA sites that also run NE.

---

# 3) New features (priority order)

1. [ ] **Detect existing paid Neighborhood Explorer subscribers (Stripe).**
   Integrate with the dreamneighborhood.com Stripe account to check whether a
   Realtor already has an active NE subscription, and skip/soften the upgrade pitch
   for customers who already pay.
2. [ ] **"Your Current Plan" badge** on the Home page School Explorer block
   ("Free — School Explorer" vs "Neighborhood Explorer — Active"), driven by the
   Stripe lookup above.
3. [ ] **Bulk email from the Upgrade Requests page.** Let a partner email all their
   realtors at once, and an admin email all realtors or all partners at once
   (reminder or special offer), instead of one recipient at a time.
4. [ ] **Auto-apply Stripe offer code from the email.** Make the Special Offer email's
   Upgrade button carry the offer code (e.g. `?offer=CODE`) so it pre-fills/auto-applies
   at `app.dreamneighborhood.com/accounts/signup/`.
5. [ ] **Install reminder in reminder emails.** If a Realtor hasn't installed the
   embed/popup yet (no detected usage / no authorized domain), include a friendly
   "finish setup — add it to your website" section with install steps instead of stats.
6. [ ] **Homebuyer settings (gear icon) in the popup/embed.** Small gear that opens a
   per-homebuyer panel: font size + display/accessibility options, persisted in
   cookies/localStorage (no account needed).
7. [ ] **Per-page usage analytics.** Capture each unique page URL where the embed/popup
   is used, so customers see how many distinct listing/neighborhood pages each surface
   appears on (breakdown by embed vs popup), not just total views.
8. [ ] **Minimalist embed + popup variant** showing only rating, distance, and address,
   linking out to `www.dreamneighborhoodschools.com/<school>` for full details
   (lightweight option for space-constrained listing pages).
9. [ ] **Private-school ratings data.** Private schools (NCES PSS) lack federal
   scores/graduation/safety, so they show "Limited data." Investigate state private
   report cards, accreditors (Cognia, etc.), or Niche-style datasets to get ≥1 outcome
   measure per private school.
10. [ ] **Refresh freshest state test scores** via state DOE report cards (federal
    EDFacts lags ~2019-20) — closes the biggest accuracy gap vs GreatSchools.
11. [ ] **Academic growth + full equity (subgroup) ratings.**
12. [ ] **School websites source** (not in federal data).
13. [ ] **Custom parent rating weights** (user-defined) shown beside the Dream Rating.
14. [ ] **"Show all schools in district" view** (beyond the nearest 30).
15. [ ] **Scheduled data auto-updates** (Heroku Scheduler).
16. [ ] **Unify list-chip 0–100 score with the 1–10 Dream Rating** (see
    `RATING_METHODOLOGY.md`, Option 1) so private/charter schools don't show an
    unearned "Excellent."
17. [ ] **Marketing hamburger polish:** font-size/accessibility options; Terms &
    Privacy shortcuts.

### UX / terminology
- [ ] **Rename "Customer" → "Realtor" across the app UI.** Today the admin/partner UI
      calls the accounts **"customers"** ("Customer List", "+ Add customer", "customer
      name", "Customer of This Partner"), while the guides and product copy call the same
      people **"realtors."** For partners these are the same person, but the split wording
      can confuse a newcomer. Standardize on **"Realtor"** in user-facing UI (e.g.
      "Realtor List", "+ Add realtor", "realtor name"), keeping internal DB fields/API
      names as-is. Do it as one deliberate pass (nav label, Customer List page, Add/Import
      modals, column headers, guides, help) so nothing reads half-renamed. Keep "customer"
      only where it genuinely means a paying/account relationship if any.

### Tech debt / cleanup (low priority)
- [ ] **Decide on editable email templates.** The Email Templates admin UI was removed
   (we use fixed, code-driven emails), but the backend (`EmailTemplateManager`,
   `app_upgrade_email_templates`, template APIs) still exists. Reinstate the UI or
   delete the code.
- [ ] Optional: Mapbox token for best-in-class address autocomplete (env-gated).

---

# Recently shipped

- [x] **NE ↔ School popup coexistence via ready signal** — `__DN_NEIGHBORHOOD_EXPLORER_READY__`
      / `dn:neighborhood-explorer-ready`, admin-configurable grace period, popup only,
      old suppress toggle + script-tag heuristics removed (`EMBED.md`).
- [x] **Scale-readiness** — env-tunable Postgres pool + timeouts, batched usage writes,
      CDN-ready cache headers, `docs/SCALING.md`. Prod scaled to Standard-1x ×2.
- [x] **Partner Import / Add / Impersonate** — managed passwordless realtor accounts;
      CSV **file upload** or paste; onboarding guide (`PARTNER_ONBOARDING_GUIDE.md`,
      `/partner-guide`).
- [x] **Banner from White Label** (customer WL → partner WL → partner/realtor name).
- [x] **Upgrade prompt** max limits + zero-days repeatable fix; SPA address detection.
- [x] **End-to-end funnel smoke** — `docs/SMOKE_TEST_PLAN.md`, `scripts/smoke-e2e.mjs`
      (52/52), `scripts/smoke-widgets-browser.mjs`, `scripts/smoke-ne-coexistence.mjs`
      (12/12). Self-delete now disables embed.
- [x] **Customer runbook** — `CUSTOMER_RUNBOOK.md`.
- [x] **`/parents` deep link + Fair Housing I-agree gate.**
- [x] **Marketing hamburger → Demographics (Limited/Full)** with Fair Housing gate.
- [x] **Fake brokerage demo site** — `/realestatewebsitedemo`.
- [x] **Geoapify primary autocomplete + Census/Photon fallback; autocomplete TTL cache.**
- [x] **Server Management + sustained fallback alerts.**
- [x] **Ratings data-coverage indicator** ("based on N of M measures") + info popup.
