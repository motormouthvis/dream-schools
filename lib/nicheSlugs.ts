import { getPool, hasDatabase } from "@/lib/db";

// ---------------------------------------------------------------------------
// Niche per-school link resolution.
//
// Niche has no public API or per-school ID, and their bot protection (PerimeterX)
// blocks server-side verification. Instead we ingest Niche's own sitemap (a
// legitimate, robots-allowed list of every valid /k12/ URL) from a residential
// machine via tools/niche_sitemap_import.py, store the slug set here, and use it
// to decide: link the school's specific Niche profile, or fall back to Niche home.
//
// Behaviour:
//   • table empty (no import yet) → best-effort SPECIFIC link (the constructed
//     slug usually resolves; matches our prior behaviour so nothing regresses).
//   • table populated + slug present → SPECIFIC link.
//   • table populated + slug absent → fall back to Niche K-12 HOME.
// ---------------------------------------------------------------------------

const NICHE_HOME = "https://www.niche.com/k12/";

/** Build Niche's URL slug for a school: `{name}-{city}-{state}`, lowercased,
 *  apostrophes/periods dropped, `&` → `and`, runs of other chars → single `-`. */
export function nicheSlug(name: string, city: string, state: string): string {
  return `${name} ${city} ${state}`
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nicheUrlForSlug(slug: string): string {
  return `https://www.niche.com/k12/${slug}/`;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS niche_valid_slugs (
           slug        TEXT PRIMARY KEY,
           updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

// Cache whether the table has any rows (decides best-effort vs strict mode), so
// the per-detail lookup doesn't run an extra COUNT every time.
let populatedCache: { value: boolean; at: number } | null = null;
const POPULATED_TTL_MS = 5 * 60 * 1000;

async function isPopulated(): Promise<boolean> {
  const now = Date.now();
  if (populatedCache && now - populatedCache.at < POPULATED_TTL_MS) {
    return populatedCache.value;
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM niche_valid_slugs LIMIT 1) AS present`
  );
  const value = Boolean(rows[0]?.present);
  populatedCache = { value, at: now };
  return value;
}

export async function countNicheSlugs(): Promise<number> {
  if (!hasDatabase()) return 0;
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM niche_valid_slugs`);
  return Number(rows[0]?.n ?? 0);
}

async function isValidSlug(slug: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM niche_valid_slugs WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return rows.length > 0;
}

/** Replace or merge the validated slug set. Returns the total row count after. */
export async function importNicheSlugs(
  slugs: string[],
  replace = false
): Promise<{ inserted: number; total: number }> {
  await ensureTable();
  const pool = getPool();
  const clean = Array.from(
    new Set(
      (slugs || [])
        .map((s) => String(s || "").trim().toLowerCase())
        .filter((s) => /^[a-z0-9-]+$/.test(s) && s.length > 1)
    )
  );
  if (replace) {
    await pool.query(`TRUNCATE niche_valid_slugs`);
  }
  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const batch = clean.slice(i, i + CHUNK);
    const values = batch.map((_, j) => `($${j + 1})`).join(",");
    const res = await pool.query(
      `INSERT INTO niche_valid_slugs (slug) VALUES ${values}
       ON CONFLICT (slug) DO NOTHING`,
      batch
    );
    inserted += res.rowCount ?? 0;
  }
  populatedCache = null; // force refresh
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM niche_valid_slugs`);
  return { inserted, total: Number(rows[0]?.n ?? 0) };
}

/**
 * Resolve the Niche link for a school. Returns null when we lack a city/state to
 * build a slug. Otherwise a specific profile link (verified or best-effort) or a
 * fallback to Niche home.
 */
export async function resolveNicheLink(
  name: string,
  city: string | null | undefined,
  state: string | null | undefined
): Promise<{ url: string; specific: boolean } | null> {
  if (!name || !city || !state) return null;
  const slug = nicheSlug(name, city, state);
  if (!slug) return null;
  const specificUrl = nicheUrlForSlug(slug);

  // No DB, or no import yet → best-effort specific (prior behaviour).
  if (!hasDatabase()) return { url: specificUrl, specific: true };
  try {
    await ensureTable();
    if (!(await isPopulated())) return { url: specificUrl, specific: true };
    if (await isValidSlug(slug)) return { url: specificUrl, specific: true };
    return { url: NICHE_HOME, specific: false };
  } catch (err) {
    console.error("resolveNicheLink failed:", err);
    return { url: specificUrl, specific: true };
  }
}
