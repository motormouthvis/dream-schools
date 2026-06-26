"use client";

import { useState } from "react";
import { scoreBadgeClass } from "./score";
import type { NearbySchool } from "@/lib/types";

export function NearbySchools({ schools }: { schools: NearbySchool[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">Nearby schools</h3>
        <span className="text-xs text-slate-500">{schools.length} closest</span>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {schools.map((s) => {
          const open = openId === s.ncesId;
          return (
            <li key={s.ncesId}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.ncesId)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-slate-50"
                aria-expanded={open}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset ${scoreBadgeClass(
                    s.score
                  )}`}
                >
                  {s.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {s.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {s.type} • Grades {s.grades} • {s.zip}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-slate-700">{s.miles} mi</span>
                  <span className="block text-[11px] text-brand-600">
                    {open ? "Hide" : "Details"}
                  </span>
                </span>
              </button>

              {open && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 pb-3 pl-16 pr-2 text-xs text-slate-600 sm:grid-cols-3">
                  <Row label="Quick score" value={`${s.score}/100`} />
                  <Row label="Type" value={s.type} />
                  <Row label="Grades" value={s.grades} />
                  <Row label="Distance" value={`${s.miles} mi`} />
                  <Row label="Enrollment" value={s.enrollment.toLocaleString()} />
                  <Row label="Zip" value={s.zip} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
