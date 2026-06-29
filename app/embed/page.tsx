"use client";

import { useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import type { LookupResult } from "@/lib/types";

// Chrome-less "School Rating Explorer" served for the embeddable widget.
//
// Loaded inside an iframe by public/embed.js (popup or inline mode). It reuses
// the same lookup + rating UI as the main app, scoped to a single address:
//
//   /embed?address=...&lat=..&lng=..&accent=%23..&mode=popup|inline&header=1
//
// When no address is supplied (scraping found nothing and no default is set),
// it shows a manual-entry search so the partner's visitor can still explore.

interface EmbedParams {
  address: string;
  lat: number | null;
  lon: number | null;
  accent: string;
  mode: "popup" | "inline";
  header: boolean;
}

function readParams(): EmbedParams {
  const p = new URLSearchParams(window.location.search);
  const num = (v: string | null) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : null;
  };
  const mode = p.get("mode") === "inline" ? "inline" : "popup";
  return {
    address: (p.get("address") || "").trim(),
    lat: num(p.get("lat")),
    lon: num(p.get("lon") ?? p.get("lng")),
    accent: p.get("accent") || "#1fa55f",
    mode,
    // The popup panel supplies its own chrome header, so the iframe only shows
    // its header when a host explicitly asks (inline mode with header=1).
    header: p.get("header") === "1",
  };
}

export default function EmbedExplorer() {
  const [params, setParams] = useState<EmbedParams | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [manual, setManual] = useState("");
  const accent = params?.accent || "#1fa55f";

  // Read params on mount (avoids useSearchParams' Suspense requirement).
  useEffect(() => {
    const parsed = readParams();
    setParams(parsed);
    setManual(parsed.address);
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setNationwide(Boolean(j.nationwide)))
      .catch(() => {});
    if (parsed.address || (parsed.lat != null && parsed.lon != null)) {
      runLookup(parsed.address, parsed.lat, parsed.lon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // iOS-safe close protocol: the host SDK asks us to retire any fixed layers
  // (the school detail modal) before it detaches the iframe, and waits for the
  // ack. We close transient UI and immediately acknowledge.
  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e?.data?.type === "dse:close") {
        try {
          closeRef.current();
        } finally {
          (e.source as Window | null)?.postMessage?.({ type: "dse:close-ack" }, "*");
          window.parent?.postMessage?.({ type: "dse:close-ack" }, "*");
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function runLookup(address: string, lat: number | null, lon: number | null) {
    const q = address.trim();
    if (!q && (lat == null || lon == null)) return;
    setLoading(true);
    setError(null);
    try {
      const coords = lat != null && lon != null ? `&lat=${lat}&lon=${lon}` : "";
      const res = await fetch(
        `/api/lookup?address=${encodeURIComponent(q || `${lat},${lon}`)}${coords}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setData(null);
      } else {
        setData(json as LookupResult);
      }
    } catch {
      setError("Network error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const resolvedAddress = data?.geocode.matchedAddress || params?.address || "";

  return (
    <main className="min-h-screen bg-white">
      {params?.header && (
        <header
          className="flex items-center gap-2.5 px-4 py-2.5 text-white"
          style={{ background: accent }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">School Rating Explorer</p>
            {resolvedAddress && (
              <p className="truncate text-xs leading-tight text-white/80">{resolvedAddress}</p>
            )}
          </div>
        </header>
      )}

      <div className="mx-auto max-w-3xl px-3 py-4">
        {/* Manual entry — prominent when nothing resolved, compact otherwise. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runLookup(manual, null, null);
          }}
          className="mb-4 flex gap-2"
        >
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Enter a US address to see nearby school ratings"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
            style={{ background: accent }}
          >
            {loading ? "…" : "Search"}
          </button>
        </form>

        {loading && (
          <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Looking up schools…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <SchoolsTab
            data={data}
            nationwide={nationwide}
            fairHousing={false}
            view={view}
            onViewChange={setView}
          />
        )}

        {!loading && !error && !data && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Enter an address above to explore school ratings nearby.
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Powered by{" "}
          <a
            href="https://www.dreamneighborhoodschools.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 hover:underline"
          >
            Dream Neighborhood Schools
          </a>
        </p>
      </div>
    </main>
  );
}
