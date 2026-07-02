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

export type UpgradeDigestVariant = "soft_nudge" | "strong_sales" | "partner_summary" | "admin_summary";

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
    minDaysBetween: cleanInt(r?.min_days_between, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 1, 365),
    idleSeconds: cleanInt(r?.idle_seconds, DEFAULT_UPGRADE_IDLE_SECONDS, 3, 60),
  };
}

export async function setGlobalUpgradeSettings(values: UpgradePromptSettings): Promise<UpgradePromptSettings> {
  await ensureTables();
  const cleaned = {
    viewsToTrigger: cleanInt(values.viewsToTrigger, DEFAULT_UPGRADE_VIEWS_TO_TRIGGER, 1, 50),
    minDaysBetween: cleanInt(values.minDaysBetween, DEFAULT_UPGRADE_MIN_DAYS_BETWEEN, 1, 365),
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

export async function listUpgradeRequests(options: { includeSent?: boolean } = {}): Promise<UpgradeRequestRow[]> {
  if (!hasDatabase()) return [];
  await ensureTables();
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
      ORDER BY r.requested_at DESC`,
    [Boolean(options.includeSent)]
  );
  return rows.map(row);
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

function customerDigestHtml(items: UpgradeRequestRow[], variant: UpgradeDigestVariant): string {
  const count = items.length;
  const strong = variant === "strong_sales";
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">${strong ? "Your visitors are asking for more neighborhood data" : "A visitor requested full neighborhood access"}</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       ${strong
         ? "People are leaving real-estate sites for Zillow and realtor.com because they want richer neighborhood answers. Dream Neighborhood gives them a more complete picture directly on your website — keeping them engaged with you."
         : "Someone browsing your website asked for the full Neighborhood Explorer experience. This is a warm signal that your visitors want deeper neighborhood insight while they are already on your site."}
     </p>
     <p style="color:#0f172a;font-size:14px;margin:0"><strong>${count}</strong> request${count === 1 ? "" : "s"} this period:</p>
     ${requestListHtml(items)}
     <p style="color:#475569;font-size:14px;line-height:1.6">
       Become the hero for your clients by providing what they want: home prices, commute, walkability, safety, dining, lifestyle, and more — all without sending them away from your site.
     </p>`
  );
}

function partnerDigestHtml(partnerName: string, items: UpgradeRequestRow[]): string {
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">Neighborhood Explorer requests for ${htmlEscape(partnerName || "your partner account")}</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       Customers under your partner account had visitors request full Neighborhood Explorer access.
       These are strong upgrade opportunities for the Realtors you support.
     </p>
     ${requestListHtml(items)}`
  );
}

function adminDigestHtml(items: UpgradeRequestRow[]): string {
  const byCustomer = groupBy(items, (r) => r.customerEmail || r.customerId);
  return emailShell(
    `<h1 style="font-size:20px;margin:0 0 8px">Admin follow-up: Neighborhood Explorer upgrade requests</h1>
     <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">
       ${items.length} request${items.length === 1 ? "" : "s"} need follow-up across ${byCustomer.size} customer account${byCustomer.size === 1 ? "" : "s"}.
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
  const byCustomer = groupBy(requests, (r) => r.customerId);
  for (const rows of byCustomer.values()) {
    const to = rows[0].customerEmail;
    if (!to) continue;
    await sendTransactionalEmail({
      to,
      subject: "Your website visitors requested full Neighborhood Explorer access",
      text: textFromRows(rows),
      html: customerDigestHtml(rows, variant),
    });
    sentTo.add(to);
  }

  const byPartner = groupBy(
    requests.filter((r) => r.partnerEmail),
    (r) => r.partnerId || r.partnerEmail || ""
  );
  for (const rows of byPartner.values()) {
    const to = rows[0].partnerEmail;
    if (!to) continue;
    await sendTransactionalEmail({
      to,
      subject: "Partner summary: Neighborhood Explorer requests",
      text: textFromRows(rows),
      html: partnerDigestHtml(rows[0].partnerCompanyName || rows[0].partnerEmail || "", rows),
    });
    sentTo.add(to);
  }

  const admins = ownerEmails();
  if (admins.length) {
    await sendTransactionalEmail({
      to: admins.join(","),
      subject: "Admin follow-up: Neighborhood Explorer upgrade requests",
      text: textFromRows(requests),
      html: adminDigestHtml(requests),
    });
    admins.forEach((e) => sentTo.add(e));
  }

  await getPool().query(
    `UPDATE app_upgrade_requests SET summary_sent_at = NOW()
      WHERE id = ANY($1::bigint[])`,
    [requests.map((r) => r.id)]
  );
  return { sentTo: Array.from(sentTo), requestCount: requests.length };
}
