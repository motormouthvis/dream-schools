"use client";

import { useEffect, useState } from "react";
import type { SchoolDetail } from "@/lib/types";
import { tone } from "./score";
import { Reviews } from "./Reviews";

export function SchoolDetailModal({
  ncesId,
  onClose,
  fairHousing = false,
  variant = "modal",
  embed = false,
  backLabel = "Back to schools",
}: {
  ncesId: string;
  onClose: () => void;
  fairHousing?: boolean;
  /** Label for the inline back affordance (e.g. "Back to list" / "Back to map"). */
  backLabel?: string;
  /**
   * "modal" (default) renders the fixed overlay used on the main site.
   * "inline" renders the detail in normal flow (scrollable, with a back
   * affordance) — used by the embeddable explorer so the school detail shows
   * inside the iframe instead of as a popup over the popup panel.
   */
  variant?: "modal" | "inline";
  /**
   * Embed (real-estate) mode: show a single 0–10 Diversity Index instead of any
   * race/gender breakdown. Race data is only shown on the main (non-real-estate)
   * website to avoid Fair Housing steering concerns on partner listing sites.
   */
  embed?: boolean;
}) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inline = variant === "inline";

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

  // Inline variant: render in normal flow so the iframe scrolls the whole page.
  if (inline) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!detail && !error && (
          <div className="p-10 text-center text-slate-400">Loading school details…</div>
        )}
        {error && (
          <div className="p-6">
            <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
            <button onClick={onClose} className="mt-4 text-sm font-semibold text-brand-600">
              ← {backLabel}
            </button>
          </div>
        )}
        {detail && (
          <DetailBody
            detail={detail}
            onClose={onClose}
            fairHousing={fairHousing}
            inline
            embed={embed}
            backLabel={backLabel}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 backdrop-blur-sm sm:p-8"
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
        {detail && (
          <DetailBody detail={detail} onClose={onClose} fairHousing={fairHousing} embed={embed} />
        )}
      </div>
    </div>
  );
}

