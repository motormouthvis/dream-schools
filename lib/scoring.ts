import type { School, SafetyRecord, GraduationRecord } from "@/lib/types";

/** A school paired with its (optional) safety + graduation records. */
export interface ScoredSchool {
  school: School;
  safety?: SafetyRecord;
  grad?: GraduationRecord;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Academic sub-score for one school (0-100), from ratio + grad rate. */
function academicScore(school: School, grad?: GraduationRecord): number {
  const ratioScore =
    school.studentTeacherRatio && school.studentTeacherRatio > 0
      ? clamp(95 - (school.studentTeacherRatio - 12) * 4, 45, 98)
      : 78;
  if (grad) {
    return clamp(0.5 * ratioScore + 0.5 * grad.gradRate4yr, 0, 100);
  }
  return ratioScore;
}

/**
 * Safety sub-score for one school (0-100), from real CRDC 2021-22 counts.
 * Violent offenses and weapons drive the score; out-of-school suspensions and
 * harassment/bullying are weighted lightly as climate signals.
 */
export function safetyScore(school: School, safety?: SafetyRecord): number {
  if (!safety) return 80;
  const per1000 = (n: number) => (n / Math.max(school.enrollment, 1)) * 1000;
  let score = 100;
  score -= per1000(safety.violentIncidentsTotal) * 4;
  score -= per1000(safety.physicalAttacksWithWeapon) * 10;
  score -= per1000(safety.firearmExplosivePossession) * 15;
  score -= per1000(safety.rapeOrSexualBattery) * 10;
  score -= per1000(safety.robberies) * 6;
  score -= per1000(safety.outOfSchoolSuspensions) * 0.08;
  score -= per1000(safety.harassmentBullyingAllegations) * 0.8;
  if (safety.firearmIncident) score -= 4;
  return clamp(Math.round(score), 45, 99);
}

/** Scale & stability sub-score for one school (0-100). */
function scaleScore(school: School): number {
  const e = school.enrollment;
  const sizeScore = e >= 600 && e <= 1800 ? 88 : e < 600 ? 80 : 78;
  const ratio = school.studentTeacherRatio ?? 16;
  const stability = clamp(90 - Math.abs(ratio - 16) * 2, 70, 92);
  return clamp(Math.round(0.5 * sizeScore + 0.5 * stability), 0, 100);
}

/** Quick overall 0-100 score for a single school (used in nearby list). */
export function quickSchoolScore(item: ScoredSchool): number {
  const a = academicScore(item.school, item.grad);
  const s = safetyScore(item.school, item.safety);
  const sc = scaleScore(item.school);
  return Math.round(0.45 * a + 0.35 * s + 0.2 * sc);
}

/** Full 0-100 score breakdown for a single school (used in the detail view). */
export function schoolScoreBreakdown(item: ScoredSchool): {
  overall: number;
  academic: number;
  safety: number;
  scale: number;
} {
  const academic = Math.round(academicScore(item.school, item.grad));
  const safety = safetyScore(item.school, item.safety);
  const scale = scaleScore(item.school);
  const overall = Math.round(0.45 * academic + 0.35 * safety + 0.2 * scale);
  return { overall, academic, safety, scale };
}

function weightedAvg(pairs: [value: number, weight: number][]): number {
  let num = 0;
  let den = 0;
  for (const [v, w] of pairs) {
    num += v * w;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

export interface AreaScores {
  overall: number;
  academic: {
    score: number;
    studentTeacherRatio: string;
    gradRate: number;
    gradYear: string;
    chronicAbsenteeism: number;
  };
  safety: { score: number };
  scale: { score: number; schoolCount: number; avgEnrollment: number };
}

/** Aggregate the three-category quality index across a set of schools. */
export function areaScores(items: ScoredSchool[]): AreaScores {
  const schools = items.map((i) => i.school);
  const withRatio = items.filter(
    (i) => i.school.studentTeacherRatio && i.school.studentTeacherRatio > 0
  );
  const ratioStudents = withRatio.reduce((s, x) => s + x.school.enrollment, 0);
  const ratioTeachers = withRatio.reduce(
    (s, x) => s + x.school.enrollment / (x.school.studentTeacherRatio as number),
    0
  );
  const aggRatio = ratioTeachers === 0 ? 0 : ratioStudents / ratioTeachers;

  const gradSchools = items.filter((i) => i.grad) as Required<ScoredSchool>[];
  const gradRate = Math.round(
    weightedAvg(gradSchools.map((x) => [x.grad.gradRate4yr, x.school.enrollment]))
  );
  const gradYear = gradSchools[0]?.grad.schoolYear ?? "2018-19";

  const absSchools = schools.filter((s) => s.chronicAbsentStudents != null);
  const absStudents = absSchools.reduce((s, x) => s + (x.chronicAbsentStudents as number), 0);
  const absEnroll = absSchools.reduce((s, x) => s + x.enrollment, 0);
  const chronicAbsenteeism =
    absEnroll === 0 ? 0 : Math.min(100, Math.round((absStudents / absEnroll) * 100));

  const academic = Math.round(
    weightedAvg(items.map((i) => [academicScore(i.school, i.grad), i.school.enrollment]))
  );
  const safety = Math.round(
    weightedAvg(items.map((i) => [safetyScore(i.school, i.safety), i.school.enrollment]))
  );
  const scale = Math.round(
    weightedAvg(items.map((i) => [scaleScore(i.school), i.school.enrollment]))
  );
  const overall = Math.round(0.45 * academic + 0.35 * safety + 0.2 * scale);
  const totalStudents = schools.reduce((s, x) => s + x.enrollment, 0);

  return {
    overall,
    academic: {
      score: academic,
      studentTeacherRatio: aggRatio > 0 ? `${Math.round(aggRatio)}:1` : "n/a",
      gradRate,
      gradYear,
      chronicAbsenteeism,
    },
    safety: { score: safety },
    scale: {
      score: scale,
      schoolCount: schools.length,
      avgEnrollment: Math.round(totalStudents / Math.max(schools.length, 1)),
    },
  };
}
