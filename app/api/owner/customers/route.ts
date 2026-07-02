import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import {
  requireOwner,
  listCustomers,
  updateCustomerAccount,
  deleteCustomer,
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

// Owner-only CRUD over customer accounts (same-origin; no CORS).
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

export async function GET(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
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
    // Account-level fields.
    const accountFields: { email?: string; isOwner?: boolean } = {};
    if (typeof body.email === "string") {
      if (!isValidEmail(body.email)) {
        return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      }
      accountFields.email = body.email;
    }
    if (typeof body.isOwner === "boolean") accountFields.isOwner = body.isOwner;
    if (Object.keys(accountFields).length) {
      const before = accountFields.email ? await getUserById(id) : null;
      await updateCustomerAccount(id, accountFields);
      if (before && accountFields.email && before.email !== accountFields.email) {
        logUserEventAsync(id, "email_changed", `${before.email} → ${accountFields.email} (by owner)`);
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
      await upsertPartner({
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
    const deleted = await deleteCustomer(id);
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("owner delete failed:", err);
    return NextResponse.json({ error: "Failed to delete customer." }, { status: 500 });
  }
}
