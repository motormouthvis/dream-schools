"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmailTemplateManager } from "@/components/app/EmailTemplateManager";
import { SchoolhouseMark } from "@/components/Logo";

interface UpgradeRequest {
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

interface SentDigestEmail {
  id: number;
  recipient: string;
  subject: string;
  variant: string;
  audience: string;
  sentAt: string;
  html: string;
}

interface UpgradeOfferEmail {
  id: number;
  customerId: string;
  customerEmail: string;
  customerName: string;
  partnerCompanyName: string | null;
  sentByEmail: string;
  offerText: string;
  discountCode: string;
  requestCount: number;
  sentAt: string;
}

interface TemplateOption {
  variant: string;
  label: string;
}

type SortKey = "date" | "customer" | "partner";

interface ScopeOption {
  type: "partner" | "customer";
  id: string;
  label: string;
  sub: string;
}

interface SeriesPoint {
  period: string;
  count: number;
}
interface RequestSeries {
  week: SeriesPoint[];
  month: SeriesPoint[];
  year: SeriesPoint[];
}

function fmt(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-2xl font-extrabold text-ink-900">{value.toLocaleString()}</div>
    </div>
  );
}

function formatPeriod(iso: string, granularity: "week" | "month" | "year"): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  if (granularity === "year") return String(d.getFullYear());
  if (granularity === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Full label (with year) used for hover tooltips, since all-time weekly bars omit
// their x-axis labels.
function formatPeriodFull(iso: string, granularity: "week" | "month" | "year"): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  if (granularity === "year") return String(d.getFullYear());
  if (granularity === "month") return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return "Week of " + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function RequestsChart({
  series,
  granularity,
  onGranularity,
}: {
  series: RequestSeries;
  granularity: "week" | "month" | "year";
  onGranularity: (g: "week" | "month" | "year") => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  // Show the full all-time series for the selected granularity.
  const shown = series[granularity] || [];
  const max = shown.reduce((m, p) => Math.max(m, p.count), 0);
  const total = shown.reduce((s, p) => s + p.count, 0);
  // Weekly all-time can be many thin bars — use narrow bars, tighter gaps, and
  // drop the x-axis labels (the date + count are available on hover instead).
  const barMinW = granularity === "week" ? "min-w-[4px]" : granularity === "month" ? "min-w-[12px]" : "min-w-[24px]";
  const gap = granularity === "week" ? "gap-px" : "gap-1";
  const showLabels = granularity !== "week";
  const unit = granularity === "week" ? "week" : granularity === "month" ? "month" : "year";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-ink-900">Requests over time</h2>
          <p className="text-[12px] text-slate-500">
            All time · {total.toLocaleString()} request{total === 1 ? "" : "s"} across {shown.length} {unit}
            {shown.length === 1 ? "" : "s"}.
            {granularity === "week" && " Hover a bar for its week and count."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["week", "month", "year"] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGranularity(g)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition ${
                granularity === g ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g === "week" ? "Weekly" : g === "month" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No request data to chart yet.</p>
      ) : (
        <>
          <div
            className={`mt-4 flex h-48 items-end ${gap} overflow-x-auto border-b border-slate-100 pb-1`}
            onMouseLeave={() => setTip(null)}
          >
            {shown.map((p, i) => {
              const pct = max > 0 ? Math.round((p.count / max) * 100) : 0;
              return (
                <div
                  key={p.period}
                  onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, i })}
                  className={`group flex h-full ${barMinW} flex-1 flex-col items-center justify-end`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${tip?.i === i ? "bg-brand-700" : "bg-brand-500 group-hover:bg-brand-600"}`}
                    style={{ height: `${Math.max(pct, p.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {tip && shown[tip.i] && (
            <div
              className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1 text-[12px] font-semibold text-white shadow-lg"
              style={{ left: tip.x, top: tip.y }}
            >
              {formatPeriodFull(shown[tip.i].period, granularity)} · {shown[tip.i].count.toLocaleString()} request{shown[tip.i].count === 1 ? "" : "s"}
            </div>
          )}

          {showLabels && (
            <div className={`mt-1 flex ${gap} overflow-x-auto text-[9px] text-slate-400`}>
              {shown.map((p) => (
                <div key={p.period} className={`${barMinW} flex-1 text-center`}>
                  {formatPeriod(p.period, granularity)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UpgradeRequestsPage() {
  return (
    <AppShell active="upgradeRequests">
      {(me) => <UpgradeRequests isOwner={me.isOwner} isPartner={me.isPartner} email={me.email} />}
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

function UpgradeRequests({ isOwner, isPartner, email }: { isOwner: boolean; isPartner: boolean; email: string }) {
  const isManager = isOwner || isPartner;
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [sentEmails, setSentEmails] = useState<SentDigestEmail[]>([]);
  const [offerEmails, setOfferEmails] = useState<UpgradeOfferEmail[]>([]);
  const [summary, setSummary] = useState<{ total: number; pending: number; sent: number } | null>(null);
  const [series, setSeries] = useState<RequestSeries | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [granularity, setGranularity] = useState<"week" | "month" | "year">("month");
  const [realtorTab, setRealtorTab] = useState<"list" | "graph">("list");
  const [truncated, setTruncated] = useState(false);
  const [limit, setLimit] = useState(200);
  const [includeSent, setIncludeSent] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [variant, setVariant] = useState("soft_nudge");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [digestIntervalWeeks, setDigestIntervalWeeks] = useState("1");
  const [lastDigestSentAt, setLastDigestSentAt] = useState<string | null>(null);
  const [copyTo, setCopyTo] = useState("");
  const [preview, setPreview] = useState<SentDigestEmail | null>(null);
  const [reminderDays, setReminderDays] = useState("7");
  const [reminderSendScope, setReminderSendScope] = useState<"all" | "new">("all");
  const [reminderLastSentAt, setReminderLastSentAt] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [offerText, setOfferText] = useState("Upgrade to Neighborhood Explorer and give your buyers the full neighborhood picture with 38+ hyperlocal insights.");
  const [offerHistoryFilter, setOfferHistoryFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [scopeType, setScopeType] = useState<"all" | "partner" | "customer">("all");
  const [scopeId, setScopeId] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Managers can include all requests; standard customers always see their permanent list.
      const wantAll = isManager ? includeSent : true;
      const scopeParam = isManager && scopeType !== "all" && scopeId ? `&scope=${encodeURIComponent(`${scopeType}:${scopeId}`)}` : "";
      const res = await fetch(`/api/owner/upgrade-requests?include_sent=${wantAll ? "1" : "0"}${scopeParam}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not load requests.");
        return;
      }
      setRequests(j.requests || []);
      setSummary(j.summary || null);
      setSeries(j.series || null);
      setTruncated(Boolean(j.truncated));
      setLimit(j.limit || 200);
      if (isOwner) {
        const tplRes = await fetch("/api/owner/upgrade-templates");
        const tplJson = await tplRes.json().catch(() => ({}));
        if (tplRes.ok) setTemplates(tplJson.templates || []);
        if (j.schedule) {
          setDigestIntervalWeeks(String(j.schedule.digestIntervalWeeks || 1));
          setLastDigestSentAt(j.schedule.lastDigestSentAt || null);
        }
        const sentRes = await fetch("/api/owner/upgrade-digests");
        const sentJson = await sentRes.json().catch(() => ({}));
        if (sentRes.ok) setSentEmails(sentJson.emails || []);
      }
      if (isManager) {
        const offersRes = await fetch("/api/owner/upgrade-offers");
        const offersJson = await offersRes.json().catch(() => ({}));
        if (offersRes.ok) setOfferEmails(offersJson.emails || []);
      }
      if (!isManager) {
        const remRes = await fetch("/api/app/reminder");
        const remJson = await remRes.json().catch(() => ({}));
        if (remRes.ok && remJson.settings) {
          setReminderDays(String(remJson.settings.intervalDays || 7));
          setReminderLastSentAt(remJson.settings.lastSentAt || null);
        }
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeSent, scopeType, scopeId]);

  // Managers: load the list of partners/customers they can scope the page to.
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/owner/customers")
      .then((r) => r.json())
      .then((j) => {
        const opts: ScopeOption[] = [];
        for (const c of j.customers || []) {
          if (c.isOwner) continue;
          if (c.isPartner) {
            if (isOwner) opts.push({ type: "partner", id: c.id, label: c.companyName || c.email, sub: "Partner" });
          } else {
            opts.push({
              type: "customer",
              id: c.id,
              label: c.businessName || c.email,
              // Partner view: search & display by Realtor Name only (no sub text).
              sub: isOwner ? (c.partnerName ? `Customer · ${c.partnerName}` : "Customer") : "",
            });
          }
        }
        opts.sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label) : a.type === "partner" ? -1 : 1));
        setScopeOptions(opts);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, isOwner]);

  async function sendNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send digest.");
        return;
      }
      setMessage(`Sent ${j.requestCount || 0} request${j.requestCount === 1 ? "" : "s"} to ${j.sentTo?.length || 0} recipient${j.sentTo?.length === 1 ? "" : "s"}.`);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestIntervalWeeks }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save schedule.");
        return;
      }
      setLastDigestSentAt(j.schedule?.lastDigestSentAt || null);
      setMessage("Schedule saved.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCopy(id: number) {
    if (!copyTo.trim()) {
      setError("Enter an email address for the copy.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-digests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, to: copyTo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send copy.");
        return;
      }
      setMessage("Copy sent.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder(send: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/app/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalDays: Number(reminderDays), send, includeAll: reminderSendScope === "all" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save reminder.");
        return;
      }
      if (send) {
        setMessage(
          j.sent
            ? `Reminder email sent to you with ${reminderSendScope === "all" ? "all requests" : "new requests only"}.`
            : "No new requests — reminder not sent."
        );
        await load();
      } else {
        setMessage("Reminder schedule saved.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const unsentCount = useMemo(() => requests.filter((r) => !r.summarySentAt).length, [requests]);
  const filteredRequests = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const customer = `${r.businessName || ""} ${r.customerEmail || ""}`.toLowerCase();
      return customer.includes(q);
    });
  }, [customerFilter, requests]);
  const sortedRequests = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredRequests].sort((a, b) => {
      if (sortKey === "customer") {
        const av = (a.businessName || a.customerEmail || "").toLowerCase();
        const bv = (b.businessName || b.customerEmail || "").toLowerCase();
        return av.localeCompare(bv) * dir;
      }
      if (sortKey === "partner") {
        const av = (a.partnerCompanyName || a.partnerEmail || "").toLowerCase();
        const bv = (b.partnerCompanyName || b.partnerEmail || "").toLowerCase();
        return av.localeCompare(bv) * dir;
      }
      return (new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()) * dir;
    });
  }, [filteredRequests, sortDir, sortKey]);
  const customers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; email: string; count: number }>();
    for (const r of requests) {
      if (!r.customerId) continue;
      const existing = m.get(r.customerId);
      if (existing) existing.count += 1;
      else m.set(r.customerId, { id: r.customerId, name: r.businessName || r.customerEmail || "Unknown customer", email: r.customerEmail || "", count: 1 });
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);
  const filteredCustomers = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q));
  }, [customerFilter, customers]);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || filteredCustomers[0] || null;
  const filteredOfferEmails = useMemo(() => {
    const q = offerHistoryFilter.trim().toLowerCase();
    if (!q) return offerEmails;
    return offerEmails.filter((e) => `${e.customerName} ${e.customerEmail}`.toLowerCase().includes(q));
  }, [offerEmails, offerHistoryFilter]);
  const filteredScopeOptions = useMemo(() => {
    const q = scopeSearch.trim().toLowerCase();
    const base = q ? scopeOptions.filter((o) => `${o.label} ${o.sub}`.toLowerCase().includes(q)) : scopeOptions;
    // Always keep the current selection visible even if it doesn't match the search.
    if (scopeType !== "all" && scopeId && !base.some((o) => o.type === scopeType && o.id === scopeId)) {
      const sel = scopeOptions.find((o) => o.type === scopeType && o.id === scopeId);
      if (sel) return [sel, ...base];
    }
    return base;
  }, [scopeOptions, scopeSearch, scopeType, scopeId]);

  const totalRows = sortedRequests.length;
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRequests = useMemo(() => {
    if (pageSize === 0) return sortedRequests;
    const start = (safePage - 1) * pageSize;
    return sortedRequests.slice(start, start + pageSize);
  }, [sortedRequests, pageSize, safePage]);

  // Reset to the first page whenever the filter, sort, or page size changes.
  useEffect(() => {
    setPage(1);
  }, [customerFilter, sortKey, sortDir, pageSize, requests.length]);

  function sortButton(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <button
        onClick={() => {
          if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir(key === "date" ? "desc" : "asc");
          }
        }}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700"
      >
        {label}
        {active && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  async function sendOffer() {
    const customerId = selectedCustomer?.id || "";
    if (!customerId) {
      setError("Filter or select a customer first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, discountCode, offerText }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send offer email.");
        return;
      }
      setMessage(`Offer email sent to ${j.recipient} with ${j.requestCount || 0} request${j.requestCount === 1 ? "" : "s"}.`);
      setDiscountCode("");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">Homebuyer Requests to Upgrade to the Full Neighborhood Explorer</h1>
          <p className="text-[12px] text-slate-500">
            Homebuyers who asked you to upgrade from the School Explorer to the full Neighborhood Explorer.
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {isManager && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-ink-900">{isOwner ? "View" : "View/Select Customers"}</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            {isOwner
              ? "Show all requests, or type to find and focus on a single partner or customer."
              : "Show all of your customers' requests, or type to find and focus on a single customer."}
          </p>
          <div className="relative mt-3 max-w-md">
            <input
              value={scopeSearch}
              onChange={(e) => {
                setScopeSearch(e.target.value);
                setScopeOpen(true);
                // Typing after a selection reverts to "all" until a new pick is made.
                if (scopeType !== "all") {
                  setScopeType("all");
                  setScopeId("");
                }
              }}
              onFocus={() => setScopeOpen(true)}
              onClick={() => setScopeOpen(true)}
              onBlur={() => setTimeout(() => setScopeOpen(false), 150)}
              placeholder={isOwner ? "All partners & customers — type to search…" : "Type to search for customers"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            {(scopeType !== "all" || scopeSearch) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setScopeType("all");
                  setScopeId("");
                  setScopeSearch("");
                  setScopeOpen(true);
                }}
                aria-label="Clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
            {scopeOpen && (
              <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setScopeType("all");
                      setScopeId("");
                      setScopeSearch("");
                      setScopeOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${scopeType === "all" ? "font-bold text-brand-700" : "text-slate-700"}`}
                  >
                    All {isOwner ? "partners & customers" : "customers"}
                  </button>
                </li>
                {filteredScopeOptions.length === 0 ? (
                  <li className="px-3 py-2 text-slate-400">No matches</li>
                ) : (
                  filteredScopeOptions.map((o) => {
                    const selected = scopeType === o.type && scopeId === o.id;
                    return (
                      <li key={`${o.type}:${o.id}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setScopeType(o.type);
                            setScopeId(o.id);
                            setScopeSearch(o.label);
                            setScopeOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 ${selected ? "bg-brand-50" : ""}`}
                        >
                          <span className={selected ? "font-bold text-brand-700" : "text-slate-800"}>{o.label}</span>
                          {(o.type === "partner" || o.sub) && (
                            <span className="shrink-0 text-[11px] text-slate-400">{o.type === "partner" ? "Partner" : o.sub}</span>
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
          {scopeType !== "all" && (
            <p className="mt-2 text-[12px] text-slate-500">
              Showing {scopeType === "partner" ? "partner" : "customer"}:{" "}
              <strong>{scopeOptions.find((o) => o.type === scopeType && o.id === scopeId)?.label || scopeId}</strong>.
            </p>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto] lg:items-end">
            <label className="block">
              <span className="block text-xs font-bold text-slate-600">Template variant for Realtor/customer email</span>
              <select value={variant} onChange={(e) => setVariant(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {(templates.length ? templates : [{ variant: "soft_nudge", label: "Soft nudge" }]).map((t) => (
                  <option key={t.variant} value={t.variant}>
                    {t.label || t.variant}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-slate-600">Auto-send every X weeks</span>
              <input
                type="number"
                min={1}
                max={52}
                value={digestIntervalWeeks}
                onChange={(e) => setDigestIntervalWeeks(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Include previously sent requests
            </label>
            <div className="flex gap-2">
              <button
                onClick={saveSchedule}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Save schedule
              </button>
              <button
                onClick={sendNow}
                disabled={busy || unsentCount === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Sending…" : `Send digest now (${unsentCount})`}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">
            Sends to the Realtor/customer email, assigned Partner email (if any), and Admin/Product Owner email(s). Sent requests are marked so they are not included again.
            {lastDigestSentAt && <> Last automatic/manual digest: <strong>{fmt(lastDigestSentAt)}</strong>.</>}
          </p>
        </div>
      )}

      {isManager ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(240px,320px)_1fr]">
            <div>
              <h2 className="text-sm font-extrabold text-ink-900">Find a Standard Account</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Filter by customer name or email, then send that customer an offer email with all of their upgrade requests.
              </p>
              <input
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
                  setSelectedCustomerId("");
                }}
                placeholder="Filter by customer name or email"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {filteredCustomers.length === 0 ? (
                  <option value="">No matching customers</option>
                ) : (
                  filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email} ({c.count})
                    </option>
                  ))
                )}
              </select>
              {selectedCustomer && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                  Sending to <strong>{selectedCustomer.name}</strong>
                  {selectedCustomer.email && <> &lt;{selectedCustomer.email}&gt;</>} with {selectedCustomer.count} request{selectedCustomer.count === 1 ? "" : "s"}.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-lime-50/60 to-emerald-50 p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-ink-900">Send Upgrade Offer Email</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Add an offer message and optional Stripe discount code. A sent-email history record is saved automatically.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr_auto] lg:items-end">
                <label className="block">
                  <span className="block text-xs font-bold text-slate-600">Stripe discount code</span>
                  <input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-600">Offer text</span>
                  <textarea
                    value={offerText}
                    onChange={(e) => setOfferText(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <button
                  onClick={sendOffer}
                  disabled={busy || !selectedCustomer || !offerText.trim()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send offer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-lime-50/60 to-emerald-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-200 to-emerald-300 text-emerald-800">
                <SchoolhouseMark className="h-5 w-5" />
              </span>
              <h2 className="text-base font-extrabold text-ink-900">Email Reminder Settings</h2>
            </div>
            <div className="text-[12px] text-slate-500">
              Sends to: <span className="font-semibold text-slate-700" title={email}>{email}</span>
            </div>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Send yourself a reminder email with your School Explorer usage, views, and upgrade requests.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Every</label>
              <input
                type="number"
                min={1}
                max={90}
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
              <span className="text-sm font-semibold text-slate-500">days</span>
            </div>

            <div className="inline-flex overflow-hidden rounded-lg border border-brand-200 bg-white text-xs font-bold">
              <button
                type="button"
                onClick={() => setReminderSendScope("all")}
                className={`px-3 py-1.5 transition ${reminderSendScope === "all" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                title="Include the full request list when sending"
              >
                All requests
              </button>
              <button
                type="button"
                onClick={() => setReminderSendScope("new")}
                className={`border-l border-brand-200 px-3 py-1.5 transition ${reminderSendScope === "new" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                title="Only requests since your last reminder"
              >
                New only
              </button>
            </div>

            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => saveReminder(false)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
                Save schedule
              </button>
              <button onClick={() => saveReminder(true)} disabled={busy} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
                Send me one now
              </button>
            </div>
          </div>
          {reminderLastSentAt && (
            <p className="mt-2 text-[11px] text-slate-400">Last sent: <strong>{fmt(reminderLastSentAt)}</strong>.</p>
          )}
        </div>
      )}

      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Manager: summary stats + graph toggle (both list and graph visible). */}
      {isManager && summary && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <SummaryStat label="Total requests" value={summary.total} />
            <SummaryStat label="Pending (not yet emailed)" value={summary.pending} />
            <SummaryStat label="Previously sent" value={summary.sent} />
          </div>
          <button
            onClick={() => setShowChart((s) => !s)}
            aria-pressed={showChart}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold shadow-sm transition ${
              showChart ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/></svg>
            {showChart ? "Hide graph" : "Show graph"}
          </button>
        </div>
      )}

      {isManager && showChart && series && (
        <RequestsChart series={series} granularity={granularity} onGranularity={setGranularity} />
      )}

      {/* Realtor: CTA headline + upgrade buttons. */}
      {!isManager && summary && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-lime-50/60 to-emerald-50 p-4 shadow-sm">
          <h2 className="max-w-2xl text-base font-extrabold leading-snug text-ink-900 sm:text-lg">
            {summary.total > 0
              ? `${summary.total.toLocaleString()} Homebuyers Have Requested That You Upgrade from the free School Explorer to the full Neighborhood Explorer`
              : "Upgrade from the free School Explorer to the full Neighborhood Explorer to Improve Your Homebuyer's Experience"}
          </h2>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.dreamneighborhood.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-extrabold text-brand-700 shadow-sm hover:bg-brand-50"
            >
              Learn More
            </a>
            <a
              href="https://app.dreamneighborhood.com/accounts/signup/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-brand-700"
            >
              Upgrade Now
            </a>
          </div>
        </div>
      )}

      {/* Realtor: List / Graph tabs — one view at a time. */}
      {!isManager && (
        <div className="mt-4 flex gap-1 border-b border-slate-200">
          {(["list", "graph"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setRealtorTab(t)}
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-bold capitalize transition ${
                realtorTab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!isManager && realtorTab === "graph" && (
        <div className="mt-4 flex min-h-[50vh] items-center">
          {series ? (
            <div className="w-full">
              <RequestsChart series={series} granularity={granularity} onGranularity={setGranularity} />
            </div>
          ) : (
            <p className="w-full text-center text-sm text-slate-400">No graph data yet.</p>
          )}
        </div>
      )}

      {truncated && (isManager || realtorTab === "list") && (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-600">
          Showing the most recent {limit} requests. Use the summary above for totals.
        </p>
      )}

      {(isManager || realtorTab === "list") && (
      <>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">
                <button
                  onClick={() => {
                    if (sortKey === "date") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSortKey("date");
                      setSortDir("desc");
                    }
                  }}
                  className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700"
                >
                  Requested
                  {sortKey === "date" && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
              <th className="px-3 py-2 font-semibold">{isManager ? sortButton("customer", "Realtor Name") : "Realtor Name"}</th>
              {isManager && <th className="px-3 py-2 font-semibold">{sortButton("partner", "Partner")}</th>}
              <th className="px-3 py-2 font-semibold">Listing Address</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold" title={isManager ? "When this request was included in an admin digest email." : "When this request was included in a reminder email to you."}>
                {isManager ? "Sent in digest" : "Emailed to you"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={isManager ? 6 : 5} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : pagedRequests.length === 0 ? (
              <tr><td colSpan={isManager ? 6 : 5} className="px-3 py-8 text-center text-slate-400">No requests yet.</td></tr>
            ) : (
              pagedRequests.map((r) => {
                const emailedToYou =
                  reminderLastSentAt && new Date(r.requestedAt).getTime() <= new Date(reminderLastSentAt).getTime()
                    ? reminderLastSentAt
                    : null;
                return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-slate-600">{fmt(r.requestedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink-900">{r.businessName || r.customerEmail || "—"}</div>
                    {r.businessName && <div className="text-[11px] text-slate-500">{r.customerEmail}</div>}
                  </td>
                  {isManager && <td className="px-3 py-2.5 text-slate-600">{r.partnerCompanyName || r.partnerEmail || "—"}</td>}
                  <td className="px-3 py-2.5 text-slate-600">{r.address || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.source || "widget"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmt(isManager ? r.summarySentAt : emailedToYou)}</td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalRows > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-slate-500">
            {pageSize === 0 ? (
              <>Showing all {totalRows.toLocaleString()} request{totalRows === 1 ? "" : "s"}.</>
            ) : (
              <>
                Showing {((safePage - 1) * pageSize + 1).toLocaleString()}–
                {Math.min(safePage * pageSize, totalRows).toLocaleString()} of {totalRows.toLocaleString()} · Page {safePage} of {pageCount}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[12px] text-slate-500">
              <span className="font-semibold">Show:</span>
              {[20, 50, 100, 0].map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                    pageSize === size ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {size === 0 ? "All" : size}
                </button>
              ))}
            </div>
            {pageSize !== 0 && pageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {isManager && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Offer Email History</h2>
              <p className="text-[12px] text-slate-500">A record of targeted upgrade-offer emails sent to Standard Accounts.</p>
            </div>
            <input
              value={offerHistoryFilter}
              onChange={(e) => setOfferHistoryFilter(e.target.value)}
              placeholder="Filter history by customer"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Sent</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  {isOwner && <th className="px-3 py-2 font-semibold">Partner</th>}
                  <th className="px-3 py-2 font-semibold">Discount</th>
                  <th className="px-3 py-2 font-semibold">Requests</th>
                  <th className="px-3 py-2 font-semibold">Sent by</th>
                  <th className="px-3 py-2 font-semibold">Offer text</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfferEmails.length === 0 ? (
                  <tr><td colSpan={isOwner ? 7 : 6} className="px-3 py-6 text-center text-slate-400">No offer emails yet.</td></tr>
                ) : (
                  filteredOfferEmails.map((email) => (
                    <tr key={email.id}>
                      <td className="px-3 py-2.5 text-slate-600">{fmt(email.sentAt)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-ink-900">{email.customerName || email.customerEmail}</div>
                        <div className="text-[11px] text-slate-500">{email.customerEmail}</div>
                      </td>
                      {isOwner && <td className="px-3 py-2.5 text-slate-600">{email.partnerCompanyName || "—"}</td>}
                      <td className="px-3 py-2.5 font-mono text-slate-700">{email.discountCode || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600">{email.requestCount}</td>
                      <td className="px-3 py-2.5 text-slate-600">{email.sentByEmail}</td>
                      <td className="max-w-md px-3 py-2.5 text-slate-600">
                        <div className="line-clamp-2">{email.offerText || "—"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isOwner && (
      <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">Sent Email Archive</h2>
          <p className="text-[12px] text-slate-500">View sent digests and send yourself a copy.</p>
        </div>
        <input
          value={copyTo}
          onChange={(e) => setCopyTo(e.target.value)}
          placeholder="copy-to email"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Sent</th>
              <th className="px-3 py-2 font-semibold">Recipient</th>
              <th className="px-3 py-2 font-semibold">Audience</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sentEmails.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No sent digest emails yet.</td></tr>
            ) : (
              sentEmails.map((email) => (
                <tr key={email.id}>
                  <td className="px-3 py-2.5 text-slate-600">{fmt(email.sentAt)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{email.recipient}</td>
                  <td className="px-3 py-2.5 text-slate-600">{email.audience}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink-900">{email.subject}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button onClick={() => setPreview(email)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">View</button>
                    <button onClick={() => sendCopy(email.id)} className="ml-2 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">Send copy</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-extrabold text-ink-900">Email templates</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Edit the wording of the digest emails, or add your own template.
        </p>
        <div className="mt-3">
          <EmailTemplateManager />
        </div>
      </div>
      </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-ink-900">{preview.subject}</h3>
                <p className="text-xs text-slate-500">{preview.recipient} · {fmt(preview.sentAt)}</p>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <iframe className="mt-3 min-h-0 flex-1 rounded-xl border border-slate-200" srcDoc={preview.html} />
          </div>
        </div>
      )}
    </>
  );
}
