// Dream Rating: 1-10 ratings computed transparently from federal data.

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pct(part: number | null | undefined, whole: number): number | null {
  if (part == null || !whole || whole <= 0) return null;
  return Math.min(100, Math.round((part / whole) * 100));
}

/** Test-score rating (1-10) from % proficient in reading + math. */
export function testRating(read: number | null, math: number | null): number | null {
  const vals = [read, math].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  // % proficient -> 1-10 (≈ proficiency / 10), gently floored so 5% != 0.
  return clamp(Math.round(avg / 10) || 1, 1, 10);
}

/**
 * Academic quality on a 0-100 scale, from real student outcomes only (test
 * proficiency + — for high schools — graduation / AP-IB / SAT-ACT). Returns
 * null when a school has NO outcome data, so we never invent a quality score
 * from proxies like student-teacher ratio (which used to inflate tiny schools
 * and correctional/alternative programs). Safety is shown separately and does
 * not prop up the academic quality number.
 */
export function academicQuality(
  read: number | null,
  math: number | null,
  gradRate: number | null,
  apIbPct: number | null,
  satActPct: number | null,
  isHigh: boolean
): number | null {
  const testVals = [read, math].filter((v): v is number => v != null);
  const testC = testVals.length ? testVals.reduce((a, b) => a + b, 0) / testVals.length : null;

  // Graduation rate is the anchor of college readiness — AP/IB/SAT participation
  // only refine it. Without a graduation rate we don't fabricate a college score
  // (otherwise a school reporting "0% AP, 0% SAT" looks measured when it isn't).
  let collegeC: number | null = null;
  if (isHigh && gradRate != null) {
    const parts: [number, number][] = [[gradRate, 0.5]];
    if (apIbPct != null) parts.push([Math.min(100, apIbPct * 2), 0.25]);
    if (satActPct != null) parts.push([satActPct, 0.25]);
    const num = parts.reduce((a, [v, w]) => a + v * w, 0);
    const den = parts.reduce((a, [, w]) => a + w, 0);
    collegeC = num / den;
  }

  if (testC != null && collegeC != null) return Math.round(0.6 * testC + 0.4 * collegeC);
  if (testC != null) return Math.round(testC);
  if (collegeC != null) return Math.round(collegeC);
  return null;
}

/** Convert a 0-100 quality score to the 1-10 Dream Rating (1 = worst, null = unrated). */
export function to10(q: number | null): number | null {
  if (q == null) return null;
  return clamp(Math.round(q / 10) || 1, 1, 10);
}

export function isHighGrade(gradeHigh: string | null | undefined): boolean {
  const n = parseInt(gradeHigh ?? "", 10);
  return !Number.isNaN(n) && n >= 9;
}

/** College-readiness rating (1-10) for high schools. */
export function collegeReadinessRating(
  gradRate: number | null,
  apIbPct: number | null,
  satActPct: number | null
): number | null {
  const parts: [number, number][] = []; // [value 0-100, weight]
  if (gradRate != null) parts.push([gradRate, 0.5]);
  if (apIbPct != null) parts.push([Math.min(100, apIbPct * 2), 0.25]); // AP/IB participation scaled
  if (satActPct != null) parts.push([satActPct, 0.25]);
  if (parts.length === 0) return null;
  const num = parts.reduce((a, [v, w]) => a + v * w, 0);
  const den = parts.reduce((a, [, w]) => a + w, 0);
  return clamp(Math.round(num / den / 10) || 1, 1, 10);
}

export interface RatingInputs {
  enrollment: number;
  isHigh: boolean;
  testRead: number | null;
  testMath: number | null;
  testYear: string | null;
  gradRate: number | null;
  apEnrolled: number | null;
  ibEnrolled: number | null;
  giftedEnrolled: number | null;
  satActStudents: number | null;
  freeReducedLunch: number | null;
  ell: number | null;
  teachersCertified: number | null;
  teachersUncertified: number | null;
  counselors: number | null;
  security: number | null;
  // fallback when test data is missing
  safetyScore0to100: number;
  hasSafety: boolean;
}

export interface Coverage {
  available: number;
  total: number;
  hasTest: boolean;
  hasCollege: boolean;
  hasSafety: boolean;
  isHigh: boolean;
}

export interface ComputedRatings {
  summaryRating: number | null;
  testScores: { read: number | null; math: number | null; year: string | null; rating: number | null } | null;
  collegeReadiness: { gradRate: number | null; apIbPct: number | null; satActPct: number | null; rating: number | null } | null;
  advanced: { apPct: number | null; ibPct: number | null; giftedPct: number | null } | null;
  students: { lowIncomePct: number | null; ellPct: number | null };
  teachers: { certifiedPct: number | null; counselors: number | null; security: boolean; securityFte: number | null };
  coverage: Coverage;
}

export function computeRatings(i: RatingInputs): ComputedRatings {
  const tRating = testRating(i.testRead, i.testMath);
  const testScores =
    i.testRead != null || i.testMath != null
      ? { read: i.testRead, math: i.testMath, year: i.testYear, rating: tRating }
      : null;

  const apIbCount =
    i.apEnrolled != null || i.ibEnrolled != null
      ? (i.apEnrolled ?? 0) + (i.ibEnrolled ?? 0)
      : null;
  const apIbPct = pct(apIbCount, i.enrollment);
  const satActPct = pct(i.satActStudents, i.enrollment);
  const crRating = i.isHigh
    ? collegeReadinessRating(i.gradRate, apIbPct, satActPct)
    : null;
  const collegeReadiness = i.isHigh
    ? { gradRate: i.gradRate, apIbPct, satActPct, rating: crRating }
    : null;

  const advanced =
    i.apEnrolled != null || i.ibEnrolled != null || i.giftedEnrolled != null
      ? {
          apPct: pct(i.apEnrolled, i.enrollment),
          ibPct: pct(i.ibEnrolled, i.enrollment),
          giftedPct: pct(i.giftedEnrolled, i.enrollment),
        }
      : null;

  const certTotal =
    i.teachersCertified != null || i.teachersUncertified != null
      ? (i.teachersCertified ?? 0) + (i.teachersUncertified ?? 0)
      : null;
  const certifiedPct =
    certTotal && certTotal > 0 ? Math.round(((i.teachersCertified ?? 0) / certTotal) * 100) : null;

  // Summary 1-10 = the 1-10 form of academic quality (test + college outcomes).
  // Safety is shown separately and never inflates the headline rating.
  const summary = to10(academicQuality(i.testRead, i.testMath, i.gradRate, apIbPct, satActPct, i.isHigh));

  // Data-coverage: how many of the applicable outcome measures we actually have.
  // Non-high schools have 2 applicable measures (test scores, safety); high
  // schools add college readiness (3).
  const hasTest = tRating != null;
  const hasCollege = i.isHigh && crRating != null;
  const total = i.isHigh ? 3 : 2;
  const available =
    (hasTest ? 1 : 0) + (hasCollege ? 1 : 0) + (i.hasSafety ? 1 : 0);
  const coverage: Coverage = {
    available,
    total,
    hasTest,
    hasCollege,
    hasSafety: i.hasSafety,
    isHigh: i.isHigh,
  };

  return {
    summaryRating: summary,
    testScores,
    collegeReadiness,
    advanced,
    students: { lowIncomePct: pct(i.freeReducedLunch, i.enrollment), ellPct: pct(i.ell, i.enrollment) },
    teachers: {
      certifiedPct,
      counselors: i.counselors ?? null,
      security: (i.security ?? 0) > 0,
      securityFte: i.security ?? null,
    },
    coverage,
  };
}
