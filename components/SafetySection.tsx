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
      subtitle={`${safety.schoolYear} School Year — U.S. DOE CRDC`}
    >
      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
        Headline counts reflect the closest school: {safety.primarySchoolName}. Source: U.S. Dept. of
        Education CRDC {safety.schoolYear} (real per-school data). Facility-security indicators
        (cameras, controlled access) are not published per-school in federal data.
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
                <Detail label="Violent incidents total" value={d.record.violentIncidentsTotal} />
                <Detail label="Physical attacks w/ weapon" value={d.record.physicalAttacksWithWeapon} />
                <Detail label="Physical attacks, no weapon" value={d.record.physicalAttacksNoWeapon} />
                <Detail label="Threats of violence" value={d.record.threatsOfViolence} />
                <Detail label="Robberies" value={d.record.robberies} />
                <Detail label="Rape / sexual battery" value={d.record.rapeOrSexualBattery} />
                <Detail label="Firearm/explosive possession" value={d.record.firearmExplosivePossession} />
                <Detail label="Out-of-school suspensions" value={d.record.outOfSchoolSuspensions} />
                <Detail label="Harassment/bullying allegations" value={d.record.harassmentBullyingAllegations} />
                <DetailBool label="Any firearm incident" value={d.record.firearmIncident} invert />
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

function DetailBool({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: boolean;
  invert?: boolean;
}) {
  const good = invert ? !value : value;
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${good ? "text-emerald-600" : "text-rose-500"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}
