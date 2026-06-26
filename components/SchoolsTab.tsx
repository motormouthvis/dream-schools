import { ScoreGauge } from "./ScoreGauge";
import { CategoryCard } from "./CategoryCard";
import { SafetySection } from "./SafetySection";
import { NearbySchools } from "./NearbySchools";
import type { LookupResult } from "@/lib/types";

export function SchoolsTab({ data }: { data: LookupResult }) {
  const { district, categories, geocode } = data;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-6 text-white sm:px-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-100">
          <span>Schools</span>
          {geocode.approximate && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] normal-case">
              approx. location (zip centroid)
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-semibold sm:text-xl">{geocode.matchedAddress}</h2>
        <p className="mt-2 text-sm text-brand-50">
          This address is in{" "}
          <span className="font-semibold text-white">{district.name}</span>
        </p>
        <p className="mt-0.5 text-sm text-brand-100">
          {district.studentCount.toLocaleString()} students • {district.schoolCount} schools
          {district.inDistrict ? "" : " • near district boundary"}
        </p>
      </header>

      <div className="px-6 py-6 sm:px-8">
        {/* Overall quality score */}
        <div className="flex flex-col items-center gap-5 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:gap-7">
          <ScoreGauge score={data.overallScore} />
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Overall quality score
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {data.overallScore}
              <span className="text-lg font-medium text-slate-400">/100</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{data.scoreBasis}</p>
          </div>
        </div>

        {/* Three category section */}
        <h3 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Quality index
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CategoryCard category={categories.academic} />
          <SafetySection safety={categories.safety} details={data.safetyDetails} />
          <CategoryCard category={categories.scale} />
        </div>

        {/* Nearby schools */}
        <div className="mt-6">
          <NearbySchools schools={data.nearbySchools} />
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Safety data reflects the full {categories.safety.schoolYear} school year (U.S. Dept. of
          Education CRDC). Roster &amp; staffing from NCES CCD 2023-24; graduation from EDFacts.
          Demo limited to schools in/near 10 zip codes around 34946 (Fort Pierce / St. Lucie County,
          FL). All figures are real, per-school federal data.
        </p>
      </div>
    </section>
  );
}
