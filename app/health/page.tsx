"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

interface BackendEvent {
  id: string;
  kind: string;
  detail: string;
  notified: boolean;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  autocomplete_fallback: "Autocomplete fallback",
  geocode_fallback: "Geocode fallback",
};

function fmt(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HealthView() {
  const [events, setEvents] = useState<BackendEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/owner/backend-log");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to load.");
        setEvents([]);
        return;
      }
      setEvents(Array.isArray(json.events) ? json.events : []);
    } catch {
      setError("Network error.");
      setEvents([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Backend health</h1>
          <p className="mt-1 text-sm text-slate-500">
            Events logged by the backend — e.g. when a paid provider throttles and we fall back to a
            free source. We&apos;ll add more signals here over time.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {events === null ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No events yet — the backend is healthy. Provider fallbacks and other health signals will
            appear here as they happen.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Detail</th>
                <th className="px-4 py-2.5">Alerted</th>
              </tr>
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
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {e.notified ? "Emailed" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <AppShell active="health">
      {(me) =>
        me.isOwner ? (
          <HealthView />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Backend health is available to the product owner only.
          </div>
        )
      }
    </AppShell>
  );
}
