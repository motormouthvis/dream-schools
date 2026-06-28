"use client";

import { useEffect, useState } from "react";
import type { SchoolDetail } from "@/lib/types";
import { Reviews } from "./Reviews";

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 backdrop-blur-sm sm:p-8"
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
    a.coed && a.coed !== "Coeducational" ? a.coed : null,
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

      <div className="max-h-[82vh] overflow-y-auto px-5 py-5 sm:max-h-[75vh] sm:px-6">
        {/* GreatSchools-style 1-10 ratings, with context */}
        <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-600/15">
          <p className="mb-2.5 text-[11px] font-medium leading-relaxed text-brand-900">
            Ratings are on a <strong>1–10 scale (10 = best)</strong>, like GreatSchools — higher
            means stronger. Based on real federal data below.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Rating10 label="Overall" desc="combined quality" value={detail.summaryRating} big />
            {detail.testScores?.rating != null && (
              <Rating10 label="Test scores" desc="state test proficiency" value={detail.testScores.rating} />
            )}
            {detail.collegeReadiness?.rating != null && (
              <Rating10
                label="College ready"
                desc="grad + AP/IB + SAT/ACT"
                value={detail.collegeReadiness.rating}
              />
            )}
          </div>
          {detail.summaryRating == null && (
            <p className="mt-2 text-xs text-brand-900/70">
              Limited data — federal test/college metrics aren&apos;t reported for this school
              (common for some private, charter, or alternative schools).
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Test scores */}
        {detail.testScores && (
          <Section title={`Test scores${detail.testScores.year ? ` · ${detail.testScores.year}` : ""}`}>
            {detail.testScores.read != null && (
              <Fact label="Students proficient in reading" value={`${detail.testScores.read}%`} />
            )}
            {detail.testScores.math != null && (
              <Fact label="Students proficient in math" value={`${detail.testScores.math}%`} />
            )}
            <Note>
              Share of students who met state standards on the annual state tests. Source: U.S. DOE
              EDFacts.
            </Note>
          </Section>
        )}

        {/* College readiness (high schools) */}
        {detail.collegeReadiness && (
          <Section title="College readiness">
            {detail.collegeReadiness.gradRate != null && (
              <Fact
                label="Graduate within 4 years"
                value={`${detail.collegeReadiness.gradRate}%`}
              />
            )}
            {detail.collegeReadiness.apIbPct != null && (
              <Fact label="Take an AP or IB course" value={`${detail.collegeReadiness.apIbPct}%`} />
            )}
            {detail.collegeReadiness.satActPct != null && (
              <Fact label="Take the SAT or ACT" value={`${detail.collegeReadiness.satActPct}%`} />
            )}
            <Note>
              % of students. Typical US 4-year graduation rate is ≈87%; very low rates usually mean
              an alternative, charter, or dropout-recovery school. Source: EDFacts + CRDC.
            </Note>
          </Section>
        )}

        {/* Safety & climate — normalized for comparison */}
        <Section title={`Safety & discipline${detail.safety ? ` · ${detail.safety.schoolYear}` : ""}`}>
          {detail.safety ? (
            <>
              <Fact
                label="Violent incidents (per 100 students)"
                value={per100(detail.safety.violentIncidentsTotal, detail.enrollment)}
              />
              <Fact
                label="Suspensions (per 100 students)"
                value={per100(detail.safety.outOfSchoolSuspensions, detail.enrollment)}
              />
              <Fact label="Violent incidents (total)" value={detail.safety.violentIncidentsTotal} />
              <Fact label="Physical attacks w/ weapon" value={detail.safety.physicalAttacksWithWeapon} />
              <Fact label="Firearm/explosive possession" value={detail.safety.firearmExplosivePossession} />
              <Fact label="Out-of-school suspensions" value={detail.safety.outOfSchoolSuspensions} />
              <Fact label="Harassment/bullying allegations" value={detail.safety.harassmentBullyingAllegations} />
              <Fact label="Any firearm incident" value={detail.safety.firearmIncident ? "Yes" : "No"} />
              <Note>
                Counts are for the full {detail.safety.schoolYear} school year. &ldquo;Per 100
                students&rdquo; lets you compare schools of different sizes. Source: U.S. DOE CRDC.
              </Note>
            </>
          ) : (
            <p className="col-span-2 text-sm text-slate-400">
              No federal safety data for this school (private schools aren&apos;t in this collection).
            </p>
          )}
        </Section>

        {/* Students */}
        <Section title="Students">
          <Fact label="Total enrolled" value={detail.enrollment.toLocaleString()} />
          {detail.students.lowIncomePct != null && (
            <Fact label="From low-income families" value={`${detail.students.lowIncomePct}%`} />
          )}
          {detail.students.ellPct != null && (
            <Fact label="English-language learners" value={`${detail.students.ellPct}%`} />
          )}
          {detail.chronicAbsentPct != null && (
            <Fact label="Chronically absent" value={`${detail.chronicAbsentPct}%`} />
          )}
          <Note>
            &ldquo;Low-income&rdquo; = eligible for free/reduced-price lunch. &ldquo;Chronically
            absent&rdquo; = missed ≥10% of school days.
          </Note>
        </Section>

        {/* Demographics (hidden in Fair Housing Compliant mode) */}
        {fairHousing ? (
          <Section title="Race & gender">
            <p className="col-span-2 text-xs text-slate-500">
              Hidden in <strong>Fair Housing Compliant</strong> mode so it can&apos;t be used to
              steer buyers, per Fair Housing guidance.
            </p>
          </Section>
        ) : (
          detail.demographics && (
            <Section title="Race & gender">
              <div className="col-span-2 space-y-3">
                {detail.demographics.byRace.length > 0 && (
                  <DemoBars title="By race / ethnicity" data={detail.demographics.byRace} />
                )}
                {detail.demographics.byGender.length > 0 && (
                  <DemoBars title="By gender" data={detail.demographics.byGender} />
                )}
                <Note>Source: NCES CCD 2023-24 enrollment.</Note>
              </div>
            </Section>
          )
        )}

        {/* Teachers & staff */}
        <Section title="Teachers & staff">
          <Fact
            label="Student-teacher ratio"
            value={detail.teachers.ratio ? `${Math.round(detail.teachers.ratio)} to 1` : "Not reported"}
          />
          {detail.teachers.certifiedPct != null && (
            <Fact label="Certified teachers" value={`${detail.teachers.certifiedPct}%`} />
          )}
          {detail.teachers.counselors != null && detail.teachers.counselors > 0 && (
            <Fact label="Counselors (full-time)" value={Math.round(detail.teachers.counselors)} />
          )}
          <Fact label="Security staff on site" value={detail.teachers.security ? "Yes" : "No"} />
        </Section>

        {/* Advanced courses */}
        {detail.advanced && (detail.advanced.apPct || detail.advanced.ibPct || detail.advanced.giftedPct) && (
          <Section title="Advanced courses">
            {detail.advanced.apPct != null && (
              <Fact label="In AP courses" value={`${detail.advanced.apPct}%`} />
            )}
            {detail.advanced.ibPct != null && (
              <Fact label="In IB courses" value={`${detail.advanced.ibPct}%`} />
            )}
            {detail.advanced.giftedPct != null && (
              <Fact label="Gifted & talented" value={`${detail.advanced.giftedPct}%`} />
            )}
          </Section>
        )}

        {/* Contact (near the end — not decision-critical) */}
        <Section title="Contact & details">
          {addressLine && <Fact label="Address" value={addressLine} />}
          {c.phone && <Fact label="Phone" value={c.phone} />}
          <Fact label="Type" value={detail.type} />
          <Fact label="Grades" value={detail.grades} />
          {a.coed && <Fact label="Coed status" value={a.coed} />}
          {a.urbanicity && <Fact label="Setting" value={a.urbanicity} />}
          <div className="col-span-2 pt-1 text-[10px] text-slate-300">NCES ID {detail.ncesId}</div>
        </Section>

        <Reviews ncesId={detail.ncesId} />
      </div>
    </>
  );
}

