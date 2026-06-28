"use client";

import { useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { Logo } from "@/components/Logo";
import { SettingsMenu } from "@/components/SettingsMenu";
import { DataSourcesModal } from "@/components/DataSourcesModal";
import { Showcase } from "@/components/Showcase";
import { getRecent, addRecent, type RecentSearch } from "@/lib/recent";
import type { LookupResult } from "@/lib/types";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

// "910 FAIRWAY DR NE, WARREN, OH, 44483" -> "Warren, OH"
function cityState(matched: string, fallbackState: string): string {
  const parts = (matched || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Drop a trailing zip if present.
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop();
  const rawState = parts.length >= 2 ? parts[parts.length - 1] : "";
  const rawCity = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
  const title = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  const state =
    /^[A-Za-z]{2}$/.test(rawState) ? rawState.toUpperCase() : (fallbackState || "").toUpperCase();
  const city = title(rawCity);
  return [city, state].filter(Boolean).join(", ");
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
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const acRef = useRef<AbortController | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [audience, setAudience] = useState<"full" | "fairhousing">("full");
  const [view, setView] = useState<"list" | "map">("list");
  const [showDataSources, setShowDataSources] = useState(false);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [focused, setFocused] = useState(false);
  const [changing, setChanging] = useState(false);
  const fairHousing = audience === "fairhousing";
  const showSearch = !data || changing;

  useEffect(() => {
    setRecents(getRecent());
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
      // Cancel any in-flight request so the latest keystroke always wins
      // (prevents slow/out-of-order responses from showing stale suggestions).
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(address)}`, {
          signal: ac.signal,
        });
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
        setShowSuggest(true);
        setActiveIdx(-1);
      } catch {
        /* aborted (newer query in flight) or network error — keep prior list */
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address]);

  function pickSuggestion(s: Suggestion) {
    suppressRef.current = true;
    setAddress(s.label);
    setShowSuggest(false);
    setFocused(false);
    setSuggestions([]);
    runLookup(s.label, s);
  }

  function pickRecent(r: RecentSearch) {
    setFocused(false);
    pickSuggestion({ label: r.label, lat: r.lat ?? NaN, lon: r.lon ?? NaN, zip: r.zip ?? "" });
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
        const result = json as LookupResult;
        setData(result);
        setChanging(false);
        // Persist this search (canonical matched address + coords) to cookies.
        setRecents(
          addRecent({
            label: result.geocode.matchedAddress || q,
            lat: result.center?.lat,
            lon: result.center?.lon,
            zip: result.geocode?.zip,
          })
        );
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

      {/* Line 2 — brand hero with illustration (always shown) */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-lime-50 ring-1 ring-inset ring-brand-600/10">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-3xl">
              Find Your Dream School
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
              Real ratings, test scores &amp; safety — public &amp; private, nationwide.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-schools.png"
            alt="Illustration of children walking to school"
            className="h-20 w-auto shrink-0 sm:h-28"
          />
        </div>
      </div>

      {/* Line 3 — search box (no address yet / changing) OR address bar */}
      {!showSearch && data && (
        <div className="mx-auto mt-4 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              <span className="mr-1">📍</span>
              {cityState(data.geocode.matchedAddress, data.district.state)} ·{" "}
              <span className="text-brand-700">{data.district.name} School District</span>
            </p>
            <p className="truncate text-xs text-slate-500">
              {(data.district.allSchools ?? data.district.schoolCount)} schools in district ·{" "}
              {(data.district.allStudents ?? data.district.studentCount).toLocaleString()} students
              (public + private)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // Reveal the form and focus the input SYNCHRONOUSLY within this tap
              // so mobile browsers open the keyboard (they block focus() in async
              // callbacks). React state catches up right after.
              formRef.current?.classList.remove("hidden");
              formRef.current?.classList.add("flex");
              inputRef.current?.focus();
              setChanging(true);
              setAddress("");
              setSuggestions([]);
              setShowSuggest(false);
              setFocused(true);
            }}
            className="shrink-0 rounded-lg border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          >
            Change address
          </button>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          runLookup(address);
        }}
        className={`mx-auto mt-4 max-w-2xl flex-col gap-2 sm:flex-row ${showSearch ? "flex" : "hidden"}`}
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌖
          </span>
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              if (e.target.value) e.target.select(); // highlight existing text for easy replace
              if (suggestions.length > 0) setShowSuggest(true);
            }}
            onBlur={() =>
              setTimeout(() => {
                setShowSuggest(false);
                setFocused(false);
              }, 150)
            }
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
            placeholder={data ? "Search or change address…" : "Enter a US address to find your Dream School"}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          {focused && !address.trim() && recents.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Recent searches
              </li>
              {recents.map((r, i) => (
                <li key={`${r.label}-${i}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickRecent(r);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="text-slate-300">🕘</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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

        {!loading && !error && !data && <Showcase />}
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
