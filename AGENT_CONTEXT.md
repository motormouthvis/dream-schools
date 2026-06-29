# Agent Context & Handoff — Dream Neighborhood School Explorer

> Purpose: persistent memory for Cursor cloud agents working on this project.
> If you are a new agent, **read this whole file first**, then continue the
> in‑progress task in the "CURRENT TASK" section.

## Repositories
- **This repo:** `motormouthvis/dream-schools` (Next.js app). Active branches:
  `cursor/dream-neighborhood-schools-tab-86c9` (PR #1 → `main`, the app) and
  `cursor/embeddable-school-explorer-7000` (PR #2, stacked on the former, adds
  the embeddable widget). See the EMBEDDABLE WIDGET section for the branch map.
- **Reference repo (READ‑ONLY — never modify):** `motormouthvis/dreamneighborhood`
  — the existing "Dream Neighborhood Explorer" embeddable widget (Django). Used
  only as a behaviour/design reference. **It has already been read** and the
  relevant patterns (SDK, scraping, config schema, resolve/popup‑config
  handlers) were mirrored fresh into this repo — see the EMBEDDABLE WIDGET
  section below. You usually do **not** need to read it again.
  - **Access gotcha (important):** Cursor mints each cloud‑agent's GitHub token
    scoped to ONLY the repo the run was launched from (`dream-schools`), even
    when the GitHub App is set to "All repositories". So private repos like
    `dreamneighborhood` return **404** no matter how many fresh runs you start —
    `repository_selection` on the token is `selected`, not `all`. Public repos
    (`dream-neighborhood-admin`, `dream-neighborhood-realty`) read fine because
    they're public. To read `dreamneighborhood` again either (a) the owner makes
    it temporarily public, or (b) add a fine‑grained read‑only PAT as a Cursor
    secret and clone with it. It was read on 2026‑06‑29 by making it public
    briefly; a full clone is no longer needed for the widget work.

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
- Deploy: push the branch to Heroku's `main`:
  `git push https://heroku:$HEROKU_API_KEY@git.heroku.com/dream-schools.git <branch>:main`
  (or `HEROKU_API_KEY=<key> git push heroku <branch>:main`). **`HEROKU_API_KEY`
  is now stored as a Cursor cloud‑agent secret** (Environment Variable, scoped
  to `dream-schools`), so it is present in the env of every NEW run — it does
  NOT need to be pasted in chat. A run that started before the secret was added
  won't have it; start a fresh run to deploy.
- `EMBED_ADMIN_PASSWORD` (optional) gates the embeddable‑widget admin
  (`/embed-admin` + `/api/embed/admin`). Set it on Heroku to enable the admin:
  `heroku config:set EMBED_ADMIN_PASSWORD='<secret>' -a dream-schools`. The
  widget itself works without it. `DATABASE_URL` is already set by the Postgres
  addon; the `embed_partners` table self‑creates on first use.
- Git workflow: branch `cursor/<name>-<suffix>`, one commit per logical change,
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

## EMBEDDABLE WIDGET — STATUS: IMPLEMENTED (PR #2), DEPLOY PENDING

The embeddable "School Rating Explorer" is **built, builds clean, and was
smoke‑tested** (endpoints + a headless‑Chrome popup/inline run against a mock
partner page). It is **not yet deployed/merged**. Full usage docs: **`EMBED.md`**.

### Branches / PRs (read this before deploying or merging)
- `main` — production default; Heroku deploys from here. Currently old/empty
  relative to the work below.
- `cursor/dream-neighborhood-schools-tab-86c9` — PR #1 → `main`. The full
  schools app (~54 commits ahead of main). Not merged yet.
- `cursor/embeddable-school-explorer-7000` — PR #2 → base `…-86c9`. **Stacked on
  top of PR #1**, so it contains EVERYTHING (whole app + this embed feature).
  This is the complete, latest branch and the one to deploy.
- Recommended cleanup (do AFTER deploy is verified live): retarget PR #2's base
  from `…-86c9` to `main` and merge it (brings in all 58 commits at once), then
  close PR #1 as already‑included. That collapses the stack back to a single
  line on `main`.

### What was built (all in `dream-schools`, fresh — nothing copied from the ref)
- **One‑line SDK:** `public/embed.js` — self‑contained IIFE (no build step).
  Auto‑detects an inline container (`#dream-schools-explorer` /
  `.dream-schools-explorer` / `[data-dream-schools-explorer]`) vs the floating
  popup; resolves per‑host config; merges `data-*` overrides; scrapes the page
  address; opens the `/embed` iframe; re‑resolves on SPA navigation; iOS‑safe
  close handshake (`dse:close` / `dse:close-ack`).
- **Chrome‑less explorer:** `app/embed/page.tsx` (`/embed`) — reuses `SchoolsTab`
  + the normal lookup/rating UI, scoped to a scraped address; accent theming;
  manual‑entry fallback. Params: `address`, `lat`, `lng`, `accent`,
  `mode=popup|inline`, `header=1`.
- **APIs:** `app/api/embed/config` (GET per‑host config + default address, CORS),
  `app/api/embed/scrape` (POST page_url/page_title/page_address → geocoded
  {address,lat,lon}, CORS), `app/api/embed/admin` (password‑protected CRUD).
- **Admin UI:** `app/embed-admin/page.tsx` (`/embed-admin`) — password‑gated
  partner config editor.
- **Libs:** `lib/embedConfig.ts` (Postgres `embed_partners` store + permissive
  default for unregistered hosts + presentation payload), `lib/addressExtract.ts`
  (server‑side URL/title/slug/neighborhood parsing, ported from the ref
  `utils.py`), `lib/embedCors.ts`, `lib/embedAuth.ts`.
- **Embeddability:** `next.config.js` sets `frame-ancestors *` on `/embed` and
  `*` CORS on `/embed.js`.
- **`data-*` knobs** (mirror the ref names): `data-partner-id`,
  `data-widget-number`, `data-accent-color`, `data-position`,
  `data-bottom-offset`, `data-tooltip-message`, `data-require-address`,
  `data-search-page-content`, `data-suppress-on-inline`, `data-min-height`,
  `data-show-header`, `data-address`, `data-lat`/`data-lng`, `data-api-base`.
- **Scraping order:** title → JSON‑LD/`og:`/microdata → (optional) visible text
  → footer → URL slug → neighbourhood → configured default → manual entry.

### One‑line embed snippets (once live)
- Popup: `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`
- Inline: add `<div id="dream-schools-explorer"></div>` before that script tag.

### TO DEPLOY (next step — needs a FRESH run with the HEROKU_API_KEY secret)
1. `git fetch origin && git checkout cursor/embeddable-school-explorer-7000`
2. `heroku config:set EMBED_ADMIN_PASSWORD='<strong-secret>' -a dream-schools`
3. `git push https://heroku:$HEROKU_API_KEY@git.heroku.com/dream-schools.git cursor/embeddable-school-explorer-7000:main`
4. Verify: `/embed.js` (200 + CORS), `/embed` (200 + `frame-ancestors *`),
   `/api/embed/config?host=test.com` (`enabled:true`). Report the admin password.

---

## ORIGINAL TASK SPEC — Embeddable "School Rating Explorer" widget (reference)
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
