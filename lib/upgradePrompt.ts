import { getPool, hasDatabase } from "@/lib/db";
import { emailShell, htmlEscape, sendTransactionalEmail } from "@/lib/email";
import { ensureAuthTables } from "@/lib/auth";

export const DEFAULT_UPGRADE_VIEWS_TO_TRIGGER = 2;
export const DEFAULT_UPGRADE_MIN_DAYS_BETWEEN = 7;
export const DEFAULT_UPGRADE_IDLE_SECONDS = 8;
export const REQUEST_SUPPRESS_DAYS = 90;

export interface UpgradePromptSettings {
  viewsToTrigger: number;
  minDaysBetween: number;
  idleSeconds: number;
}

export interface UpgradeDigestSchedule {
  digestIntervalWeeks: number;
  lastDigestSentAt: string | null;
}

export type UpgradeDigestVariant = string;

export interface UpgradeRequestRow {
  id: number;
  customerId: string;
  customerEmail: string;
  businessName: string;
  partnerId: string | null;
  partnerEmail: string | null;
  partnerCompanyName: string | null;
  providerName: string;
  requesterKey: string;
  address: string;
  source: string;
  requestedAt: string;
  summarySentAt: string | null;
}

export interface UpgradeEmailTemplate {
  variant: UpgradeDigestVariant;
  label: string;
  subject: string;
  intro: string;
  ctaText: string;
  ctaUrl: string;
  updatedAt: string | null;
}

export interface SentDigestEmail {
  id: number;
  recipient: string;
  subject: string;
  variant: UpgradeDigestVariant | string;
  audience: string;
  requestIds: number[];
  html: string;
  text: string;
  sentAt: string;
}

export interface UpgradeOfferEmail {
  id: number;
  customerId: string;
  customerEmail: string;
  customerName: string;
  partnerId: string | null;
  partnerCompanyName: string | null;
  sentByEmail: string;
  offerText: string;
  discountCode: string;
  requestIds: number[];
  requestCount: number;
  sentAt: string;
}

