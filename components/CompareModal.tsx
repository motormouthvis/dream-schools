"use client";

import { useEffect, useState } from "react";
import type { AreaAverages, SchoolDetail } from "@/lib/types";

function rating10Color(v: number): string {
  if (v >= 8) return "#059669";
  if (v >= 6) return "#65a30d";
  if (v >= 4) return "#d97706";
  return "#e11d48";
}

function per100(count: number | null | undefined, enrollment: number): string {
  if (count == null || !enrollment) return "—";
  const v = (count / enrollment) * 100;
  return v === 0 ? "0" : v < 0.1 ? "<0.1" : v.toFixed(1);
}

export function CompareModal({
  ncesIds,
  area,
  areaName,
  fairHousing,
  onClose,
}: {
  ncesIds: string[];
  area: AreaAverages | null;
  areaName: string;
  fairHousing: boolean;
  onClose: () => void;
}) {
  const [schools, setSchools] = useState<(SchoolDetail | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      ncesIds.map((id) =>
        fetch(`/api/school?ncesId=${encodeURIComponent(id)}${fairHousing ? "&fh=1" : ""}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((res) => {
      if (!cancelled) {
        setSchools(res.map((r) => (r && !r.error ? r : null)));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ncesIds, fairHousing]);

  const valid = schools.filter(Boolean) as SchoolDetail[];

  const pctOrDash = (v: number | null | undefined) => (v != null ? `${v}%` : "—");
  const rows: {
    label: string;
    get: (d: SchoolDetail) => React.ReactNode;
    area?: (a: AreaAverages) => React.ReactNode;
    rating?: boolean;
  }[] = [
    { label: "Overall rating", get: (d) => d.summaryRating, area: (a) => a.overallRating, rating: true },
    { label: "Test scores rating", get: (d) => d.testScores?.rating ?? null, rating: true },
    { label: "College-ready rating", get: (d) => d.collegeReadiness?.rating ?? null, rating: true },
    { label: "Reading proficient", get: (d) => pctOrDash(d.testScores?.read), area: (a) => pctOrDash(a.testRead) },
    { label: "Math proficient", get: (d) => pctOrDash(d.testScores?.math), area: (a) => pctOrDash(a.testMath) },
    {
      label: "Graduate in 4 yrs",
      get: (d) => pctOrDash(d.collegeReadiness?.gradRate),
      area: (a) => pctOrDash(a.gradRate),
    },
    { label: "Enrollment", get: (d) => d.enrollment.toLocaleString() },
    {
      label: "Student-teacher ratio",
      get: (d) => (d.teachers.ratio ? `${Math.round(d.teachers.ratio)} to 1` : "—"),
      area: (a) => (a.ratio ? `${Math.round(a.ratio)} to 1` : "—"),
    },
    {
      label: "Low-income students",
      get: (d) => pctOrDash(d.students.lowIncomePct),
      area: (a) => pctOrDash(a.lowIncomePct),
    },
    {
      label: "Violent incidents / 100",
      get: (d) => (d.safety ? per100(d.safety.violentIncidentsTotal, d.enrollment) : "—"),
      area: (a) => (a.violentPer100 != null ? String(a.violentPer100) : "—"),
    },
    {
      label: "Suspensions / 100",
      get: (d) => (d.safety ? per100(d.safety.outOfSchoolSuspensions, d.enrollment) : "—"),
      area: (a) => (a.suspensionsPer100 != null ? String(a.suspensionsPer100) : "—"),
    },
    { label: "Type", get: (d) => d.type },
    { label: "Grades", get: (d) => d.grades },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white">
          <h2 className="text-base font-bold sm:text-lg">Compare schools</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[80vh] overflow-auto p-4">
          {loading ? (
            <p className="p-8 text-center text-slate-400">Loading comparison…</p>
          ) : valid.length === 0 ? (
            <p className="p-8 text-center text-slate-400">Could not load these schools.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left text-xs font-semibold text-slate-400"></th>
                  {area && (
                    <th className="bg-brand-50 p-2 align-bottom text-left">
                      <div className="text-[13px] font-bold leading-tight text-brand-800">
                        Area average
                      </div>
                      <div className="mt-0.5 text-[11px] font-normal text-brand-700/70">{areaName}</div>
                    </th>
                  )}
                  {valid.map((d) => (
                    <th key={d.ncesId} className="p-2 align-bottom text-left">
                      <div className="text-[13px] font-bold leading-tight text-slate-900">{d.name}</div>
                      <div className="mt-0.5 text-[11px] font-normal text-slate-400">
                        {d.district.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white p-2 text-xs font-medium text-slate-500">
                      {row.label}
                    </td>
                    {area && (
                      <td className="bg-brand-50/50 p-2">
                        {(() => {
                          const av = row.area ? row.area(area) : "—";
                          if (row.rating && typeof av === "number") {
                            return (
                              <span
                                className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold text-white"
                                style={{ backgroundColor: rating10Color(av) }}
                              >
                                {av}
                              </span>
                            );
                          }
                          return <span className="font-semibold text-brand-800">{av ?? "—"}</span>;
                        })()}
                      </td>
                    )}
                    {valid.map((d) => {
                      const v = row.get(d);
                      if (row.rating && typeof v === "number") {
                        return (
                          <td key={d.ncesId} className="p-2">
                            <span
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold text-white"
                              style={{ backgroundColor: rating10Color(v) }}
                            >
                              {v}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={d.ncesId} className="p-2 font-semibold text-slate-800">
                          {v == null ? "—" : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
