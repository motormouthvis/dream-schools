// ---------------------------------------------------------------------------
// The customer number shared with Dream Neighborhood — e.g. `DN-100042`.
//
// DN mints it, at account creation and at CSV import, because DN will soon be
// the only place customers are created. We store a copy, display it, search it,
// and send it on every row we push. We never mint one: if a customer here has
// no number, the answer is to create them in DN, not to invent one — two
// minters is two sequences and eventually two customers wearing one number.
//
// Deliberately NOT DN's `embed_key`, which is public and appears in every
// snippet, so it cannot be what support asks a caller to confirm.
//
// Pure — no database, no environment. The Customer List search box imports it
// too, so the browser and the server agree on what counts as a match.
// ---------------------------------------------------------------------------

/** Anything a person might type or paste, reduced to `DN100042`. */
export function normalizeCustomerNumber(raw: string | null | undefined): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * The canonical stored/displayed form, `DN-100042`. Accepts `dn100042`,
 * `DN 100042`, `dn-100042` and returns them all as one thing. Anything that
 * isn't recognisably a DN number comes back empty rather than half-parsed —
 * storing a mangled number is worse than storing none.
 */
export function formatCustomerNumber(raw: string | null | undefined): string {
  const n = normalizeCustomerNumber(raw);
  const m = /^DN(\d+)$/.exec(n);
  return m ? `DN-${m[1]}` : "";
}

/** Is this a well-formed customer number? */
export function isCustomerNumber(raw: string | null | undefined): boolean {
  return formatCustomerNumber(raw) !== "";
}

/**
 * Does a customer number match what someone typed into a search box?
 *
 * Matches on the punctuation-stripped form so `DN-100042`, `dn100042` and
 * `dn 100042` all find the same customer, and on the bare digits so typing
 * `100042` works — support reads numbers off a screen, not a spec.
 */
export function customerNumberMatches(
  customerNumber: string | null | undefined,
  query: string
): boolean {
  const stored = normalizeCustomerNumber(customerNumber);
  if (!stored) return false;
  const q = normalizeCustomerNumber(query);
  if (!q) return false;
  if (stored.includes(q)) return true;
  // Bare digits: `100042` should find `DN-100042`, but `1` should not find
  // everything, so require the digits to be a run of at least three.
  return /^\d{3,}$/.test(q) && stored.replace(/^DN/, "").includes(q);
}
