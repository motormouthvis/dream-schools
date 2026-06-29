"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { SchoolDetailModal } from "@/components/SchoolDetailModal";
import { getRecent, addRecent, type RecentSearch } from "@/lib/recent";
import type { LookupResult } from "@/lib/types";

// Chrome-less "School Rating Explorer" served for the embeddable widget.
//
// Loaded inside an iframe by public/embed.js (popup or inline mode):
//   /embed?address=...&lat=..&lng=..&accent=%23..&mode=popup|inline&header=1
//
// Behaviour mirrors the main site: a home screen with a search bar + recent
// searches (cookies) when no address is resolved, the schools list/map for a
// resolved address, and the school detail rendered INLINE inside the iframe.
//
// Real-estate context: the detail shows a single 0–10 Diversity Index instead of
// any race breakdown (race data is only on the main, non-real-estate website).

interface EmbedParams {
  address: string;
  lat: number | null;
  lon: number | null;
  accent: string;
  mode: "popup" | "inline";
  header: boolean;
}

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

function readParams(): EmbedParams {
  const p = new URLSearchParams(window.location.search);
  const num = (v: string | null) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : null;
  };
  return {
    address: (p.get("address") || "").trim(),
    lat: num(p.get("lat")),
    lon: num(p.get("lon") ?? p.get("lng")),
    accent: p.get("accent") || "#1fa55f",
    mode: p.get("mode") === "inline" ? "inline" : "popup",
    header: p.get("header") === "1",
  };
}

