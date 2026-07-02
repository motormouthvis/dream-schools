import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  requireOwner,
  requireCustomerListAccess,
  listCustomers,
  listPartnerAccounts,
  updateCustomerAccount,
  deleteCustomer,
  restoreCustomer,
} from "@/lib/owner";
import {
  getByPartner,
  upsertPartner,
  claimHostForPartner,
  hostsClaimedByOthers,
  normalizeHost,
  DEFAULT_PRESENTATION,
} from "@/lib/embedConfig";
import { isValidEmail, getUserById } from "@/lib/auth";
import { logUserEventAsync } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Admin/partner customer listing + admin-only CRUD over customer accounts.
//
//   GET    /api/owner/customers                → list customers + usage
//   PATCH  /api/owner/customers  { id, ... }   → edit account + widget config
//   DELETE /api/owner/customers?id=            → delete a customer

async function guard(request: Request) {
  if (!hasDatabase()) {
    return { error: NextResponse.json({ error: "Database required." }, { status: 503 }) };
  }
  const owner = await requireOwner(request);
  if (!owner) {
    return { error: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  }
  return { owner };
}

async function listGuard(request: Request) {
  if (!hasDatabase()) {
    return { error: NextResponse.json({ error: "Database required." }, { status: 503 }) };
  }
  const user = await requireCustomerListAccess(request);
  if (!user) {
    return { error: NextResponse.json({ error: "Customer List access required." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const g = await listGuard(request);
  if (g.error) return g.error;
  try {
    const customers = await listCustomers(g.user);
    const partners = g.user!.isOwner ? await listPartnerAccounts() : [];
    return NextResponse.json({ customers, partners, canEdit: g.user!.isOwner });
  } catch (err) {
    console.error("owner list failed:", err);
    return NextResponse.json({ error: "Failed to list customers." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "Customer id is required." }, { status: 400 });

  try {
    if (body.action === "restore") {
      const reason = String(body.reason || "").trim();
      const restored = await restoreCustomer(id, reason || undefined);
      return NextResponse.json({ restored });
    }

    // Account-level fields.
    const accountFields: {
      email?: string;
      isOwner?: boolean;
      isPartner?: boolean;
      partnerId?: string | null;
      companyName?: string;
    } = {};
    if (typeof body.email === "string") {
      if (!isValidEmail(body.email)) {
        return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      }
      accountFields.email = body.email;
    }
    if (typeof body.isOwner === "boolean") accountFields.isOwner = body.isOwner;
    if (typeof body.isPartner === "boolean") accountFields.isPartner = body.isPartner;
    if (typeof body.companyName === "string") accountFields.companyName = body.companyName;
    if (body.partnerId !== undefined) {
      const nextPartnerId = String(body.partnerId || "").trim() || null;
      accountFields.partnerId = nextPartnerId === id ? null : nextPartnerId;
    }
    if (Object.keys(accountFields).length) {
      const before = await getUserById(id);
      await updateCustomerAccount(id, accountFields);
      if (before && accountFields.email && before.email !== accountFields.email) {
        logUserEventAsync(id, "email_changed", `${before.email} → ${accountFields.email} (by owner)`);
      }
      if (before && "partnerId" in accountFields && before.partnerId !== accountFields.partnerId) {
        logUserEventAsync(id, "partner_assignment_changed", `${before.partnerId || "(none)"} → ${accountFields.partnerId || "(none)"} (by admin)`);
      }
      if (before && typeof accountFields.isPartner === "boolean" && before.isPartner !== accountFields.isPartner) {
        logUserEventAsync(id, "partner_status_changed", `${before.isPartner ? "partner" : "customer"} → ${accountFields.isPartner ? "partner" : "customer"} (by admin)`);
      }
    }

    // Widget config fields — merge onto existing so we don't clobber styling.
    const touchesWidget =
      body.authorizedDomain !== undefined ||
      body.enabled !== undefined ||
      body.defaultAddress !== undefined;
    if (touchesWidget) {
      const existing = await getByPartner(id, 1);
      const base = existing ?? { ...DEFAULT_PRESENTATION, defaultAddress: "", enabled: false };
      const allowedHosts =
        body.authorizedDomain !== undefined
          ? [normalizeHost(String(body.authorizedDomain))].filter(Boolean)
          : existing?.allowedHosts ?? [];
      // A domain can only belong to one account.
      if (allowedHosts.length) {
        const taken = await hostsClaimedByOthers(allowedHosts, id);
        if (taken.length) {
          return NextResponse.json(
            {
              error: `${taken.join(", ")} is already registered to another account. Each domain can belong to only one account.`,
            },
            { status: 409 }
          );
        }
      }
      const saved = await upsertPartner({
        partnerId: id,
        widgetNumber: 1,
        allowedHosts,
        defaultAddress:
          typeof body.defaultAddress === "string"
            ? body.defaultAddress
            : existing?.defaultAddress ?? "",
        accentColor: base.accentColor,
        position: base.position,
        bottomOffset: base.bottomOffset,
        tooltipMessage: base.tooltipMessage,
        requireAddress: base.requireAddress,
        searchPageContent: base.searchPageContent,
        suppressOnInline: base.suppressOnInline,
        suppressIfNeighborhoodExplorer: base.suppressIfNeighborhoodExplorer,
        inlineMinHeight: base.inlineMinHeight,
        inlineShowHeader: base.inlineShowHeader,
        showExternalLinks: base.showExternalLinks,
        // Popup stays off until a domain is authorized.
        enabled:
          allowedHosts.length > 0
            ? typeof body.enabled === "boolean"
              ? body.enabled
              : base.enabled
            : false,
      });
      const priorDomain = existing?.allowedHosts?.[0] ?? "";
      const nextDomain = saved.allowedHosts?.[0] ?? "";
      if (priorDomain !== nextDomain) {
        logUserEventAsync(id, "domain_changed", `${priorDomain || "(none)"} → ${nextDomain || "(none)"} (by admin)`);
      }
      if ((existing?.defaultAddress ?? "") !== (saved.defaultAddress ?? "")) {
        logUserEventAsync(
          id,
          "default_address_changed",
          `${existing?.defaultAddress || "(none)"} → ${saved.defaultAddress || "(none)"} (by admin)`
        );
      }
      if (existing && Boolean(existing.enabled) !== Boolean(saved.enabled)) {
        logUserEventAsync(
          id,
          "explorer_enabled_changed",
          `${existing.enabled ? "on" : "off"} → ${saved.enabled ? "on" : "off"} (by admin)`
        );
      }
      if (allowedHosts.length) {
        await claimHostForPartner(id, allowedHosts).catch((err) =>
          console.error("claimHostForPartner failed:", err)
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Unique-violation on email → friendly message.
    if (err?.code === "23505") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    console.error("owner edit failed:", err);
    return NextResponse.json({ error: "Failed to save customer." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Customer id is required." }, { status: 400 });
  if (id === g.owner!.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  try {
    let reason = "";
    try {
      const body = await request.json();
      reason = String(body?.reason || "").trim();
    } catch {
      // DELETE bodies are optional.
    }
    const deleted = await deleteCustomer(id, reason || undefined);
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("owner delete failed:", err);
    return NextResponse.json({ error: "Failed to delete customer." }, { status: 500 });
  }
}
