# Smoke testing — Dream Neighborhood Schools

How to re-run production smoke tests before/after releases, plus what the
remaining **manual** checks mean and how to do them.

Related: detailed phase checklist in `docs/SMOKE_TEST_PLAN.md`. Automated
runners: `scripts/smoke-e2e.mjs`, `scripts/smoke-widgets-browser.mjs`.

---

## Quick start (automated — do this first)

### Prerequisites

1. Heroku CLI logged in (or `HEROKU_API_KEY` set).
2. `SMOKE_TEST_SECRET` on the `dream-schools` app (do **not** commit it):

```bash
heroku config:get SMOKE_TEST_SECRET -a dream-schools
```

3. Dummy sites still up (same hosts authorized on the smoke realtor accounts):

| Role | URL |
|------|-----|
| Independent | https://dream-schools-smoke-ind-43304e4a96aa.herokuapp.com/ |
| Partner realtor 1 | https://dream-schools-smoke-p1-b208bf11e83e.herokuapp.com/ |
| Partner realtor 2 | https://dream-schools-smoke-p2-da2515146e4c.herokuapp.com/ |

### Passwordless smoke admin

```text
https://app.dreamneighborhoodschools.com/test?key=<SMOKE_TEST_SECRET>
```

Lands you on the dashboard as `smoke-admin@dreamneighborhoodschools.com` (owner).
No password. Only works when `SMOKE_TEST_SECRET` is set on the dyno.

### Run the automated suites

```bash
export SMOKE_TEST_SECRET="$(heroku config:get SMOKE_TEST_SECRET -a dream-schools)"
export SMOKE_SITE_IND='https://dream-schools-smoke-ind-43304e4a96aa.herokuapp.com'
export SMOKE_SITE_P1='https://dream-schools-smoke-p1-b208bf11e83e.herokuapp.com'
export SMOKE_SITE_P2='https://dream-schools-smoke-p2-da2515146e4c.herokuapp.com'

# API / account / email-send / lifecycle (~1 min)
node scripts/smoke-e2e.mjs

# Browser popup + embed on the 3 sites (~2 min; needs Chrome + playwright-core)
node scripts/smoke-widgets-browser.mjs
```

**Pass =** e2e prints `failed=0` and widgets prints `failed=0`.  
Reports (gitignored): `scripts/smoke-report.json`, `scripts/smoke-widgets-report.json`.

### Smoke accounts (reused)

| Role | Email |
|------|-------|
| Admin | `smoke-admin@dreamneighborhoodschools.com` |
| Partner | `smoke-partner@dreamneighborhoodschools.com` |
| Realtor under partner #1 | `smoke-realtor-p1@dreamneighborhoodschools.com` |
| Realtor under partner #2 | `smoke-realtor-p2@dreamneighborhoodschools.com` |
| Independent realtor | `smoke-realtor-ind@dreamneighborhoodschools.com` |

Non-admin password (script default): `SmokeTest!2026` (provision API resets it).  
Password login on prod needs Turnstile — use `/test` or the smoke `login-as` API for automation.

---

## The four remaining **manual** checks (explained)

These are the items automation cannot fully prove. Do them before a big-customer
go-live (and again after major auth/email/UI changes).

### 1. Confirm a reminder/offer hits a **real inbox**

**What this means**  
The automated smoke calls Mailgun and gets `sent: true`. That only proves Mailgun
**accepted** the message. It does **not** prove:

- SPF/DKIM/DMARC are correct for your sending domain  
- The message lands in **Inbox** (not spam)  
- Links in the email work for a human

Smoke recipients are `smoke-*@dreamneighborhoodschools.com`. Unless that domain
has mailboxes (or forwards), you will never see those messages. You need a
mailbox you actually open.

**How to do it**

1. Sign in as smoke admin: `/test?key=…`
2. Open **Upgrade Requests** (or Customer List → send email).
3. Pick a **real** realtor/partner email you control (e.g. your work inbox), **or**
   temporarily change a smoke realtor’s email to your inbox:
   - Login as that realtor (smoke `login-as` / account page), or as admin edit
     the customer email to something like `you+dns-smoke@yourdomain.com`
4. Send a **Reminder** and a **Special Offer** (include a test code, e.g. `SMOKE20`).
5. Check the inbox (and spam) within a few minutes.
6. Open the email → click the upgrade CTA → confirm the landing URL is correct.
7. Optional: in Mailgun dashboard → Logs, confirm delivery (not just accepted).

**Pass**  
Both emails arrive, look correct, links work, not stuck in spam for your domain.

**If it fails**  
Check `MAILGUN_SENDER_DOMAIN`, `EMAIL_FROM`, DNS (SPF/DKIM), and Mailgun logs
before blaming the app.

---

### 2. Browser Turnstile signup/login spot-check

**What this means**  
Production has Cloudflare Turnstile enforced (`TURNSTILE_ENFORCE=1`). Automated
smoke **bypasses** that via `/api/auth/smoke`. Real customers must complete the
widget. You need to prove a human can still sign up and log in in a normal browser.

**How to do it**

1. Open an **incognito** window → `https://app.dreamneighborhoodschools.com/login`
2. **Signup** with a throwaway email you control (not a `smoke-*` address):
   - Password ≥ 8 characters  
   - Complete the Turnstile checkbox/challenge  
   - Optional: pick **Smoke Test Partner Group** from the partner dropdown  
