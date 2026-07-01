"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { SchoolDetailModal } from "@/components/SchoolDetailModal";
import { getRecent, addRecent, type RecentSearch } from "@/lib/recent";
import type { LookupResult } from "@/lib/types";

// Chrome-less "Dream Neighborhood School Explorer" served for the embeddable
// widget. Loaded inside an iframe by public/embed.js (popup or inline):
//   /embed?address=...&lat=..&lng=..&accent=%23..&mode=popup|inline&header=1
//
// The free School Explorer is a loss leader for the paid full Neighborhood
// Explorer (38 hyperlocal insights). The detail shows a 0–10 Diversity Index
// instead of race data (real-estate Fair Housing safety). The widget is a
// fixed-height app: the home fits without scrolling and the results list
// scrolls within the frame.

interface EmbedParams {
  address: string;
  lat: number | null;
  lon: number | null;
  accent: string;
  mode: "popup" | "inline";
  header: boolean;
  links: boolean;
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
    links: p.get("links") === "1",
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

  // Inline embeds report their content height so the SDK can size the iframe to
  // fit (no fixed-height white space, never overly tall — long lists are capped
  // with internal scroll). Both the inline embed and the popup panel size to
  // this, so the popup is compact on the home screen and grows for results.
  useEffect(() => {
    // The SDK sizes the iframe to this height, so the iframe itself never needs a
    // scrollbar — internal regions (the results list) scroll on their own.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const report = () => {
      const h = Math.ceil(document.body.scrollHeight) + 2;
      if (h > 0) window.parent?.postMessage?.({ type: "dse:height", height: h }, "*");
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [isInline, screen, selected, loading, view, error]);

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

  // The embed fills its iframe; override the global `min-height:100vh` so inline
  // auto-height can shrink to content.
  useEffect(() => {
    document.body.style.minHeight = "0px";
    document.body.style.background = "#fff";
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
        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      {focused && !address.trim() && recents.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
    <main className="flex flex-col bg-white">
      {/* Inline embeds have no SDK chrome, so brand the iframe itself. */}
      {isInline && (
        <header
          className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-white"
          style={{ background: accent }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
            {PIN_SVG}
          </span>
          <p className="truncate text-[13px] font-bold leading-tight">
            Dream Neighborhood School Explorer
          </p>
        </header>
      )}

      {/* ---- HOME SCREEN (fits without scrolling on desktop) ---- */}
      {screen === "home" && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3">
          {/* Hero — one image with the heading overlaid (identical to the marketing site) */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-inset ring-brand-600/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-banner.png"
              alt="Children walking to a neighborhood schoolhouse"
              className="h-[230px] w-full object-cover object-right sm:h-[260px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30 sm:via-white/75 sm:to-transparent" />
            {/* Gentle sky/cloud wash in the top-left corner so the image box stays
                visible on light partner sites. */}
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
                Real ratings, test scores &amp; safety for any address.
              </p>
            </div>
          </div>

          {/* Search — floats over the hero for the integrated look (matches the site) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(address);
            }}
            className="relative z-10 mx-auto -mt-7 flex w-full max-w-xl flex-col gap-2 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/5 backdrop-blur sm:-mt-8 sm:flex-row"
          >
            {SearchField}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: accent }}
            >
              {loading ? "Searching…" : "Search schools"}
            </button>
          </form>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ---- RESULTS SCREEN (fixed chrome, list scrolls within) ---- */}
      {screen === "results" && data && (
        <div className="mx-auto flex w-full max-w-5xl flex-col px-3 pt-3 sm:px-4">
          <div className="mb-3 flex shrink-0 items-center gap-2">
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

          {/* Scroll region: only the results/detail scroll, chrome stays put.
              Fixed px cap (NOT vh — vh inside the iframe feeds back into the
              SDK-set iframe height and collapses it). */}
          <div className="max-h-[440px] overflow-y-auto pb-4">
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
                showExternalLinks={!!params?.links}
                backLabel={view === "map" ? "Back to map" : "Back to list"}
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
                listColumns={2}
              />
            )}
          </div>
        </div>
      )}

      {/* Footer — single line: copyright + legal. */}
      <footer className="shrink-0 border-t border-slate-100 px-4 py-1.5 text-center text-[10px] text-slate-500">
        © 2026 Dream Neighborhood ·{" "}
        <a
          href="https://docs.google.com/document/d/e/2PACX-1vSndxJR71x1k8uI1vmjOZGYvWfpxM-TJSFuMVXclgzx_h5P1Iey2BdKlY0DDiVPSGTJLn0NMLYKXTB5/pub"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-600 hover:underline"
        >
          Terms
        </a>{" "}
        ·{" "}
        <a
          href="https://docs.google.com/document/d/e/2PACX-1vREF8QKsVkEpUyWff3FWUU8D4GoS2aRtz67qgCTmMb2uIQcXHjaqgBtJi6OBhUw-uZsqgM5itrsrxFR/pub"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-600 hover:underline"
        >
          Privacy
        </a>
      </footer>
    </main>
  );
}
