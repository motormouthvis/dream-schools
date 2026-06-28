"use client";

import { scoreHex, scoreLabel } from "./score";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({
  schools,
  onSelect,
}: {
  schools: NearbySchool[];
  onSelect: (ncesId: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {schools.map((s) => {
        const isPrivate = s.level === "private";
        const color = scoreHex(s.score);
        return (
          <li key={s.ncesId}>
            <button
              type="button"
              onClick={() => onSelect(s.ncesId)}
              className="flex w-full items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition active:scale-[0.99] hover:border-brand-300 hover:shadow-md"
            >
              {/* colored score chip */}
              <span
                className="flex w-16 shrink-0 flex-col items-center justify-center py-3 text-white"
                style={{ backgroundColor: color }}
              >
                <span className="text-xl font-extrabold leading-none">{s.score}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-90">
                  / 100
                </span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-bold leading-tight text-slate-900">
                    {s.name}
                  </span>
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
                    {scoreLabel(s.score)}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-700">{s.miles} mi away</span>
                </span>
              </span>

              <span className="flex shrink-0 items-center pr-3 text-2xl text-slate-300">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
