"use client";

import { useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
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
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700 ring-1 ring-inset ring-brand-600/20">
          Dream Neighborhood
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Neighborhood Schools Explorer
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
          Enter an address to see its school district, an overall quality score, the three-category
          quality index, and nearby schools.{" "}
          {nationwide
            ? "Coverage: ~119k U.S. public & private schools (NCES CCD + CRDC + PSS)."
            : "Demo coverage: 10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL)."}
        </p>

        {/* Audience / compliance mode */}
        <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2">
          <label htmlFor="audience" className="text-xs font-medium text-slate-500">
            View mode
          </label>
          <select
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as "full" | "fairhousing")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="full">Full data (research / families)</option>
            <option value="fairhousing">Fair Housing Compliant (real estate)</option>
          </select>
        </div>
        {fairHousing && (
          <p className="mx-auto mt-2 max-w-md text-[11px] text-slate-400">
            Protected-class data (race &amp; gender) is hidden to prevent steering, per Fair Housing
            guidance.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runLookup(address);
        }}
        className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row"
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
          <SchoolsTab data={data} nationwide={nationwide} fairHousing={fairHousing} />
        )}

        {!loading && !error && !data && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-400">
            Enter an address above or pick a sample to load the Schools tab.
          </div>
        )}
      </div>
    </main>
  );
}
