# Scaling runbook — Dream Neighborhood Schools

How to take the platform from a single small customer to a big customer rolling
the School Explorer out across many sites. Split into **code/config (done in the
app)** and **infra (Heroku/CDN account actions)**.

Every widget page view = one `embed.js` fetch + one `GET /api/embed/config`.
So load scales with **partner sites × pageviews**, concentrated on those two
requests. Everything below targets exactly that path.

---

## 1. What the app already does (shipped)

### Postgres connection pool (`lib/db.ts`)
- Pool size is **env-configurable** via `PG_POOL_MAX` (default **6** per dyno).
- Added `idleTimeoutMillis`, `connectionTimeoutMillis`, and a server-side
  `statement_timeout`/`query_timeout` (`PG_STATEMENT_TIMEOUT_MS`, default 15s) so
  a slow query can't pin a connection under load.
- Idle-client `error` handler so a dropped connection can't crash the dyno.

> **Connection budget:** keep `dynos × PG_POOL_MAX` under the Postgres plan limit
> (essential ≈ **20**, standard-0 ≈ **120**). Example: 2 dynos × 6 = 12 (safe on
> essential-1). Leave headroom for `psql`, migrations, and other attached apps.

### Usage writes are batched (`lib/embedUsage.ts`)
- Previously **one row upsert per view** → hot-row contention on a single
  `embed_usage` row for a busy widget.
- Now views are **coalesced in memory and flushed in one batched upsert**
  (`EMBED_USAGE_FLUSH_MS`, default 10s), collapsing many views of the same widget
  into a single write. Multi-dyno safe (each dyno flushes its own deltas; the
  upsert sums them). Flushes on `SIGTERM`/`SIGINT` (dyno cycling).
- Dashboards fold in not-yet-flushed counts so numbers still look live.

### Caching / CDN-readiness
- `GET /api/embed/config`: `public, max-age=60, s-maxage=60, stale-while-revalidate=120`.
  Cache key is the full URL (host + widget + surface are query params).
- `/embed.js`: `public, max-age=300, s-maxage=600, stale-while-revalidate=86400`.
- Global embed settings + upgrade settings are cached in-process (60s TTL) so the
  hot config endpoint doesn't do an extra DB round-trip per view.

### Config vars (set these on the app)
```bash
heroku config:set PG_POOL_MAX=6 -a dream-schools
# optional tuning:
# heroku config:set EMBED_USAGE_FLUSH_MS=10000 -a dream-schools
# heroku config:set PG_STATEMENT_TIMEOUT_MS=15000 -a dream-schools
```

---

## 2. Heroku dyno scaling (account action)

Basic dynos **cannot run more than one dyno** and don't autoscale. To handle a
big customer, move to Standard (horizontal scale + redundancy) or Performance
(adds autoscaling).

```bash
# Inspect current formation
heroku ps -a dream-schools

# Recommended starting point: 2 × Standard-1x (redundancy + throughput)
heroku ps:type web=standard-1x -a dream-schools
heroku ps:scale web=2 -a dream-schools

# If SSR memory pressure shows up (R14/R15 in `heroku logs`), go to standard-2x:
# heroku ps:type web=standard-2x -a dream-schools

# Autoscaling requires Performance dynos:
# heroku ps:type web=performance-m -a dream-schools
# then enable autoscale in the Heroku Dashboard → Resources.
```

Revert anytime:
```bash
heroku ps:type web=basic -a dream-schools && heroku ps:scale web=1 -a dream-schools
```

> With 2 dynos and `PG_POOL_MAX=6` you use ≤12 connections — safe on the current
> **essential-1** Postgres (20-connection limit). Only migrate Postgres (below)
> once you need more dynos/connections.

---

## 3. Postgres plan upgrade (account action — needs a maintenance window)

The current DB is **essential-1** (20 connections, `~$9/mo`). Essential-tier
plans **cannot be resized in place** — moving to a larger plan (e.g.
`standard-0`, 120 connections) is a **copy + promote** migration with brief
**downtime**, so schedule a maintenance window.

```bash
# 1. Provision the new database
heroku addons:create heroku-postgresql:standard-0 -a dream-schools --wait

# 2. Put the app in maintenance mode and stop writes
heroku maintenance:on -a dream-schools
heroku ps:scale web=0 -a dream-schools

# 3. Copy data from the old DB to the new one (use the new color/URL from step 1)
heroku pg:copy DATABASE_URL HEROKU_POSTGRESQL_<NEWCOLOR>_URL -a dream-schools --confirm dream-schools

# 4. Promote the new database to DATABASE_URL
heroku pg:promote HEROKU_POSTGRESQL_<NEWCOLOR>_URL -a dream-schools

# 5. Bring it back
heroku ps:scale web=2 -a dream-schools
heroku maintenance:off -a dream-schools

# 6. When confident, remove the old DB
# heroku addons:destroy heroku-postgresql:essential-1 -a dream-schools
```

Then raise `PG_POOL_MAX` if you add many dynos (keep `dynos × PG_POOL_MAX < 120`).

---

## 4. CDN (account action — biggest load reducer)

Heroku has no CDN in front by default, so every uncached request hits the dyno.
Fronting `www.dreamneighborhoodschools.com` with a CDN offloads the two hot,
cacheable requests (`/embed.js` and `/api/embed/config`), which already send
CDN-friendly `s-maxage`/`stale-while-revalidate` headers.

Cloudflare (proxied DNS) outline:
1. Add `dreamneighborhoodschools.com` to Cloudflare; point the nameservers there.
2. Proxy (orange-cloud) the `www` record to the Heroku app; keep `app.` DNS-only
   (the app host serves authenticated, non-cacheable traffic).
3. Cache rule: **cache** `/embed.js` and `/api/embed/config*`; **bypass** cache
   for everything else on `www` (and all of `app.`).
4. Respect origin `Cache-Control` (don't override) so `stale-while-revalidate`
   works and the 60s config TTL is honored.
5. Verify `cf-cache-status: HIT` on repeat `/embed.js` and config requests.

No app code change needed — headers are already set.

---

## 5. External dependencies to watch
- **Geocoding** uses the free **U.S. Census** geocoder (no key) with a
  zip-centroid fallback (`lib/geocode.ts`). No hard quota, but it can be slow;
  the 5s abort + fallback keeps the widget responsive. If accuracy/latency
  matters at scale, add a keyed provider (Mapbox/Google) behind an env flag.

---

## 6. Recommended go-live order for the big customer
1. `heroku config:set PG_POOL_MAX=6` (done/verify).
2. Scale dynos to `2 × standard-1x`.
3. Front `www` with a CDN (biggest win).
4. Watch `heroku logs` + `heroku pg:info` during ramp: connection count, R14
   memory, and `embed_usage` write rate.
5. Migrate Postgres to `standard-0` only once connection headroom is needed.
