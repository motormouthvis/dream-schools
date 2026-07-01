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
| `data-suppress-if-neighborhood-explorer` | popup | (legacy) hide the popup when the (paid) Dream Neighborhood Explorer is on the page — now automatic |
| `data-show-external-links` | both | show a "more on this school" row (Niche & GreatSchools) on the school detail. Off by default on the embed; always on for the main site |

### Automatic popup suppression

The floating School popup **never appears** when either of these is detected on the
page, regardless of config:

- a **School Explorer embedded snippet** (an inline container such as
  `#dream-schools-explorer`), or
- the **paid Dream Neighborhood Explorer** — its floating popup or an embedded
  snippet (detected via a `dreamneighborhood.com` script/iframe/link, a known
  container selector, or a global such as `__DN_EXPLORER_API_BASE__`).

Detection re-runs shortly after load to catch a partner widget whose script
loads after ours. The `data-*` flags above remain for backward compatibility but
are no longer required.
| `data-min-height` | inline | iframe min-height in px |
| `data-max-width` | inline | max width in px (default 840; e.g. `600` narrower or `1100` wider) |
| `data-show-header` | inline | show the explorer header bar |
| `data-address` | inline | explicit address; bypasses scraping |
| `data-lat` / `data-lng` | inline | explicit coordinates; bypasses geocoding |
| `data-api-base` | both | override the API origin (defaults to the script's origin) |

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
