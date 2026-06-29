"use client";

import { to10, rating10Hex, rating10Word } from "./score";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({
  schools,
  onSelect,
  compareIds,
  onToggleCompare,
}: {
  schools: NearbySchool[];
  onSelect: (ncesId: string) => void;
  compareIds: string[];
  onToggleCompare: (ncesId: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
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
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
              selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200"
            }`}
          >
            <div className="flex items-stretch gap-3">
              {/* colored score chip with the list number */}
              <button
                type="button"
                onClick={() => onSelect(s.ncesId)}
                className="relative flex w-16 shrink-0 flex-col items-center justify-center py-3 text-white"
                style={{ backgroundColor: color }}
                aria-label={`Open ${s.name}`}
              >
                <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/25 text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className={`font-extrabold leading-none ${hasScore ? "text-2xl" : "text-base"}`}>
                  {hasScore ? r10 : "NR"}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-90">
                  {hasScore ? "/ 10" : "no data"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelect(s.ncesId)}
                className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-2 text-left"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-bold leading-tight text-slate-900">{s.name}</span>
                  {isPrivate && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                      Private
                    </span>
                  )}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {s.type} · Grades {s.grades}
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="font-semibold" style={{ color }}>
                    {r10 != null ? rating10Word(r10) : "Limited data"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-700">{s.miles} mi away</span>
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