3. Check email → click verify link → land in onboarding/dashboard.
4. Log out → **log in** again with email/password + Turnstile.
5. Spot-check **Forgot password**: request reset → open link → set new password → login.

**Pass**  
Signup, verify, login, and reset all work with Turnstile; no infinite “Verification failed.”

**If it fails**  
Confirm `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` and that the
domain is allowed in the Cloudflare Turnstile site settings.

---

### 3. `/parents` deep link + Fair Housing hamburger gate

**What this means (two related product checks)**

**A. `/parents` deep link**  
Marketing and school detail can send someone to a parents-only explorer, e.g.:

```text
https://www.dreamneighborhoodschools.com/parents?address=<ADDRESS>&school=<NCES_ID>
```

That should open the explorer scoped to the address **and** open that school’s
detail (not a blank search). Realtor/partner marketing sections should be hidden
on `/parents`.

**B. Fair Housing / demographics hamburger**  
On the public explorer, the top-right **hamburger (settings)** controls how
demographic data is shown:

- Today: **Data display** → `Full` vs `Fair Housing` (Fair Housing hides race/gender
  to reduce steering risk).  
- Backlog (TODO): rename to **Demographics**, default to Limited, and require an
  **“I agree”** + cookie timestamp before Full data.

Until the backlog ships, smoke what exists: toggle Fair Housing and confirm
sensitive demographics hide on school detail.

**How to do it**

1. On www, search any address (or open `/parents`).
2. Open a school → **More on this school** → “Dream Neighborhood Schools” (or
   build a URL with `address` + `school=<ncesId>`).
3. Confirm `/parents?…` loads schools for that address and the school modal/detail
   for that id; logo stays parents-scoped; no realtor/partner sales sections.
4. Open the **hamburger** → **Data display**:
   - Switch to **Fair Housing** → open a school → race/gender demographics hidden.  
   - Switch to **Full** → those demographics visible again (where data exists).
5. When the Fair Housing “I agree” gate ships, also verify: Limited default, Full
   blocked until agree, cookie persists across refresh, clearing cookie re-prompts.

**Pass**  
Deep link opens the right school; Fair Housing mode actually hides protected-class
demographics; (later) agree-gate works.

**Status (Jul 14, 2026):** Verified on production for
`/parents?address=1500 N 23RD ST, FORT PIERCE, FL, 34950&school=120177001932`
(Lincoln Park Academy): deep link opens detail, Fair Housing hides race UI + uses
`/api/school?fh=1`, Full restores demographics. **I-agree gate still TODO.**

---

### 4. Week-1 `/server` watch + short customer runbook

**What this means**

**A. Week-1 Server Management watch**  
For the first week after a customer goes live, you (owner) should glance at
**Server Management** daily so problems show up before the customer complains:

```text
https://app.dreamneighborhoodschools.com/server
```

(Requires owner / smoke admin.)

Look for:

- Search / autocomplete volume (is anyone using it?)  
- Top areas / visitors  
- **Geoapify fallback** / backend events (sustained errors → email alerts)  
- Generate a **daily report** once so you have a snapshot  

Escalate if fallback alerts fire, 5xx spikes, or autocomplete quality drops.

**B. Short customer runbook**  
A one-pager (email or Notion is fine) you hand the customer so they are not stuck.
Minimum contents:

1. App login URL: `https://app.dreamneighborhoodschools.com/login`  
2. How to authorize their domain (Configure Explorer)  
3. Install snippets (popup + embed) — from `/installation` or `/installation/partners`  
4. Where to see usage / upgrade requests  
5. Who to contact (you) if embed shows disabled or domains conflict  
6. Partners only: how revenue share / realtor invites work  

**How to do it (ops checklist)**

Day 0 (go-live): send runbook; open `/server` once after first traffic.  
Days 1–7: open `/server` once/day; note anything odd.  
After week 1: drop to as-needed unless alerts fire.

**Pass**  
You have a runbook ready to send, and you know `/server` is the health pane for
week 1.

---

## Manual browser spot-check (widgets + admin)

Do this occasionally even when automation is green:

1. Open each dummy site home → click green popup bubble → schools load.  
2. Open `/embed.html` on each → inline explorer loads.  
3. Open 2–3 listing pages in different cities → address scrape feels right.  
4. As smoke admin: **Customer List** shows rising views; **Upgrade Requests** works.  
5. As partner: customer list is **only** the two partner realtors.

---

## After a deploy (recommended order)

1. Automated: `smoke-e2e.mjs` then `smoke-widgets-browser.mjs`  
2. Manual #2 if auth/Turnstile changed  
3. Manual #1 if email templates / Mailgun / sending domain changed  
4. Manual #3 if explorer / parents / settings menu changed  
5. Manual #4 always before a customer launch (runbook + know `/server`)

---

## Security notes

- Keep `SMOKE_TEST_SECRET` private; rotate if leaked.  
- `/test` and `/api/auth/smoke` only work when the secret is set.  
- Smoke provision/login-as is limited to `smoke-*@dreamneighborhoodschools.com`.  
- Do not use smoke accounts as real customer accounts.
