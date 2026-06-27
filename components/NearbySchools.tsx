"use client";

import { useState } from "react";
import { scoreBadgeClass } from "./score";
import { SchoolDetailModal } from "./SchoolDetailModal";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({ schools }: { schools: NearbySchool[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">Nearby schools</h3>
        <span className="text-xs text-slate-500">{schools.length} closest • click for full data</span>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {schools.map((s) => (
          <li key={s.ncesId}>
            <button
              type="button"
              onClick={() => setOpenId(s.ncesId)}
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
                <span className="block truncate text-sm font-semibold text-slate-900">{s.name}</span>
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
        ))}
      </ul>

      {openId && <SchoolDetailModal ncesId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
