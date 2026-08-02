"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import { NearbySchoolsFull } from "@/components/embed/NearbySchoolsFull";
import { MinimalistSchools } from "@/components/embed/MinimalistSchools";
import { SchoolDetailModal } from "@/components/SchoolDetailModal";
import { SchoolhouseMark } from "@/components/Logo";
import { getRecent, addRecent, removeRecent, type RecentSearch } from "@/lib/recent";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";
import { NEIGHBORHOOD_INSIGHTS } from "@/lib/neighborhoodInsights";
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
  variant: "classic" | "full" | "minimalist";
  fullHeight: number;
  header: boolean;
  links: boolean;
  provider: string;
  business: string;
  customer: string;
  partner: string;
  upgradeViews: number;
  upgradeDays: number;
  upgradeIdle: number;
  upgradeRequestSuppressDays: number;
}

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

/** Sync peek of ?address / ?lat so we can skip the home search flash on auto-load. */
function peekAutoTarget(): { address: string; hasTarget: boolean } {
  if (typeof window === "undefined") return { address: "", hasTarget: false };
  const p = new URLSearchParams(window.location.search);
  const address = (p.get("address") || "").trim();
  const lat = parseFloat(p.get("lat") ?? "");
  const lon = parseFloat(p.get("lng") ?? p.get("lon") ?? "");
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  return { address, hasTarget: Boolean(address || hasCoords) };
}

function peekIsInline(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mode") === "inline";
}

function peekIsFull(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("variant") === "full";
}

function peekIsMinimal(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("variant") === "minimalist";
}

function peekNative(): boolean {
  const c = readAppearanceCookie();
  const v = c ?? (peekIsFull() ? "full" : peekIsMinimal() ? "minimalist" : "classic");
  return v === "full" || v === "minimalist";
}

// Temporary appearance switcher (footer): remembers the chosen inline variant in
// a cookie so it can be compared across the three designs.
const APPEARANCE_COOKIE = "dse_embed_appearance";
type Variant = "classic" | "full" | "minimalist";
const VARIANTS: Variant[] = ["classic", "full", "minimalist"];
const VARIANT_LABEL: Record<Variant, string> = {
  classic: "Compact",
  full: "Showcase",
  minimalist: "Minimalist",
};
function readAppearanceCookie(): Variant | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + APPEARANCE_COOKIE + "=([^;]*)"));
  const v = m ? decodeURIComponent(m[1]) : "";
  return v === "classic" || v === "full" || v === "minimalist" ? v : null;
}
function writeAppearanceCookie(v: Variant): void {
  if (typeof document === "undefined") return;
  document.cookie = `${APPEARANCE_COOKIE}=${v};path=/;max-age=31536000;samesite=lax`;
}

function readParams(): EmbedParams {
  const p = new URLSearchParams(window.location.search);
  const num = (v: string | null) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : null;
  };
  const intParam = (key: string, fallback: number, min: number) => {
    const raw = p.get(key);
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) ? Math.max(min, n) : fallback;
  };
  return {
    address: (p.get("address") || "").trim(),
    lat: num(p.get("lat")),
    lon: num(p.get("lon") ?? p.get("lng")),
    accent: p.get("accent") || "#1fa55f",
    mode: p.get("mode") === "inline" ? "inline" : "popup",
    variant:
      p.get("variant") === "full" ? "full" : p.get("variant") === "minimalist" ? "minimalist" : "classic",
    fullHeight: Math.max(360, Math.min(1200, intParam("h", 640, 360))),
    header: p.get("header") === "1",
    links: p.get("links") === "1",
    provider: (p.get("provider") || "").trim(),
    business: (p.get("business") || "").trim(),
    customer: (p.get("customer") || "").trim(),
    partner: (p.get("partner") || "").trim(),
    upgradeViews: intParam("uv", 2, 1),
    upgradeDays: intParam("ud", 7, 0),
    upgradeIdle: intParam("ui", 8, 3),
    upgradeRequestSuppressDays: intParam("ur", 90, 0),
  };
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
  const isTail = (s: string) =>
    /^\d{5}(-\d{4})?$/.test(s) ||
    /^(usa|u\.?s\.?a?\.?|united states(?: of america)?)$/i.test(s) ||
    /^[A-Za-z]{2}$/.test(s) ||
    /^[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(s) ||
    US_STATE_NAMES.has(s.toLowerCase());
  while (parts.length > 1 && isTail(parts[parts.length - 1])) parts.pop();
  const city = parts.length && /^\d/.test(parts[0]) ? parts[parts.length - 1] : parts[0] || "";
  return [title(city), state].filter(Boolean).join(", ");
}

