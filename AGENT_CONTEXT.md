# Agent Context & Handoff — Dream Neighborhood School Explorer

> Purpose: persistent memory for Cursor cloud agents working on this project.
> If you are a new agent, **read this whole file first**, then continue the
> in‑progress task in the "CURRENT TASK" section.

## Repositories
- **This repo:** `motormouthvis/dream-schools` (Next.js app). Work branch:
  `cursor/dream-neighborhood-schools-tab-86c9` (PR open against `main`).
- **Reference repo (READ‑ONLY — never modify):** `motormouthvis/dreamneighborhood`
  — the existing "Dream Neighborhood Explorer" embeddable widget. Use it only as
  a behavior/design reference. Confirm read access first:
  `gh api repos/motormouthvis/dreamneighborhood --jq .full_name`
  (Access was granted to the Cursor GitHub App installation; a fresh agent run
  should be able to read it. If it 404s, the token still needs to rotate.)

## What this product is
A nationwide school‑search web app. A user enters an address and sees the school
district, nearby schools (list + map), and a per‑school profile with a 1–10
"Dream Rating", test scores, college readiness, safety/discipline, demographics,
teachers, etc. Plus side‑by‑side compare, reviews, and a Fair‑Housing display mode.

## Tech stack & layout
- Next.js (App Router) + TypeScript + Tailwind. Leaflet + OSM tiles for maps.
- Postgres + PostGIS (nationwide data). Data pipeline in `pipeline/` (Python),
  sourced from NCES CCD, U.S. DOE CRDC, EDFacts, NCES PSS, Census geocoder/boundaries.
- Key code:
  - `app/page.tsx` — home/search + autocomplete.
  - `app/api/lookup/route.ts`, `lib/lookupDb.ts`, `lib/buildResult.ts` — address → results.
  - `app/api/school/route.ts`, `lib/school.ts` — per‑school detail.
  - `app/api/autocomplete/route.ts` — address autocomplete (Census + Photon).
  - `lib/ratings.ts` (`academicQuality`, `to10`, `computeRatings`) + `lib/scoring.ts`
    (`listScore`, `areaScores`) — the rating engine.
  - `components/` — `SchoolsTab`, `NearbySchools`, `SchoolDetailModal`, `CompareModal`,
    `MapView`, `ScoreGauge`, `Showcase`, `score.ts`, etc.
  - Living docs: `RATING_METHODOLOGY.md`, `DATA_SOURCES.md`, `COMPETITIVE_ANALYSIS.md`, `TODO.md`.

## Deployment & ops
- Hosted on **Heroku** app `dream-schools`
  (`https://dream-schools-c2ccd302adef.herokuapp.com`), custom domain
  **`https://www.dreamneighborhoodschools.com`** (Basic dyno; auto‑SSL on; the
  root domain forwards to `www` via Squarespace).
- Deploy: `git push origin <branch>` then
  `HEROKU_API_KEY=<key> git push heroku <branch>:main`. The Heroku API key was
  provided by the owner in chat; if not present in env, ask the owner.
- Git workflow: branch `cursor/<name>-86c9`, one commit per logical change,
  `git push -u origin <branch>`, keep/maintain the PR. Don't force‑push/amend.
  Ask before anything destructive or paid.

## Local dev / testing
- Build: `npm run build`. Run with DB:
  `DATABASE_URL="postgresql://dream:dream@localhost:5432/schools" PORT=3000 npm run start`
  (a local Postgres with the loaded dataset exists in the dev environment; run the
  dev server inside tmux). Without `DATABASE_URL` it falls back to a small JSON demo
  bundle (Fort Pierce, FL).
- Visual checks: puppeteer‑core + `/usr/bin/google-chrome-stable` to screenshot
  pages (the agent has used this to verify mobile/desktop UI).
- Test address used a lot: `1500 N 23rd St, Fort Pierce, FL 34950` (St. Lucie County).

## Rating system (important — recently overhauled)
- **One unified rating** shown everywhere as `N/10`: list chips, map pins,
  neighborhood gauge, and the detail. List = `to10(academicQuality)`; detail uses
  the same `academicQuality`.
