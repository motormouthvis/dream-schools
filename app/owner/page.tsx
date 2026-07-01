"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

interface Customer {
  id: string;
  email: string;
  emailVerified: boolean;
  isOwner: boolean;
  createdAt: string;
  authorizedDomain: string | null;
  enabled: boolean;
  defaultAddress: string;
  views: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

type SortKey = "email" | "createdAt" | "views" | "firstSeen" | "lastSeen";
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
      {(me) => (me.isOwner ? <OwnerAdmin /> : <NotAuthorized />)}
    </AppShell>
  );
}

function NotAuthorized() {
  return (
    <>
      <h1 className="text-xl font-extrabold text-ink-900">Not authorized</h1>
      <p className="mt-2 text-sm text-slate-600">This area is for the account owner.</p>
    </>
  );
}

function OwnerAdmin() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<Customer | null>(null);

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
      setSortDir(key === "email" ? "asc" : "desc");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            (c.authorizedDomain || "").toLowerCase().includes(q)
        )
      : customers.slice();

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortKey) {
        case "email":
          av = a.email.toLowerCase();
          bv = b.email.toLowerCase();
          break;
        case "views":
          av = a.views;
          bv = b.views;
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

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.email}? This removes their account, widget config, and usage. This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/owner/customers?id=${encodeURIComponent(c.id)}`, {
      method: "DELETE",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j.error || "Could not delete.");
      return;
    }
    load();
  }

  const totalViews = customers.reduce((s, c) => s + c.views, 0);
  const activeCount = customers.filter((c) => c.enabled).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">Owner Admin</h1>
          <p className="text-[12px] text-slate-500">Everyone who signed up, their setup, and their usage.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Active widgets" value={String(activeCount)} />
        <Stat label="Total views" value={totalViews.toLocaleString()} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or domain…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <span className="text-[12px] text-slate-400">{rows.length} shown</span>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <Th label="Customer" k="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Signed up" k="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-semibold">Domain</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <Th label="Views" k="views" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <Th label="Code detected" k="firstSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Last active" k="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No customers yet.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink-900">{c.email}</div>
                    <div className="mt-0.5 flex gap-1">
                      {c.isOwner && <Badge tone="brand">Owner</Badge>}
                      {c.emailVerified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <Badge tone="amber">Unverified</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {c.authorizedDomain || <span className="text-slate-400">— none —</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.enabled ? (
                      <Badge tone="green">Live</Badge>
                    ) : (
                      <Badge tone="slate">Off</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink-900">
                    {c.views.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(c.firstSeen)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDateTime(c.lastSeen)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="ml-2 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(customer.email);
  const [authorizedDomain, setAuthorizedDomain] = useState(customer.authorizedDomain || "");
  const [defaultAddress, setDefaultAddress] = useState(customer.defaultAddress || "");
  const [enabled, setEnabled] = useState(customer.enabled);
  const [isOwner, setIsOwner] = useState(customer.isOwner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          email,
          authorizedDomain,
          defaultAddress,
          enabled,
          isOwner,
        }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-ink-900">Edit customer</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{customer.email}</p>

        <div className="mt-4 space-y-3">
          <L label="Email">
            <input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} />
          </L>
          <L label="Authorized domain" hint="Base domain — works on all pages & subdomains. Popup is OFF until set.">
            <input
              className={inp}
              value={authorizedDomain}
              onChange={(e) => setAuthorizedDomain(e.target.value)}
              placeholder="youragency.com"
            />
          </L>
          <L label="Default address (fallback)">
            <input
              className={inp}
              value={defaultAddress}
              onChange={(e) => setDefaultAddress(e.target.value)}
              placeholder="1500 N 23rd St, Fort Pierce, FL"
            />
          </L>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            Explorer enabled (requires a domain)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={isOwner}
              onChange={(e) => setIsOwner(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            Owner (full admin access)
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
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
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : ""}`}>
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
