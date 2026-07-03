import { getPool, hasDatabase } from "@/lib/db";
import { emailShell, htmlEscape, sendTransactionalEmail } from "@/lib/email";

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
          `CREATE INDEX IF NOT EXISTS app_upgrade_requests_customer_idx
             ON app_upgrade_requests(customer_id, requested_at)`
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

function cleanInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

const LEARN_MORE_URL = "https://www.dreamneighborhood.com";
const SIGNUP_URL = "https://app.dreamneighborhood.com";

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
};

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

export async function listUpgradeRequests(options: { includeSent?: boolean; limit?: number; viewer?: { id: string; isOwner: boolean; isPartner: boolean } | null } = {}): Promise<UpgradeRequestRow[]> {
  if (!hasDatabase()) return [];
  await ensureTables();
  const params: unknown[] = [Boolean(options.includeSent)];
  let scope = "";
  if (options.viewer && !options.viewer.isOwner) {
    if (options.viewer.isPartner) {
      params.push(options.viewer.id);
      scope = ` AND r.partner_id = $${params.length}`;
    } else {
      params.push(options.viewer.id);
      scope = ` AND r.customer_id = $${params.length}`;
    }
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
  viewer?: { id: string; isOwner: boolean; isPartner: boolean } | null
): Promise<{ total: number; pending: number; sent: number }> {
  if (!hasDatabase()) return { total: 0, pending: 0, sent: 0 };
  await ensureTables();
  const params: unknown[] = [];
  let scope = "";
  if (viewer && !viewer.isOwner) {
    params.push(viewer.id);
    scope = viewer.isPartner ? ` WHERE r.partner_id = $1` : ` WHERE r.customer_id = $1`;
  }
  const { rows } = await getPool().query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.summary_sent_at IS NULL)::int AS pending,
        COUNT(*) FILTER (WHERE r.summary_sent_at IS NOT NULL)::int AS sent
       FROM app_upgrade_requests r${scope}`,
    params
  );
  return { total: rows[0].total, pending: rows[0].pending, sent: rows[0].sent };
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
