# Embeddable "School Rating Explorer" widget

A partner adds **one line of code** to their site and gets a configurable
School Rating Explorer — either a **floating popup** (chat-style bubble) or an
**inline embed**. The widget auto-scrapes the listing address from the page and
opens a compact, chrome-less explorer scoped to that address, reusing the same
lookup + Dream Rating UI as the main app.

## One-line embed

Floating popup (bottom-right bubble):

```html
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
```

Inline embed (mounts into a container on the page):

```html
<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
```

## Optional `data-*` overrides

Set on the `<script>` tag (popup) or the container element (inline). Each is
optional and overrides the server-resolved per-host config.

| Attribute | Applies to | Notes |
| --- | --- | --- |
| `data-partner-id` | both | Pin a specific partner config (skips host lookup) |
| `data-widget-number` | both | Choose a non-default widget (default `1`) |
| `data-accent-color` | both | e.g. `#1fa55f` |
| `data-position` | popup | `left` or `right` |
| `data-bottom-offset` | popup | px lifted off the bottom (avoid overlapping a chat widget) |
| `data-tooltip-message` | popup | supports a `{{address}}` token |
| `data-require-address` | popup | hide the bubble when no address resolves |
| `data-search-page-content` | both | opt-in to the heavier visible-text address scan |
| `data-suppress-on-inline` | popup | (legacy) hide the popup when an inline schools embed is also present — now automatic |
| `data-show-external-links` | both | show a "more on this school" row (Niche & GreatSchools) on the school detail. Off by default on the embed; always on for the main site |
| `data-min-height` | inline | iframe min-height in px |
| `data-max-width` | inline | max width in px (default 840; e.g. `600` narrower or `1100` wider) |
| `data-show-header` | inline | show the explorer header bar |
| `data-address` | inline | explicit address; bypasses scraping |
| `data-lat` / `data-lng` | inline | explicit coordinates; bypasses geocoding |
| `data-api-base` | both | override the API origin (defaults to the script's origin) |
| `data-via` | popup | set by whoever loaded us; `dn-explorer` marks a Dream Neighborhood hand-off (see below) |

### Loaded on demand by Dream Neighborhood

Under the shared-popup model a realtor pastes only DN's tag. DN resolves
entitlement per page load and, when the answer is "not entitled", appends
`embed.js` to `<head>` at runtime:

```html
<script src="https://www.dreamneighborhoodschools.com/embed.js" async
        data-via="dn-explorer"
        data-accent-color="#ACEF00"
        data-position="right"
        data-bottom-offset="40"
        data-tooltip-message="See schools near {{address}}"></script>
```

A runtime-injected tag behaves exactly like a parser-inserted one:
`document.currentScript` is set for async classic scripts, so the `data-*`
overrides above are read off it as usual, and `boot()` runs immediately because
`document.readyState` is past `loading`. Loading `embed.js` twice is harmless —
the second execution publishes the hand-off signal and then returns, so a page
never grows a second floating bubble.

`data-via="dn-explorer"` also **skips the Neighborhood Explorer grace period**
described below. The attribute means DN has already evaluated entitlement and
decided its own Explorer will not render, so no ready signal is coming. The
grace period would otherwise fire on every hand-off: DN's bundle sets
`window.__DN_EXPLORER_API_BASE__` and loads from a `dreamneighborhood.com` host,
both of which make `neighborhoodExplorerMaybePresent()` true. If the hand-off
arrives *after* a wait has already begun (a site running the old two-snippet
install), the wait ends there rather than running to the timeout.

The ready listener stays wired regardless: a page can carry both a hand-off and
a separately installed DN popup, and stepping aside is still right.

Covered by `scripts/smoke-dn-handoff.mjs`, which stands up a local origin and a
fake DN sdk.js and needs no deployed environment.

### Automatic popup suppression

The floating School popup steps aside when:

1. **An inline School Explorer** is already on the page (e.g. `#dream-schools-explorer`), or
2. **Neighborhood Explorer actually shows** on the page — not merely because its
   script tag is present.

Neighborhood Explorer (www.dreamneighborhood.com) signals readiness once per page
load when it is entitled and mounted:

```js
window.__DN_NEIGHBORHOOD_EXPLORER_READY__ = true;
window.dispatchEvent(new Event("dn:neighborhood-explorer-ready"));
```

The School popup:

- Checks the flag first (in case NE already signaled),
- Listens for the event (including after the grace period),
- Waits a configurable grace period (default **4000ms**, admin Account Settings)
  before showing if no signal arrives — unless the loading tag carried
  `data-via="dn-explorer"`, in which case there is nothing to wait for.

**Inline School Explorer is not suppressed** by this handshake — partners can keep
an embedded School Explorer on a school page alongside Neighborhood Explorer.

#### Known SPA quirk

The ready flag never flips back to `false`. On single-page-app listing sites, if
Neighborhood Explorer shows on listing A (flag becomes true) and then hides on
listing B without a full page reload (e.g. no address found), the School popup
stays suppressed for the rest of that tab session. A refresh or new tab resets it.
Tracked in `TODO.md` for a possible future “hidden” event on both sides.

## Address scraping (best-effort, in order)

1. `document.title` (comma / single-comma / no-comma address formats)
2. JSON-LD `PostalAddress` → `og:` meta → microdata
3. (optional) visible body text — gated by `data-search-page-content`
4. page footer (HOA / office address on community pages)
5. URL slug (e.g. `/3309-n-indian-river-drive-fort-pierce-fl-34946/`)
6. neighbourhood / city name from the title or URL
7. the partner's configured **default address**
8. manual entry inside the explorer

The client-scraped candidate plus the raw URL/title are POSTed to
`/api/embed/scrape`, which validates + geocodes server-side (with its own
URL/title fallback) and returns `{ address, lat, lon }`.

## Endpoints

- `GET  /embed` — chrome-less explorer (loaded in the iframe). Params:
  `address`, `lat`, `lng`, `accent`, `mode=popup|inline`, `header=1`.
  Sends `Content-Security-Policy: frame-ancestors *` so it can be framed by
  any partner domain.
- `GET  /embed.js` — the one-line SDK (popup + inline). Served with `*` CORS.
- `GET  /api/embed/config?host=&widget_number=` — resolves per-host
  presentation + behaviour + default address. CORS-enabled. Unknown hosts get
  a permissive default so a freshly-pasted snippet still renders.
- `POST /api/embed/scrape` — `{ page_url, page_title, page_address }` →
  `{ success, address, lat, lon }`. CORS-enabled.
- `GET/POST/DELETE /api/embed/admin` — password-protected partner-config CRUD
  (same-origin; requires `EMBED_ADMIN_PASSWORD` + `DATABASE_URL`).

## Admin

Manage per-partner configs at **`/embed-admin`** (password-protected). Set the
shared secret via the `EMBED_ADMIN_PASSWORD` environment variable. Configs are
stored in the Postgres table `embed_partners` (created automatically on first
use). Each partner row holds: allowed hosts, default address, accent color,
popup position / bottom-offset / tooltip, the scraping/visibility options, the
inline min-height / header flag, and an `enabled` switch.

When `DATABASE_URL` is unset (the local JSON demo), config resolution falls back
to a permissive default and the admin endpoints return `503`.
