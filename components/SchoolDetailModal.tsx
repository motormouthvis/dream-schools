"use client";

import { useEffect, useState } from "react";
import type { SchoolDetail } from "@/lib/types";
import { tone } from "./score";
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
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const a = detail.attributes;
  const c = detail.contact;
  const b = detail.benchmarks;
  const reportHref =
    `mailto:corrections@dreamneighborhood.com` +
    `?subject=${encodeURIComponent(`Data correction: ${detail.name} (NCES ${detail.ncesId})`)}` +
    `&body=${encodeURIComponent(
      `School: ${detail.name}\nNCES ID: ${detail.ncesId}\n\nWhat is incorrect, and what should it be?\n`
    )}`;
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
      <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight sm:text-lg">{detail.name}</h2>
          <p className="mt-0.5 text-xs text-brand-50 sm:text-sm">
            {detail.type} • Grades {detail.grades} • {detail.district.name}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-brand-100">
            <button type="button" onClick={() => setShowDisclaimer(true)} className="underline underline-offset-2 hover:text-white">
              ⓘ Data disclaimer
            </button>
            <a href={reportHref} className="underline underline-offset-2 hover:text-white">
              Report an error
            </a>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
        >
          ✕
        </button>
      </header>

      {showDisclaimer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowDisclaimer(false)}>
          <div className="max-w-sm rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900">Data disclaimer</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Figures come from public federal datasets (NCES CCD, U.S. DOE CRDC, EDFacts, NCES PSS)
              and may be <strong>several years old, incomplete, or contain errors</strong>. Ratings
              are our own computed estimates, not official scores. This information is provided
              &ldquo;as is&rdquo; for general guidance only — verify directly with the school or
              district before making decisions. Dream Neighborhood is not responsible for any
              decisions made based on this data. See the menu under &ldquo;Data sources&rdquo; for
              details.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <a href={reportHref} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Report an error →
              </a>
              <button type="button" onClick={() => setShowDisclaimer(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-[82vh] overflow-y-auto px-5 py-5 sm:max-h-[75vh] sm:px-6">
        {/* 1-10 Dream Rating, with context + data-coverage */}
        <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-600/15">
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium leading-relaxed text-brand-900">
              Ratings are on a <strong>1–10 scale (10 = best)</strong> — higher means stronger.
            </p>
            <RatingInfo coverage={detail.coverage} />
          </div>
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
          {/* Data-coverage indicator (Option 3) */}
          <div className="mt-2.5 flex items-center gap-2">
            <CoverageDots available={detail.coverage.available} total={detail.coverage.total} />
            <span className="text-[11px] font-medium text-brand-900/80">
              {detail.summaryRating == null
                ? "Limited data — no outcome measures reported"
                : `Based on ${detail.coverage.available} of ${detail.coverage.total} outcome measures`}
            </span>
          </div>
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
              <Fact
                label="Reading proficiency"
                value={`${detail.testScores.read}%`}
                color={tone(detail.testScores.read, 60, 35)}
                sub={bench(b?.stateAvg?.testRead, b?.nationalAvg?.testRead, "%")}
              />
            )}
            {detail.testScores.math != null && (
              <Fact
                label="Math proficiency"
                value={`${detail.testScores.math}%`}
                color={tone(detail.testScores.math, 60, 35)}
                sub={bench(b?.stateAvg?.testMath, b?.nationalAvg?.testMath, "%")}
              />
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
                label="4-yr graduation rate"
                value={`${detail.collegeReadiness.gradRate}%`}
                color={tone(detail.collegeReadiness.gradRate, 85, 67)}
                sub={bench(b?.stateAvg?.gradRate, b?.nationalAvg?.gradRate, "%")}
              />
            )}
            {detail.collegeReadiness.apIbPct != null && (
              <Fact
                label="In AP / IB courses"
                value={`${detail.collegeReadiness.apIbPct}%`}
                color={tone(detail.collegeReadiness.apIbPct, 30, 8)}
              />
            )}
            {detail.collegeReadiness.satActPct != null && (
              <Fact
                label="Took SAT / ACT"
                value={`${detail.collegeReadiness.satActPct}%`}
                color={tone(detail.collegeReadiness.satActPct, 40, 10)}
              />
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
                label="Violent / 100 students"
                value={per100(detail.safety.violentIncidentsTotal, detail.enrollment)}
                color={tone(
                  (detail.safety.violentIncidentsTotal / Math.max(detail.enrollment, 1)) * 100,
                  1,
                  5,
                  false
                )}
                sub={bench(b?.stateAvg?.violentPer100, b?.nationalAvg?.violentPer100)}
              />
              <Fact
                label="Suspensions / 100"
                value={per100(detail.safety.outOfSchoolSuspensions, detail.enrollment)}
                color={tone(
                  (detail.safety.outOfSchoolSuspensions / Math.max(detail.enrollment, 1)) * 100,
                  5,
                  20,
                  false
                )}
                sub={bench(b?.stateAvg?.suspensionsPer100, b?.nationalAvg?.suspensionsPer100)}
              />
              <Fact
                label="Security staff on site"
                value={detail.teachers.security ? "Yes" : "No"}
                color={detail.teachers.security ? "#059669" : "#d97706"}
              />
              <Fact label="Violent incidents (total)" value={detail.safety.violentIncidentsTotal} />
              <Fact label="Attacks w/ weapon" value={detail.safety.physicalAttacksWithWeapon} />
              <Fact label="Attacks, no weapon" value={detail.safety.physicalAttacksNoWeapon} />
              <Fact label="Threats of violence" value={detail.safety.threatsOfViolence} />
              <Fact label="Robberies" value={detail.safety.robberies} />
              <Fact label="Rape / sexual battery" value={detail.safety.rapeOrSexualBattery} />
              <Fact label="Firearm possession" value={detail.safety.firearmExplosivePossession} />
              <Fact label="Suspensions (total)" value={detail.safety.outOfSchoolSuspensions} />
              <Fact label="Bullying allegations" value={detail.safety.harassmentBullyingAllegations} />
              <Fact label="Any firearm incident" value={detail.safety.firearmIncident ? "Yes" : "No"} />
              <Note>
                Counts are for the full {detail.safety.schoolYear} school year. &ldquo;Per 100
                students&rdquo; lets you compare schools of different sizes (vs your state &amp; the
                US). Source: U.S. DOE CRDC.
              </Note>
            </>
          ) : (
            <p className="col-span-full text-sm text-slate-400">
              No federal safety data for this school (private schools aren&apos;t in this collection).
            </p>
          )}
        </Section>

        {/* Students */}
        <Section title="Students">
          <Fact label="Total enrolled" value={detail.enrollment.toLocaleString()} />
          {detail.students.lowIncomePct != null && (
            <Fact label="Low-income" value={`${detail.students.lowIncomePct}%`} />
          )}
          {detail.students.ellPct != null && (
            <Fact label="English learners" value={`${detail.students.ellPct}%`} />
          )}
          {detail.chronicAbsentPct != null && (
            <Fact
              label="Chronically absent"
              value={`${detail.chronicAbsentPct}%`}
              color={tone(detail.chronicAbsentPct, 15, 35, false)}
            />
          )}
          <Note>
            &ldquo;Low-income&rdquo; = eligible for free/reduced-price lunch. &ldquo;Chronically
            absent&rdquo; = missed ≥10% of school days.
          </Note>
        </Section>

        {/* Teachers & staff */}
        <Section title="Teachers & staff">
          <Fact
            label="Student-teacher ratio"
            value={detail.teachers.ratio ? `${Math.round(detail.teachers.ratio)} to 1` : "Not reported"}
            color={detail.teachers.ratio ? tone(detail.teachers.ratio, 14, 20, false) : undefined}
          />
          {detail.teachers.certifiedPct != null && (
            <Fact
              label="Certified teachers"
              value={`${detail.teachers.certifiedPct}%`}
              color={tone(detail.teachers.certifiedPct, 90, 70)}
            />
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
              <Fact label="In AP courses" value={`${detail.advanced.apPct}%`} color={tone(detail.advanced.apPct, 15, 2)} />
            )}
            {detail.advanced.ibPct != null && (
              <Fact label="In IB courses" value={`${detail.advanced.ibPct}%`} color={tone(detail.advanced.ibPct, 8, 0.5)} />
            )}
            {detail.advanced.giftedPct != null && (
              <Fact label="Gifted & talented" value={`${detail.advanced.giftedPct}%`} color={tone(detail.advanced.giftedPct, 8, 1)} />
            )}
          </Section>
        )}

        <Reviews ncesId={detail.ncesId} />

        {/* Race & gender — kept near the bottom, just above Contact */}
        {fairHousing ? (
          <Section title="Race & gender">
            <p className="col-span-full text-xs text-slate-500">
              Hidden in <strong>Fair Housing Compliant</strong> mode so it can&apos;t be used to
              steer buyers, per Fair Housing guidance.
            </p>
          </Section>
        ) : (
          detail.demographics && (
            <Section title="Race & gender">
              <div className="col-span-full space-y-3">
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

        {/* Contact (bottom — not decision-critical; collapsed) */}
        <CollapsibleSection title="Contact & details">
          {addressLine && <Fact label="Address" value={addressLine} />}
          {c.phone && <Fact label="Phone" value={c.phone} />}
          <Fact label="Type" value={detail.type} />
          <Fact label="Grades" value={detail.grades} />
          {a.coed && <Fact label="Coed status" value={a.coed} />}
          {a.urbanicity && <Fact label="Setting" value={a.urbanicity} />}
          <div className="col-span-full pt-1 text-[10px] text-slate-300">NCES ID {detail.ncesId}</div>
        </CollapsibleSection>
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

function CoverageDots({ available, total }: { available: number; total: number }) {
  const color = available === 0 ? "#e11d48" : available >= total ? "#059669" : "#d97706";
  return (
    <span className="flex items-center gap-0.5" aria-label={`${available} of ${total} measures`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: i < available ? color : "#e2e8f0" }}
        />
      ))}
    </span>
  );
}

