"use client";

import { useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { Logo } from "@/components/Logo";
import { SettingsMenu } from "@/components/SettingsMenu";
import { DataSourcesModal } from "@/components/DataSourcesModal";
import { ExplorerPromo } from "@/components/ExplorerPromo";
import { getRecent, addRecent, removeRecent, type RecentSearch } from "@/lib/recent";
import type { LookupResult } from "@/lib/types";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

const US_STATE_NAMES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware",
  "florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky",
  "louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri",
  "montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york",
  "north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont","virginia","washington",
  "west virginia","wisconsin","wyoming","district of columbia",
]);

// "910 FAIRWAY DR NE, WARREN, OH, 44483" -> "Warren, OH"
// "White City, Port Saint Lucie, Florida" -> "White City, FL"
function cityState(matched: string, fallbackState: string): string {
  const state = (fallbackState || "").toUpperCase();
  const title = (s: string) =>
    s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const parts = (matched || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Strip trailing zip / country / state (2-letter or full name) tokens.
  const isTail = (s: string) =>
    /^\d{5}(-\d{4})?$/.test(s) ||
    /^(usa|u\.?s\.?a?\.?|united states(?: of america)?)$/i.test(s) ||
    /^[A-Za-z]{2}$/.test(s) ||
    /^[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(s) ||
    US_STATE_NAMES.has(s.toLowerCase());
  while (parts.length > 1 && isTail(parts[parts.length - 1])) parts.pop();
  // Street addresses lead with a house number → the city is the LAST locality part
  // (before the state); place/city searches → the first (most specific) part.
  const city = parts.length && /^\d/.test(parts[0]) ? parts[parts.length - 1] : parts[0] || "";
  return [title(city), state].filter(Boolean).join(", ");
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
        // Bias suggestions toward the area being explored (current result, or
        // the most recent search) so partial street addresses resolve to the
        // right city instead of a same-named street across the country.
        const bp =
          data?.center ?? recents.find((r) => r.lat != null && r.lon != null) ?? null;
        const bias = bp && bp.lat != null && bp.lon != null ? `&lat=${bp.lat}&lon=${bp.lon}` : "";
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(address)}${bias}`, {
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
        <a href="/" aria-label="Dream Neighborhood — home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Logo />
        </a>
        <SettingsMenu
          view={view}
          onView={setView}
          audience={audience}
          onAudience={setAudience}
          onOpenDataSources={() => setShowDataSources(true)}
        />
      </div>

      {/* Line 2 — hero. Landing: one image banner with the heading overlaid;
          results: a slim heading to keep the page compact. */}
      {!data ? (
        <div className="relative mt-4 overflow-hidden rounded-3xl ring-1 ring-inset ring-brand-600/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-banner.png"
            alt="A friendly neighborhood with a school and children walking"
            className="h-[230px] w-full object-cover object-right sm:h-[260px]"
          />
          {/* Stronger scrim on mobile (text wraps to more lines) so the tagline stays readable. */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30 sm:via-white/75 sm:to-transparent" />
          {/* Gentle sky/cloud wash in the top-left corner so the image box stays
              visible on light websites. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(240px 190px at top left, rgba(180,220,100,0.24), rgba(180,220,100,0) 72%)" }}
          />
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
            <h1 className="max-w-md text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
              School Explorer
            </h1>
            <p className="mt-1 max-w-[15rem] text-base font-bold leading-snug text-ink-800 sm:max-w-md sm:text-xl">
              Find the Best Schools in Your New Neighborhood
            </p>
            <p className="mt-2 max-w-[17rem] text-xs font-semibold leading-snug text-slate-700 sm:max-w-sm">
              Real ratings, test scores &amp; safety for any address —{" "}
              <span className="font-bold text-brand-700">free, forever.</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2.5">
          <span className="h-6 w-1.5 rounded-full bg-brand-500" />
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
            Find Your Dream School
          </h1>
        </div>
      )}

      {/* Line 3 — search box (no address yet / changing) OR address bar */}
      {!showSearch && data && (
        <div className="mx-auto mt-4 flex max-w-2xl items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <button
            type="button"
            aria-label="Home"
            title="Home"
            onClick={() => {
              setData(null);
              setAddress("");
              setChanging(false);
              setSuggestions([]);
              setShowSuggest(false);
              setFocused(false);
              setError(null);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
            </svg>
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              <span className="mr-1">📍</span>
              {cityState(data.geocode.matchedAddress, data.district.state)} ·{" "}
              <span className="text-brand-700">{data.district.name} School District</span>
            </p>
            <p className="truncate text-xs text-slate-500">
              {data.nearbySchools.length} schools nearby ·{" "}
              {data.nearbySchools
                .reduce((sum, s) => sum + (s.enrollment || 0), 0)
                .toLocaleString()}{" "}
              students (public + private)
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
        className={`relative z-10 mx-auto max-w-2xl flex-col gap-2 sm:flex-row ${
          showSearch ? "flex" : "hidden"
        } ${
          !data
            ? "-mt-7 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/5 backdrop-blur sm:-mt-8"
            : "mt-4"
        }`}
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
                <li key={`${r.label}-${i}`} className="group flex items-center transition hover:bg-slate-50">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickRecent(r);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-slate-700"
                  >
                    <span className="text-slate-300">🕘</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r.label} from recent searches`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRecents(removeRecent(r.label));
                    }}
                    className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <span aria-hidden className="text-base leading-none">×</span>
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
            listColumns={2}
          />
        )}

        {!loading && !error && !data && <ExplorerPromo />}
      </div>

      {/* Footnote: coverage (moved off the top to declutter) */}
      <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-slate-400">
        {nationwide
          ? "Coverage: ~119k U.S. public & private schools (NCES CCD, CRDC, EDFacts, PSS). Private-school data is limited. "
          : "Demo coverage: 10 zip codes around 34946 (Fort Pierce / St. Lucie County, FL). "}
        Data sources &amp; methodology in the menu under “Data sources.”
      </p>

      {/* Footer — matches dreamneighborhood.com */}
      <footer className="mx-auto mt-10 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>© 2026 Dream Neighborhood. All rights reserved.</p>
        <div className="mt-2 flex items-center justify-center gap-5">
          <a
            href="https://docs.google.com/document/d/e/2PACX-1vSndxJR71x1k8uI1vmjOZGYvWfpxM-TJSFuMVXclgzx_h5P1Iey2BdKlY0DDiVPSGTJLn0NMLYKXTB5/pub"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 transition hover:text-brand-700"
          >
            Terms of Service
          </a>
          <a
            href="https://docs.google.com/document/d/e/2PACX-1vREF8QKsVkEpUyWff3FWUU8D4GoS2aRtz67qgCTmMb2uIQcXHjaqgBtJi6OBhUw-uZsqgM5itrsrxFR/pub"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 transition hover:text-brand-700"
          >
            Privacy Policy
          </a>
        </div>
      </footer>

      {showDataSources && <DataSourcesModal onClose={() => setShowDataSources(false)} />}
    </main>
  );
}