const PIN_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M12 3 2.5 8.5" />
    <path d="M12 3 21.5 8.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M3 20h18" />
    <rect x="10" y="14.5" width="4" height="5.5" />
    <path d="M12 3V1.2" />
    <path d="M11 2h2" />
  </svg>
);

export default function EmbedExplorer() {
  // Gate rendering until client mount so SSR never paints the home search UI
  // into the iframe (that was the ½–1s flash before auto-lookup finished).
  const [mounted, setMounted] = useState(false);
  const [params, setParams] = useState<EmbedParams | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  /** True while we auto-lookup from URL address/coords — never show the home search UI. */
  const [autoBoot, setAutoBoot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nationwide, setNationwide] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [schoolViews, setSchoolViews] = useState(0);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountedResultRef = useRef<string>("");
  /** Prevents a queued idle timer from reopening the ad after dismiss/request. */
  const upgradeSuppressedRef = useRef(false);

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
  // Appearance override (footer switcher, cookie-backed) wins over the snippet's variant.
  const [appearance, setAppearance] = useState<Variant | null>(null);
  useEffect(() => {
    setAppearance(readAppearanceCookie());
  }, []);
  const effVariant: Variant = appearance ?? params?.variant ?? "classic";
  const isFull = effVariant === "full";
  const isMinimal = effVariant === "minimalist";
  // Flat, native, page-flow variants (no accent header, no Home button).
  const isNative = isFull || isMinimal;
  function cycleAppearance() {
    const idx = VARIANTS.indexOf(effVariant);
    const next = VARIANTS[(idx + 1) % VARIANTS.length];
    writeAppearanceCookie(next);
    setAppearance(next);
    setSelected(null);
  }
  const headerTitle = `Dream Neighborhood School Explorer${params?.provider ? ` provided by ${params.provider}` : ""}`;

  const upgradeKey = params?.customer ? `dse-upgrade-prompt:${params.customer}` : "";
  const requestKey = params?.customer ? `dse-upgrade-requested:${params.customer}` : "";
  const viewCountKey = params?.customer ? `dse-upgrade-view-count:${params.customer}` : "";

  function incrementUpgradeView() {
    if (!viewCountKey) {
      setSchoolViews((n) => n + 1);
      return;
    }
    try {
      const next = Number(localStorage.getItem(viewCountKey) || 0) + 1;
      localStorage.setItem(viewCountKey, String(next));
      setSchoolViews(next);
    } catch {
      setSchoolViews((n) => n + 1);
    }
  }

  useEffect(() => {
    if (!viewCountKey) return;
    try {
      setSchoolViews(Number(localStorage.getItem(viewCountKey) || 0));
    } catch {
      /* ignore */
    }
  }, [viewCountKey]);

  useEffect(() => {
    if (!data || !params?.customer) return;
    const key = data.geocode?.matchedAddress || `${data.center?.lat || ""},${data.center?.lon || ""}`;
    if (!key || key === lastCountedResultRef.current) return;
    lastCountedResultRef.current = key;
    incrementUpgradeView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params?.customer]);

  function isWithinSuppressWindow(ts: number, days: number): boolean {
    if (!ts) return false;
    // days <= 0 means "no cooldown" — the ad stays repeatable (used for testing
    // and for accounts that set Minimum days between prompts to 0). A prior
    // dismiss/request must NOT suppress it in that case.
    if (days <= 0) return false;
    return Date.now() - ts < days * 86400000;
  }

  function canShowUpgrade(): boolean {
    if (upgradeSuppressedRef.current) return false;
    if (!params?.customer || !upgradeKey || !requestKey) return false;
    if (schoolViews < params.upgradeViews) return false;
    try {
      const dismissed = Number(localStorage.getItem(upgradeKey) || 0);
      const requested = Number(localStorage.getItem(requestKey) || 0);
      if (isWithinSuppressWindow(dismissed, params.upgradeDays)) return false;
      if (isWithinSuppressWindow(requested, params.upgradeRequestSuppressDays)) return false;
    } catch {
      return false;
    }
    return true;
  }

  /** Hide the ad immediately and stamp localStorage so it can't reappear this session / window. */
  function dismissUpgradeAd(kind: "dismiss" | "request") {
    upgradeSuppressedRef.current = true;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    try {
      const now = String(Date.now());
      if (kind === "request") {
        // Longer suppress for an explicit upgrade request
        if (requestKey) localStorage.setItem(requestKey, now);
        // Also stamp dismiss so short cooldown applies even if request stamp fails
        if (upgradeKey) localStorage.setItem(upgradeKey, now);
      } else if (upgradeKey) {
        localStorage.setItem(upgradeKey, now);
      }
    } catch {
      /* ignore quota / private mode */
    }
    setUpgradeVisible(false);
  }

  function scheduleUpgradePrompt() {
    if (!params) return;
    if (upgradeSuppressedRef.current || !canShowUpgrade()) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      if (canShowUpgrade()) setUpgradeVisible(true);
    }, params.upgradeIdle * 1000);
  }

  function recordActivity() {
    if (upgradeVisible || upgradeSuppressedRef.current) return;
    scheduleUpgradePrompt();
  }

  useEffect(() => {
    if (!params?.customer) return;
    // Sync in-memory suppress from storage (e.g. prior request/dismiss this browser).
    try {
      const dismissed = Number(localStorage.getItem(upgradeKey) || 0);
      const requested = Number(localStorage.getItem(requestKey) || 0);
      if (
        isWithinSuppressWindow(dismissed, params.upgradeDays) ||
        isWithinSuppressWindow(requested, params.upgradeRequestSuppressDays)
      ) {
        upgradeSuppressedRef.current = true;
      }
    } catch {
      /* ignore */
    }
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity as any));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.customer, schoolViews, upgradeVisible]);

  useEffect(() => {
    if (schoolViews >= (params?.upgradeViews || 2)) scheduleUpgradePrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolViews]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && upgradeVisible) dismissUpgradeAd("dismiss");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeVisible]);

  async function requestFullAccess() {
    // Close immediately — never leave a lingering "Request sent" screen.
    dismissUpgradeAd("request");
    if (!params?.customer) return;
    try {
      await fetch("/api/upgrade/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: params.customer,
          partnerId: params.partner,
          providerName: params.provider || params.business,
          requesterKey: (() => {
            try {
              const key = `dse-visitor:${params.customer}`;
              let v = localStorage.getItem(key);
              if (!v) {
                v = Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem(key, v);
              }
              return v;
            } catch {
              return "";
            }
          })(),
          address: params.address || address,
          source: params.mode,
        }),
      });
    } catch {
      // Already dismissed + suppressed; ignore network errors for UX.
    }
  }
  // home = empty search; boot = auto-detected address loading; results = schools ready
  const screen: "home" | "boot" | "results" = data
    ? "results"
    : autoBoot
      ? "boot"
      : "home";

  // Height coordination with the SDK:
  //  • Inline: report the exact content height so the iframe grows to fit
  //    (no white space, long lists cap with internal scroll).
  //  • Popup: DON'T report a content height (that fed back into the SDK-set
  //    iframe height and collapsed it). Instead announce which screen we're on;
  //    the SDK uses two fixed sizes — a "home" size tall enough to show the
  //    recent-searches dropdown, and a viewport-sized "expanded" size for results.
  //    Auto-boot uses "expanded" so the panel doesn't flash home→results size.
  useEffect(() => {
    const inline = isInline || peekIsInline();
    if (inline) {
      // Measure the FULL page including the recents/autocomplete dropdowns, which
      // are absolutely positioned below the search box. We must NOT clip overflow
      // (that would drop the dropdown from scrollHeight); scrolling=no on the
      // iframe keeps it scrollbar-free while the SDK grows it to fit.
      const report = () => {
        // Floor keeps the parent iframe from collapsing to a white sliver during auto-boot.
        const h = Math.max(540, Math.ceil(document.body.scrollHeight) + 2);
        if (h > 0) window.parent?.postMessage?.({ type: "dse:height", height: h }, "*");
      };
      report();
      requestAnimationFrame(report);
      const t = setTimeout(report, 60);
      const t2 = setTimeout(report, 400);
      const ro = new ResizeObserver(report);
      ro.observe(document.body);
      window.addEventListener("resize", report);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
        ro.disconnect();
        window.removeEventListener("resize", report);
      };
    }
    window.parent?.postMessage?.(
      {
        type: "dse:screen",
        // Prefer expanded when an address was passed in the iframe URL so the
        // popup doesn't flash the smaller "home" size during auto-boot.
        screen: screen === "home" && !peekAutoTarget().hasTarget ? "home" : "expanded",
      },
      "*"
    );
  }, [isInline, screen, selected, loading, view, error, focused, showSuggest, address, recents.length, appearance]);

  const runLookup = useCallback(async (query: string, picked?: Suggestion, opts?: { fromAuto?: boolean }) => {
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
        // Fall back to the home search UI if the auto-detected address failed.
        if (opts?.fromAuto) setAutoBoot(false);
      } else {
        const result = json as LookupResult;
        setData(result);
        setChanging(false);
        setAutoBoot(false);
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
      if (opts?.fromAuto) setAutoBoot(false);
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
    setMounted(true);
    const parsed = readParams();
    setParams(parsed);
    setRecents(getRecent());
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setNationwide(Boolean(j.nationwide)))
      .catch(() => {});
    if (parsed.address || (parsed.lat != null && parsed.lon != null)) {
      if (parsed.address) setAddress(parsed.address);
      setAutoBoot(true);
      setLoading(true);
      const picked =
        parsed.lat != null && parsed.lon != null
          ? { label: parsed.address, lat: parsed.lat, lon: parsed.lon, zip: "" }
          : undefined;
      runLookup(parsed.address, picked, { fromAuto: true });
    } else {
      setAutoBoot(false);
      setLoading(false);
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
    setAutoBoot(false);
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

  // Don't SSR the home search UI — that HTML flashes inside the iframe before
  // client auto-lookup runs. Until mount (and during auto-boot), show a neutral
  // loader — never the search-bar home screen.
  //
  // Before mount this branch IS the prerendered HTML for /embed, and /embed is
  // built statically, with no query string. Reading window.location here made
  // the first client render disagree with that HTML whenever an address was
  // passed — React #418, thrown on every customer page carrying the inline
  // embed. Both branches below are neutral loaders, so deferring the peek to
  // after mount costs a frame rather than a flash: the home search UI is still
  // never server-rendered, which is the thing this block exists to prevent.
  if (!mounted || screen === "boot") {
    const peek = mounted ? { address, hasTarget: autoBoot } : { address: "", hasTarget: false };
    const label = (peek.address || address).trim()
      ? `Looking up schools near ${(peek.address || address).split(",")[0].trim()}…`
      : "Looking up schools…";
    const showBoot = peek.hasTarget || screen === "boot";

    const inlineBoot = isInline || peekIsInline();
    return (
      <main
        className={`flex flex-col bg-white ${mounted && !inlineBoot ? "h-screen overflow-hidden" : "min-h-[540px]"}`}
        aria-busy="true"
      >
        {mounted && isInline && !peekNative() && (
          <header
            className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-white"
            style={{ background: accent }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
              {PIN_SVG}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p
                className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold leading-tight"
                title={headerTitle}
              >
                {headerTitle}
              </p>
            </div>
          </header>
        )}
        {showBoot ? (
          <div className={`mx-auto flex w-full max-w-5xl flex-col px-3 pt-3 sm:px-4 ${mounted && !isInline ? "min-h-0 flex-1" : ""}`}>
            {(peek.address || address).trim() ? (
              <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                  <span className="mr-1">📍</span>
                  {peek.address || address}
                </p>
              </div>
            ) : null}
            <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              {label}
            </div>
          </div>
        ) : (
          <div className="min-h-[180px] flex-1 bg-white" />
        )}
      </main>
    );
  }

  return (
    <main className={`flex flex-col bg-white ${isInline ? "" : "h-screen overflow-hidden"}`}>
      <style>{`
        @keyframes dse-inline-title-marquee {
          0%, 15% { transform: translateX(0); }
          85%, 100% { transform: translateX(calc(-100% + 220px)); }
        }
        @media (max-width: 520px) {
          .dse-inline-title-marquee {
            display: inline-block;
            min-width: max-content;
            animation: dse-inline-title-marquee 12s linear infinite;
          }
        }
      `}</style>
      {/* Inline embeds have no SDK chrome, so brand the iframe itself. The
          "full"/"minimalist" variants use their own native heading instead. */}
      {isInline && !isNative && (
        <header
          className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-white"
          style={{ background: accent }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
            {PIN_SVG}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="dse-inline-title-marquee overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold leading-tight" title={headerTitle}>
              {headerTitle}
            </p>
          </div>
        </header>
      )}

      {/* ---- Native (full/minimalist) home: compact search (no hero, no Home) ---- */}
      {screen === "home" && isNative && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Nearby Schools</h2>
            <p className="text-[13px] text-slate-500">Enter an address to see nearby schools and ratings.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(address);
            }}
            className="flex w-full flex-col gap-2 sm:flex-row"
          >
            {SearchField}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: accent }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          )}
        </div>
      )}

      {/* ---- HOME SCREEN (fits without scrolling on desktop) ---- */}
      {screen === "home" && !isNative && (
        <div
          className={`mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 ${
            isInline ? "" : "min-h-0 flex-1 justify-start"
          }`}
        >
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
        <div
          className={`mx-auto flex w-full max-w-5xl flex-col px-3 pt-3 sm:px-4 ${
            isInline ? "" : "min-h-0 flex-1"
          }`}
        >
          {/* Minimalist hides the address/Change bar entirely for a cleaner look. */}
          {!isMinimal && (
          <div className="mb-3 flex shrink-0 items-center gap-2">
            {!isNative && (
              <button
                type="button"
                onClick={goHome}
                aria-label="Home"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <SchoolhouseMark className="h-4 w-4 rounded-[3px]" />
                <span className="hidden sm:inline">Home</span>
              </button>
            )}

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
          )}

          {/* Scroll region: only the results/detail scroll, chrome stays put.
              Popup fills the SDK-set panel (flex-1); inline caps the list.
              The "full" variant manages its own list+map layout / heights. */}
          {isFull ? (
            <div className="flex flex-col pb-2" style={{ height: params?.fullHeight ?? 640 }}>
              {loading && (
                <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  Looking up schools…
                </div>
              )}
              {!loading && error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
              )}
              {!loading && !error && selected && (
                <div className="min-h-0 flex-1 overflow-y-auto pb-2">
                  <SchoolDetailModal
                    ncesId={selected}
                    fairHousing={false}
                    variant="inline"
                    embed
                    showExternalLinks
                    backLabel="Nearby Schools"
                    onClose={() => setSelected(null)}
                  />
                </div>
              )}
              {!loading && !error && !selected && (
                <NearbySchoolsFull
                  data={data}
                  onOpenSchool={(id) => {
                    setSelected(id);
                    incrementUpgradeView();
                  }}
                />
              )}
            </div>
          ) : isMinimal ? (
            <div className="pb-4">
              {loading && (
                <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  Looking up schools…
                </div>
              )}
              {!loading && error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
              )}
              {!loading && !error && <MinimalistSchools data={data} />}
            </div>
          ) : (
            <div
              className={`overflow-y-auto pb-4 ${isInline ? "max-h-[440px]" : "min-h-0 flex-1"}`}
            >
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
                  onOpenSchool={(id) => {
                    setSelected(id);
                    incrementUpgradeView();
                  }}
                  listColumns={2}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer — single line: copyright + legal. */}
      <footer className="shrink-0 border-t border-slate-100 px-4 py-1.5 text-center text-[10px] text-slate-500">
        © 2026 Dream Neighborhood ·{" "}
        <a
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-600 hover:underline"
        >
          Terms
        </a>{" "}
        ·{" "}
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-600 hover:underline"
        >
          Privacy
        </a>
        {isInline && (
          <>
            {" "}·{" "}
            <button
              type="button"
              onClick={cycleAppearance}
              title="Temporary: cycle the inline appearance (Compact → Showcase → Minimalist). Saved in this browser."
              className="font-medium text-slate-600 underline decoration-dotted underline-offset-2 hover:text-brand-700"
            >
              Appearance: {VARIANT_LABEL[effVariant]}
            </button>
          </>
        )}
      </footer>

      {upgradeVisible && (
        <UpgradePrompt
          accent={accent}
          providerName={params?.provider || params?.business || ""}
          address={params?.address || address || data?.geocode?.matchedAddress || ""}
          onDismiss={() => dismissUpgradeAd("dismiss")}
          onRequest={requestFullAccess}
        />
      )}
    </main>
  );
}

