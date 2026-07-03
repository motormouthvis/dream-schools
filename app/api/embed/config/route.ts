import { preflight, withCors } from "@/lib/embedCors";
import { presentationPayload, resolveByHost } from "@/lib/embedConfig";
import { recordUsageAsync } from "@/lib/embedUsage";
import { getPool, hasDatabase } from "@/lib/db";
import { getGlobalUpgradeSettings, REQUEST_SUPPRESS_DAYS } from "@/lib/upgradePrompt";
import { ensureAuthTables } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Resolve the embeddable widget config for a host in one round-trip.
//
//   GET /api/embed/config?host=example.com&widget_number=1
//
// Returns the presentation payload (accent, position, options, ...) plus the
// resolved partnerId / widgetNumber and the per-customer default address used
// as a fallback when page scraping finds nothing. Unknown hosts get a
// permissive default so a freshly-pasted snippet still renders.

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = (searchParams.get("host") || "").trim();
  const widgetRaw = (searchParams.get("widget_number") || "1").trim();

  if (!host) {
    return withCors(request, { error: "host query parameter is required" }, { status: 400 });
  }
  const widgetNumber = Number.parseInt(widgetRaw, 10);
  if (!Number.isFinite(widgetNumber)) {
    return withCors(request, { error: "widget_number must be an integer" }, { status: 400 });
  }

  const config = await resolveByHost(host, widgetNumber);
  if (!config.enabled) {
    const res = withCors(request, { enabled: false, reason: "disabled" });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Count this resolution as one view / "code detected" signal for the customer.
  // Fire-and-forget so the widget response stays fast.
  recordUsageAsync(config.partnerId, config.widgetNumber);

  let providerName = "";
  let businessName = "";
  let partnerId: string | null = null;
  let partnerOverride: { viewsToTrigger: number | null; minDaysBetween: number | null; idleSeconds: number | null } = {
    viewsToTrigger: null,
    minDaysBetween: null,
    idleSeconds: null,
  };
  if (hasDatabase() && !config.partnerId.startsWith("host:")) {
    try {
      await ensureAuthTables();
      const { rows } = await getPool().query(
        `SELECT
            u.business_name,
            u.partner_id,
            COALESCE(NULLIF(partner.company_name, ''), NULLIF(u.company_name, ''), NULLIF(u.business_name, '')) AS provider_name,
            partner.upgrade_views_to_trigger,
            partner.upgrade_min_days_between,
            partner.upgrade_idle_seconds
           FROM app_users u
           LEFT JOIN app_users partner ON partner.id = u.partner_id
          WHERE u.id = $1`,
        [config.partnerId]
      );
      providerName = rows[0]?.provider_name || "";
      businessName = rows[0]?.business_name || "";
      partnerId = rows[0]?.partner_id || null;
      partnerOverride = {
        viewsToTrigger: rows[0]?.upgrade_views_to_trigger == null ? null : Number(rows[0].upgrade_views_to_trigger),
        minDaysBetween: rows[0]?.upgrade_min_days_between == null ? null : Number(rows[0].upgrade_min_days_between),
        idleSeconds: rows[0]?.upgrade_idle_seconds == null ? null : Number(rows[0].upgrade_idle_seconds),
      };
    } catch (err) {
      console.error("providerName lookup failed:", err);
    }
  }
  const globalUpgrade = await getGlobalUpgradeSettings();
  const upgradePrompt = {
    enabled: true,
    viewsToTrigger: partnerOverride.viewsToTrigger ?? globalUpgrade.viewsToTrigger,
    minDaysBetween: partnerOverride.minDaysBetween ?? globalUpgrade.minDaysBetween,
    idleSeconds: partnerOverride.idleSeconds ?? globalUpgrade.idleSeconds,
    requestSuppressDays:
      (partnerOverride.minDaysBetween ?? globalUpgrade.minDaysBetween) === 0
        ? 0
        : REQUEST_SUPPRESS_DAYS,
  };

  const payload = {
    enabled: true,
    partnerId: config.partnerId,
    widgetNumber: config.widgetNumber,
    defaultAddress: config.defaultAddress || "",
    providerName,
    businessName,
    customerId: config.partnerId,
    customerPartnerId: partnerId,
    upgradePrompt,
    ...presentationPayload(config),
  };
  const res = withCors(request, payload);
  res.headers.set("Cache-Control", "public, max-age=60");
  return res;
}