- Driven by **academic outcomes only**: test proficiency (reading+math) and, for
  high schools, graduation rate (the anchor) refined by AP/IB + SAT/ACT.
- **No outcome data → "NR / Not rated"** everywhere (no fabricated scores). This
  fixed a jail scoring 94 and empty private schools scoring 88.
- Safety is shown separately (per‑100 with state/US benchmarks), never folded into
  the headline rating. GreatSchools likewise does **not** rate private schools;
  ours shows "Limited data" for them by design. See `RATING_METHODOLOGY.md`.

## CURRENT TASK — Embeddable "School Rating Explorer" widget
Build a **standalone embeddable widget** served from this app
(`dreamneighborhoodschools.com`) so a partner adds **one line of code** and gets a
configurable floating popup (chat‑style) + inline embed that shows a compact
School Rating Explorer, auto‑scraping the listing address from the page.

Owner decisions (final):
- **Standalone** (lives in this repo), served from `dreamneighborhoodschools.com`.
- **Compact UI**, sized like the DN realty widget.
- **Both** a floating popup **and** an inline embed mode.
- **Per‑allowed‑URL config** resolved server‑side by host: popup **position**,
  **accent color**, **options**, the partner's **allowed URLs**, and a
  **default address per customer URL** (fallback when scraping finds nothing).
  Propose a small password‑protected **admin endpoint** to manage this config.
- **Best‑effort address scraping** on any embedding page, in order:
  URL slug → JSON‑LD `PostalAddress` → `og:`/meta tags → common DOM selectors →
  visible page text → config default → manual entry fallback.
- Popup opens a **chrome‑less `?embed=1` explorer** (iframe) scoped to the resolved
  address, reusing the existing lookup/rating UI.
- Make the site **iframe‑embeddable on allowed partner domains** (`frame-ancestors`/CSP)
  and add **CORS** for the config endpoint.

### Reference: the existing DN Explorer widget (mirror its look/behavior)
- One‑line embed on partner sites:
  `<script src="https://app.dreamneighborhood.com/explorer/sdk.js" async></script>`
- From the (minified) public `sdk.js`:
  - Sets `window.__DN_EXPLORER_API_BASE__`.
  - Reads `data-*` config off the script tag: `data-partner-id`, plus
    `accentColor`, `position` (left/right), `bottomOffset`, `tooltipMessage`,
    `requireAddress`, `suppressOnInline`, `searchPageContent`, `inlineMinHeight`,
    `inlineShowHeader`.
  - Backend endpoints: `GET /explorer/popup-config/?partner=…&widget_number=…`
    and `GET /explorer/resolve/?host=…&widget_number=…` (host → partner/config).
  - Floating button → popup; supports inline mode; scrapes page content for an address.
- **First step for the new agent:** read the un‑minified source in
  `motormouthvis/dreamneighborhood` (popup/widget source, address‑scraping module,
  config schema + the `resolve`/`popup-config` handlers) and mirror the compact UI,
  field names, and scraping heuristics. Treat it as read‑only reference; implement
  fresh here. Do NOT copy/modify the reference repo.

### Suggested v1 plan (confirm with owner before large/destructive changes)
- `public/embed.js` (or an API route) — the one‑line SDK: floating button or inline
  mount, config via `data-*` overrides merged with server config.
- `GET /api/embed/config?host=…` — resolves per‑domain config (position, accent,
  options, allowed hosts, default address). Add CORS.
- Chrome‑less explorer mode at `/?embed=1&address=…` reusing existing UI.
- Admin: minimal password‑protected endpoint/page to CRUD partner URL configs
  (store in Postgres).
- Set `Content-Security-Policy: frame-ancestors` to allow embedding on allowed hosts.

## Conventions / cautions
- Don't change the reference repo. Ask the owner before destructive or paid actions.
- Keep the unified `N/10` rating scale and "NR/Limited data" honesty.
- Private‑school data is intentionally limited; messaging already states this on the
  home page and on private‑school cards/profiles.
