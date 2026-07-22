"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { AddressAutocomplete } from "@/components/app/AddressAutocomplete";

// Close a modal when the Escape key is pressed.
function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

interface Customer {
  id: string;
  email: string;
  emailVerified: boolean;
  isOwner: boolean;
  isPartner: boolean;
  partnerId: string | null;
  partnerName: string | null;
  companyName: string;
  businessName: string;
  createdAt: string;
  deletedAt: string | null;
  authorizedDomain: string | null;
  enabled: boolean;
  defaultAddress: string;
  views: number;
  upgradeRequests: number;
  upgraded: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
}

interface PartnerOption {
  id: string;
  email: string;
  companyName: string;
}

type SortKey = "customer" | "createdAt" | "views" | "upgradeRequests" | "firstSeen" | "lastSeen" | "partnerName" | "domain" | "status" | "upgraded";
type SortDir = "asc" | "desc";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OwnerPage() {
  return (
    <AppShell active="owner">
      {(me) => (me.isOwner || me.isPartner ? <OwnerAdmin /> : <NotAuthorized />)}
    </AppShell>
  );
}

function NotAuthorized() {
  return (
    <>
      <h1 className="text-xl font-extrabold text-ink-900">Not authorized</h1>
      <p className="mt-2 text-sm text-slate-600">This area is for admins only.</p>
    </>
  );
}

