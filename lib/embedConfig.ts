import { getPool, hasDatabase } from "@/lib/db";

// ---------------------------------------------------------------------------
// Embeddable "School Rating Explorer" widget — per-partner configuration.
//
// A partner adds one line of script to their site. The SDK resolves the
// presentation + behaviour for the embedding host from here (server-side),
// then opens a chrome-less explorer iframe scoped to the scraped address.
//
// Config is stored in Postgres (table `embed_partners`) when DATABASE_URL is
// set. Without a database, every host falls back to DEFAULT_PRESENTATION so a
// freshly-pasted snippet still renders (useful for the demo bundle / local
// dev). The admin CRUD endpoints require a database.
// ---------------------------------------------------------------------------

export interface EmbedPresentation {
  accentColor: string;
  /** Floating-bubble side. */
  position: "left" | "right";
  /** Extra px lifted off the bottom edge (avoids overlapping a host chat widget). */
  bottomOffset: number;
  /** Tooltip copy; supports a `{{address}}` token. Empty = SDK default. */
  tooltipMessage: string;
  /** Hide the popup when no address could be resolved for the page. */
  requireAddress: boolean;
  /** Opt-in to the (heavier) visible-body-text address scan. */
  searchPageContent: boolean;
  /** Hide the floating popup when an inline embed is already on the page. */
  suppressOnInline: boolean;
  /** Hide the School Explorer when the (paid) Neighborhood Explorer popup/embed
   *  is already present on the page, so the two don't stack. */
  suppressIfNeighborhoodExplorer: boolean;
  /** Inline embed min-height (desktop) in px. */
  inlineMinHeight: number;
  /** Whether the inline embed shows the explorer header bar. */
  inlineShowHeader: boolean;
}

export interface PartnerConfig extends EmbedPresentation {
  partnerId: string;
  widgetNumber: number;
  /** Hostnames allowed to embed this widget (exact or parent-domain match). */
  allowedHosts: string[];
  /** Fallback address used when page scraping finds nothing. */
  defaultAddress: string;
  enabled: boolean;
}

export const DEFAULT_PRESENTATION: EmbedPresentation = {
  // Dream Neighborhood green (brand-500). Partners override per site.
  accentColor: "#1fa55f",
  position: "right",
  bottomOffset: 0,
  tooltipMessage: "",
  requireAddress: false,
  searchPageContent: false,
  suppressOnInline: false,
  suppressIfNeighborhoodExplorer: false,
  inlineMinHeight: 750,
  inlineShowHeader: false,
};

export function normalizePosition(value: unknown): "left" | "right" {
  return String(value ?? "right").toLowerCase() === "left" ? "left" : "right";
}

