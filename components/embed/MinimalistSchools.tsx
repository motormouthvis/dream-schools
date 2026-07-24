"use client";

import { to10, rating10Hex, rating10Word } from "@/components/score";
import type { LookupResult, NearbySchool } from "@/lib/types";

const SITE = "https://www.dreamneighborhoodschools.com";

// Minimalist inline variant (Option 3): a subdued, transparent multi-column list
// of nearby schools — no map, no in-box detail. Each school links out to the
// main-site detail page. Shows up to 9 on desktop, 3 on mobile.
export function MinimalistSchools({ data }: { data: LookupResult }) {
  const address = data.geocode?.matchedAddress || "";
  const schools = data.nearbySchools.slice(0, 9);

  function schoolUrl(s: NearbySchool): string {
    const p = new URLSearchParams();
    if (address) p.set("address", address);
    p.set("school", s.ncesId);
    return `${SITE}/parents?${p.toString()}`;
  }
  const allUrl = `${SITE}/parents${address ? `?address=${encodeURIComponent(address)}` : ""}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-bold tracking-tight text-slate-800">Nearby Schools</h2>
        <span className="text-[11px] text-slate-400">{data.nearbySchools.length} nearby</span>
        <a
          href={allUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[12px] font-semibold text-emerald-700/80 hover:text-emerald-800 hover:underline"
        >
          View all schools ↗
        </a>
      </div>

      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((s, i) => {
          const hasScore = s.score != null;
          const r10 = hasScore ? to10(s.score as number) : null;
          const hex = r10 != null ? rating10Hex(r10) : "#94a3b8";
          const isPrivate = s.level === "private";
          return (
            <a
              key={s.ncesId}
              href={schoolUrl(s)}
              target="_blank"
              rel="noopener noreferrer"
              // Mobile shows the first 3; sm+ reveals the rest (up to 9).
              className={`group flex items-start gap-3 border-b border-slate-100 py-3 transition hover:bg-slate-50/60 ${
                i >= 3 ? "hidden sm:flex" : "flex"
              }`}
            >
              {/* Subdued rating tile (or graduation cap when not rated) */}
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[13px] font-extrabold"
                style={{ backgroundColor: `${hex}1f`, color: hex }}
              >
                {r10 != null ? (
                  r10
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <g transform="rotate(-10 12 10)">
                      <path d="M12 4 21 8 12 12 3 8z" fill="currentColor" />
                      <path d="M6.5 9.4V13c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3V9.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                    <path d="M20 8.4V13.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="20" cy="14.4" r="1.1" fill="currentColor" />
                  </svg>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {isPrivate && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      Private
                    </span>
                  )}
                  <span className="truncate text-[14px] font-semibold text-slate-800">{s.name}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                  {s.type} · Grades {s.grades}
                </span>
                <span className="mt-0.5 block text-[12px] text-slate-400">
                  {s.miles} mi{r10 != null ? ` · ${rating10Word(r10)}` : " · Limited data"}
                </span>
                <span className="mt-1 inline-block text-[12px] font-semibold text-emerald-700/80 group-hover:text-emerald-800 group-hover:underline">
                  See details ↗
                </span>
              </span>
            </a>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-400">
        Full school details at Dream Neighborhood Schools
      </p>
    </div>
  );
}
