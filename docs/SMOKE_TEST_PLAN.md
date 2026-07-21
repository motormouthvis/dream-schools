# Production smoke test plan — Dream Neighborhood Schools

**Operator runbook (how to re-run + manual checks):** see root [`smoketest.md`](../smoketest.md).

Goal: prove the product is ready for a first big customer at **low volume**.
Roles exercised: **smoke admin**, **partner** (with 2 realtor customers), **independent realtor**.

## Fixtures

| Role | Email | Site |
|------|-------|------|
| Smoke admin (no password) | `smoke-admin@dreamneighborhoodschools.com` | `/test` on app host |
| Partner | `smoke-partner@dreamneighborhoodschools.com` | (admin only; manages realtors) |
| Partner realtor 1 | `smoke-realtor-p1@dreamneighborhoodschools.com` | Harbor View Homes smoke site |
| Partner realtor 2 | `smoke-realtor-p2@dreamneighborhoodschools.com` | Summit Street Realty smoke site |
| Independent realtor | `smoke-realtor-ind@dreamneighborhoodschools.com` | Lone Star Independent Realty smoke site |

Password for non-admin smoke accounts (script default): see `scripts/smoke-e2e.mjs`.
Admin: passwordless via `https://app.dreamneighborhoodschools.com/test?key=$SMOKE_TEST_SECRET`.

Each realtor site includes:
- Home + listings index with **popup** one-liner (`embed.js`)
- `/embed.html` with **inline embed**
- 12 USA listing pages (NY, DC, Chicago, CA, CO, TX, NC, LA, MA, OR, FL, Austin)
- A **Neighborhood Explorer simulator** on every page, inert unless the URL has
  `?ne` (see Phase G). It mirrors the real NE contract:
  `window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true` + a one-time
  `dn:neighborhood-explorer-ready` event.

## Phase A — Enable harness

1. Set `SMOKE_TEST_SECRET` on `dream-schools` (and preview if used).
2. Deploy branch with `/test` + `/api/auth/smoke`.
3. Open `/test?key=…` → lands on dashboard as smoke admin (`isOwner`).

## Phase B — Account setup

1. As admin: provision partner (`company_name` set so signup dropdown works).
2. Provision two partner realtors linked to partner id + independent realtor.
3. Login as each realtor; set `businessName`; authorize unique smoke-site hostname.
4. Confirm `GET /api/embed/config?host=<site>&surface=popup` → `enabled: true`.

## Phase C — Widget / USA address matrix

For **each of the 3 realtor sites**:

1. Hit home (popup config) and `embed.html` (embed config) ≥3 times each (bypass cache with cache-bust or wait >60s between some hits).
2. Open ≥8 distinct listing pages; call scrape/lookup for the page address; open explorer iframe URL with that address.
3. Confirm `/api/app/summary` (as that realtor) shows `popupDetected` and `embedDetected`.
4. Confirm Customer List (`/api/owner/customers`) shows rising `views` for each realtor.

Addresses covered (listing pages): NYC, DC, Chicago, Cupertino, Denver, Houston, Charlotte, LA, Boston, Portland, Fort Pierce, Austin.

## Phase D — Admin / partner features

1. As partner: list customers → only their two realtors.
2. As admin: list all smoke customers; open Server Management; generate a daily report snapshot if available.
3. Trigger an upgrade request for each realtor (API or widget path).
4. Send **reminder** email (`kind: reminder`) to each realtor.
5. Send **special offer** email (`kind: offer`) with code `SMOKE20`.
6. Self-service reminder from a realtor account (`POST /api/app/reminder` with `send: true`).

## Phase G — Neighborhood Explorer coexistence (popup only)

Uses the `?ne` simulator on any smoke listing page. The **popup** should hide
when NE signals ready; the **inline embed** must never be suppressed by NE.

1. **No NE (baseline):** open a listing page normally. The School **popup**
   bubble should appear promptly (~after geocode, no artificial delay).
2. **NE ready (typical):** open the same listing with `?ne=1200`. The popup must
   **not** appear (it hides when the ready signal fires ~1.2s in).
3. **NE ready before we mount (`?ne=0`):** popup never shows (flag already set).
4. **NE ready AFTER the grace period:** set the admin grace low for the test
   (Account Settings → "School popup ↔ Neighborhood Explorer", e.g. 2000ms) and
   open with `?ne=4000`. The popup may flash in at ~2s, then hide when NE signals
   at ~4s.
5. **NE never comes:** open with a `dreamneighborhood.com` script present but no
   ready signal — popup shows after the grace period. (The `?ne` simulator always
   fires; to test "never", just confirm case 1 — no NE at all shows immediately.)
6. **Inline coexistence:** open `/embed.html?ne=1200`. The inline School Explorer
   must still mount and render; only the floating popup defers to NE.

Automated version: `node scripts/smoke-ne-coexistence.mjs` (Playwright) loads the
new `embed.js` against the live smoke sites with and without `?ne` and asserts
popup visibility. See the script header for env vars.

## Phase E — Account lifecycle

On the **independent** realtor (then restore):

1. Change password → login with new password.
2. Change email to another `smoke-*@…` address → login as new email.
3. Change authorized domain → old host disabled, new host enabled.
4. Self-delete account → cannot login; embed config disabled.
5. Admin restore → login works; embed re-enabled when domain present.
6. Admin disable → restore again.

Repeat a shorter disable/restore on one **partner realtor**.

## Phase F — Cleanup / leave ready

1. Leave smoke accounts **enabled** with domains pointing at the 3 dummy sites (so future QA can reuse).
2. Document site URLs + secret location in this file / Heroku config (do not commit the secret).
3. Record pass/fail in the run report (`scripts/smoke-report.json`).

## Pass criteria

- `/test` passwordless admin works
- Partner + 2 realtors + independent all configured
- Popup + embed detected for all 3 sites
- Views increment after multi-page traffic
- Reminder + offer send APIs return success
- Delete / restore / email / password / domain changes behave correctly
- No blocker bugs for first-customer go-live

## Out of scope (scale later)

Redis, paid Geoapify, server-side upgrade-request pagination.
Scale posture (pool tuning, batched usage writes, CDN-ready cache headers, dyno
and Postgres upgrade steps) is documented in [`docs/SCALING.md`](./SCALING.md).

## Live smoke site URLs (Heroku)

> **Cost note:** the three smoke-site dynos are scaled to **0** when not in use to
> save ~$21/mo (they serve QA only, never customers). Bring one back before a run:
>
> ```bash
> heroku ps:scale web=1 -a dream-schools-smoke-ind   # and -p1 / -p2
> ```
> Scale back to 0 when finished. (If the account subscribes to Eco dynos, prefer
> `heroku ps:type web=eco` so they sleep/wake automatically instead.)


| Site | URL | Hostname to authorize |
|------|-----|------------------------|
| Independent realtor | https://dream-schools-smoke-ind-43304e4a96aa.herokuapp.com/ | `dream-schools-smoke-ind-43304e4a96aa.herokuapp.com` |
| Partner realtor 1 | https://dream-schools-smoke-p1-b208bf11e83e.herokuapp.com/ | `dream-schools-smoke-p1-b208bf11e83e.herokuapp.com` |
| Partner realtor 2 | https://dream-schools-smoke-p2-da2515146e4c.herokuapp.com/ | `dream-schools-smoke-p2-da2515146e4c.herokuapp.com` |

Smoke admin: `https://app.dreamneighborhoodschools.com/test?key=$SMOKE_TEST_SECRET`  
(`SMOKE_TEST_SECRET` is set on the `dream-schools` Heroku app — do not commit it.)
