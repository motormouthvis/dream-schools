
## Address detector v3 — adopted

The shared detector replaces our own page reader. Version and digest are pinned
in `public/address-detector/detector.lock.json` and checked by
`scripts/check-address-detector-drift.mjs`.

Two things it gives us that our reader could not. It waits, so platforms that
build the listing after DOMContentLoaded resolve at all. And it says whether the
page is a single listing, which is what lets the explorer distinguish "we could
not read this listing's address" from "we read it". When it cannot read one on a
page that is plainly a listing, the explorer now says *Showing the general area,
not this listing's address*. That is deliberately not the same as the existing
approximate flag, which means we placed this listing but only coarsely.

The swap fixed a live wrong answer of ours. On an IDX Broker results page our
reader took the first of the `coords` records without counting them, so
`search.homesweethomerr.com`'s search results reported "2412 Elk Drive" — one
listing of twenty-five — as the address of the page. DN found this by reading
our description of our own code; verified live before and after.

Three defects of ours surfaced while wiring it up, all of which failed quietly:

- The detector is ESM, imported cross-origin from the realtor's page. The static
  file had no `Access-Control-Allow-Origin`, so the import failed everywhere
  except same-origin tests, and failed *into* our old reader — no error, just the
  old answers. Fixed in `next.config.js`.
- We geocoded the detector's guesses. `found: false` means the text is inferred
  from the title or URL rather than stated by the page; on a listing page that
  resolves to a real place that is not the house.
- `/api/embed/scrape` then guessed again from the URL and slug, so a listing with
  no address became "Nonesuch, KY" and an agency's `/about-us` became "Kangaroo
  Walk-About, Fresno, CA". The SDK now sends `allow_inference: false` whenever
  the detector ran.

Closed in v4: filler words are stripped from the slug and what remains has to
stand up as a place name, so `/about-us` and `/meet-the-team` yield nothing while
somewhere genuinely called The Villages survives. Verified through the whole
stack, not just in the detector.

Still true of neighborhood guesses generally: they are geocoded with no locality
context, so `/neighborhoods/lincoln-park` on an Illinois site resolves to Lincoln
Park, MI. Milder than the Fresno case — it is a real place and the page named it
— but it is the same shape, and the fix would be to geocode the guess near the
account's own area rather than globally.

## The off switch reaches a standalone schools embed

When a realtor switches the Explorer off in DN's dashboard, DN's popup, DN's
neighborhood embed and the schools popup all stop, because each asks DN first. A
standalone schools embed carried on, being our script talking to our server.

It now stops, at no cost: DN's `resolve` response already carries `reason`, we
already fetch it through the config relay on every mount, and we were discarding
it. DN's own SDK reads the same field from the same payload. Measured on
preview: one `/api/embed/dn-config` request per page load before and after, no
request from the visitor's browser to DN at all, embed mounted at a median of
583ms.

The entitlement endpoint is deliberately not used. It would be a second request
per visitor for an answer already in hand, and a second thing to be down.

Narrower than DN's SDK, which treats any non-school product as off. Only an
explicit `no_widget` removes anything here:

| `reason` | Schools embed |
| --- | --- |
| `no_widget` | stops |
| `subscription_required`, `trial_expired` | renders — this is who the free product is for |
| anything unrecognised | renders |
| no answer, timeout, 5xx, unparseable | renders |

Not yet verified against a live switched-off account: DN has no permanently
switched-off fixture, so the end-to-end check stubs DN's payload shape taken
from a live response. A fixture host would close that.
