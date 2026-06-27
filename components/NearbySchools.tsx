"use client";

import { scoreBadgeClass } from "./score";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({
  schools,
  onSelect,
}: {
  schools: NearbySchool[];
  onSelect: (ncesId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">Individual schools near this address</h3>
        <span className="text-xs text-slate-500">{schools.length} closest • click for full data</span>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {schools.map((s) => {
          const isPrivate = s.level === "private";
          return (
            <li key={s.ncesId}>
              <button
                type="button"
                onClick={() => onSelect(s.ncesId)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-slate-50"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset ${scoreBadgeClass(
                    s.score
                  )}`}
                >
                  {s.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{s.name}</span>
                    {isPrivate && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                        Private
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {s.type} • Grades {s.grades} • {s.zip}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-slate-700">{s.miles} mi</span>
                  <span className="block text-[11px] text-brand-600">View details →</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
