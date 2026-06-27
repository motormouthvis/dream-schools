"use client";

import { useEffect, useState } from "react";
import { scoreHex, scoreBadgeClass, scoreLabel } from "./score";
import type { SchoolDetail } from "@/lib/types";

export function SchoolDetailModal({
  ncesId,
  onClose,
}: {
  ncesId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/school?ncesId=${encodeURIComponent(ncesId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else setDetail(j as SchoolDetail);
      })
      .catch(() => !cancelled && setError("Could not load school details."));
    return () => {
      cancelled = true;
    };
  }, [ncesId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!detail && !error && (
          <div className="p-10 text-center text-slate-400">Loading school details…</div>
        )}
        {error && (
          <div className="p-6">
            <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
            <button onClick={onClose} className="mt-4 text-sm font-semibold text-brand-600">
              Close
            </button>
          </div>
        )}
        {detail && <DetailBody detail={detail} onClose={onClose} />}
      </div>
    </div>
  );
}

function DetailBody({ detail, onClose }: { detail: SchoolDetail; onClose: () => void }) {
  const s = detail.scores;
  return (
    <>
      <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-5 text-white">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{detail.name}</h2>
          <p className="mt-0.5 text-sm text-brand-50">
            {detail.type} • Grades {detail.grades} • {detail.district.name}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
        >
          ✕
        </button>
      </header>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
        {/* Scores */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigScore label="Overall" value={s.overall} primary />
          <BigScore label="Academic" value={s.academic} />
          <BigScore label="Safety" value={s.safety} />
          <BigScore label="Scale" value={s.scale} />
        </div>

        {/* Key facts */}
        <Section title="School">
          <Fact label="Type" value={detail.type} />
          <Fact label="Grades" value={detail.grades} />
          <Fact label="Enrollment" value={detail.enrollment.toLocaleString()} />
          <Fact
            label="Student-teacher ratio"
            value={detail.studentTeacherRatio ? `${detail.studentTeacherRatio}:1` : "Not reported"}
          />
          <Fact
            label="Chronic absenteeism"
            value={detail.chronicAbsentPct != null ? `${detail.chronicAbsentPct}%` : "Not reported"}
          />
          <Fact label="Zip" value={detail.zip || "—"} />
          <Fact label="NCES ID" value={detail.ncesId} />
        </Section>

        {/* Graduation */}
        <Section title="Graduation">
          {detail.graduation ? (
            <>
              <Fact
                label={`4-year graduation rate (${detail.graduation.schoolYear})`}
                value={`${detail.graduation.gradRate4yr}%`}
              />
              <Fact label="Cohort size" value={detail.graduation.cohortSize.toLocaleString()} />
              <p className="col-span-2 mt-1 text-[11px] text-slate-400">{detail.graduation.source}</p>
            </>
          ) : (
            <p className="col-span-2 text-sm text-slate-400">
              No graduation data (typically a non–high-school grade span).
            </p>
          )}
        </Section>

        {/* Safety (full CRDC) */}
        <Section title={`Safety & Climate ${detail.safety ? `(${detail.safety.schoolYear})` : ""}`}>
          {detail.safety ? (
            <>
              <Fact label="Violent incidents total" value={detail.safety.violentIncidentsTotal} />
              <Fact label="Physical attacks w/ weapon" value={detail.safety.physicalAttacksWithWeapon} />
              <Fact label="Physical attacks, no weapon" value={detail.safety.physicalAttacksNoWeapon} />
              <Fact label="Threats of violence" value={detail.safety.threatsOfViolence} />
              <Fact label="Robberies" value={detail.safety.robberies} />
              <Fact label="Rape / sexual battery" value={detail.safety.rapeOrSexualBattery} />
              <Fact label="Firearm/explosive possession" value={detail.safety.firearmExplosivePossession} />
              <Fact label="Out-of-school suspensions" value={detail.safety.outOfSchoolSuspensions} />
              <Fact label="Harassment/bullying allegations" value={detail.safety.harassmentBullyingAllegations} />
              <Fact label="Any firearm incident" value={detail.safety.firearmIncident ? "Yes" : "No"} />
              <p className="col-span-2 mt-1 text-[11px] text-slate-400">{detail.safety.source}</p>
            </>
          ) : (
            <p className="col-span-2 text-sm text-slate-400">No safety data reported for this school.</p>
          )}
        </Section>
      </div>
    </>
  );
}

function BigScore({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  const color = scoreHex(value);
  return (
    <div
      className={`rounded-xl p-3 text-center ${primary ? "bg-slate-50 ring-1 ring-slate-200" : ""}`}
    >
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ring-1 ring-inset ${scoreBadgeClass(
          value
        )}`}
      >
        {scoreLabel(value)}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}
