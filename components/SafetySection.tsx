"use client";

import { useState } from "react";
import { CategoryCard } from "./CategoryCard";
import type { LookupResult } from "@/lib/types";

export function SafetySection({
  safety,
  details,
}: {
  safety: LookupResult["categories"]["safety"];
  details: LookupResult["safetyDetails"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <CategoryCard
      category={safety}
      subtitle={`${safety.schoolYear} School Year — NCES SSOCS`}
    >
      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
        Headline counts reflect the closest school: {safety.primarySchoolName}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
        aria-expanded={open}
      >
        {open ? "Hide full safety details" : "View full safety details"}
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {details.map((d) => (
            <div key={d.ncesId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">{d.name}</span>
                <span className="text-xs text-slate-500">{d.miles} mi</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <Detail label="Violent incidents" value={d.record.violentIncidentsTotal} />
                <Detail label="Aggravated assaults" value={d.record.aggravatedAssaults} />
                <Detail label="Threats of violence" value={d.record.threatsOfViolence} />
                <Detail label="Theft / larceny" value={d.record.theftLarceny} />
                <Detail label="Vandalism" value={d.record.vandalism} />
                <Detail label="Drug incidents" value={d.record.drugIncidents} />
                <Detail label="Weapons possession" value={d.record.weaponsPossession} />
                <Detail label="Police calls" value={d.record.policeCalls} />
                <DetailBool label="Security cameras" value={d.record.securityCameras} />
                <DetailBool label="Controlled access" value={d.record.controlledBuildingAccess} />
                <DetailBool label="Officer on site" value={d.record.swornLawEnforcementOnSite} />
                <DetailBool label="Visitor sign-in" value={d.record.visitorSignIn} />
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
                {d.record.schoolYear} • {d.record.source}
              </div>
            </div>
          ))}
        </div>
      )}
    </CategoryCard>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

function DetailBool({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-semibold ${value ? "text-emerald-600" : "text-rose-500"}`}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}
