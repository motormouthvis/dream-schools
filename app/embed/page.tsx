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
// Behaviour mirrors the main site: a beautiful home screen with a search bar +
// recent searches (saved in cookies) when no address is resolved, the schools
// list/map for a resolved address, and the school detail rendered INLINE inside
// the iframe (scrollable, with a back arrow) — never a popup over the popup.

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

export default function EmbedExplorer() {
  const [params, setParams] = useState<EmbedParams | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);

  // Search box state (mirrors the main site).
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
  // A resolved result switches us to the "results" screen; otherwise "home".
  const screen: "home" | "results" = data ? "results" : "home";
  const showSearch = screen === "home" || changing;

  const runLookup = useCallback(
    async (query: string, picked?: Suggestion) => {
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
    },
    []
  );

  // Read params on mount; resolve immediately if an address/coords were passed.
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

  // iOS-safe close protocol: retire transient layers (the inline detail) on
  // request and acknowledge so the host SDK can detach the iframe cleanly.
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

  // Debounced address autocomplete (free, via Photon/OSM), biased to the area.
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

  // The search field + its autocomplete / recent dropdowns (shared by both screens).
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
    <main className="min-h-screen bg-white">
      {/* ---- HOME SCREEN: hero + search, no schools listed ---- */}
      {screen === "home" && (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-6 sm:pt-10">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-lime-50 ring-1 ring-inset ring-brand-600/10">
            <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-3xl">
                  Find Your Dream School
                </h1>
                <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
                  Real ratings, test scores &amp; safety for public schools, nationwide. Private
                  schools included (limited data).
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
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ["Test scores", "State proficiency in reading & math"],
              ["College readiness", "Graduation, AP/IB & SAT/ACT"],
              ["Safety", "Incidents vs. state & US averages"],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-xs font-bold text-slate-800 sm:text-sm">{t}</p>
                <p className="mt-1 hidden text-[11px] leading-snug text-slate-500 sm:block">{d}</p>
              </div>
            ))}
          </div>

          <p className="mt-auto pt-6 text-center text-[11px] text-slate-400">
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
      )}

      {/* ---- RESULTS SCREEN: address bar + (list/map | inline detail) ---- */}
      {screen === "results" && data && (
        <div className="mx-auto max-w-3xl px-3 py-3 sm:py-4">
          {/* Sticky top bar: Home + address + change */}
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    <span className="mr-1">📍</span>
                    {resolvedCityState}
                    {data.district?.name ? (
                      <>
                        {" · "}
                        <span className="text-brand-700">{data.district.name} School District</span>
                      </>
                    ) : null}
                  </p>
                </div>
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

          {params?.mode === "inline" && (
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
          )}
        </div>
      )}
    </main>
  );
}
