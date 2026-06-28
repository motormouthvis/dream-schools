"use client";

import { useState } from "react";
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
    <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="h-5 w-1.5 rounded-full bg-brand-500" />
      <h3 className="text-base font-bold text-slate-900 sm:text-lg">{children}</h3>
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </div>
  );
}

export function SchoolsTab({
  data,
  nationwide = false,
  fairHousing = false,
}: {
  data: LookupResult;
  nationwide?: boolean;
  fairHousing?: boolean;
}) {
  const { district, categories, geocode } = data;
  const [openId, setOpenId] = useState<string | null>(null);
  const [showArea, setShowArea] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  function toggleCompare(ncesId: string) {
    setCompareIds((prev) =>
      prev.includes(ncesId)
        ? prev.filter((id) => id !== ncesId)
        : prev.length >= 3
        ? prev
        : [...prev, ncesId]
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 px-5 py-5 text-white shadow-lg shadow-brand-900/10 sm:px-7 sm:py-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-brand-100">
          <span>Your address</span>
          {geocode.approximate && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 normal-case">approx.</span>
          )}
        </div>
        <h2 className="mt-1 text-base font-semibold leading-snug sm:text-xl">
          {geocode.matchedAddress}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-50">
          <span>School district:</span>
          <span className="font-bold text-white">{district.name}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            {district.studentCount.toLocaleString()} students
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            {district.schoolCount} schools
          </span>
        </div>
      </header>

      {/* Map — collapsed by default; pins are numbered to match the list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={showMap}
        >
          <span className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 rounded-full bg-brand-500" />
            <span className="text-base font-bold text-slate-900">Map of these schools</span>
          </span>
          <span className={`text-brand-500 transition-transform ${showMap ? "rotate-180" : ""}`}>▾</span>
        </button>
        {showMap && (
          <div className="px-3 pb-3">
            <MapView data={data} onSelectSchool={setOpenId} />
            <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-slate-400">
              Numbered pins match the list below · 📍 your address · 🟠 private · shaded ={" "}
              {district.name}
            </p>
          </div>
        )}
      </div>

      {/* PRIMARY: schools near you */}
      <div>
        <SectionTitle hint="tap a school for details · check boxes to compare">
          Schools near you
        </SectionTitle>
        <NearbySchools
          schools={data.nearbySchools}
          onSelect={setOpenId}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
        />
      </div>

      {/* SECONDARY: neighborhood overview (collapsible) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => setShowArea((v) => !v)}
          className="flex w-full items-center gap-4 text-left"
          aria-expanded={showArea}
        >
          <ScoreGauge score={data.overallScore} size={84} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Neighborhood schools overview</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              An <strong>area average</strong> of the public schools serving this address — not one
              school. Tap to {showArea ? "hide" : "see"} the breakdown.
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

      {/* Footer note */}
      <p className="px-2 text-center text-[11px] leading-relaxed text-slate-400">
        Safety data: U.S. DOE CRDC {categories.safety.schoolYear}. Roster &amp; staffing: NCES CCD
        2023-24. Test scores: EDFacts. {nationwide ? "Nationwide public + private schools." : ""} All
        figures are real, per-school federal data.
      </p>

      {openId && (
        <SchoolDetailModal
          ncesId={openId}
          fairHousing={fairHousing}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* Compare bar */}
      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">
              {compareIds.length} selected{" "}
              <span className="font-normal text-slate-400">(up to 3)</span>
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
                disabled={compareIds.length < 2}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                Compare {compareIds.length} schools
              </button>
            </div>
          </div>
        </div>
      )}

      {compareOpen && (
        <CompareModal
          ncesIds={compareIds}
          fairHousing={fairHousing}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </section>
  );
}
