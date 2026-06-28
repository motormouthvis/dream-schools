"use client";

import { useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { Logo } from "@/components/Logo";
import { SettingsMenu } from "@/components/SettingsMenu";
import { DataSourcesModal } from "@/components/DataSourcesModal";
import type { LookupResult } from "@/lib/types";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const [nationwide, setNationwide] = useState(false);
  const [audience, setAudience] = useState<"full" | "fairhousing">("full");
  const [view, setView] = useState<"list" | "map">("list");
  const [showDataSources, setShowDataSources] = useState(false);
  const fairHousing = audience === "fairhousing";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setNationwide(Boolean(j.nationwide)))
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("address");
    if (initial) {
      setAddress(initial);
      runLookup(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced address autocomplete (free, via Photon/OSM).
  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    if (address.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(address)}`);
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
        setShowSuggest(true);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address]);

  function pickSuggestion(s: Suggestion) {
    suppressRef.current = true;
    setAddress(s.label);
    setShowSuggest(false);
    setSuggestions([]);
    runLookup(s.label, s);
  }

  async function runLookup(query: string, picked?: Suggestion) {
    const q = query.trim();
    if (!q) return;
    setShowSuggest(false);
    setLoading(true);
    setError(null);
    try {
      const coords = picked ? `&lat=${picked.lat}&lon=${picked.lon}&zip=${encodeURIComponent(picked.zip)}` : "";
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(q)}${coords}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setData(null);
      } else {
        setData(json as LookupResult);
      }
    } catch {
      setError("Network error. Is the dev server running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-4">
      {/* Top bar: logo + settings hamburger */}
      <div className="flex items-center justify-between">
        <Logo />
        <SettingsMenu
          view={view}
          onView={setView}
          audience={audience}
          onAudience={setAudience}
          onOpenDataSources={() => setShowDataSources(true)}
        />
      </div>

      {/* Compact hero with illustration */}
      <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-lime-50 ring-1 ring-inset ring-brand-600/10">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-3xl">
              Find the right schools <br className="hidden sm:block" />
              for any address
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Real ratings, test scores &amp; safety — public &amp; private, nationwide.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-schools.png"
            alt="Illustration of children walking to school"
            className="hidden h-28 w-auto sm:block"
          />
        </div>
        <img
          src="/hero-schools.png"
          alt=""
          className="mt-3 block h-28 w-full object-cover object-top sm:hidden"
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runLookup(address);
        }}
        className="mx-auto mt-4 flex max-w-2xl flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌖
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            onKeyDown={(e) => {
              if (!showSuggest || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && activeIdx >= 0) {
                e.preventDefault();
                pickSuggestion(suggestions[activeIdx]);
              } else if (e.key === "Escape") {
                setShowSuggest(false);
              }
            }}
            autoComplete="off"
            placeholder="Start typing any US address…"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          {showSuggest && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(s);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      i === activeIdx ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-slate-300">⌖</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-lime2-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-sm transition hover:bg-lime2-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-8">
        {loading && (
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow">
            Looking up schools…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <SchoolsTab
            data={data}
            nationwide={nationwide}
            fairHousing={fairHousing}
            view={view}
            onViewChange={setView}
          />
        )}

        {!loading && !error && !data && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-400">
            Enter an address above to explore its schools.
          </div>
        )}
      </div>

      {/* Footnote: coverage (moved off the top to declutter) */}
      <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-slate-400">
        {nationwide
          ? "Coverage: ~119k U.S. public & private schools (NCES CCD, CRDC, EDFacts, PSS). "
          : "Demo coverage: 10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL). "}
        Data sources &amp; methodology in the menu under “Data sources.”
      </p>

      {showDataSources && <DataSourcesModal onClose={() => setShowDataSources(false)} />}
    </main>
  );
}