// "910 FAIRWAY DR NE, WARREN, OH, 44483" -> "Warren, OH"
function cityState(matched: string, fallbackState: string): string {
  const parts = (matched || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop();
  const rawState = parts.length >= 2 ? parts[parts.length - 1] : "";
  const rawCity = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
  const title = (s: string) =>
    s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const state = /^[A-Za-z]{2}$/.test(rawState)
    ? rawState.toUpperCase()
    : (fallbackState || "").toUpperCase();
  return [title(rawCity), state].filter(Boolean).join(", ");
}

const PIN_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function EmbedExplorer() {
  const [params, setParams] = useState<EmbedParams | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);

  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [focused, setFocused] = useState(false);
  const [changing, setChanging] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const acRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = params?.accent || "#1fa55f";
  const isInline = params?.mode === "inline";
  const screen: "home" | "results" = data ? "results" : "home";
  const showSearch = screen === "home" || changing;

  const runLookup = useCallback(async (query: string, picked?: Suggestion) => {
    const q = query.trim();
    const hasCoords = picked && Number.isFinite(picked.lat) && Number.isFinite(picked.lon);
    if (!q && !hasCoords) return;
    setShowSuggest(false);
    setSelected(null);
    setLoading(true);
    setError(null);
    try {
      const coords = hasCoords
        ? `&lat=${picked!.lat}&lon=${picked!.lon}&zip=${encodeURIComponent(picked!.zip || "")}`
        : "";
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(q || `${picked!.lat},${picked!.lon}`)}${coords}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setData(null);
      } else {
        const result = json as LookupResult;
        setData(result);
        setChanging(false);
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
      setError("Network error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const parsed = readParams();
    setParams(parsed);
    setRecents(getRecent());
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setNationwide(Boolean(j.nationwide)))
      .catch(() => {});
    if (parsed.address || (parsed.lat != null && parsed.lon != null)) {
      const picked =
        parsed.lat != null && parsed.lon != null
          ? { label: parsed.address, lat: parsed.lat, lon: parsed.lon, zip: "" }
          : undefined;
      runLookup(parsed.address, picked);
    }
  }, [runLookup]);

  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    closeRef.current = () => setSelected(null);
  });
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
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      try {
        const bp = data?.center ?? recents.find((r) => r.lat != null && r.lon != null) ?? null;
        const bias = bp && bp.lat != null && bp.lon != null ? `&lat=${bp.lat}&lon=${bp.lon}` : "";
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(address)}${bias}`, {
          signal: ac.signal,
        });
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
        setShowSuggest(true);
        setActiveIdx(-1);
      } catch {
        /* aborted or network error — keep prior list */
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function goHome() {
    setData(null);
    setSelected(null);
    setError(null);
    setChanging(false);
    setAddress("");
    setSuggestions([]);
    setShowSuggest(false);
  }

  function beginChange() {
    setChanging(true);
    setAddress("");
    setSuggestions([]);
    setShowSuggest(false);
    setFocused(true);
    inputRef.current?.focus();
  }

  const resolvedCityState = data ? cityState(data.geocode.matchedAddress, data.district.state) : "";

  const SearchField = (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌖</span>
      <input
        ref={inputRef}
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          if (e.target.value) e.target.select();
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
        placeholder="Enter a US address to find nearby schools"
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
  );

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Inline embeds have no SDK chrome, so brand the iframe itself. */}
      {isInline && (
        <header
          className="flex items-center gap-2.5 px-4 py-2.5 text-white sm:px-5"
          style={{ background: accent }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
            {PIN_SVG}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Dream Neighborhood School Explorer</p>
            <p className="hidden text-[11px] leading-tight text-white/85 sm:block">
              Ratings, test scores &amp; safety for nearby schools
            </p>
          </div>
        </header>
      )}

      <div className="flex-1">
        {/* ---- HOME SCREEN ---- */}
        {screen === "home" && (
          <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:pt-7">
            {/* Hero */}
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-lime-50 ring-1 ring-inset ring-brand-600/10">
              <div className="grid items-center gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8 sm:py-8">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
                    School Rating Explorer
                  </span>
                  <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
                    Find Your Dream School
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    See a 1–10 rating, test scores, college readiness &amp; safety for every public
                    school near any address — nationwide. Private schools included (limited data).
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/showcase.png"
                  alt="Neighborhood with a school and children"
                  className="hidden h-44 w-full rounded-2xl object-cover object-[center_72%] shadow-sm sm:block"
                />
              </div>
            </div>

            {/* Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runLookup(address);
              }}
              className="mt-5 flex flex-col gap-2 sm:flex-row"
            >
              {SearchField}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: accent }}
              >
                {loading ? "Searching…" : "Search schools"}
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* What you get */}
            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["★", "Dream Rating", "One 1–10 score per school"],
                ["✎", "Test scores", "Reading & math proficiency"],
                ["🎓", "College readiness", "Graduation, AP/IB & SAT/ACT"],
                ["🛡", "Safety", "Incidents vs. state & US"],
              ].map(([icon, t, d]) => (
                <div key={t} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="text-lg" aria-hidden>{icon}</div>
                  <p className="mt-1 text-sm font-bold text-slate-800">{t}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{d}</p>
                </div>
              ))}
            </div>

            {/* Realtor CTA — get the widget */}
            <div className="mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d5c52] to-brand-700 p-5 text-white shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold leading-tight sm:text-xl">
                    Get the Neighborhood Explorer Here
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-white/85">
                    Add this to your real-estate site and give buyers instant neighborhood &amp;
                    school insight on every listing.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-semibold text-[#d9f99d]">
                    <li className="flex items-center gap-1.5"><span aria-hidden>✓</span> Free for life</li>
                    <li className="flex items-center gap-1.5"><span aria-hidden>✓</span> No ads, ever</li>
                    <li className="flex items-center gap-1.5"><span aria-hidden>✓</span> One line of code</li>
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                  <a
                    href="https://www.dreamneighborhood.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-brand-800 shadow-sm transition hover:bg-white/90"
                  >
                    See the benefits
                  </a>
                  <a
                    href="https://app.dreamneighborhood.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-[#d9f99d] px-4 py-2.5 text-center text-sm font-bold text-[#0d5c52] shadow-sm transition hover:bg-[#cded8f]"
                  >
                    Sign up free
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- RESULTS SCREEN ---- */}
        {screen === "results" && data && (
          <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-4">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={goHome}
                aria-label="Home"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
                </svg>
                <span className="hidden sm:inline">Home</span>
              </button>

              {!changing ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                    <span className="mr-1">📍</span>
                    {resolvedCityState}
                    {data.district?.name ? (
                      <>
                        {" · "}
                        <span className="text-brand-700">{data.district.name} School District</span>
                      </>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    onClick={beginChange}
                    className="shrink-0 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runLookup(address);
                  }}
                  className="flex min-w-0 flex-1 gap-2"
                >
                  {SearchField}
                  <button
                    type="submit"
                    disabled={loading}
                    className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
                    style={{ background: accent }}
                  >
                    {loading ? "…" : "Go"}
                  </button>
                </form>
              )}
            </div>

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

            {!loading && !error && selected && (
              <SchoolDetailModal
                ncesId={selected}
                fairHousing={false}
                variant="inline"
                embed
                onClose={() => setSelected(null)}
              />
            )}

            {!loading && !error && !selected && (
              <SchoolsTab
                data={data}
                nationwide={nationwide}
                fairHousing={false}
                view={view}
                onViewChange={setView}
                onOpenSchool={setSelected}
              />
            )}
          </div>
        )}
      </div>

      {/* Inline embeds: brand footer (popup mode gets this from the SDK panel). */}
      {isInline && (
        <footer className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-400">
          Powered by{" "}
          <a
            href="https://www.dreamneighborhoodschools.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 hover:underline"
          >
            Dream Neighborhood Schools
          </a>
        </footer>
      )}
    </main>
  );
}
