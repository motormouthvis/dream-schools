"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ScoreGauge } from "./ScoreGauge";
import { CategoryCard } from "./CategoryCard";
import { SafetySection } from "./SafetySection";
import { NearbySchools } from "./NearbySchools";
import { SchoolDetailModal } from "./SchoolDetailModal";
import { CompareModal } from "./CompareModal";
import type { LookupResult } from "@/lib/types";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[62vh] min-h-[380px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export function SchoolsTab({
  data,
  nationwide = false,
  fairHousing = false,
  view,
  onViewChange,
}: {
  data: LookupResult;
  nationwide?: boolean;
  fairHousing?: boolean;
  view: "list" | "map";
  onViewChange: (v: "list" | "map") => void;
}) {
  const { district, categories } = data;
  const [openId, setOpenId] = useState<string | null>(null);
  const [showArea, setShowArea] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");
  const [filterLevel, setFilterLevel] = useState<"all" | "public" | "private">("all");

  function toggleCompare(ncesId: string) {
    setCompareIds((prev) =>
      prev.includes(ncesId)
        ? prev.filter((id) => id !== ncesId)
        : prev.length >= 3
        ? prev
        : [...prev, ncesId]
    );
  }

  const visibleSchools = useMemo(() => {
    let list = data.nearbySchools.slice();
    if (filterLevel !== "all") {
      list = list.filter((s) =>
        filterLevel === "private" ? s.level === "private" : s.level !== "private"
      );
    }
    list.sort((a, b) => (sortBy === "rating" ? b.score - a.score : a.miles - b.miles));
    return list;
  }, [data.nearbySchools, filterLevel, sortBy]);

  return (
    <section className="space-y-5">
      {/* Slim result header — address is already shown in the search box above,
          so we only confirm the district + quick stats here. */}
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <p className="text-sm leading-snug">
          <span className="mr-1">📍</span>
          <span className="font-bold text-brand-700">{district.name}</span>
          <span className="text-slate-400"> School District</span>
          <span className="ml-2 text-xs text-slate-400">
            {district.studentCount.toLocaleString()} students · {district.schoolCount} schools
          </span>
        </p>
      </header>

      {/* PRIMARY: schools near you */}
      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-5 w-1.5 rounded-full bg-brand-500" />
          <h3 className="text-base font-bold text-slate-900 sm:text-lg">Schools near you</h3>
          <span className="ml-auto text-xs text-slate-400">{view === "map" ? "map" : `${visibleSchools.length} shown`}</span>
        </div>

        {view === "list" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">Sort</span>
            <Pill active={sortBy === "distance"} onClick={() => setSortBy("distance")}>
              Distance
            </Pill>
            <Pill active={sortBy === "rating"} onClick={() => setSortBy("rating")}>
              Rating
            </Pill>
            <span className="ml-2 font-semibold text-slate-500">Show</span>
            <Pill active={filterLevel === "all"} onClick={() => setFilterLevel("all")}>
              All
            </Pill>
            <Pill active={filterLevel === "public"} onClick={() => setFilterLevel("public")}>
              Public
            </Pill>
            <Pill active={filterLevel === "private"} onClick={() => setFilterLevel("private")}>
              Private
            </Pill>
          </div>
        )}

        {view === "list" ? (
          visibleSchools.length > 0 ? (
            <NearbySchools
              schools={visibleSchools}
              onSelect={setOpenId}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              No {filterLevel} schools in this area.
            </p>
          )
        ) : (
          <div>
            <MapView data={data} onSelectSchool={setOpenId} heightClass="h-[62vh] min-h-[380px]" />
            <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-slate-400">
              Tap a numbered pin for that school&apos;s full details · 📍 your address · 🟠 private ·
              shaded area = {district.name}
            </p>
          </div>
        )}
      </div>

      {/* SECONDARY: neighborhood overview (collapsible) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => setShowArea((v) => !v)}
          className="flex w-full items-center gap-4 text-left"
          aria-expanded={showArea}
        >
          <ScoreGauge score={data.overallScore} size={72} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Neighborhood overview</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              An <strong>area average</strong> of nearby public schools — not one school. Tap to
              {showArea ? " hide" : " see"} the breakdown.
            </p>
          </div>
          <span className={`shrink-0 text-brand-500 transition-transform ${showArea ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        {showArea && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 lg:grid-cols-3">
            <CategoryCard category={categories.academic} />
            <SafetySection safety={categories.safety} details={data.safetyDetails} />
            <CategoryCard category={categories.scale} />
          </div>
        )}
      </div>

      {openId && (
        <SchoolDetailModal
          ncesId={openId}
          fairHousing={fairHousing}
          onClose={() => setOpenId(null)}
        />
      )}

      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">
              {compareIds.length} selected <span className="font-normal text-slate-400">(up to 3)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
              >
                Compare {compareIds.length === 1 ? "vs area" : `${compareIds.length} schools`}
              </button>
            </div>
          </div>
        </div>
      )}

      {compareOpen && (
        <CompareModal
          ncesIds={compareIds}
          area={data.areaAverages ?? null}
          areaName={district.name}
          fairHousing={fairHousing}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-semibold transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