/** Lowercase, strip scheme/path/port and a leading `www.`. */
export function normalizeHost(raw: string): string {
  let h = (raw || "").trim().toLowerCase();
  if (!h) return "";
  if (h.includes("://")) {
    try {
      h = new URL(h).hostname;
    } catch {
      /* fall through to manual parse */
    }
  }
  h = h.split("/")[0].split(":")[0];
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

/** Candidate hosts for a domain walk: the host itself, then each parent. */
function hostCandidates(host: string): string[] {
  const h = normalizeHost(host);
  if (!h) return [];
  const labels = h.split(".");
  const out = [h];
  // Walk up but never down to a bare TLD (e.g. "com").
  for (let i = 1; i < labels.length - 1; i += 1) {
    out.push(labels.slice(i).join("."));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Presentation payload — the JSON shape the SDK consumes.
// Mirrors the reference DN explorer: flat legacy keys + popup/inline blocks.
// ---------------------------------------------------------------------------

export function presentationPayload(p: EmbedPresentation) {
  return {
    accentColor: p.accentColor,
    searchPageContent: p.searchPageContent,
    position: p.position,
    bottomOffset: p.bottomOffset,
    tooltipMessage: p.tooltipMessage,
    requireAddress: p.requireAddress,
    suppressOnInline: p.suppressOnInline,
    popup: {
      position: p.position,
      bottomOffset: p.bottomOffset,
      tooltipMessage: p.tooltipMessage,
      requireAddress: p.requireAddress,
      suppressOnInline: p.suppressOnInline,
      suppressIfNeighborhoodExplorer: p.suppressIfNeighborhoodExplorer,
    },
    inline: {
      minHeight: p.inlineMinHeight,
      showHeader: p.inlineShowHeader,
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres-backed partner store
// ---------------------------------------------------------------------------

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS embed_partners (
           partner_id           TEXT NOT NULL,
           widget_number        INTEGER NOT NULL DEFAULT 1,
           allowed_hosts        TEXT[] NOT NULL DEFAULT '{}',
           default_address      TEXT NOT NULL DEFAULT '',
           accent_color         TEXT NOT NULL DEFAULT '#1fa55f',
           position             TEXT NOT NULL DEFAULT 'right',
           bottom_offset        INTEGER NOT NULL DEFAULT 0,
           tooltip_message      TEXT NOT NULL DEFAULT '',
           require_address      BOOLEAN NOT NULL DEFAULT FALSE,
           search_page_content  BOOLEAN NOT NULL DEFAULT FALSE,
           suppress_on_inline   BOOLEAN NOT NULL DEFAULT FALSE,
           suppress_if_neighborhood_explorer BOOLEAN NOT NULL DEFAULT FALSE,
           inline_min_height    INTEGER NOT NULL DEFAULT 750,
           inline_show_header   BOOLEAN NOT NULL DEFAULT FALSE,
           enabled              BOOLEAN NOT NULL DEFAULT TRUE,
           created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (partner_id, widget_number)
         )`
      )
      // Idempotently add columns introduced after the table first shipped.
      .then(() =>
        pool.query(
          `ALTER TABLE embed_partners
             ADD COLUMN IF NOT EXISTS suppress_if_neighborhood_explorer BOOLEAN NOT NULL DEFAULT FALSE`
        )
      )
      .then(() => undefined)
      .catch((err) => {
        // Reset so a transient failure can be retried on the next call.
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

function rowToConfig(r: any): PartnerConfig {
  return {
    partnerId: r.partner_id,
    widgetNumber: Number(r.widget_number),
    allowedHosts: Array.isArray(r.allowed_hosts) ? r.allowed_hosts : [],
    defaultAddress: r.default_address ?? "",
    enabled: Boolean(r.enabled),
    accentColor: r.accent_color || DEFAULT_PRESENTATION.accentColor,
    position: normalizePosition(r.position),
    bottomOffset: Number(r.bottom_offset ?? 0),
    tooltipMessage: r.tooltip_message ?? "",
    requireAddress: Boolean(r.require_address),
    searchPageContent: Boolean(r.search_page_content),
    suppressOnInline: Boolean(r.suppress_on_inline),
    suppressIfNeighborhoodExplorer: Boolean(r.suppress_if_neighborhood_explorer),
    inlineMinHeight: Number(r.inline_min_height ?? DEFAULT_PRESENTATION.inlineMinHeight),
    inlineShowHeader: Boolean(r.inline_show_header),
  };
}

/** A default, enabled config so an un-registered host still renders. */
export function defaultConfigForHost(host: string, widgetNumber: number): PartnerConfig {
  return {
    ...DEFAULT_PRESENTATION,
    partnerId: `host:${normalizeHost(host) || "unknown"}`,
    widgetNumber,
    allowedHosts: [normalizeHost(host)].filter(Boolean),
    defaultAddress: "",
    enabled: true,
  };
}

/**
 * Resolve the config for an embedding host. Tries the host and each parent
 * domain. Returns a permissive default when nothing is registered (or no DB),
 * so the one-line snippet works immediately on the owner's own sites.
 */
export async function resolveByHost(
  host: string,
  widgetNumber: number
): Promise<PartnerConfig> {
  if (hasDatabase()) {
    try {
      await ensureTable();
      const pool = getPool();
      const candidates = hostCandidates(host);
      if (candidates.length) {
        const { rows } = await pool.query(
          `SELECT * FROM embed_partners
             WHERE widget_number = $1
               AND enabled = TRUE
               AND allowed_hosts && $2::text[]
             LIMIT 50`,
          [widgetNumber, candidates]
        );
        // Prefer the most specific match (longest allowed host that the page
        // host ends with), so blog.example.com beats example.com.
        let best: PartnerConfig | null = null;
        let bestLen = -1;
        for (const row of rows) {
          const cfg = rowToConfig(row);
          for (const allowed of cfg.allowedHosts) {
            const a = normalizeHost(allowed);
            if (candidates.includes(a) && a.length > bestLen) {
              best = cfg;
              bestLen = a.length;
            }
          }
        }
        if (best) return best;
      }
    } catch (err) {
      console.error("embed config resolveByHost failed:", err);
    }
  }
  return defaultConfigForHost(host, widgetNumber);
}

export async function getByPartner(
  partnerId: string,
  widgetNumber: number
): Promise<PartnerConfig | null> {
  if (!hasDatabase()) return null;
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM embed_partners WHERE partner_id = $1 AND widget_number = $2`,
    [partnerId, widgetNumber]
  );
  return rows[0] ? rowToConfig(rows[0]) : null;
}

export async function listPartners(): Promise<PartnerConfig[]> {
  if (!hasDatabase()) return [];
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM embed_partners ORDER BY partner_id, widget_number`
  );
  return rows.map(rowToConfig);
}

export interface PartnerUpsert {
  partnerId: string;
  widgetNumber?: number;
  allowedHosts?: string[];
  defaultAddress?: string;
  accentColor?: string;
  position?: string;
  bottomOffset?: number;
  tooltipMessage?: string;
  requireAddress?: boolean;
  searchPageContent?: boolean;
  suppressOnInline?: boolean;
  suppressIfNeighborhoodExplorer?: boolean;
  inlineMinHeight?: number;
  inlineShowHeader?: boolean;
  enabled?: boolean;
}

export async function upsertPartner(input: PartnerUpsert): Promise<PartnerConfig> {
  await ensureTable();
  const pool = getPool();
  const partnerId = String(input.partnerId || "").trim();
  if (!partnerId) throw new Error("partnerId is required");
  const widgetNumber = Number.isFinite(input.widgetNumber as number)
    ? Number(input.widgetNumber)
    : 1;
  const hosts = (input.allowedHosts ?? [])
    .map((h) => normalizeHost(h))
    .filter(Boolean);

  const { rows } = await pool.query(
    `INSERT INTO embed_partners (
        partner_id, widget_number, allowed_hosts, default_address, accent_color,
        position, bottom_offset, tooltip_message, require_address,
        search_page_content, suppress_on_inline, inline_min_height,
        inline_show_header, enabled, suppress_if_neighborhood_explorer, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW())
     ON CONFLICT (partner_id, widget_number) DO UPDATE SET
        allowed_hosts = EXCLUDED.allowed_hosts,
        default_address = EXCLUDED.default_address,
        accent_color = EXCLUDED.accent_color,
        position = EXCLUDED.position,
        bottom_offset = EXCLUDED.bottom_offset,
        tooltip_message = EXCLUDED.tooltip_message,
        require_address = EXCLUDED.require_address,
        search_page_content = EXCLUDED.search_page_content,
        suppress_on_inline = EXCLUDED.suppress_on_inline,
        inline_min_height = EXCLUDED.inline_min_height,
        inline_show_header = EXCLUDED.inline_show_header,
        enabled = EXCLUDED.enabled,
        suppress_if_neighborhood_explorer = EXCLUDED.suppress_if_neighborhood_explorer,
        updated_at = NOW()
     RETURNING *`,
    [
      partnerId,
      widgetNumber,
      hosts,
      String(input.defaultAddress ?? ""),
      String(input.accentColor ?? DEFAULT_PRESENTATION.accentColor),
      normalizePosition(input.position),
      Math.max(0, Math.floor(Number(input.bottomOffset ?? 0)) || 0),
      String(input.tooltipMessage ?? ""),
      Boolean(input.requireAddress),
      Boolean(input.searchPageContent),
      Boolean(input.suppressOnInline),
      Math.max(200, Math.floor(Number(input.inlineMinHeight ?? DEFAULT_PRESENTATION.inlineMinHeight)) || DEFAULT_PRESENTATION.inlineMinHeight),
      Boolean(input.inlineShowHeader),
      input.enabled == null ? true : Boolean(input.enabled),
      Boolean(input.suppressIfNeighborhoodExplorer),
    ]
  );
  return rowToConfig(rows[0]);
}

export async function deletePartner(
  partnerId: string,
  widgetNumber: number
): Promise<boolean> {
  if (!hasDatabase()) return false;
  await ensureTable();
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM embed_partners WHERE partner_id = $1 AND widget_number = $2`,
    [partnerId, widgetNumber]
  );
  return (res.rowCount ?? 0) > 0;
}