function rating10Color(v: number): string {
  if (v >= 8) return "#059669";
  if (v >= 6) return "#65a30d";
  if (v >= 4) return "#d97706";
  return "#e11d48";
}

function Rating10({
  label,
  desc,
  value,
  big,
}: {
  label: string;
  desc?: string;
  value: number | null;
  big?: boolean;
}) {
  if (value == null) return null;
  const color = rating10Color(value);
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/70 p-2">
      <div
        className="flex shrink-0 items-baseline justify-center rounded-xl font-extrabold text-white"
        style={{ backgroundColor: color, width: big ? 52 : 46, height: big ? 52 : 46 }}
      >
        <span style={{ fontSize: big ? 22 : 19 }}>{value}</span>
        <span className="text-[10px] font-semibold opacity-80">/10</span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight text-slate-900">{label}</div>
        {desc && <div className="text-[11px] leading-tight text-slate-500">{desc}</div>}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="col-span-2 mt-1 text-[11px] leading-relaxed text-slate-400">{children}</p>;
}

function per100(count: number, enrollment: number): string {
  if (!enrollment || enrollment <= 0) return "—";
  const v = (count / enrollment) * 100;
  return v === 0 ? "0" : v < 0.1 ? "<0.1" : v.toFixed(1);
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
    <div className="mt-4 rounded-xl bg-slate-50/70 p-3.5 sm:p-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="h-4 w-1.5 rounded-full bg-brand-500" />
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 py-1.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