// What the free School Explorer already answers, by category. Kept honest and
// short: overstating the free side weakens the comparison, understating it is a
// claim a realtor reading their own widget would catch.
const FREE_ANSWERS = ["School ratings", "Test scores", "Safety & discipline"];

// The paid ones worth naming. Chosen for surprise rather than coverage — the
// predictable three (price, commute, walkability) are what anyone would guess,
// so each of these earns its place by being something a buyer would not think
// to ask for. The rest are counted rather than listed.
const PAID_ANSWERS = [
  "Median home price",
  "Days on market",
  "Home price trend",
  "Commute times",
  "Walk & bike score",
  "Parks & groceries",
  "Homeownership rate",
  "% of neighbors under 18",
];

/**
 * Geocoders hand back SHOUTING ADDRESSES. Only touched when the string has no
 * lowercase at all, so a properly-cased scrape from the page is left alone.
 */
function tidyAddress(raw: string): string {
  const s = (raw || "").trim();
  if (!s || /[a-z]/.test(s)) return s;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function UpgradePrompt({
  accent,
  providerName,
  address,
  onDismiss,
  onRequest,
}: {
  accent: string;
  providerName: string;
  address: string;
  onDismiss: () => void;
  onRequest: () => void;
}) {
  // Buyer-facing CTA — avoid repeating long provider/admin names in the button.
  const buttonText = providerName
    ? `Ask ${shortProviderName(providerName)} for full access`
    : "Request full access";
  // "Schools are just the start" was true but abstract, and the old headline
  // ("before you tour") assumed a listing page — this widget also runs on home
  // pages and neighborhood pages, where there is nothing to tour.
  const shortAddress = tidyAddress((address || "").split(",")[0]);
  const remaining = Math.max(0, NEIGHBORHOOD_INSIGHTS.length - PAID_ANSWERS.length);

  return (
    <div className="fixed inset-0 z-50 flex bg-[#f7faf6]">
      <div className="relative flex min-h-0 w-full flex-col">
        {/* Single close control — no second brand header (popup chrome already brands it). */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xl leading-none text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-white hover:text-slate-800"
        >
          ×
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
            {/* Compact hero — brand once, one headline, one line */}
            <div className="pr-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f6b3a]">
                Neighborhood Explorer
              </p>
              <h2 className="mt-2 text-[1.65rem] font-extrabold leading-[1.15] tracking-tight text-ink-900 sm:text-3xl">
                You&rsquo;re seeing a third of the picture
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {shortAddress ? (
                  <>
                    Schools are one part of{" "}
                    <strong className="font-bold text-slate-800">{shortAddress}</strong>.
                  </>
                ) : (
                  <>Schools are one part of this neighborhood.</>
                )}{" "}
                Here&rsquo;s the rest.
              </p>
            </div>

            {/* The argument is the gap between the columns, so they sit side by
                side at every width — stacking them hides the whole point. */}
            <div className="mt-5 grid grid-cols-2 items-start gap-2.5">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  What you see now
                </p>
                <ul className="mt-2.5 space-y-2">
                  {FREE_ANSWERS.map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-slate-500">
                      <span aria-hidden className="mt-[3px] text-[10px] leading-none text-slate-300">
                        ✓
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#d7e4c8] bg-white p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2f6b3a]">
                  What you&rsquo;re missing
                </p>
                <ul className="mt-2.5 space-y-2">
                  {PAID_ANSWERS.map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-slate-700">
                      <span
                        aria-hidden
                        className="mt-[3px] text-[10px] leading-none"
                        style={{ color: accent }}
                      >
                        ✓
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                {remaining > 0 && (
                  <p
                    className="mt-2.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    +{remaining} more
                  </p>
                )}
              </div>
            </div>

            <div className="mt-auto space-y-2 pt-6">
              <button
                type="button"
                onClick={onRequest}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:brightness-105"
                style={{ backgroundColor: accent }}
              >
                {buttonText}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
              >
                Continue with schools only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shorten noisy provider labels like "Dream Neighborhood Admin" for the CTA. */
function shortProviderName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return "your agent";
  // Drop trailing role words that read oddly in “Ask X for full access”
  const withoutRole = cleaned.replace(/\s+(Admin|Administrator|Owner)$/i, "").trim();
  if (!withoutRole || /^(dream\s*neighborhood(\s*schools)?)$/i.test(withoutRole)) {
    return "your agent";
  }
  // Keep it short for the button
  if (withoutRole.length > 28) return `${withoutRole.slice(0, 26).trim()}…`;
  return withoutRole;
}