let tableReady: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
  if (!tableReady) {
    const pool = getPool();
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_upgrade_settings (
           key TEXT PRIMARY KEY,
           views_to_trigger INTEGER NOT NULL DEFAULT 2,
           min_days_between INTEGER NOT NULL DEFAULT 7,
           idle_seconds INTEGER NOT NULL DEFAULT 8,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_upgrade_requests (
             id BIGSERIAL PRIMARY KEY,
             customer_id TEXT NOT NULL,
             partner_id TEXT,
             provider_name TEXT NOT NULL DEFAULT '',
             requester_key TEXT NOT NULL DEFAULT '',
             address TEXT NOT NULL DEFAULT '',
             source TEXT NOT NULL DEFAULT '',
             requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             summary_sent_at TIMESTAMPTZ
           )`
        )
      )
      .then(() =>
        pool.query(
          `ALTER TABLE app_upgrade_settings
             ADD COLUMN IF NOT EXISTS digest_interval_weeks INTEGER NOT NULL DEFAULT 1,
             ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_upgrade_email_templates (
             variant TEXT PRIMARY KEY,
             label TEXT NOT NULL,
             subject TEXT NOT NULL,
             intro TEXT NOT NULL,
             cta_text TEXT NOT NULL DEFAULT '',
             cta_url TEXT NOT NULL DEFAULT '',
             updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_upgrade_digest_emails (
             id BIGSERIAL PRIMARY KEY,
             recipient TEXT NOT NULL,
             subject TEXT NOT NULL,
             variant TEXT NOT NULL,
             audience TEXT NOT NULL,
             request_ids BIGINT[] NOT NULL DEFAULT '{}',
             html TEXT NOT NULL,
             text TEXT NOT NULL,
             sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE TABLE IF NOT EXISTS app_upgrade_offer_emails (
             id BIGSERIAL PRIMARY KEY,
             customer_id TEXT NOT NULL,
             partner_id TEXT,
             sent_by TEXT NOT NULL,
             recipient TEXT NOT NULL,
             customer_name TEXT NOT NULL DEFAULT '',
             offer_text TEXT NOT NULL DEFAULT '',
             discount_code TEXT NOT NULL DEFAULT '',
             request_ids BIGINT[] NOT NULL DEFAULT '{}',
             request_count INTEGER NOT NULL DEFAULT 0,
             html TEXT NOT NULL,
             text TEXT NOT NULL,
             sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS app_upgrade_requests_customer_idx
             ON app_upgrade_requests(customer_id, requested_at)`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS app_upgrade_offer_emails_customer_idx
             ON app_upgrade_offer_emails(customer_id, sent_at DESC)`
        )
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS app_upgrade_offer_emails_partner_idx
             ON app_upgrade_offer_emails(partner_id, sent_at DESC)`
        )
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

// Exported so other modules (e.g. the customer list) can guarantee the upgrade
// tables exist before joining against them on a fresh database.
export function ensureUpgradeTables(): Promise<void> {
  return ensureTables();
}

function cleanInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

const LEARN_MORE_URL = "https://www.dreamneighborhood.com";
const SIGNUP_URL = "https://app.dreamneighborhood.com/accounts/signup/";
const REQUESTS_URL = "https://app.dreamneighborhoodschools.com/upgrade-requests";
const REMINDER_REQUEST_PREVIEW_LIMIT = 5;
const CUSTOMER_REMINDER_INTRO =
  "Your website visitors are asking for the full Neighborhood Explorer — home prices, commute, walkability, safety, dining and 38+ hyperlocal insights.";
const OLD_CUSTOMER_REMINDER_INTRO =
  "Your website visitors are asking for the full Neighborhood Explorer — home prices, commute, walkability, safety, dining and 38+ hyperlocal insights. Give them the complete picture on YOUR site (instead of losing them to Zillow or Realtor.com™) and become the hero for your clients.";

const DEFAULT_TEMPLATES: Record<string, Omit<UpgradeEmailTemplate, "updatedAt">> = {
  soft_nudge: {
    variant: "soft_nudge",
    label: "Soft nudge",
    subject: "Your website visitors requested full Neighborhood Explorer access",
    intro:
      "Someone browsing your website asked for the full Neighborhood Explorer experience. This is a warm signal that your visitors want deeper neighborhood insight while they are already on your site.",
    ctaText: "Learn more about Neighborhood Explorer",
    ctaUrl: LEARN_MORE_URL,
  },
  strong_sales: {
    variant: "strong_sales",
    label: "Strong upgrade sales pitch",
    subject: "Your visitors are leaving for neighborhood answers — keep them on your site",
    intro:
      "People leave real-estate sites for Zillow and realtor.com because they want richer neighborhood answers. Dream Neighborhood gives them a more complete picture directly on your website — keeping them engaged with you.",
    ctaText: "Upgrade to Neighborhood Explorer",
    ctaUrl: SIGNUP_URL,
  },
  partner_summary: {
    variant: "partner_summary",
    label: "Partner-facing summary",
    subject: "Partner summary: Neighborhood Explorer requests",
    intro:
      "Customers under your partner account had visitors request full Neighborhood Explorer access. These are strong upgrade opportunities for the Realtors you support.",
    ctaText: "Learn more",
    ctaUrl: LEARN_MORE_URL,
  },
  admin_summary: {
    variant: "admin_summary",
    label: "Admin follow-up summary",
    subject: "Admin follow-up: Neighborhood Explorer upgrade requests",
    intro:
      "These requests need follow-up. Realtors have visitors asking for more comprehensive neighborhood data on their websites.",
    ctaText: "Open admin",
    ctaUrl: "https://app.dreamneighborhoodschools.com/upgrade-requests",
  },
  customer_reminder: {
    variant: "customer_reminder",
    label: "Realtor reminder (self)",
    subject: "Your homebuyers want the full neighborhood picture",
    intro: CUSTOMER_REMINDER_INTRO,
    ctaText: "Sign up",
    ctaUrl: SIGNUP_URL,
  },
};

export const DEFAULT_REMINDER_INTERVAL_DAYS = 7;

function fillTemplate(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function seedTemplates(): Promise<void> {
  await ensureTables();
  for (const t of Object.values(DEFAULT_TEMPLATES)) {
    await getPool().query(
      `INSERT INTO app_upgrade_email_templates (variant, label, subject, intro, cta_text, cta_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (variant) DO NOTHING`,
      [t.variant, t.label, t.subject, t.intro, t.ctaText, t.ctaUrl]
    );
  }
}

export async function listUpgradeEmailTemplates(): Promise<UpgradeEmailTemplate[]> {
  if (!hasDatabase()) {
    return Object.values(DEFAULT_TEMPLATES).map((t) => ({ ...t, updatedAt: null }));
  }
  await seedTemplates();
  const { rows } = await getPool().query(
    `SELECT variant, label, subject, intro, cta_text, cta_url, updated_at
       FROM app_upgrade_email_templates
      ORDER BY CASE variant
        WHEN 'soft_nudge' THEN 1
        WHEN 'strong_sales' THEN 2
        WHEN 'partner_summary' THEN 3
        WHEN 'admin_summary' THEN 4
        ELSE 99 END`
  );
  return rows.map((r: any) => ({
    variant: r.variant,
    label: r.label,
    subject: r.subject,
    intro: r.intro,
    ctaText: r.cta_text,
    ctaUrl: r.cta_url,
    updatedAt: r.updated_at,
  }));
}

export async function getUpgradeEmailTemplate(variant: UpgradeDigestVariant): Promise<UpgradeEmailTemplate> {
  const templates = await listUpgradeEmailTemplates();
  return templates.find((t) => t.variant === variant) || { ...DEFAULT_TEMPLATES.soft_nudge, updatedAt: null };
}

export async function saveUpgradeEmailTemplate(input: UpgradeEmailTemplate): Promise<UpgradeEmailTemplate> {
  await ensureTables();
  const label = input.label || DEFAULT_TEMPLATES[input.variant]?.label || "Custom template";
  const { rows } = await getPool().query(
    `INSERT INTO app_upgrade_email_templates (variant, label, subject, intro, cta_text, cta_url, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (variant) DO UPDATE SET
       subject = EXCLUDED.subject,
       intro = EXCLUDED.intro,
       cta_text = EXCLUDED.cta_text,
       cta_url = EXCLUDED.cta_url,
       updated_at = NOW()
     RETURNING variant, label, subject, intro, cta_text, cta_url, updated_at`,
    [input.variant, label, input.subject, input.intro, input.ctaText, input.ctaUrl]
  );
  const r = rows[0];
  return { variant: r.variant, label: r.label, subject: r.subject, intro: r.intro, ctaText: r.cta_text, ctaUrl: r.cta_url, updatedAt: r.updated_at };
}

export async function getGlobalUpgradeSettings(): Promise<UpgradePromptSettings> {
  if (!hasDatabase()) {
    return {
      viewsToTrigger: DEFAULT_UPGRADE_VIEWS_TO_TRIGGER,
      minDaysBetween: DEFAULT_UPGRADE_MIN_DAYS_BETWEEN,
      idleSeconds: DEFAULT_UPGRADE_IDLE_SECONDS,
    };
  }
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT views_to_trigger, min_days_between, idle_seconds
       FROM app_upgrade_settings WHERE key = 'global'`
  );
  const r = rows[0];
  return {
    viewsToTrigger: cleanInt(r?.views_to_trigger, DEFAULT_UPGRADE_VIEWS_TO_TRIGGER, 1, 50),
    minDaysBetween: cleanInt(r?.min_days_between, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 0, 365),
    idleSeconds: cleanInt(r?.idle_seconds, DEFAULT_UPGRADE_IDLE_SECONDS, 3, 60),
  };
}

export async function setGlobalUpgradeSettings(values: UpgradePromptSettings): Promise<UpgradePromptSettings> {
  await ensureTables();
  const cleaned = {
    viewsToTrigger: cleanInt(values.viewsToTrigger, DEFAULT_UPGRADE_VIEWS_TO_TRIGGER, 1, 50),
    minDaysBetween: cleanInt(values.minDaysBetween, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 0, 365),
    idleSeconds: cleanInt(values.idleSeconds, DEFAULT_UPGRADE_IDLE_SECONDS, 3, 60),
  };
  await getPool().query(
    `INSERT INTO app_upgrade_settings (key, views_to_trigger, min_days_between, idle_seconds, updated_at)
       VALUES ('global', $1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       views_to_trigger = EXCLUDED.views_to_trigger,
       min_days_between = EXCLUDED.min_days_between,
       idle_seconds = EXCLUDED.idle_seconds,
       updated_at = NOW()`,
    [cleaned.viewsToTrigger, cleaned.minDaysBetween, cleaned.idleSeconds]
  );
  return cleaned;
}

export async function getUpgradeDigestSchedule(): Promise<UpgradeDigestSchedule> {
  if (!hasDatabase()) return { digestIntervalWeeks: 1, lastDigestSentAt: null };
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT digest_interval_weeks, last_digest_sent_at
       FROM app_upgrade_settings WHERE key = 'global'`
  );
  return {
    digestIntervalWeeks: cleanInt(rows[0]?.digest_interval_weeks, 1, 1, 52),
    lastDigestSentAt: rows[0]?.last_digest_sent_at ?? null,
  };
}

export async function setUpgradeDigestSchedule(intervalWeeks: number): Promise<UpgradeDigestSchedule> {
  await ensureTables();
  const weeks = cleanInt(intervalWeeks, 1, 1, 52);
  const { rows } = await getPool().query(
    `INSERT INTO app_upgrade_settings (key, digest_interval_weeks, updated_at)
       VALUES ('global', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       digest_interval_weeks = EXCLUDED.digest_interval_weeks,
       updated_at = NOW()
     RETURNING digest_interval_weeks, last_digest_sent_at`,
    [weeks]
  );
  return { digestIntervalWeeks: Number(rows[0].digest_interval_weeks), lastDigestSentAt: rows[0].last_digest_sent_at ?? null };
}

async function markDigestRun(): Promise<void> {
  await getPool().query(
    `INSERT INTO app_upgrade_settings (key, last_digest_sent_at, updated_at)
       VALUES ('global', NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET
       last_digest_sent_at = NOW(),
       updated_at = NOW()`
  );
}

export async function isDigestDue(now = new Date()): Promise<boolean> {
  const schedule = await getUpgradeDigestSchedule();
  if (!schedule.lastDigestSentAt) return true;
  const last = new Date(schedule.lastDigestSentAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= schedule.digestIntervalWeeks * 7 * 86400000;
}

export async function recordUpgradeRequest(input: {
  customerId: string;
  partnerId?: string | null;
  providerName?: string;
  requesterKey?: string;
  address?: string;
  source?: string;
}): Promise<void> {
  if (!hasDatabase() || !input.customerId) return;
  await ensureTables();
  await getPool().query(
    `INSERT INTO app_upgrade_requests
       (customer_id, partner_id, provider_name, requester_key, address, source)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.customerId,
      input.partnerId || null,
      input.providerName || "",
      input.requesterKey || "",
      input.address || "",
      input.source || "",
    ]
  );
}

function row(r: any): UpgradeRequestRow {
  return {
    id: Number(r.id),
    customerId: r.customer_id,
    customerEmail: r.customer_email || "",
    businessName: r.business_name || "",
    partnerId: r.partner_id || null,
    partnerEmail: r.partner_email || null,
    partnerCompanyName: r.partner_company_name || null,
    providerName: r.provider_name || "",
    requesterKey: r.requester_key || "",
    address: r.address || "",
    source: r.source || "",
    requestedAt: r.requested_at,
    summarySentAt: r.summary_sent_at ?? null,
  };
}

export interface UpgradeRequestNarrow {
  customerId?: string | null;
  partnerId?: string | null;
}

export async function listUpgradeRequests(options: { includeSent?: boolean; limit?: number; viewer?: { id: string; isOwner: boolean; isPartner: boolean } | null; narrow?: UpgradeRequestNarrow } = {}): Promise<UpgradeRequestRow[]> {
  if (!hasDatabase()) return [];
  await ensureTables();
  const params: unknown[] = [Boolean(options.includeSent)];
  let scope = "";
  if (options.viewer && !options.viewer.isOwner) {
    params.push(options.viewer.id);
    if (options.viewer.isPartner) {
      // Scope by the customer's CURRENT partner association, so requests appear
      // for the partner even if the row wasn't stamped with partner_id.
      scope = ` AND r.customer_id IN (SELECT id FROM app_users WHERE partner_id = $${params.length})`;
    } else {
      scope = ` AND r.customer_id = $${params.length}`;
    }
  }
  // Optional narrowing (all/one partner/one customer). The viewer scope above is
  // always applied too, so a partner can never narrow outside their own customers.
  if (options.narrow?.customerId) {
    params.push(options.narrow.customerId);
    scope += ` AND r.customer_id = $${params.length}`;
  } else if (options.narrow?.partnerId) {
    params.push(options.narrow.partnerId);
    scope += ` AND r.customer_id IN (SELECT id FROM app_users WHERE partner_id = $${params.length})`;
  }
  let limitClause = "";
  if (options.limit && Number.isFinite(options.limit)) {
    params.push(Math.floor(options.limit));
    limitClause = ` LIMIT $${params.length}`;
  }
  const { rows } = await getPool().query(
    `SELECT
        r.*,
        customer.email AS customer_email,
        customer.business_name,
        partner.email AS partner_email,
        partner.company_name AS partner_company_name
       FROM app_upgrade_requests r
       LEFT JOIN app_users customer ON customer.id = r.customer_id
       LEFT JOIN app_users partner ON partner.id = r.partner_id
      WHERE ($1::boolean = TRUE OR r.summary_sent_at IS NULL)
      ${scope}
      ORDER BY r.requested_at DESC${limitClause}`,
    params
  );
  return rows.map(row);
}

export async function getUpgradeRequestSummary(
  viewer?: { id: string; isOwner: boolean; isPartner: boolean } | null,
  narrow?: UpgradeRequestNarrow
): Promise<{ total: number; pending: number; sent: number; views: number }> {
  if (!hasDatabase()) return { total: 0, pending: 0, sent: 0, views: 0 };
  await ensureTables();
  const params: unknown[] = [];
  let viewerIdx = 0;
  let narrowIdx = 0;
  let narrowKind: "customer" | "partner" | null = null;
  if (viewer && !viewer.isOwner) {
    params.push(viewer.id);
    viewerIdx = params.length;
  }
  if (narrow?.customerId) {
    params.push(narrow.customerId);
    narrowIdx = params.length;
    narrowKind = "customer";
  } else if (narrow?.partnerId) {
    params.push(narrow.partnerId);
    narrowIdx = params.length;
    narrowKind = "partner";
  }
  // Build an equivalent scope for either table: requests use r.customer_id, and
  // embed usage rows are keyed by the customer's own id (partner_id column).
  function scopeFor(col: string): string {
    const c: string[] = [];
    if (viewerIdx) {
      c.push(viewer!.isPartner ? `${col} IN (SELECT id FROM app_users WHERE partner_id = $${viewerIdx})` : `${col} = $${viewerIdx}`);
    }
    if (narrowKind === "customer") c.push(`${col} = $${narrowIdx}`);
    else if (narrowKind === "partner") c.push(`${col} IN (SELECT id FROM app_users WHERE partner_id = $${narrowIdx})`);
    return c.length ? ` WHERE ${c.join(" AND ")}` : "";
  }
  const { rows } = await getPool().query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.summary_sent_at IS NULL)::int AS pending,
        COUNT(*) FILTER (WHERE r.summary_sent_at IS NOT NULL)::int AS sent
       FROM app_upgrade_requests r${scopeFor("r.customer_id")}`,
    params
  );
  const viewsRow = await getPool().query(
    `SELECT COALESCE(SUM(views),0)::bigint AS n FROM embed_usage${scopeFor("partner_id")}`,
    params
  );
  return {
    total: rows[0].total,
    pending: rows[0].pending,
    sent: rows[0].sent,
    views: Number(viewsRow.rows[0].n) || 0,
  };
}

export interface UpgradeRequestSeriesPoint {
  period: string;
  count: number;
}

export interface UpgradeRequestSeries {
  week: UpgradeRequestSeriesPoint[];
  month: UpgradeRequestSeriesPoint[];
  year: UpgradeRequestSeriesPoint[];
}

// Request counts bucketed by week/month/year for charting, scoped to the viewer.
export async function getUpgradeRequestSeries(
  viewer?: { id: string; isOwner: boolean; isPartner: boolean } | null,
  narrow?: UpgradeRequestNarrow
): Promise<UpgradeRequestSeries> {
  const empty: UpgradeRequestSeries = { week: [], month: [], year: [] };
  if (!hasDatabase()) return empty;
  await ensureTables();
  const params: unknown[] = [];
  const conds: string[] = [];
  if (viewer && !viewer.isOwner) {
    params.push(viewer.id);
    conds.push(viewer.isPartner
      ? `r.customer_id IN (SELECT id FROM app_users WHERE partner_id = $${params.length})`
      : `r.customer_id = $${params.length}`);
  }
  if (narrow?.customerId) {
    params.push(narrow.customerId);
    conds.push(`r.customer_id = $${params.length}`);
  } else if (narrow?.partnerId) {
    params.push(narrow.partnerId);
    conds.push(`r.customer_id IN (SELECT id FROM app_users WHERE partner_id = $${params.length})`);
  }
  const scope = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  async function bucket(unit: "week" | "month" | "year"): Promise<UpgradeRequestSeriesPoint[]> {
    const { rows } = await getPool().query(
      `SELECT to_char(date_trunc('${unit}', r.requested_at), 'YYYY-MM-DD') AS period, COUNT(*)::int AS count
         FROM app_upgrade_requests r${scope}
        GROUP BY 1
        ORDER BY 1`,
      params
    );
    return rows.map((r: any) => ({ period: r.period, count: Number(r.count) }));
  }
  const [week, month, year] = await Promise.all([bucket("week"), bucket("month"), bucket("year")]);
  return { week, month, year };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    out.set(k, [...(out.get(k) || []), item]);
  }
  return out;
}

function requestListHtml(items: UpgradeRequestRow[]): string {
  return `<ul style="padding-left:18px;margin:12px 0;color:#334155;font-size:14px;line-height:1.6">
    ${items
      .map(
        (r) =>
          `<li><strong>${htmlEscape(r.address || "Unknown address")}</strong> — ${new Date(
            r.requestedAt
          ).toLocaleString()} (${htmlEscape(r.source || "widget")})</li>`
      )
      .join("")}
  </ul>`;
}

async function archiveEmail(input: {
  recipient: string;
  subject: string;
  variant: string;
  audience: string;
  requestIds: number[];
  html: string;
  text: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO app_upgrade_digest_emails
       (recipient, subject, variant, audience, request_ids, html, text)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [input.recipient, input.subject, input.variant, input.audience, input.requestIds, input.html, input.text]
  );
}

function customerDigestHtml(items: UpgradeRequestRow[], template: UpgradeEmailTemplate, variant: UpgradeDigestVariant): string {
  const count = items.length;
  const strong = variant === "strong_sales";
  const vars = {
    request_count: String(count),
    learn_more_url: LEARN_MORE_URL,
    signup_url: SIGNUP_URL,
    partner_signup_url: SIGNUP_URL,
  };
  const intro = fillTemplate(template.intro, vars);
  const ctaUrl = fillTemplate(template.ctaUrl || LEARN_MORE_URL, vars);
  const ctaText = fillTemplate(template.ctaText || "Learn more", vars);
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">${htmlEscape(template.subject)}</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       ${htmlEscape(intro)}
     </p>
     <p style="color:#0f172a;font-size:14px;margin:0"><strong>${count}</strong> request${count === 1 ? "" : "s"} this period:</p>
     ${requestListHtml(items)}
     <p style="color:#475569;font-size:14px;line-height:1.6">
       Become the hero for your clients by providing what they want: home prices, commute, walkability, safety, dining, lifestyle, and more — all without sending them away from your site.
     </p>
     <p style="margin-top:18px">
       <a href="${htmlEscape(ctaUrl)}" style="display:inline-block;background:#12854c;color:#fff;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px">${htmlEscape(ctaText)}</a>
     </p>
     <p style="color:#64748b;font-size:13px;line-height:1.5">
       Learn more: <a href="${LEARN_MORE_URL}">${LEARN_MORE_URL}</a><br>
       Sign up: <a href="${SIGNUP_URL}">${SIGNUP_URL}</a>
     </p>`
  );
}

function partnerDigestHtml(partnerName: string, items: UpgradeRequestRow[], template: UpgradeEmailTemplate): string {
  const vars = {
    partner_name: partnerName || "",
    request_count: String(items.length),
    learn_more_url: LEARN_MORE_URL,
    signup_url: SIGNUP_URL,
    partner_signup_url: SIGNUP_URL,
  };
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">${htmlEscape(fillTemplate(template.subject, vars))}</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       ${htmlEscape(fillTemplate(template.intro, vars))}
     </p>
     ${requestListHtml(items)}
     <p style="margin-top:18px">
       <a href="${htmlEscape(fillTemplate(template.ctaUrl || LEARN_MORE_URL, vars))}" style="display:inline-block;background:#12854c;color:#fff;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px">${htmlEscape(fillTemplate(template.ctaText || "Learn more", vars))}</a>
     </p>
     <p style="color:#64748b;font-size:13px;line-height:1.5">
       Learn more: <a href="${LEARN_MORE_URL}">${LEARN_MORE_URL}</a><br>
       Sign up: <a href="${SIGNUP_URL}">${SIGNUP_URL}</a>
     </p>`
  );
}

function adminDigestHtml(items: UpgradeRequestRow[], template: UpgradeEmailTemplate): string {
  const byCustomer = groupBy(items, (r) => r.customerEmail || r.customerId);
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">${htmlEscape(template.subject)}</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       ${htmlEscape(template.intro)} ${items.length} request${items.length === 1 ? "" : "s"} need follow-up across ${byCustomer.size} customer account${byCustomer.size === 1 ? "" : "s"}.
     </p>
     ${Array.from(byCustomer.entries())
       .map(
         ([customer, rows]) =>
           `<div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:10px">
              <p style="margin:0;color:#0f172a;font-size:14px"><strong>${htmlEscape(customer)}</strong> — ${rows.length} request${rows.length === 1 ? "" : "s"}</p>
              ${requestListHtml(rows)}
            </div>`
       )
       .join("")}`
  );
}

function textFromRows(items: UpgradeRequestRow[]): string {
  return items
    .map((r) => `- ${r.customerEmail}: ${r.address || "Unknown address"} at ${new Date(r.requestedAt).toLocaleString()}`)
    .join("\n");
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function sendUpgradeDigestNow(variant: UpgradeDigestVariant = "soft_nudge"): Promise<{
  sentTo: string[];
  requestCount: number;
}> {
  const requests = await listUpgradeRequests({ includeSent: false });
  if (!requests.length) return { sentTo: [], requestCount: 0 };

  const sentTo = new Set<string>();
  const customerTemplate = await getUpgradeEmailTemplate(variant);
  const partnerTemplate = await getUpgradeEmailTemplate("partner_summary");
  const adminTemplate = await getUpgradeEmailTemplate("admin_summary");
  const byCustomer = groupBy(requests, (r) => r.customerId);
  for (const rows of byCustomer.values()) {
    const to = rows[0].customerEmail;
    if (!to) continue;
    const subject = fillTemplate(customerTemplate.subject, {
      request_count: String(rows.length),
      learn_more_url: LEARN_MORE_URL,
      signup_url: SIGNUP_URL,
      partner_signup_url: SIGNUP_URL,
    });
    const html = customerDigestHtml(rows, customerTemplate, variant);
    const text = textFromRows(rows);
    await sendTransactionalEmail({
      to,
      subject,
      text,
      html,
    });
    await archiveEmail({ recipient: to, subject, variant, audience: "customer", requestIds: rows.map((r) => r.id), html, text });
    sentTo.add(to);
  }

  const byPartner = groupBy(
    requests.filter((r) => r.partnerEmail),
    (r) => r.partnerId || r.partnerEmail || ""
  );
  for (const rows of byPartner.values()) {
    const to = rows[0].partnerEmail;
    if (!to) continue;
    const subject = fillTemplate(partnerTemplate.subject, {
      partner_name: rows[0].partnerCompanyName || rows[0].partnerEmail || "",
      request_count: String(rows.length),
      learn_more_url: LEARN_MORE_URL,
      signup_url: SIGNUP_URL,
      partner_signup_url: SIGNUP_URL,
    });
    const html = partnerDigestHtml(rows[0].partnerCompanyName || rows[0].partnerEmail || "", rows, partnerTemplate);
    const text = textFromRows(rows);
    await sendTransactionalEmail({
      to,
      subject,
      text,
      html,
    });
    await archiveEmail({ recipient: to, subject, variant: "partner_summary", audience: "partner", requestIds: rows.map((r) => r.id), html, text });
    sentTo.add(to);
  }

  const admins = ownerEmails();
  if (admins.length) {
    const subject = adminTemplate.subject;
    const html = adminDigestHtml(requests, adminTemplate);
    const text = textFromRows(requests);
    await sendTransactionalEmail({
      to: admins.join(","),
      subject,
      text,
      html,
    });
    await archiveEmail({ recipient: admins.join(","), subject, variant: "admin_summary", audience: "admin", requestIds: requests.map((r) => r.id), html, text });
    admins.forEach((e) => sentTo.add(e));
  }

  await getPool().query(
    `UPDATE app_upgrade_requests SET summary_sent_at = NOW()
      WHERE id = ANY($1::bigint[])`,
    [requests.map((r) => r.id)]
  );
  await markDigestRun();
  return { sentTo: Array.from(sentTo), requestCount: requests.length };
}

export async function listSentDigestEmails(): Promise<SentDigestEmail[]> {
  if (!hasDatabase()) return [];
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT id, recipient, subject, variant, audience, request_ids, html, text, sent_at
       FROM app_upgrade_digest_emails
      ORDER BY sent_at DESC
      LIMIT 100`
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    recipient: r.recipient,
    subject: r.subject,
    variant: r.variant,
    audience: r.audience,
    requestIds: r.request_ids || [],
    html: r.html,
    text: r.text,
    sentAt: r.sent_at,
  }));
}

export async function getSentDigestEmail(id: number): Promise<SentDigestEmail | null> {
  await ensureTables();
  const { rows } = await getPool().query(
    `SELECT id, recipient, subject, variant, audience, request_ids, html, text, sent_at
       FROM app_upgrade_digest_emails WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    recipient: r.recipient,
    subject: r.subject,
    variant: r.variant,
    audience: r.audience,
    requestIds: r.request_ids || [],
    html: r.html,
    text: r.text,
    sentAt: r.sent_at,
  };
}

export async function sendDigestCopy(id: number, to: string): Promise<void> {
  const sent = await getSentDigestEmail(id);
  if (!sent) throw new Error("Sent email not found");
  await sendTransactionalEmail({
    to,
    subject: `Copy: ${sent.subject}`,
    text: sent.text,
    html: sent.html,
  });
}

type UpgradeManagerViewer = {
  id: string;
  email: string;
  isOwner: boolean;
  isPartner: boolean;
};

function assertCanManageUpgradeOffers(viewer: UpgradeManagerViewer): void {
  if (!viewer.isOwner && !viewer.isPartner) {
    throw new Error("Admin or partner access required.");
  }
}

function offerEmailHtml(opts: {
  customerName: string;
  requests: UpgradeRequestRow[];
  offerText: string;
  discountCode: string;
}): string {
  const { customerName, requests, offerText, discountCode } = opts;
  return emailShell(
    `<div style="background:#f8fbf4;border:1px solid #dcebd5;border-radius:24px;overflow:hidden">
       <div style="background:linear-gradient(135deg,#fbfff1 0%,#effdd1 48%,#dcfce7 100%);padding:24px;border-bottom:1px solid #d9f99d">
         <div style="display:inline-block;background:#ffffff;border:1px solid #bbf7d0;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;color:#12854c">Dream Neighborhood&trade;</div>
         <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;color:#102a1d">Your homebuyers want the full neighborhood picture</h1>
         <p style="font-size:14px;line-height:1.6;margin:0;color:#31523d">Visitors on your website requested access to the full Neighborhood Explorer.</p>
       </div>
       <div style="padding:20px 22px">
         ${customerName ? `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 12px">Hi ${htmlEscape(customerName)},</p>` : ""}
         <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 14px">${htmlEscape(offerText || "Upgrade to Neighborhood Explorer to keep buyers on your site with 38+ hyperlocal insights: prices, commute, walkability, safety, dining, and more.")}</p>
         ${
           discountCode
             ? `<div style="background:#ffffff;border:1px solid #bbf7d0;border-radius:16px;padding:14px;margin:0 0 16px">
                  <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#12854c;margin-bottom:4px">Discount code</div>
                  <div style="font-size:20px;font-weight:900;color:#0f172a">${htmlEscape(discountCode)}</div>
                </div>`
             : ""
         }
         <div style="text-align:center;background:#ffffff;border:1px solid #bbf7d0;border-radius:20px;padding:18px;margin:0 0 16px">
           <div style="font-size:17px;font-weight:900;color:#0f172a;line-height:1.25;margin:0 0 12px">Give buyers the full neighborhood picture.</div>
           <a href="${SIGNUP_URL}" style="display:inline-block;background:#12854c;color:#ffffff;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px">Upgrade Now</a>
         </div>
         <div style="background:#ffffff;border:1px solid #dcebd5;border-radius:18px;padding:16px">
           <p style="color:#0f172a;font-size:14px;margin:0 0 4px"><strong>Homebuyer upgrade requests (${requests.length.toLocaleString()}):</strong></p>
           ${requestListHtml(requests)}
         </div>
       </div>
     </div>`
  );
}

function offerEmailText(opts: {
  customerName: string;
  requests: UpgradeRequestRow[];
  offerText: string;
  discountCode: string;
}): string {
  const { customerName, requests, offerText, discountCode } = opts;
  return [
    "Your homebuyers want the full neighborhood picture",
    "",
    customerName ? `Hi ${customerName},` : "",
    offerText || "Upgrade to Neighborhood Explorer to keep buyers on your site with 38+ hyperlocal insights: prices, commute, walkability, safety, dining, and more.",
    discountCode ? `Discount code: ${discountCode}` : "",
    "",
    `Homebuyer upgrade requests (${requests.length}):`,
    textFromRows(requests),
    "",
    `Upgrade Now: ${SIGNUP_URL}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendUpgradeOfferEmail(input: {
  viewer: UpgradeManagerViewer;
  customerId: string;
  offerText: string;
  discountCode?: string;
}): Promise<{ sent: boolean; recipient: string; requestCount: number }> {
  if (!hasDatabase()) return { sent: false, recipient: "", requestCount: 0 };
  assertCanManageUpgradeOffers(input.viewer);
  await ensureTables();
  await ensureAuthTables();
  const params: unknown[] = [input.customerId];
  let scope = "";
  if (!input.viewer.isOwner) {
    // A partner may only send to a customer currently assigned to them.
    params.push(input.viewer.id);
    scope = ` AND customer.partner_id = $${params.length}`;
  }
  const { rows } = await getPool().query(
    `SELECT
        r.*,
        customer.email AS customer_email,
        customer.business_name,
        customer.partner_id AS customer_partner_id,
        partner.email AS partner_email,
        partner.company_name AS partner_company_name
       FROM app_upgrade_requests r
       LEFT JOIN app_users customer ON customer.id = r.customer_id
       LEFT JOIN app_users partner ON partner.id = r.partner_id
      WHERE r.customer_id = $1${scope}
      ORDER BY r.requested_at ASC`,
    params
  );
  const requests = rows.map(row);
  const first = requests[0];
  if (!first?.customerEmail) throw new Error("No scoped upgrade requests found for this customer.");
  // Prefer the customer's current partner association for the archived record.
  const offerPartnerId = (rows[0] as any)?.customer_partner_id || first.partnerId || null;
  const customerName = first.businessName || first.customerEmail;
  const offerText = input.offerText.trim();
  const discountCode = (input.discountCode || "").trim();
  const subject = "Special offer: Upgrade to Neighborhood Explorer";
  const html = offerEmailHtml({ customerName, requests, offerText, discountCode });
  const text = offerEmailText({ customerName, requests, offerText, discountCode });
  await sendTransactionalEmail({ to: first.customerEmail, subject, text, html });
  await getPool().query(
    `INSERT INTO app_upgrade_offer_emails
       (customer_id, partner_id, sent_by, recipient, customer_name, offer_text, discount_code, request_ids, request_count, html, text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      first.customerId,
      offerPartnerId,
      input.viewer.email,
      first.customerEmail,
      customerName,
      offerText,
      discountCode,
      requests.map((r) => r.id),
      requests.length,
      html,
      text,
    ]
  );
  return { sent: true, recipient: first.customerEmail, requestCount: requests.length };
}

export async function listUpgradeOfferEmails(viewer: UpgradeManagerViewer): Promise<UpgradeOfferEmail[]> {
  if (!hasDatabase()) return [];
  assertCanManageUpgradeOffers(viewer);
  await ensureTables();
  const params: unknown[] = [];
  let scope = "";
  if (!viewer.isOwner) {
    params.push(viewer.id);
    scope = ` WHERE e.partner_id = $1`;
  }
  const { rows } = await getPool().query(
    `SELECT e.*, partner.company_name AS partner_company_name
       FROM app_upgrade_offer_emails e
       LEFT JOIN app_users partner ON partner.id = e.partner_id
       ${scope}
      ORDER BY e.sent_at DESC
      LIMIT 200`,
    params
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    customerId: r.customer_id,
    customerEmail: r.recipient,
    customerName: r.customer_name || r.recipient,
    partnerId: r.partner_id || null,
    partnerCompanyName: r.partner_company_name || null,
    sentByEmail: r.sent_by,
    offerText: r.offer_text || "",
    discountCode: r.discount_code || "",
    requestIds: r.request_ids || [],
    requestCount: Number(r.request_count || 0),
    sentAt: r.sent_at,
  }));
}

// ---------------------------------------------------------------------------
// Per-customer (Realtor) self-reminder emails.
// ---------------------------------------------------------------------------

function cleanReminderDays(v: unknown): number {
  if (v === null || v === undefined || v === "") return DEFAULT_REMINDER_INTERVAL_DAYS;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_REMINDER_INTERVAL_DAYS;
  return Math.max(1, Math.min(90, Math.floor(n)));
}

export async function getReminderSettings(
  userId: string
): Promise<{ intervalDays: number; lastSentAt: string | null }> {
  if (!hasDatabase()) return { intervalDays: DEFAULT_REMINDER_INTERVAL_DAYS, lastSentAt: null };
  await ensureAuthTables();
  const { rows } = await getPool().query(
    `SELECT reminder_interval_days, reminder_last_sent_at FROM app_users WHERE id = $1`,
    [userId]
  );
  return {
    intervalDays: cleanReminderDays(rows[0]?.reminder_interval_days),
    lastSentAt: rows[0]?.reminder_last_sent_at ?? null,
  };
}

export async function setReminderInterval(userId: string, days: number): Promise<number> {
  await ensureAuthTables();
  const clean = cleanReminderDays(days);
  await getPool().query(`UPDATE app_users SET reminder_interval_days = $1 WHERE id = $2`, [clean, userId]);
  return clean;
}

interface SpecialOffer {
  partnerName: string;
  offerText: string;
  discountCode: string;
}

function reminderHtml(opts: {
  template: UpgradeEmailTemplate;
  businessName: string;
  newRequests: UpgradeRequestRow[];
  includedRequests: UpgradeRequestRow[];
  totalViews: number;
  totalRequests: number;
  specialOffer?: SpecialOffer;
}): string {
  const { template, businessName, newRequests, includedRequests, totalViews, totalRequests, specialOffer } = opts;
  const previewRequests = includedRequests.slice(0, REMINDER_REQUEST_PREVIEW_LIMIT);
  const hiddenRequestCount = Math.max(0, includedRequests.length - previewRequests.length);
  const vars = {
    request_count: String(newRequests.length),
    learn_more_url: LEARN_MORE_URL,
    signup_url: SIGNUP_URL,
    partner_name: businessName,
  };
  const subject = fillTemplate(template.subject, vars);
  const intro = fillTemplate(
    !template.intro || template.intro === OLD_CUSTOMER_REMINDER_INTRO ? CUSTOMER_REMINDER_INTRO : template.intro,
    vars
  );
  return emailShell(
    `<div style="display:none;max-height:0;overflow:hidden;color:#f8fafc">
       Your homebuyers want the full neighborhood picture. Upgrade interest and School Explorer usage are inside.
     </div>
     <div style="background:#f8fbf4;border:1px solid #dcebd5;border-radius:26px;overflow:hidden;box-shadow:0 18px 48px rgba(15,81,50,.10)">
       <div style="background:linear-gradient(135deg,#fbfff1 0%,#effdd1 48%,#dcfce7 100%);padding:26px 24px 24px;color:#0f172a;border-bottom:1px solid #d9f99d">
         <div style="display:inline-block;background:#ffffff;border:1px solid #bbf7d0;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:13px;color:#12854c">
           Dream Neighborhood&trade;
         </div>
         <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px;color:#102a1d">${htmlEscape(subject)}</h1>
         <p style="font-size:14px;line-height:1.65;margin:0;color:#31523d">${htmlEscape(intro)}</p>
       </div>

       <div style="padding:20px 22px 6px">
         ${
           specialOffer
             ? `<div style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;border-radius:18px;padding:16px;margin:0 0 16px">
                  <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#9a3412;margin:0 0 6px">Special Offer From ${htmlEscape(specialOffer.partnerName)}</div>
                  <p style="font-size:14px;line-height:1.6;color:#7c2d12;margin:0 0 12px">${htmlEscape(specialOffer.offerText)}</p>
                  <div style="display:inline-block;background:#ffffff;border:1px dashed #fb923c;border-radius:12px;padding:8px 14px">
                    <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9a3412">Offer code</span>
                    <span style="font-size:18px;font-weight:900;color:#0f172a;margin-left:8px;letter-spacing:.04em">${htmlEscape(specialOffer.discountCode)}</span>
                  </div>
                </div>`
             : ""
         }
         <p style="color:#0f172a;font-size:14px;line-height:1.6;margin:0 0 12px">
           <strong>Dream Neighborhood&trade; has two product offerings:</strong>
         </p>
         <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px">
           <tr>
             <td style="background:#ffffff;border:1px solid #dcebd5;border-left:5px solid #12854c;border-radius:16px;padding:14px;vertical-align:top">
               <div style="font-size:13px;font-weight:800;color:#12854c;margin-bottom:4px">School Explorer</div>
               <div style="font-size:12px;line-height:1.55;color:#475569">Free forever, no ads, and no credit card required.</div>
             </td>
           </tr>
           <tr><td style="height:10px"></td></tr>
           <tr>
             <td style="background:#ffffff;border:1px solid #dcebd5;border-left:5px solid #84cc16;border-radius:16px;padding:14px;vertical-align:top">
               <div style="font-size:13px;font-weight:800;color:#3f6212;margin-bottom:4px">Neighborhood Explorer</div>
               <div style="font-size:12px;line-height:1.55;color:#475569">School information plus much more! 38+ hyperlocal neighborhood insights: prices, commute, walkability, safety, dining, and more. Very cost effective.</div>
             </td>
           </tr>
         </table>

         ${
           totalViews > 0
             ? `<div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 16px">
                  <div style="font-size:15px;font-weight:900;color:#0f172a;margin:0 0 4px">Your clients are using the School Explorer!</div>
                  <div style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#12854c;margin:0 0 12px">School Explorer Usage</div>
                  <table role="presentation" style="width:100%;border-collapse:collapse">
                    <tr>
                      <td style="background:#f1f5f9;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                        <div style="font-size:24px;font-weight:900;color:#0f172a;line-height:1">${totalViews.toLocaleString()}</div>
                        <div style="font-size:11px;color:#64748b;line-height:1.3;margin-top:5px">Total homebuyer views</div>
                      </td>
                      <td style="width:8px"></td>
                      <td style="background:#f1f5f9;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                        <div style="font-size:24px;font-weight:900;color:#0f172a;line-height:1">${totalRequests.toLocaleString()}</div>
                        <div style="font-size:11px;color:#64748b;line-height:1.3;margin-top:5px">Total upgrade requests</div>
                      </td>
                      <td style="width:8px"></td>
                      <td style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                        <div style="font-size:24px;font-weight:900;color:#047857;line-height:1">${newRequests.length.toLocaleString()}</div>
                        <div style="font-size:11px;color:#047857;line-height:1.3;margin-top:5px">New since last reminder</div>
                      </td>
                    </tr>
                  </table>
                  ${newRequests.length ? `<p style="color:#64748b;font-size:13px;line-height:1.5;margin:12px 0 0">Your latest requests are summarized at the end of this email.</p>` : ""}
                </div>`
             : `<div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 16px">
                  <div style="font-size:15px;font-weight:900;color:#0f172a;margin:0">Your clients are using the free School Explorer!</div>
                </div>`
         }

         <div style="text-align:center;background:#ffffff;border:1px solid #bbf7d0;border-radius:22px;padding:20px;margin:0 0 16px;box-shadow:0 10px 30px rgba(18,133,76,.10)">
           <div style="font-size:18px;font-weight:900;color:#0f172a;line-height:1.25;margin:0 0 14px">Get the Full neighborhood picture for your homebuyers!</div>
           <table role="presentation" align="center" style="margin:0 auto;border-collapse:collapse"><tr>
             <td style="padding-right:8px">
               <a href="${LEARN_MORE_URL}" style="display:inline-block;background:#ffffff;border:2px solid #12854c;color:#12854c;font-weight:800;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:14px">Learn More</a>
             </td>
             <td>
               <a href="${SIGNUP_URL}" style="display:inline-block;background:#12854c;color:#ffffff;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px;box-shadow:0 8px 18px rgba(18,133,76,.25)">Sign up</a>
             </td>
           </tr></table>
         </div>

         <div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 16px">
           <div style="font-size:14px;font-weight:900;color:#0f5132;margin:0 0 8px">Why this matters for your business</div>
           <ul style="color:#334155;font-size:13px;line-height:1.65;padding-left:18px;margin:0">
             <li>Keep buyers on your site instead of bouncing to Zillow or Realtor.com&trade;</li>
             <li>38+ hyperlocal insights: prices, commute, walkability, safety, dining</li>
             <li>More time on page, better SEO, fewer showings, happier clients</li>
           </ul>
         </div>

         ${
           includedRequests.length
             ? `<div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 14px">
                  <p style="color:#0f172a;font-size:14px;margin:0 0 4px"><strong>Request preview</strong></p>
                  <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 6px">Showing ${previewRequests.length} of ${includedRequests.length.toLocaleString()} request${includedRequests.length === 1 ? "" : "s"}.</p>
                  ${requestListHtml(previewRequests)}
                  ${
                    hiddenRequestCount
                      ? `<p style="color:#475569;font-size:13px;line-height:1.5;margin:8px 0 0">+ ${hiddenRequestCount.toLocaleString()} more request${hiddenRequestCount === 1 ? "" : "s"}. <a href="${REQUESTS_URL}" style="color:#12854c;font-weight:800;text-decoration:none">View all requests</a></p>`
                      : ""
                  }
                </div>`
             : ""
         }

         <p style="text-align:center;margin:0 0 18px">
           <a href="${REQUESTS_URL}" style="display:inline-block;background:#e6f4df;color:#0f5132;font-weight:800;text-decoration:none;padding:9px 14px;border-radius:999px;font-size:12px">Change how often you receive these emails</a>
         </p>
       </div>
     </div>`
  );
}

export async function sendCustomerReminder(
  userId: string,
  opts: { manual?: boolean; includeAll?: boolean } = {}
): Promise<{ sent: boolean; newCount: number; includedCount: number }> {
  if (!hasDatabase() || !userId) return { sent: false, newCount: 0, includedCount: 0 };
  await ensureAuthTables();
  await ensureTables();
  const pool = getPool();
  const u = await pool.query(
    `SELECT email, business_name, company_name, reminder_last_sent_at FROM app_users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const user = u.rows[0];
  if (!user?.email) return { sent: false, newCount: 0, includedCount: 0 };
  const since = user.reminder_last_sent_at || new Date(0).toISOString();

  const newRows = (
    await pool.query(
      `SELECT r.*, cu.email AS customer_email, cu.business_name
         FROM app_upgrade_requests r
         LEFT JOIN app_users cu ON cu.id = r.customer_id
        WHERE r.customer_id = $1 AND r.requested_at > $2
        ORDER BY r.requested_at ASC`,
      [userId, since]
    )
  ).rows.map(row);

  if (!newRows.length && !opts.manual) return { sent: false, newCount: 0, includedCount: 0 };

  const allRows = opts.manual && opts.includeAll
    ? (
        await pool.query(
          `SELECT r.*, cu.email AS customer_email, cu.business_name
             FROM app_upgrade_requests r
             LEFT JOIN app_users cu ON cu.id = r.customer_id
            WHERE r.customer_id = $1
            ORDER BY r.requested_at ASC`,
          [userId]
        )
      ).rows.map(row)
    : newRows;

  const totalViews = Number(
    (await pool.query(`SELECT COALESCE(SUM(views),0)::bigint AS n FROM embed_usage WHERE partner_id = $1`, [userId]))
      .rows[0].n
  ) || 0;
  const totalRequests = Number(
    (await pool.query(`SELECT COUNT(*)::int AS n FROM app_upgrade_requests WHERE customer_id = $1`, [userId])).rows[0].n
  );

  const template = await getUpgradeEmailTemplate("customer_reminder");
  const businessName = user.business_name || user.company_name || "";
  const html = reminderHtml({ template, businessName, newRequests: newRows, includedRequests: allRows, totalViews, totalRequests });
  const intro = !template.intro || template.intro === OLD_CUSTOMER_REMINDER_INTRO ? CUSTOMER_REMINDER_INTRO : template.intro;
  const text = [
    fillTemplate(template.subject, { request_count: String(newRows.length) }),
    "",
    "Dream Neighborhood has two product offerings:",
    "- School Explorer: free forever, no ads, no credit card required.",
    "- Neighborhood Explorer: school information plus much more! 38+ hyperlocal neighborhood insights: prices, commute, walkability, safety, dining, and more. Very cost effective.",
    "",
    fillTemplate(intro, {
      request_count: String(newRows.length),
      learn_more_url: LEARN_MORE_URL,
      signup_url: SIGNUP_URL,
      partner_name: businessName,
    }),
    "",
    totalViews > 0
      ? [
          "Your clients are using the School Explorer!",
          "School Explorer Usage",
          `${totalViews} Total homebuyer views`,
          `${totalRequests} Total upgrade requests`,
          `${newRows.length} New since last reminder`,
          newRows.length ? "Your latest requests are summarized at the end of this email." : "",
        ].join("\n")
      : "Your clients are using the free School Explorer!",
    "",
    "Get the Full neighborhood picture for your homebuyers!",
    `Learn More: ${LEARN_MORE_URL}`,
    `Sign up: ${SIGNUP_URL}`,
    "",
    "Keep buyers on your site instead of bouncing to Zillow or Realtor.com(TM)",
    "38+ hyperlocal insights: prices, commute, walkability, safety, dining",
    "More time on page, better SEO, fewer showings, happier clients",
    "",
    allRows.length
      ? `Request preview (showing ${Math.min(allRows.length, REMINDER_REQUEST_PREVIEW_LIMIT)} of ${allRows.length}):\n${textFromRows(allRows.slice(0, REMINDER_REQUEST_PREVIEW_LIMIT))}`
      : "",
    allRows.length > REMINDER_REQUEST_PREVIEW_LIMIT
      ? `+ ${allRows.length - REMINDER_REQUEST_PREVIEW_LIMIT} more request(s). View all: ${REQUESTS_URL}`
      : "",
    `Change how often you receive these emails: ${REQUESTS_URL}`,
  ].join("\n");

  const subject = fillTemplate(template.subject, { request_count: String(newRows.length) });
  await sendTransactionalEmail({ to: user.email, subject, text, html });
  await archiveEmail({ recipient: user.email, subject, variant: "customer_reminder", audience: "reminder", requestIds: allRows.map((r) => r.id), html, text });
  await pool.query(`UPDATE app_users SET reminder_last_sent_at = NOW() WHERE id = $1`, [userId]);
  return { sent: true, newCount: newRows.length, includedCount: allRows.length };
}

// Partner/admin-initiated email to one of their realtors. Reuses the exact
// realtor reminder email; for "offer" it prepends a "Special Offer From
// {partner}" block. Does NOT reset the realtor's own reminder schedule.
export async function sendPartnerRealtorEmail(input: {
  viewer: UpgradeManagerViewer;
  realtorId: string;
  kind: "reminder" | "offer";
  offerText?: string;
  discountCode?: string;
  preview?: boolean;
}): Promise<{ sent: boolean; recipient: string; requestCount: number; html?: string; subject?: string }> {
  if (!hasDatabase()) return { sent: false, recipient: "", requestCount: 0 };
  assertCanManageUpgradeOffers(input.viewer);
  if (input.kind === "offer" && !input.preview) {
    if (!input.offerText?.trim() || !input.discountCode?.trim()) {
      throw new Error("Offer text and offer code are required for a Special Offer.");
    }
  }
  await ensureAuthTables();
  await ensureTables();
  const pool = getPool();

  // Authorize: a partner may only email a realtor currently assigned to them.
  const uParams: unknown[] = [input.realtorId];
  let uScope = "";
  if (!input.viewer.isOwner) {
    uParams.push(input.viewer.id);
    uScope = ` AND partner_id = $2`;
  }
  const user = (
    await pool.query(
      `SELECT id, email, business_name, company_name, reminder_last_sent_at
         FROM app_users WHERE id = $1 AND deleted_at IS NULL${uScope}`,
      uParams
    )
  ).rows[0];
  if (!user?.email) throw new Error("Realtor not found in your account.");

  const since = user.reminder_last_sent_at || new Date(0).toISOString();
  const newRows = (
    await pool.query(
      `SELECT r.*, cu.email AS customer_email, cu.business_name
         FROM app_upgrade_requests r LEFT JOIN app_users cu ON cu.id = r.customer_id
        WHERE r.customer_id = $1 AND r.requested_at > $2 ORDER BY r.requested_at ASC`,
      [input.realtorId, since]
    )
  ).rows.map(row);
  const allRows = (
    await pool.query(
      `SELECT r.*, cu.email AS customer_email, cu.business_name
         FROM app_upgrade_requests r LEFT JOIN app_users cu ON cu.id = r.customer_id
        WHERE r.customer_id = $1 ORDER BY r.requested_at ASC`,
      [input.realtorId]
    )
  ).rows.map(row);
  const totalViews = Number(
    (await pool.query(`SELECT COALESCE(SUM(views),0)::bigint AS n FROM embed_usage WHERE partner_id = $1`, [input.realtorId])).rows[0].n
  ) || 0;
  const totalRequests = Number(
    (await pool.query(`SELECT COUNT(*)::int AS n FROM app_upgrade_requests WHERE customer_id = $1`, [input.realtorId])).rows[0].n
  );

  // Partner display name for the special-offer header.
  let partnerName = "Dream Neighborhood";
  if (!input.viewer.isOwner) {
    const p = (await pool.query(`SELECT company_name, email FROM app_users WHERE id = $1`, [input.viewer.id])).rows[0];
    partnerName = (p?.company_name || "").trim() || p?.email || input.viewer.email;
  }

  const template = await getUpgradeEmailTemplate("customer_reminder");
  const businessName = user.business_name || user.company_name || "";
  const specialOffer =
    input.kind === "offer"
      ? { partnerName, offerText: (input.offerText || "").trim() || "Your special offer text will appear here.", discountCode: (input.discountCode || "").trim() || "OFFERCODE" }
      : undefined;
  const html = reminderHtml({ template, businessName, newRequests: newRows, includedRequests: allRows, totalViews, totalRequests, specialOffer });
  const subject =
    input.kind === "offer"
      ? `Special offer from ${partnerName}: Upgrade to Neighborhood Explorer`
      : fillTemplate(template.subject, { request_count: String(newRows.length) });
  const text = [
    subject,
    specialOffer ? `\nSpecial Offer From ${partnerName}\n${specialOffer.offerText}\nOffer code: ${specialOffer.discountCode}\n` : "",
    `School Explorer usage — ${totalViews} views, ${totalRequests} total upgrade requests.`,
    `Get the full neighborhood picture: ${SIGNUP_URL}`,
  ].filter(Boolean).join("\n");

  // Preview only: return the rendered email without sending or recording.
  if (input.preview) {
    return { sent: false, recipient: user.email, requestCount: allRows.length, html, subject };
  }

  await sendTransactionalEmail({ to: user.email, subject, text, html });
  if (input.kind === "offer") {
    await pool.query(
      `INSERT INTO app_upgrade_offer_emails
         (customer_id, partner_id, sent_by, recipient, customer_name, offer_text, discount_code, request_ids, request_count, html, text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        input.realtorId,
        input.viewer.isOwner ? null : input.viewer.id,
        input.viewer.email,
        user.email,
        businessName || user.email,
        specialOffer!.offerText,
        specialOffer!.discountCode,
        allRows.map((r) => r.id),
        allRows.length,
        html,
        text,
      ]
    );
  } else {
    await archiveEmail({ recipient: user.email, subject, variant: "customer_reminder", audience: "partner_reminder", requestIds: allRows.map((r) => r.id), html, text });
  }
  return { sent: true, recipient: user.email, requestCount: allRows.length };
}

// Partner-focused email (admin → a partner). Same visual design as the realtor
// reminder, but the copy is about getting their realtors' clients to upgrade,
// with aggregated stats across the partner's whole book of business.
function partnerEmailHtml(opts: {
  partnerName: string;
  totalViews: number;
  totalRequests: number;
  realtorCount: number;
  specialOffer?: { offerText: string; discountCode: string };
}): string {
  const { partnerName, totalViews, totalRequests, realtorCount, specialOffer } = opts;
  const intro =
    "Homebuyers across your realtors' websites are asking for the full Neighborhood Explorer — home prices, commute, walkability, safety, dining, and 38+ hyperlocal insights. Encourage your realtors to upgrade their clients so they stay on their sites instead of leaving for Realtor.com\u2122.";
  return emailShell(
    `<div style="background:#f8fbf4;border:1px solid #dcebd5;border-radius:26px;overflow:hidden;box-shadow:0 18px 48px rgba(15,81,50,.10)">
       <div style="background:linear-gradient(135deg,#fbfff1 0%,#effdd1 48%,#dcfce7 100%);padding:26px 24px 24px;color:#0f172a;border-bottom:1px solid #d9f99d">
         <div style="display:inline-block;background:#ffffff;border:1px solid #bbf7d0;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:13px;color:#12854c">Dream Neighborhood&trade; · Partner</div>
         <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px;color:#102a1d">Your realtors' homebuyers want the full neighborhood picture</h1>
         <p style="font-size:14px;line-height:1.65;margin:0;color:#31523d">${htmlEscape(intro)}</p>
       </div>

       <div style="padding:20px 22px 6px">
         ${
           specialOffer
             ? `<div style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;border-radius:18px;padding:16px;margin:0 0 16px">
                  <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#9a3412;margin:0 0 6px">Share this offer with your realtors</div>
                  <p style="font-size:13px;line-height:1.6;color:#7c2d12;margin:0 0 10px">Forward the code and message below to your realtors so their homebuyers can upgrade at a discount.</p>
                  <p style="font-size:14px;line-height:1.6;color:#7c2d12;margin:0 0 12px">${htmlEscape(specialOffer.offerText)}</p>
                  <div style="display:inline-block;background:#ffffff;border:1px dashed #fb923c;border-radius:12px;padding:8px 14px">
                    <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9a3412">Offer code</span>
                    <span style="font-size:18px;font-weight:900;color:#0f172a;margin-left:8px;letter-spacing:.04em">${htmlEscape(specialOffer.discountCode)}</span>
                  </div>
                </div>`
             : ""
         }
         <p style="color:#0f172a;font-size:14px;line-height:1.6;margin:0 0 12px">
           <strong>Dream Neighborhood&trade; has two product offerings:</strong>
         </p>
         <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px">
           <tr>
             <td style="background:#ffffff;border:1px solid #dcebd5;border-left:5px solid #12854c;border-radius:16px;padding:14px;vertical-align:top">
               <div style="font-size:13px;font-weight:800;color:#12854c;margin-bottom:4px">School Explorer</div>
               <div style="font-size:12px;line-height:1.55;color:#475569">Free forever, no ads, and no credit card required.</div>
             </td>
           </tr>
           <tr><td style="height:10px"></td></tr>
           <tr>
             <td style="background:#ffffff;border:1px solid #dcebd5;border-left:5px solid #84cc16;border-radius:16px;padding:14px;vertical-align:top">
               <div style="font-size:13px;font-weight:800;color:#3f6212;margin-bottom:4px">Neighborhood Explorer</div>
               <div style="font-size:12px;line-height:1.55;color:#475569">School information plus much more! 38+ hyperlocal neighborhood insights: prices, commute, walkability, safety, dining, and more. Very cost effective.</div>
             </td>
           </tr>
         </table>

         <div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 16px">
           <div style="font-size:15px;font-weight:900;color:#0f172a;margin:0 0 4px">Your realtors are using the School Explorer!</div>
           <div style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#12854c;margin:0 0 12px">School Explorer Usage</div>
           <table role="presentation" style="width:100%;border-collapse:collapse">
             <tr>
               <td style="background:#f1f5f9;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                 <div style="font-size:24px;font-weight:900;color:#0f172a;line-height:1">${totalViews.toLocaleString()}</div>
                 <div style="font-size:11px;color:#64748b;line-height:1.3;margin-top:5px">Total homebuyer views</div>
               </td>
               <td style="width:8px"></td>
               <td style="background:#f1f5f9;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                 <div style="font-size:24px;font-weight:900;color:#0f172a;line-height:1">${totalRequests.toLocaleString()}</div>
                 <div style="font-size:11px;color:#64748b;line-height:1.3;margin-top:5px">Total upgrade requests</div>
               </td>
               <td style="width:8px"></td>
               <td style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;padding:14px 8px;text-align:center;width:33.333%">
                 <div style="font-size:24px;font-weight:900;color:#047857;line-height:1">${realtorCount.toLocaleString()}</div>
                 <div style="font-size:11px;color:#047857;line-height:1.3;margin-top:5px">Realtors on School Explorer</div>
               </td>
             </tr>
           </table>
         </div>

         <div style="text-align:center;background:#ffffff;border:1px solid #bbf7d0;border-radius:22px;padding:20px;margin:0 0 16px;box-shadow:0 10px 30px rgba(18,133,76,.10)">
           <div style="font-size:18px;font-weight:900;color:#0f172a;line-height:1.25;margin:0 0 14px">Help your realtors give homebuyers the full neighborhood picture!</div>
           <table role="presentation" align="center" style="margin:0 auto;border-collapse:collapse"><tr>
             <td style="padding-right:8px">
               <a href="${LEARN_MORE_URL}" style="display:inline-block;background:#ffffff;border:2px solid #12854c;color:#12854c;font-weight:800;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:14px">Learn More</a>
             </td>
             <td>
               <a href="${SIGNUP_URL}" style="display:inline-block;background:#12854c;color:#ffffff;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px;box-shadow:0 8px 18px rgba(18,133,76,.25)">See Neighborhood Explorer</a>
             </td>
           </tr></table>
         </div>

         <div style="background:#ffffff;border:1px solid #dcebd5;border-radius:20px;padding:16px;margin:0 0 16px">
           <div style="font-size:14px;font-weight:900;color:#0f5132;margin:0 0 8px">Why this matters for your realtors</div>
           <ul style="color:#334155;font-size:13px;line-height:1.65;padding-left:18px;margin:0">
             <li>Help your realtors keep buyers on their sites instead of bouncing to Zillow or Realtor.com&trade;</li>
             <li>38+ hyperlocal insights: prices, commute, walkability, safety, dining</li>
             <li>More time on page, better SEO, fewer showings, happier clients</li>
           </ul>
         </div>
       </div>
     </div>`
  );
}

export async function sendPartnerTargetedEmail(input: {
  viewer: UpgradeManagerViewer;
  partnerId: string;
  kind: "reminder" | "offer";
  offerText?: string;
  discountCode?: string;
  preview?: boolean;
}): Promise<{ sent: boolean; recipient: string; requestCount: number; html?: string; subject?: string }> {
  if (!hasDatabase()) return { sent: false, recipient: "", requestCount: 0 };
  if (!input.viewer.isOwner) throw new Error("Admin access required to email a partner.");
  if (input.kind === "offer" && !input.preview) {
    if (!input.offerText?.trim() || !input.discountCode?.trim()) {
      throw new Error("Suggested text and offer code are required for a Special Offer.");
    }
  }
  await ensureAuthTables();
  await ensureTables();
  const pool = getPool();

  const partner = (
    await pool.query(
      `SELECT id, email, company_name FROM app_users WHERE id = $1 AND is_partner = TRUE AND deleted_at IS NULL`,
      [input.partnerId]
    )
  ).rows[0];
  if (!partner?.email) throw new Error("Partner not found.");
  const partnerName = (partner.company_name || "").trim() || partner.email;

  const totalViews = Number(
    (await pool.query(
      `SELECT COALESCE(SUM(views),0)::bigint AS n FROM embed_usage
        WHERE partner_id IN (SELECT id FROM app_users WHERE partner_id = $1)`,
      [input.partnerId]
    )).rows[0].n
  ) || 0;
  const totalRequests = Number(
    (await pool.query(
      `SELECT COUNT(*)::int AS n FROM app_upgrade_requests
        WHERE customer_id IN (SELECT id FROM app_users WHERE partner_id = $1)`,
      [input.partnerId]
    )).rows[0].n
  );
  const realtorCount = Number(
    (await pool.query(
      `SELECT COUNT(*)::int AS n FROM app_users
        WHERE partner_id = $1 AND deleted_at IS NULL AND is_owner = FALSE AND is_partner = FALSE`,
      [input.partnerId]
    )).rows[0].n
  );

  const specialOffer =
    input.kind === "offer"
      ? { offerText: (input.offerText || "").trim() || "Your suggested message to realtors will appear here.", discountCode: (input.discountCode || "").trim() || "OFFERCODE" }
      : undefined;
  const html = partnerEmailHtml({ partnerName, totalViews, totalRequests, realtorCount, specialOffer });
  const subject = input.kind === "offer" ? "A special offer to share with your realtors" : "Your realtors' homebuyers want the full neighborhood picture";
  const text = [
    subject,
    specialOffer ? `\nShare this offer with your realtors\n${specialOffer.offerText}\nOffer code: ${specialOffer.discountCode}\n` : "",
    `Across your realtors: ${totalViews} homebuyer views, ${totalRequests} upgrade requests, ${realtorCount} realtors on the School Explorer.`,
    `Learn more: ${LEARN_MORE_URL}`,
  ].filter(Boolean).join("\n");

  if (input.preview) {
    return { sent: false, recipient: partner.email, requestCount: totalRequests, html, subject };
  }

  await sendTransactionalEmail({ to: partner.email, subject, text, html });
  if (input.kind === "offer") {
    await pool.query(
      `INSERT INTO app_upgrade_offer_emails
         (customer_id, partner_id, sent_by, recipient, customer_name, offer_text, discount_code, request_ids, request_count, html, text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [input.partnerId, input.partnerId, input.viewer.email, partner.email, partnerName, specialOffer!.offerText, specialOffer!.discountCode, [], totalRequests, html, text]
    );
  } else {
    await archiveEmail({ recipient: partner.email, subject, variant: "partner_target", audience: "partner_target", requestIds: [], html, text });
  }
  return { sent: true, recipient: partner.email, requestCount: totalRequests };
}

export async function runDueCustomerReminders(now = new Date()): Promise<{ processed: number }> {
  if (!hasDatabase()) return { processed: 0 };
  await ensureAuthTables();
  await ensureTables();
  const pool = getPool();
  // Realtor/customer accounts with at least one request, whose reminder interval
  // has elapsed since their last reminder (or since account creation).
  const { rows } = await pool.query(
    `SELECT u.id,
            COALESCE(u.reminder_interval_days, $1) AS interval_days,
            COALESCE(u.reminder_last_sent_at, u.created_at) AS anchor
       FROM app_users u
      WHERE u.deleted_at IS NULL AND u.is_owner = FALSE
        AND EXISTS (SELECT 1 FROM app_upgrade_requests r WHERE r.customer_id = u.id)`,
    [DEFAULT_REMINDER_INTERVAL_DAYS]
  );
  let processed = 0;
  for (const r of rows) {
    const due = now.getTime() - new Date(r.anchor).getTime() >= Number(r.interval_days) * 86400000;
    if (!due) continue;
    const res = await sendCustomerReminder(r.id);
    if (res.sent) processed += 1;
  }
  return { processed };
}

export async function runScheduledUpgradeDigest(): Promise<{ due: boolean; sentTo: string[]; requestCount: number }> {
  if (!(await isDigestDue())) return { due: false, sentTo: [], requestCount: 0 };
  const pending = await listUpgradeRequests({ includeSent: false });
  if (!pending.length) {
    await markDigestRun();
    return { due: true, sentTo: [], requestCount: 0 };
  }
  const result = await sendUpgradeDigestNow("soft_nudge");
  return { due: true, ...result };
}