function OwnerAdmin() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState<"owner" | "partner">("partner");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [reasonAction, setReasonAction] = useState<null | { type: "disable"; customer: Customer }>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const modalOpen = Boolean(editing || historyFor || reasonAction || adding || importing);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/customers");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not load customers.");
        return;
      }
      setCustomers(j.customers || []);
      setPartners(j.partners || []);
      setCanEdit(Boolean(j.canEdit));
      setRole(j.role === "owner" ? "owner" : "partner");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "customer" || key === "domain" || key === "partnerName" ? "asc" : "desc");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) =>
            (q === "active" && !c.deletedAt) ||
            ((q === "disabled" || q === "deleted") && Boolean(c.deletedAt)) ||
            c.email.toLowerCase().includes(q) ||
            (c.authorizedDomain || "").toLowerCase().includes(q) ||
            (c.partnerName || "").toLowerCase().includes(q) ||
            (c.companyName || "").toLowerCase().includes(q) ||
            fmtDate(c.createdAt).toLowerCase().includes(q) ||
            new Date(c.createdAt)
              .toLocaleDateString(undefined, { month: "long", year: "numeric" })
              .toLowerCase()
              .includes(q) ||
            new Date(c.createdAt).getFullYear().toString().includes(q)
        )
      : customers.slice();

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (a.deletedAt && !b.deletedAt) return 1;
      if (!a.deletedAt && b.deletedAt) return -1;
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortKey) {
        case "customer":
          av = (a.companyName || a.businessName || a.email).toLowerCase();
          bv = (b.companyName || b.businessName || b.email).toLowerCase();
          break;
        case "domain":
          av = (a.authorizedDomain || "").toLowerCase();
          bv = (b.authorizedDomain || "").toLowerCase();
          break;
        case "status":
          av = a.deletedAt ? 2 : a.enabled ? 0 : 1;
          bv = b.deletedAt ? 2 : b.enabled ? 0 : 1;
          break;
        case "upgraded":
          av = a.upgraded ? 1 : 0;
          bv = b.upgraded ? 1 : 0;
          break;
        case "views":
          av = a.views;
          bv = b.views;
          break;
        case "upgradeRequests":
          av = a.upgradeRequests;
          bv = b.upgradeRequests;
          break;
        case "partnerName":
          av = (a.partnerName || "").toLowerCase();
          bv = (b.partnerName || "").toLowerCase();
          break;
        case "createdAt":
        case "firstSeen":
        case "lastSeen": {
          const at = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
          const bt = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
          av = at;
          bv = bt;
          break;
        }
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return filtered;
  }, [customers, query, sortKey, sortDir]);

  async function impersonate(c: Customer) {
    try {
      const res = await fetch("/api/owner/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: c.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.error || "Could not view as this customer.");
        return;
      }
      window.location.href = j.redirect || "/dashboard";
    } catch {
      alert("Network error.");
    }
  }

  async function remove(c: Customer, reason: string) {
    const res = await fetch(`/api/owner/customers?id=${encodeURIComponent(c.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j.error || "Could not disable.");
      return;
    }
    load();
  }

  const totalViews = customers.reduce((s, c) => s + c.views, 0);
  const activeCount = customers.filter((c) => !c.deletedAt).length;
  const disabledCount = customers.filter((c) => c.deletedAt).length;
  const enabledCount = customers.filter((c) => !c.deletedAt && c.enabled).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">Customer List</h1>
          <p className="text-[12px] text-slate-500">Everyone who signed up, their setup, and their usage.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setAdding(true)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-700"
              >
                + Add customer
              </button>
              <button
                onClick={() => setImporting(true)}
                className="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                Import
              </button>
              <a
                href="/partner-guide"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Instructions
              </a>
            </>
          )}
          <button
            onClick={load}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active customers" value={String(activeCount)} />
        <Stat label="Disabled customers" value={String(disabledCount)} />
        <Stat label="Enabled widgets" value={String(enabledCount)} />
        <Stat label="Total views" value={totalViews.toLocaleString()} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => {
            // Browser autofill can target the search input while a modal is
            // open; ignore those changes so customers don't disappear.
            if (!modalOpen) setQuery(e.target.value);
          }}
          name="customer-list-filter"
          autoComplete="off"
          readOnly={modalOpen}
          placeholder="Search email, domain, month, or year…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <span className="text-[12px] text-slate-400">{rows.length} shown</span>
        <div className="ml-auto"><PageSizeButtons value={pageSize} onChange={setPageSize} /></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {["Active", "Disabled"].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setQuery(query.toLowerCase() === chip.toLowerCase() ? "" : chip)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              query.toLowerCase() === chip.toLowerCase()
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {chip}
            {query.toLowerCase() === chip.toLowerCase() && <span aria-hidden>×</span>}
          </button>
        ))}
        <span className="text-[11px] text-slate-400">Search also supports month/year, e.g. "July" or "2026".</span>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th label="Customer Name" k="customer" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Signed up" k="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Domain" k="domain" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Customer of This Partner" k="partnerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Views" k="views" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <Th label="Upgrade requests" k="upgradeRequests" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <Th label="Upgraded" k="upgraded" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
              <Th label="Code detected" k="firstSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Last active" k="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                  No customers yet.
                </td>
              </tr>
            ) : (
              (pageSize === 0 ? rows : rows.slice(0, pageSize)).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">
                    {(() => {
                      const name = c.companyName || c.businessName || "";
                      return (
                        <>
                          <div className="font-semibold text-ink-900">{name || c.email}</div>
                          {name && <div className="text-[11px] text-slate-500">{c.email}</div>}
                        </>
                      );
                    })()}
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c.deletedAt && <Badge tone="slate">Disabled</Badge>}
                      {!c.deletedAt && c.isOwner && <Badge tone="brand">Admin</Badge>}
                      {!c.deletedAt && !c.isOwner && c.isPartner && <Badge tone="brand">Partner</Badge>}
                      {!c.deletedAt && !c.isOwner && !c.isPartner && <Badge tone="slate">Customer</Badge>}
                      {c.emailVerified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <Badge tone="amber">Unverified</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {c.authorizedDomain ? (
                      <a
                        href={`https://${c.authorizedDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                      >
                        {c.authorizedDomain}
                      </a>
                    ) : (
                      <span className="text-slate-400">— none —</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {!c.isPartner && c.partnerName ? (
                      c.partnerName
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.deletedAt ? (
                      <Badge tone="slate">Disabled</Badge>
                    ) : c.enabled ? (
                      <Badge tone="green">Enabled</Badge>
                    ) : (
                      <Badge tone="slate">Off</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink-900">
                    {c.views.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink-900">
                    {c.upgradeRequests.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {c.upgraded ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(c.firstSeen)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(c.lastSeen)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button
                      onClick={() => setHistoryFor(c)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      History
                    </button>
                    {canEdit && (
                      <>
                        {!c.deletedAt && !c.isOwner && (!c.isPartner || role === "owner") && (
                          <button
                            onClick={() => impersonate(c)}
                            title={
                              c.isPartner
                                ? "Sign in as this partner to configure their account"
                                : "Sign in as this realtor to configure their account"
                            }
                            className="ml-2 rounded-md border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                          >
                            View as
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(c)}
                          className="ml-2 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        {!c.deletedAt && (
                          <button
                            onClick={() => setReasonAction({ type: "disable", customer: c })}
                            className="ml-2 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Disable
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && pageSize !== 0 && rows.length > pageSize && (
        <p className="mt-2 text-[12px] text-slate-500">
          Showing first {pageSize} of {rows.length.toLocaleString()}. Increase "Show" above to see more.
        </p>
      )}

      {editing && (
        <EditModal
          customer={editing}
          partners={partners}
          isAdmin={role === "owner"}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {adding && (
        <AddCustomerModal
          isAdmin={role === "owner"}
          partners={partners}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {importing && (
        <ImportModal
          isAdmin={role === "owner"}
          partners={partners}
          onClose={() => setImporting(false)}
          onDone={() => load()}
        />
      )}

      {historyFor && <HistoryModal customer={historyFor} onClose={() => setHistoryFor(null)} />}
      {reasonAction && (
        <ReasonModal
          title="Disable customer"
          customer={reasonAction.customer}
          actionLabel="Disable customer"
          onClose={() => setReasonAction(null)}
          onConfirm={async (reason) => {
            await remove(reasonAction.customer, reason);
            setReasonAction(null);
          }}
        />
      )}
    </>
  );
}

interface HistoryEvent {
  event: string;
  detail: string | null;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  account_created: "Account created",
  email_verified: "Email verified",
  email_changed: "Email changed",
  password_changed: "Password changed",
  password_reset: "Password reset",
  domain_changed: "Website URL changed",
  default_address_changed: "Default address changed",
  explorer_enabled_changed: "Explorer enabled changed",
  account_deleted: "Customer disabled",
  account_restored: "Customer re-enabled",
  partner_assignment_changed: "Partner assignment changed",
  partner_status_changed: "Partner status changed",
  impersonation_started: "Viewed by partner/admin",
};

function HistoryModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    fetch(`/api/owner/history?id=${encodeURIComponent(customer.id)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not load history.");
        return j;
      })
      .then((j) => setEvents(j.events || []))
      .catch((e) => setError(e.message));
  }, [customer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold text-ink-900">Account history</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{customer.email}</p>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {!events && !error ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : events && events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No history recorded.</p>
        ) : (
          <ol className="mt-4 max-h-80 space-y-3 overflow-auto pr-1">
            {(events || [])
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900">
                      {EVENT_LABELS[e.event] || e.event}
                    </div>
                    {e.detail && <div className="truncate text-[12px] text-slate-500">{e.detail}</div>}
                    <div className="text-[11px] text-slate-400">{fmtDateTime(e.createdAt)}</div>
                  </div>
                </li>
              ))}
          </ol>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  customer,
  partners,
  isAdmin,
  onClose,
  onSaved,
}: {
  customer: Customer;
  partners: PartnerOption[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(customer.email);
  const [authorizedDomain, setAuthorizedDomain] = useState(customer.authorizedDomain || "");
  const [defaultAddress, setDefaultAddress] = useState(customer.defaultAddress || "");
  const [enabled, setEnabled] = useState(customer.enabled);
  const [isOwner, setIsOwner] = useState(customer.isOwner);
  const [isPartner, setIsPartner] = useState(customer.isPartner);
  const [partnerId, setPartnerId] = useState(customer.partnerId || "");
  const [companyName, setCompanyName] = useState(customer.companyName || "");
  const [businessName, setBusinessName] = useState(customer.businessName || "");
  const [restoreReason, setRestoreReason] = useState<null | string>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        id: customer.id,
        email,
        authorizedDomain,
        defaultAddress,
        enabled,
      };
      if (isAdmin) {
        payload.isOwner = isOwner;
        payload.isPartner = isPartner;
        payload.partnerId = isPartner ? "" : partnerId;
        payload.companyName = companyName;
        payload.businessName = businessName;
      }
      const res = await fetch("/api/owner/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(reason: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, action: "restore", reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.restored) {
        setError(j.error || "Could not re-enable.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-ink-900">Edit customer</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{customer.email}</p>
        {customer.deletedAt && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-600">
            This customer is disabled. You can review/edit their details, or re-enable the account below.
          </p>
        )}

        <div className="-mr-2 mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
          <L label="Email">
            <input
              type="email"
              name="customer-email-edit"
              autoComplete="email"
              className={inp}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </L>
          {isAdmin && !isPartner && (
            <L label="Realtor name" hint="Identity for this realtor account (emails, customer list). Not the popup banner.">
              <input className={inp} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Jane Doe or Coastal Realty" />
            </L>
          )}
          {isAdmin && (
            <L
              label="White label name"
              hint="Popup/embed banner: Dream Neighborhood School Explorer provided by …. Blank = inherit partner white label (then partner name)."
            >
              <input className={inp} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="your company name" />
            </L>
          )}
          <L label="Authorized domain" hint="Base domain — works on all pages & subdomains. Popup is OFF until set.">
            <input
              className={inp}
              value={authorizedDomain}
              onChange={(e) => setAuthorizedDomain(e.target.value)}
              placeholder="youragency.com"
            />
          </L>
          <L label="Default address (fallback)">
            <AddressAutocomplete
              className={inp}
              value={defaultAddress}
              onChange={setDefaultAddress}
              placeholder="1500 N 23rd St, Fort Pierce, FL"
            />
          </L>
          {isAdmin && !isPartner && (
            <L label="Belongs to partner" hint="Optional. Customers assigned here are visible to that partner.">
              <select className={inp} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">No partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.companyName || p.email}
                  </option>
                ))}
              </select>
            </L>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            Explorer enabled (requires a domain)
          </label>
          {isAdmin && (
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={isOwner}
                onChange={(e) => setIsOwner(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-brand-600"
              />
              Admin
            </label>
            <p className="mt-1 pl-6 text-[11px] leading-relaxed text-slate-500">
              Admins get full access to the Customer List — they can view, edit, and delete every
              account. Only grant this to your own team members, never to customers.
            </p>
            {isOwner && !customer.isOwner && (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1.5 pl-6 text-[11px] font-semibold text-amber-800">
                ⚠ You’re granting full admin access to this account.
              </p>
            )}
          </div>
          )}

          {/* Danger zone — partner status conversion (admins only) */}
          {isAdmin && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-rose-700">Danger zone</div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-rose-900">
              <input
                type="checkbox"
                checked={isPartner}
                onChange={(e) => {
                  if (e.target.checked && !customer.isPartner) {
                    const ok = window.confirm(
                      "Change this customer's status to PARTNER?\n\n" +
                        "Partners can see EVERY customer assigned to them and get a Partner Login link that auto-associates new signups.\n\n" +
                        "Only do this for real business partners — never a regular customer. Continue?"
                    );
                    if (!ok) return;
                  }
                  setIsPartner(e.target.checked);
                  if (e.target.checked) setPartnerId("");
                }}
                className="h-4 w-4 cursor-pointer accent-rose-600"
              />
              Change Customer Status to Partner
            </label>
            <p className="mt-1 pl-6 text-[11px] leading-relaxed text-rose-700/90">
              This grants access to a partner-scoped Customer List and a Partner Login link. It changes
              what this account can see and do. Assigned customers are keyed to the partner’s account —
              renaming the company later is safe and updates everywhere automatically.
            </p>
            {isPartner && (
              <div className="mt-3 pl-6">
                <L
                  label="Partner company name"
                  hint="Signup / partner identity. Banner uses White Label first; this is the fallback when White Label is blank. Safe to change anytime."
                >
                  <input className={inp} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Partner Company" />
                </L>
              </div>
            )}
            {isPartner && !customer.isPartner && (
              <p className="mt-2 rounded-md bg-rose-100 px-2 py-1.5 pl-6 text-[11px] font-semibold text-rose-800">
                ⚠ You’re converting this customer into a Partner account.
              </p>
            )}
          </div>
          )}
        </div>

        {error && <p className="mt-3 shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {customer.deletedAt && (
            <button
              onClick={() => setRestoreReason("")}
              disabled={busy}
              className="mr-auto rounded-lg border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
            >
              Re-enable customer
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {restoreReason !== null && (
          <ReasonModal
            title="Re-enable customer"
            customer={customer}
            actionLabel="Re-enable customer"
            mode="restore"
            onClose={() => setRestoreReason(null)}
            onConfirm={async (reason) => {
              await restore(reason);
              setRestoreReason(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddCustomerModal({
  isAdmin,
  partners,
  onClose,
  onSaved,
}: {
  isAdmin: boolean;
  partners: PartnerOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [authorizedDomain, setAuthorizedDomain] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEscapeKey(onClose);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/owner/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: isAdmin ? partnerId || undefined : undefined,
          rows: [{ email, name, authorizedDomain, defaultAddress }],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not add customer.");
        return;
      }
      const r = (j.results || [])[0];
      if (r?.status === "created" && !r.reason) {
        onSaved();
        return;
      }
      if (r?.status === "created" && r.reason) {
        setNotice(r.reason);
        return;
      }
      setError(r?.reason || "Could not add customer.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold text-ink-900">Add customer</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Creates a verified, active realtor account — the School Explorer works on their site right
          away. They set a password the first time they sign in.
        </p>
        <div className="-mr-2 mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
          <L label="Email">
            <input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@agency.com" />
          </L>
          <L label="Customer name">
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe or Coastal Realty" />
          </L>
          <L label="Authorized domain" hint="Base domain — works on all pages & subdomains.">
            <input className={inp} value={authorizedDomain} onChange={(e) => setAuthorizedDomain(e.target.value)} placeholder="youragency.com" />
          </L>
          <L label="Default address (fallback)">
            <AddressAutocomplete className={inp} value={defaultAddress} onChange={setDefaultAddress} placeholder="1500 N 23rd St, Fort Pierce, FL" />
          </L>
          {isAdmin && (
            <L label="Belongs to partner" hint="Optional. Assign this realtor to a partner.">
              <select className={inp} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">No partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.companyName || p.email}
                  </option>
                ))}
              </select>
            </L>
          )}
        </div>
        {error && <p className="mt-3 shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {notice && <p className="mt-3 shrink-0 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {notice ? "Done" : "Cancel"}
          </button>
          <button onClick={save} disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Adding…" : "Add customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImportResult {
  email: string;
  status: "created" | "skipped" | "error";
  reason?: string;
}

// Parse pasted CSV/TSV rows: email, name, domain, address. A header line
// containing "email" is ignored. Commas inside addresses are handled by
// treating the 4th column onward as the address.
function parseImport(text: string): { email: string; name: string; authorizedDomain: string; defaultAddress: string }[] {
  const out: { email: string; name: string; authorizedDomain: string; defaultAddress: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const delim = line.includes("\t") ? "\t" : ",";
    const parts = line.split(delim).map((p) => p.trim());
    if (!parts[0] || /^e-?mail$/i.test(parts[0]) || !parts[0].includes("@")) {
      // Skip header rows or lines whose first cell isn't an email.
      if (/@/.test(parts[0] || "")) {
        // still an email even without dot? unlikely; fallthrough
      } else {
        continue;
      }
    }
    const email = parts[0] || "";
    const name = parts[1] || "";
    const authorizedDomain = parts[2] || "";
    // Address may itself contain the delimiter → rejoin the remainder.
    const defaultAddress = parts.length > 3 ? parts.slice(3).join(delim === "," ? ", " : " ").trim() : "";
    out.push({ email, name, authorizedDomain, defaultAddress });
  }
  return out;
}

function ImportModal({
  isAdmin,
  partners,
  onClose,
  onDone,
}: {
  isAdmin: boolean;
  partners: PartnerOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<null | { created: number; skipped: number; errored: number; results: ImportResult[] }>(null);
  useEscapeKey(onClose);

  const parsed = useMemo(() => parseImport(text), [text]);

  async function run() {
    if (!parsed.length) {
      setError("Paste at least one row with an email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: isAdmin ? partnerId || undefined : undefined, rows: parsed }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Import failed.");
        return;
      }
      setSummary({ created: j.created, skipped: j.skipped, errored: j.errored, results: j.results || [] });
      onDone();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold text-ink-900">Import customers</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          One realtor per line: <code className="rounded bg-slate-100 px-1">email, customer name, authorized domain, default address</code>.
          Accounts are created verified and active — no email verification needed.
        </p>

        {!summary ? (
          <div className="-mr-2 mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
            <textarea
              rows={9}
              className={`${inp} resize-y font-mono text-[12px]`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"jane@agency.com, Jane Doe, janeagency.com, 1500 N 23rd St, Fort Pierce, FL\njohn@homes.com, John Smith, johnhomes.com, 742 Evergreen Ter, Springfield, IL"}
            />
            <p className="text-[12px] text-slate-500">{parsed.length} row{parsed.length === 1 ? "" : "s"} detected.</p>
            {isAdmin && (
              <L label="Assign all to partner" hint="Optional. Applies to every imported row.">
                <select className={inp} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                  <option value="">No partner</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.companyName || p.email}
                    </option>
                  ))}
                </select>
              </L>
            )}
          </div>
        ) : (
          <div className="-mr-2 mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
            <div className="flex gap-2">
              <Stat label="Created" value={String(summary.created)} />
              <Stat label="Skipped" value={String(summary.skipped)} />
              <Stat label="Errors" value={String(summary.errored)} />
            </div>
            <ul className="space-y-1 text-[12px]">
              {summary.results.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      r.status === "created"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.status === "skipped"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink-900">{r.email}</span>
                    {r.reason && <span className="text-slate-500"> — {r.reason}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="mt-3 shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {summary ? "Done" : "Cancel"}
          </button>
          {!summary && (
            <button onClick={run} disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Importing…" : `Import ${parsed.length || ""}`.trim()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DELETE_REASONS = [
  "Customer requested disable",
  "Duplicate account",
  "Invalid or test account",
  "No longer using School Explorer",
  "Billing/support cleanup",
  "Other",
];

const RESTORE_REASONS = [
  "Customer requested re-enable",
  "Disabled by mistake",
  "Duplicate resolved",
  "Testing complete",
  "Other",
];

function ReasonModal({
  title,
  customer,
  actionLabel,
  mode = "delete",
  onClose,
  onConfirm,
}: {
  title: string;
  customer: Customer;
  actionLabel: string;
  mode?: "delete" | "restore";
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const reasons = mode === "restore" ? RESTORE_REASONS : DELETE_REASONS;
  const [selected, setSelected] = useState(reasons[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const reason = selected === "Other" ? other.trim() : selected;
  useEscapeKey(onClose);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      await onConfirm(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold text-ink-900">{title}</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{customer.email}</p>
        <div className="mt-4 space-y-3">
          <L label="Reason">
            <select className={inp} value={selected} onChange={(e) => setSelected(e.target.value)}>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </L>
          {selected === "Other" && (
            <L label="Other reason">
              <textarea
                rows={3}
                className={`${inp} resize-y`}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Enter reason"
              />
            </L>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !reason}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${
              mode === "restore" ? "bg-brand-600 hover:bg-brand-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {busy ? "Saving…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-2xl font-extrabold text-ink-900">{value}</div>
    </div>
  );
}

function PageSizeButtons({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 text-[12px] text-slate-500">
      <span className="font-semibold">Show:</span>
      {[10, 20, 50, 100, 0].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-md px-2 py-1 text-xs font-bold transition ${value === s ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
        >
          {s === 0 ? "All" : s}
        </button>
      ))}
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === k;
  return (
    <th className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active ? "text-ink-900" : "hover:text-slate-700"
        }`}
      >
        {label}
        <span className="text-[9px]">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "brand" | "slate";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    brand: "bg-brand-50 text-brand-700 border-brand-200",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