function RatingInfo({ coverage }: { coverage: SchoolDetail["coverage"] }) {
  const [open, setOpen] = useState(false);
  const mark = (b: boolean) => (b ? "✓" : "✗");
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How this rating is calculated"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] leading-relaxed text-slate-600 shadow-xl">
            <p className="mb-1.5 font-bold text-slate-900">How this rating is calculated</p>
            <p className="mb-2">
              A 1–10 score combining the outcome measures we have for this school. More measures =
              higher confidence.
            </p>
            <ul className="space-y-1">
              <li>
                <span className={coverage.hasTest ? "text-emerald-600" : "text-rose-500"}>
                  {mark(coverage.hasTest)}
                </span>{" "}
                Test scores (state proficiency, EDFacts)
              </li>
              <li>
                {coverage.isHigh ? (
                  <>
                    <span className={coverage.hasCollege ? "text-emerald-600" : "text-rose-500"}>
                      {mark(coverage.hasCollege)}
                    </span>{" "}
                    College readiness (grad + AP/IB + SAT/ACT)
                  </>
                ) : (
                  <>
                    <span className="text-slate-300">—</span> College readiness (high schools only)
                  </>
                )}
              </li>
              <li>
                <span className={coverage.hasSafety ? "text-emerald-600" : "text-rose-500"}>
                  {mark(coverage.hasSafety)}
                </span>{" "}
                Safety &amp; discipline (CRDC)
              </li>
            </ul>
            <p className="mt-2 text-slate-400">
              {`Based on ${coverage.available} of ${coverage.total} measures. Private schools have no outcome data collected federally, so they show “Limited data.”`}
            </p>
          </div>
        </>
      )}
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="col-span-full mt-1 text-[11px] leading-relaxed text-slate-400">{children}</p>;
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
      <dl className="grid grid-cols-1 gap-y-1.5">{children}</dl>
    </div>
  );
}

function Fact({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="border-b border-slate-200/70 py-1.5 last:border-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <dt className="min-w-0 text-slate-500">{label}</dt>
        <dd
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-bold tabular-nums"
          style={{ color: color ?? "#0f172a" }}
        >
          {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
          {value}
        </dd>
      </div>
      {sub && <div className="mt-0.5 text-right text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

// "State 48% · US 50%" benchmark caption (omits unknowns).
function bench(stateV: number | null | undefined, natV: number | null | undefined, unit = ""): string | undefined {
  const parts: string[] = [];
  if (stateV != null) parts.push(`State ${stateV}${unit}`);
  if (natV != null) parts.push(`US ${natV}${unit}`);
  return parts.length ? parts.join(" · ") : undefined;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 rounded-xl bg-slate-50/70 p-3.5 sm:p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-bold text-slate-900"
        aria-expanded={open}
      >
        <span className="h-4 w-1.5 rounded-full bg-brand-500" />
        {title}
        <span className={`ml-auto text-brand-500 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <dl className="mt-2.5 grid grid-cols-1 gap-y-1.5">{children}</dl>}
    </div>
  );
}