function DetailBody({
  detail,
  onClose,
  fairHousing,
  inline = false,
  embed = false,
  backLabel = "Back to schools",
}: {
  detail: SchoolDetail;
  onClose: () => void;
  fairHousing: boolean;
  inline?: boolean;
  embed?: boolean;
  backLabel?: string;
}) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const a = detail.attributes;
  const c = detail.contact;
  const b = detail.benchmarks;
  const isPrivate = detail.level === "private";
  const lowG = gradeNum(detail.gradeLow);
  const highG = gradeNum(detail.gradeHigh);
  // Only high schools have AP/IB/SAT/graduation outcomes; combo schools (e.g.
  // K-12) serve those grades alongside lower ones, so we annotate rather than hide.
  const servesHigh = highG != null && highG >= 9;
  const isCombo = servesHigh && lowG != null && lowG <= 6;
  const hsNote = isCombo ? "Reflects high-school grades only." : null;
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
      {inline && (
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center gap-1.5 border-b border-slate-100 bg-white px-5 py-2.5 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-50 sm:px-6"
        >
          <span aria-hidden className="text-base leading-none">←</span> {backLabel}
        </button>
      )}
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
          aria-label={inline ? backLabel : "Close"}
          className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
        >
          {inline ? "←" : "✕"}
        </button>
      </header>

      {showDisclaimer && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowDisclaimer(false)}>
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

      <div
        className={
          inline
            ? "px-5 py-5 sm:px-6"
            : "max-h-[82vh] overflow-y-auto px-5 py-5 sm:max-h-[75vh] sm:px-6"
        }
      >
        {/* Dream Rating — plain-language header + interpretive 1-10 scores */}
        <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-600/15">
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold leading-tight text-brand-900">Dream Rating</p>
              <p className="text-[11px] leading-relaxed text-brand-900/70">
                Our 1–10 score (10 = best). 1–3 below average · 4–7 average · 8–10 above average.
              </p>
            </div>
            <RatingInfo coverage={detail.coverage} isPrivate={isPrivate} />
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Rating10 label="Overall" value={detail.summaryRating} big />
            {detail.testScores?.rating != null && (
              <Rating10 label="Test scores" value={detail.testScores.rating} />
            )}
            {servesHigh && detail.collegeReadiness?.rating != null && (
              <Rating10 label="College readiness" value={detail.collegeReadiness.rating} />
            )}
          </div>
          {/* Plain-language confidence + what the rating is based on */}
          <ConfidenceLine
            summaryRating={detail.summaryRating}
            coverage={detail.coverage}
            isPrivate={isPrivate}
          />
        </div>

        {isPrivate && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-500/25">
            <strong>Private school — limited data.</strong> The federal government doesn&apos;t
            collect test scores, graduation, or safety records for most private schools, so this
            profile shows only what schools self-report (enrollment, grades, student-teacher ratio).
            Contact the school directly for academic results.
          </div>
        )}

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
        {detail.testScores && (detail.testScores.read != null || detail.testScores.math != null) && (
          <Section title={`Test scores${detail.testScores.year ? ` · ${detail.testScores.year}` : ""}`}>
            {detail.testScores.read != null && (
              <MetricBar
                label="Reading at grade level"
                value={detail.testScores.read}
                unit="%"
                max={100}
                color={tone(detail.testScores.read, 60, 35)}
                state={b?.stateAvg?.testRead}
                nat={b?.nationalAvg?.testRead}
              />
            )}
            {detail.testScores.math != null && (
              <MetricBar
                label="Math at grade level"
                value={detail.testScores.math}
                unit="%"
                max={100}
                color={tone(detail.testScores.math, 60, 35)}
                state={b?.stateAvg?.testMath}
                nat={b?.nationalAvg?.testMath}
              />
            )}
            <Note>
              Percent of students who passed the annual state tests (&ldquo;proficient&rdquo; or
              better). The bar marks show your state and US averages for comparison. Source: U.S. DOE
              EDFacts.
            </Note>
          </Section>
        )}

        {/* College readiness — high schools only, and only when we have data */}
        {servesHigh &&
          detail.collegeReadiness &&
          (detail.collegeReadiness.gradRate != null ||
            detail.collegeReadiness.apIbPct != null ||
            detail.collegeReadiness.satActPct != null) && (
          <Section title="College readiness">
            {detail.collegeReadiness.gradRate != null && (
              <MetricBar
                label="Graduated in 4 years"
                value={detail.collegeReadiness.gradRate}
                unit="%"
                max={100}
                color={tone(detail.collegeReadiness.gradRate, 85, 67)}
                state={b?.stateAvg?.gradRate}
                nat={b?.nationalAvg?.gradRate}
              />
            )}
            {detail.collegeReadiness.apIbPct != null && (
              <Fact
                label="Taking AP / IB classes"
                value={`${detail.collegeReadiness.apIbPct}%`}
                color={tone(detail.collegeReadiness.apIbPct, 30, 8)}
              />
            )}
            {detail.collegeReadiness.satActPct != null && (
              <Fact
                label="Took the SAT / ACT"
                value={`${detail.collegeReadiness.satActPct}%`}
                color={tone(detail.collegeReadiness.satActPct, 40, 10)}
              />
            )}
            <Note>
              Share of students. A typical US 4-year graduation rate is about 87%; very low rates
              usually mean an alternative or dropout-recovery school. {hsNote} Source: EDFacts + CRDC.
            </Note>
          </Section>
        )}

        {/* Safety — at-a-glance summary, key comparisons, details on demand */}
        <Section title={`Safety & discipline${detail.safety ? ` · ${detail.safety.schoolYear}` : ""}`}>
          {detail.safety ? (
            <SafetyBlock detail={detail} b={b} />
          ) : (
            <p className="col-span-full text-sm text-slate-400">
              No federal safety data for this school
              {isPrivate ? " (not collected for private schools)" : ""}.
            </p>
          )}
        </Section>

        {/* Students */}
        <Section title="Students">
          <Fact label="Total students" value={detail.enrollment.toLocaleString()} />
          {detail.students.lowIncomePct != null && (
            <Fact label="From low-income homes" value={`${detail.students.lowIncomePct}%`} />
          )}
          {detail.students.ellPct != null && (
            <Fact label="Still learning English" value={`${detail.students.ellPct}%`} />
          )}
          {detail.chronicAbsentPct != null && (
            <Fact
              label="Chronically absent"
              value={`${detail.chronicAbsentPct}%`}
              color={tone(detail.chronicAbsentPct, 15, 35, false)}
            />
          )}
          <Note>
            &ldquo;Low-income&rdquo; means eligible for free or reduced-price lunch — a common
            measure of economic need, not school quality. &ldquo;Chronically absent&rdquo; means
            missing 10% or more of school days (lower is better).
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
          <Fact
            label="Security staff on site"
            value={securityStatus(detail).value}
            color={securityStatus(detail).color}
          />
          <Note>
            Student-teacher ratio is the number of students per teacher — fewer usually means more
            individual attention (e.g. &ldquo;15 to 1&rdquo; = 15 students per teacher).
          </Note>
        </Section>

        {/* Advanced courses — AP/IB are high-school only; gifted can be any level */}
        {detail.advanced &&
          ((servesHigh && (detail.advanced.apPct != null || detail.advanced.ibPct != null)) ||
            detail.advanced.giftedPct != null) && (
            <Section title="Advanced & gifted programs">
              {servesHigh && detail.advanced.apPct != null && (
                <Fact label="Taking AP courses" value={`${detail.advanced.apPct}%`} color={tone(detail.advanced.apPct, 15, 2)} />
              )}
              {servesHigh && detail.advanced.ibPct != null && (
                <Fact label="Taking IB courses" value={`${detail.advanced.ibPct}%`} color={tone(detail.advanced.ibPct, 8, 0.5)} />
              )}
              {detail.advanced.giftedPct != null && (
                <Fact label="In gifted & talented" value={`${detail.advanced.giftedPct}%`} color={tone(detail.advanced.giftedPct, 8, 1)} />
              )}
              {hsNote && servesHigh && (detail.advanced.apPct != null || detail.advanced.ibPct != null) && (
                <Note>AP / IB figures reflect high-school grades only.</Note>
              )}
            </Section>
          )}

        <Reviews ncesId={detail.ncesId} />

        {/* Diversity (embed/real-estate) — a single 0–10 index, no race data.
            Race/gender breakdowns are shown only on the main website. */}
        {embed ? (
          <DiversitySection byRace={detail.demographics?.byRace ?? []} />
        ) : fairHousing ? (
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

// Security staff status from the reported FTE: No = red, Part-time = amber,
// Yes = green, and "Not reported" (no CRDC record, e.g. private) = slate.
function securityStatus(detail: SchoolDetail): { value: string; color: string } {
  const fte = detail.teachers.securityFte;
  if (fte == null) {
    return detail.teachers.security
      ? { value: "Yes", color: "#059669" }
      : { value: "Not reported", color: "#64748b" };
  }
  if (fte <= 0) return { value: "No", color: "#e11d48" };
  if (fte < 1) return { value: "Part-time", color: "#d97706" };
  return { value: "Yes", color: "#059669" };
}

function ratingWord(v: number): string {
  if (v >= 8) return "Above average";
  if (v >= 4) return "Average";
  return "Below average";
}

function gradeNum(g: string | null | undefined): number | null {
  if (!g) return null;
  const u = g.toUpperCase().trim();
  if (u === "PK" || u === "PRESCHOOL" || u === "PRE-K") return -1;
  if (u === "KG" || u === "K" || u === "KINDERGARTEN") return 0;
  const n = parseInt(g, 10);
  return Number.isNaN(n) ? null : n;
}

function Rating10({ label, value, big }: { label: string; value: number | null; big?: boolean }) {
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
        <div className="text-[11px] font-semibold leading-tight" style={{ color }}>
          {ratingWord(value)}
        </div>
      </div>
    </div>
  );
}

// Plain-language statement of how confident the rating is and what it's based on.
function ConfidenceLine({
  summaryRating,
  coverage,
  isPrivate,
}: {
  summaryRating: number | null;
  coverage: SchoolDetail["coverage"];
  isPrivate: boolean;
}) {
  // The rating is academic: test scores (+ graduation for high schools).
  const have: string[] = [];
  if (coverage.hasTest) have.push("test scores");
  if (coverage.isHigh && coverage.hasCollege) have.push("graduation rates");
  const list =
    have.length === 0
      ? ""
      : have.length === 1
      ? have[0]
      : `${have.slice(0, -1).join(", ")} and ${have[have.length - 1]}`;
  const expected = coverage.isHigh ? 2 : 1;
  const haveN = have.length;

  let text: string;
  let color: string;
  if (summaryRating == null) {
    text = isPrivate
      ? "Not rated — public schools' test & graduation data isn't collected for private schools"
      : "Not rated — no test or graduation data reported for this school";
    color = "#e11d48";
  } else if (haveN >= expected) {
    text = `Confident rating — based on ${list}`;
    color = "#059669";
  } else {
    text = `Lower-confidence rating — based on ${list} only (graduation data missing)`;
    color = "#d97706";
  }
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <CoverageDots available={haveN} total={expected} />
      <span className="text-[11px] font-semibold" style={{ color }}>
        {text}
      </span>
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

function RatingInfo({ coverage, isPrivate }: { coverage: SchoolDetail["coverage"]; isPrivate?: boolean }) {
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
              {isPrivate
                ? "Private schools have little outcome data collected federally, so most show “Limited data.”"
                : `More measures available = higher confidence in the rating.`}
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

// Diversity Index: the probability that two randomly chosen students come from
// different racial/ethnic backgrounds (Simpson's index), scaled to 0–10. Shown
// in the embed instead of any race breakdown.
function diversityIndex10(byRace: { pct: number }[]): number | null {
  const slices = (byRace || []).filter((s) => s && s.pct > 0);
  if (slices.length === 0) return null;
  const total = slices.reduce((a, s) => a + s.pct, 0) || 100;
  const simpson = 1 - slices.reduce((a, s) => {
    const p = s.pct / total;
    return a + p * p;
  }, 0);
  return Math.max(0, Math.min(10, Math.round(simpson * 10)));
}

function diversityWord(v: number): string {
  if (v >= 7) return "High diversity";
  if (v >= 4) return "Moderate diversity";
  return "Lower diversity";
}

function DiversitySection({ byRace }: { byRace: { pct: number }[] }) {
  const idx = diversityIndex10(byRace);
  return (
    <Section title="Diversity Index">
      {idx == null ? (
        <p className="col-span-full text-sm text-slate-400">
          Not enough data to compute a diversity index for this school.
        </p>
      ) : (
        <div className="col-span-full">
          <div className="flex items-center gap-3">
            <div
              className="flex shrink-0 items-baseline justify-center rounded-xl font-extrabold text-white"
              style={{ backgroundColor: rating10Color(idx), width: 52, height: 52 }}
            >
              <span style={{ fontSize: 22 }}>{idx}</span>
              <span className="text-[10px] font-semibold opacity-80">/10</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight text-slate-900">{diversityWord(idx)}</div>
              <div className="text-[11px] leading-tight text-slate-500">
                Higher = a more even mix of student backgrounds.
              </div>
            </div>
          </div>
          <Note>
            The Diversity Index is the chance that two randomly chosen students come from different
            racial/ethnic backgrounds, scaled 0–10. Source: NCES CCD enrollment.
          </Note>
        </div>
      )}
    </Section>
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

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// A metric shown as a labeled value plus a horizontal bar, with tick marks for
// the state and US averages so a parent can see "how does this compare?" at a
// glance. For "%" metrics higher is better (bar past the ticks = good); for
// per-100 safety metrics lower is better (bar short of the ticks = good).
function MetricBar({
  label,
  value,
  unit = "",
  color,
  state,
  nat,
  max,
}: {
  label: string;
  value: number;
  unit?: string;
  color: string;
  state?: number | null;
  nat?: number | null;
  max?: number;
}) {
  const top = max ?? (Math.max(value, state ?? 0, nat ?? 0, unit === "%" ? 1 : 0.6) * 1.35 || 1);
  const clamp = (v: number) => Math.max(1, Math.min(100, (v / top) * 100));
  return (
    <div className="border-b border-slate-200/70 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <dt className="text-slate-600">{label}</dt>
        <dd className="shrink-0 font-bold tabular-nums" style={{ color }}>
          {fmtNum(value)}
          {unit}
        </dd>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${clamp(value)}%`, backgroundColor: color }}
        />
        {state != null && <Tick pos={clamp(state)} shade="#475569" />}
        {nat != null && <Tick pos={clamp(nat)} shade="#94a3b8" />}
      </div>
      {(state != null || nat != null) && (
        <div className="mt-1 text-[10px] text-slate-400">
          {state != null && (
            <>
              <span className="inline-block h-2 w-0.5 translate-y-[1px] bg-[#475569]" /> State avg{" "}
              {fmtNum(state)}
              {unit}
            </>
          )}
          {state != null && nat != null ? "  ·  " : ""}
          {nat != null && (
            <>
              <span className="inline-block h-2 w-0.5 translate-y-[1px] bg-[#94a3b8]" /> US avg{" "}
              {fmtNum(nat)}
              {unit}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Tick({ pos, shade }: { pos: number; shade: string }) {
  return (
    <span
      className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded"
      style={{ left: `${pos}%`, backgroundColor: shade }}
    />
  );
}

// Safety section body: a glanceable headline, the two key comparison bars, the
// security-staff flag, any incidents that actually occurred, and an expander for
// the full breakdown (most categories are zero for the typical school).
function SafetyBlock({
  detail,
  b,
}: {
  detail: SchoolDetail;
  b: SchoolDetail["benchmarks"];
}) {
  const [showAll, setShowAll] = useState(false);
  const sf = detail.safety!;
  const enr = Math.max(detail.enrollment, 1);
  const violPer100 = (sf.violentIncidentsTotal / enr) * 100;
  const suspPer100 = (sf.outOfSchoolSuspensions / enr) * 100;

  // Headline vs the national average (falls back to absolute thresholds).
  const natViol = b?.nationalAvg?.violentPer100 ?? null;
  let head: { text: string; color: string; bg: string };
  const safe = natViol != null ? violPer100 <= natViol * 0.6 : violPer100 < 1;
  const high = natViol != null ? violPer100 > natViol * 1.2 : violPer100 >= 5;
  if (safe) head = { text: "Fewer incidents than average", color: "#047857", bg: "#ecfdf5" };
  else if (!high) head = { text: "About average for safety", color: "#b45309", bg: "#fffbeb" };
  else head = { text: "More incidents than average", color: "#be123c", bg: "#fff1f2" };

  const items: [string, number][] = [
    ["Physical attacks with a weapon", sf.physicalAttacksWithWeapon],
    ["Physical attacks without a weapon", sf.physicalAttacksNoWeapon],
    ["Threats of violence", sf.threatsOfViolence],
    ["Robberies", sf.robberies],
    ["Rape / sexual battery", sf.rapeOrSexualBattery],
    ["Firearm or explosive possession", sf.firearmExplosivePossession],
    ["Bullying / harassment allegations", sf.harassmentBullyingAllegations],
  ];
  const concerning = items.filter(([, v]) => v > 0);

  return (
    <div className="col-span-full">
      <div
        className="mb-3 rounded-lg px-3 py-2 text-sm font-bold"
        style={{ color: head.color, backgroundColor: head.bg }}
      >
        {head.text}
      </div>

      <MetricBar
        label="Violent incidents per 100 students"
        value={Number(violPer100.toFixed(1))}
        color={tone(violPer100, 1, 5, false)}
        state={b?.stateAvg?.violentPer100}
        nat={b?.nationalAvg?.violentPer100}
      />
      <MetricBar
        label="Suspensions per 100 students"
        value={Number(suspPer100.toFixed(1))}
        color={tone(suspPer100, 5, 20, false)}
        state={b?.stateAvg?.suspensionsPer100}
        nat={b?.nationalAvg?.suspensionsPer100}
      />
      <Fact
        label="Security staff on site"
        value={securityStatus(detail).value}
        color={securityStatus(detail).color}
      />

      <div className="mt-3">
        {concerning.length === 0 ? (
          <p className="text-sm font-semibold text-emerald-700">
            ✓ No incidents reported in any category for {sf.schoolYear}.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Incidents reported:</p>
            <dl className="grid grid-cols-1 gap-y-1.5">
              {concerning.map(([label, v]) => (
                <Fact key={label} label={label} value={v} color="#be123c" />
              ))}
            </dl>
          </>
        )}

        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-2.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          {showAll ? "Hide full breakdown" : "Show all categories (including 0s)"}
        </button>
        {showAll && (
          <dl className="mt-2 grid grid-cols-1 gap-y-1.5">
            {items.map(([label, v]) => (
              <Fact key={label} label={label} value={v} color={v > 0 ? "#be123c" : undefined} />
            ))}
            <Fact
              label="Any firearm incident on record"
              value={sf.firearmIncident ? "Yes" : "No"}
              color={sf.firearmIncident ? "#be123c" : undefined}
            />
          </dl>
        )}
      </div>

      <Note>
        Counts cover the full {sf.schoolYear} school year. &ldquo;Per 100 students&rdquo; lets you
        compare schools of different sizes — the tick marks show your state and US averages. Source:
        U.S. DOE Civil Rights Data Collection (CRDC).
      </Note>
    </div>
  );
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
