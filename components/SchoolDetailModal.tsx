"use client";

import { useEffect, useState } from "react";
import { scoreHex, scoreBadgeClass, scoreLabel } from "./score";
import type { SchoolDetail } from "@/lib/types";

export function SchoolDetailModal({
  ncesId,
  onClose,
  fairHousing = false,
}: {
  ncesId: string;
  onClose: () => void;
  fairHousing?: boolean;
}) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/school?ncesId=${encodeURIComponent(ncesId)}${fairHousing ? "&fh=1" : ""}`)
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
  }, [ncesId, fairHousing]);

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
        {detail && <DetailBody detail={detail} onClose={onClose} fairHousing={fairHousing} />}
      </div>
    </div>
  );
}

function DetailBody({
  detail,
  onClose,
  fairHousing,
}: {
  detail: SchoolDetail;
  onClose: () => void;
  fairHousing: boolean;
}) {
  const s = detail.scores;
  const a = detail.attributes;
  const c = detail.contact;
  const addressLine = [c.street, [c.city, c.state].filter(Boolean).join(", "), c.zip]
    .filter(Boolean)
    .join(" · ");
  const tags = [
    detail.level === "private" ? "Private" : null,
    a.charter ? "Charter" : null,
    a.magnet ? "Magnet" : null,
    a.virtual ? "Virtual" : null,
    a.titleI ? "Title I" : null,
  ].filter(Boolean) as string[];
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

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Contact */}
        <Section title="Contact">
          {addressLine && <Fact label="Address" value={addressLine} />}
          {c.phone && <Fact label="Phone" value={c.phone} />}
          {!addressLine && !c.phone && (
            <p className="col-span-2 text-sm text-slate-400">No contact info reported.</p>
          )}
        </Section>

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
          {a.freeReducedLunchPct != null && (
            <Fact label="Free/reduced lunch" value={`${a.freeReducedLunchPct}%`} />
          )}
          {a.urbanicity && <Fact label="Setting" value={a.urbanicity} />}
          <Fact label="NCES ID" value={detail.ncesId} />
        </Section>

        {/* Demographics (hidden in Fair Housing Compliant mode) */}
        {fairHousing ? (
          <Section title="Student demographics">
            <p className="col-span-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Hidden in <strong>Fair Housing Compliant</strong> mode. Race and gender data are
              omitted so they can&apos;t be used to steer buyers, per Fair Housing guidance.
            </p>
          </Section>
        ) : (
          detail.demographics && (
            <Section title="Student demographics">
              <div className="col-span-2 space-y-3">
                {detail.demographics.byRace.length > 0 && (
                  <DemoBars title="By race / ethnicity" data={detail.demographics.byRace} />
                )}
                {detail.demographics.byGender.length > 0 && (
                  <DemoBars title="By gender" data={detail.demographics.byGender} />
                )}
                <p className="text-[11px] text-slate-400">Source: NCES CCD 2023-24 enrollment.</p>
              </div>
            </Section>
          )
        )}

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

function DemoBars({ title, data }: { title: string; data: { label: string; count: number; pct: number }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-600">{title}</p>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 truncate text-slate-500">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${d.pct}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-slate-700">
              {d.pct}% ({d.count.toLocaleString()})
            </span>
          </div>
        ))}
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
