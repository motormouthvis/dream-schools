"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

interface Stats {
  from: string;
  to: string;
  searches: number;
  uniqueVisitors: number;
  topIps: { ip: string; count: number }[];
  topAreas: { area: string; count: number }[];
  autocompleteCalls: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  autocompleteFallbacks: number;
  geocodeFallbacks: number;
  lookupErrors: number;
}
interface ReportMeta { id: string; type: string; label: string; generatedAt: string; }
interface Report extends ReportMeta { data: Stats; }
interface BackendEvent { id: string; kind: string; detail: string; notified: boolean; createdAt: string; }

const KIND_LABEL: Record<string, string> = {
  autocomplete_fallback: "Autocomplete fallback",
  geocode_fallback: "Geocode fallback",
};

function fmt(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-ink-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function StatsView({ stats }: { stats: Stats }) {
  const pct = Math.round(stats.cacheHitRate * 100);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Searches" value={stats.searches.toLocaleString()} />
        <StatCard label="Unique visitors" value={stats.uniqueVisitors.toLocaleString()} hint="by IP" />
        <StatCard label="Autocomplete calls" value={stats.autocompleteCalls.toLocaleString()} />
        <StatCard label="Cache hit rate" value={`${pct}%`} hint={`${stats.cacheHits.toLocaleString()} hits / ${stats.cacheMisses.toLocaleString()} misses`} />
        <StatCard label="Autocomplete fallbacks" value={stats.autocompleteFallbacks.toLocaleString()} hint="premium provider failed → free" />
        <StatCard label="Geocode fallbacks" value={stats.geocodeFallbacks.toLocaleString()} hint="Census+Photon failed → zip centroid" />
        <StatCard label="Lookup errors" value={stats.lookupErrors.toLocaleString()} />
        <StatCard label="Range" value={stats.from === stats.to ? stats.from : `${stats.from} → ${stats.to}`} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-ink-900">Top visitors (by IP)</div>
          {stats.topIps.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">No search activity yet.</p>
          ) : (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1 text-sm">
              {stats.topIps.map((r) => (
                <li key={r.ip} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-[12px] text-slate-600">{r.ip}</span>
                  <span className="font-bold text-ink-900">{r.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-ink-900">Top searched areas</div>
          {stats.topAreas.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">No search activity yet.</p>
          ) : (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1 text-sm">
              {stats.topAreas.map((r) => (
                <li key={r.area} className="flex justify-between gap-3">
                  <span className="truncate text-slate-600">{r.area}</span>
                  <span className="font-bold text-ink-900">{r.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ServerView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [sr, bl] = await Promise.all([
        fetch("/api/owner/server-report").then((r) => r.json()),
        fetch("/api/owner/backend-log").then((r) => r.json()),
      ]);
      setStats(sr.stats ?? null);
      setReports(Array.isArray(sr.reports) ? sr.reports : []);
      setEvents(Array.isArray(bl.events) ? bl.events : []);
    } catch {
      setError("Failed to load server data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(type: "daily" | "monthly") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/server-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to generate report.");
        return;
      }
      setSelected(json.report);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openReport(id: string) {
    setError(null);
    const json = await fetch(`/api/owner/server-report?id=${encodeURIComponent(id)}`).then((r) => r.json());
    if (json.report) setSelected(json.report);
  }

  async function removeReport(id: string) {
    if (!window.confirm("Delete this report? This can't be undone.")) return;
    setError(null);
    const res = await fetch(`/api/owner/server-report?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete report.");
      return;
    }
    if (selected?.id === id) setSelected(null);
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Server management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live production stats and backend health. Generate a point-in-time report anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => generate("daily")} disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            Generate daily report
          </button>
          <button type="button" onClick={() => generate("monthly")} disabled={busy}
            className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60">
            Generate monthly digest
          </button>
          <button type="button" onClick={load}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Today */}
      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Today so far</h2>
      <div className="mt-2">{stats ? <StatsView stats={stats} /> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading…</div>}</div>

      {/* Saved reports */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Saved reports</h2>
      <div className="mt-2 grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {reports.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No reports yet. Generate one above.</p>
          ) : (
            <ul className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
              {reports.map((r) => (
                <li key={r.id} className="group flex items-center gap-1">
                  <button type="button" onClick={() => openReport(r.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      selected?.id === r.id ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-700"
                    }`}>
                    <span className="block truncate">{r.label}</span>
                    <span className="block text-[11px] text-slate-400">{fmt(r.generatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReport(r.id)}
                    aria-label="Delete report"
                    title="Delete report"
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <span aria-hidden className="text-base leading-none">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {selected ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-ink-900">{selected.label}</div>
                  <div className="text-[11px] text-slate-400">Generated {fmt(selected.generatedAt)}</div>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-700">Close</button>
              </div>
              <StatsView stats={selected.data} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
              Select a report to view it, or generate a new one.
            </div>
          )}
        </div>
      </div>

      {/* Backend events */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Recent backend events</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {events.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No events — backend is healthy.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Event</th><th className="px-4 py-2.5">Detail</th><th className="px-4 py-2.5">Alerted</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{fmt(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {KIND_LABEL[e.kind] || e.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{e.detail}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{e.notified ? "Emailed" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ServerPage() {
  return (
    <AppShell active="server">
      {(me) =>
        me.isOwner ? (
          <ServerView />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Server management is available to the product owner only.
          </div>
        )
      }
    </AppShell>
  );
}
