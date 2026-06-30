"use client";

import { useRef, useState } from "react";
import { to10, rating10Hex, rating10Word } from "./score";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({
  schools,
  onSelect,
  compareIds,
  onToggleCompare,
  twoCol = false,
}: {
  schools: NearbySchool[];
  onSelect: (ncesId: string) => void;
  compareIds: string[];
  onToggleCompare: (ncesId: string) => void;
  /** Two columns on wide screens (used by the embed popup to fill the panel). */
  twoCol?: boolean;
}) {
  return (
    <ul className={twoCol ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : "space-y-2.5"}>
      {schools.map((s, i) => {
        const isPrivate = s.level === "private";
        const hasScore = s.score != null;
        const r10 = hasScore ? to10(s.score as number) : null;
        const color = r10 != null ? rating10Hex(r10) : "#94a3b8";
        const selected = compareIds.includes(s.ncesId);
        const atMax = compareIds.length >= 3 && !selected;
        return (
          <li
            key={s.ncesId}
            className={`group flex h-[88px] overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200"
            }`}
          >
            {/* Whole row (rating + details) opens the school */}
            <button
              type="button"
              onClick={() => onSelect(s.ncesId)}
              className="flex min-w-0 flex-1 items-stretch gap-3 text-left"
              aria-label={`Open ${s.name}`}
            >
              {/* colored score chip with the list rank */}
              <span
                className="relative flex w-16 shrink-0 flex-col items-center justify-center text-white"
                style={{ backgroundColor: color }}
              >
                <span className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/25 text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className={`font-extrabold leading-none ${hasScore ? "text-2xl" : "text-base"}`}>
                  {hasScore ? r10 : "NR"}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-90">
                  {hasScore ? "/ 10" : "no data"}
                </span>
              </span>

              {/* exactly three single-line rows → every card is the same height */}
              <span className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {isPrivate && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                      Private
                    </span>
                  )}
                  <ScrollName name={s.name} />
                </span>
                <span className="mt-1 truncate text-xs text-slate-500">
                  {s.type} · Grades {s.grades}
                </span>
                <span className="mt-1.5 flex items-center gap-2 truncate text-xs">
                  <span className="shrink-0 font-semibold" style={{ color }}>
                    {r10 != null ? rating10Word(r10) : "Limited data"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-slate-700">
                    <PinIcon />
                    {s.miles} mi
                  </span>
                </span>
              </span>
            </button>

            {/* compare toggle */}
            <button
              type="button"
              onClick={() => onToggleCompare(s.ncesId)}
              disabled={atMax}
              className={`flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-l text-[10px] font-semibold transition ${
                selected
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : atMax
                  ? "border-slate-100 text-slate-300"
                  : "border-slate-100 text-slate-400 hover:bg-slate-50"
              }`}
              aria-pressed={selected}
              title={atMax ? "Up to 3 schools" : "Add to compare"}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                }`}
              >
                {selected ? "✓" : ""}
              </span>
              Compare
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// School name on a single line. Long names are truncated, and gently scroll to
// reveal the full name on hover/focus (kept one line so every card is uniform).
function ScrollName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  function measure() {
    const el = ref.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    setShift(overflow > 2 ? overflow : 0);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={measure}
      onMouseLeave={() => setShift(0)}
      title={name}
      className="block min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[15px] font-bold leading-tight text-slate-900"
    >
      <span
        className="inline-block ease-linear [transition-property:transform]"
        style={{
          transform: `translateX(-${shift}px)`,
          transitionDuration: `${Math.max(500, shift * 18)}ms`,
        }}
      >
        {name}
      </span>
    </span>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 text-slate-400"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
