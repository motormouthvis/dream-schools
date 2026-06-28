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
  teachers: { certifiedPct: number | null; counselors: number | null; security: boolean };
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

  // Summary 1-10: test scores lead; college readiness (HS) or safety fills in.
  let summary: number | null = null;
  const safety10 = clamp(Math.round(i.safetyScore0to100 / 10), 1, 10);
  if (tRating != null && crRating != null) summary = Math.round(0.6 * tRating + 0.4 * crRating);
  else if (tRating != null) summary = Math.round(0.7 * tRating + 0.3 * safety10);
  else if (crRating != null) summary = Math.round(0.6 * crRating + 0.4 * safety10);
  if (summary != null) summary = clamp(summary, 1, 10);

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
    teachers: { certifiedPct, counselors: i.counselors ?? null, security: (i.security ?? 0) > 0 },
    coverage,
  };
}
