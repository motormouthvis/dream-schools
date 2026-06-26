import type { School, SafetyRecord, GraduationRecord } from "@/lib/types";
import { safetyFor, graduationFor } from "@/lib/data";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Academic sub-score for one school (0-100), from ratio + grad rate. */
function academicScore(school: School, grad?: GraduationRecord): number {
  // Lower student:teacher ratio is better. 12:1 -> 95, 22:1 -> ~55.
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
export function quickSchoolScore(school: School): number {
  const grad = graduationFor(school.ncesId);
  const safety = safetyFor(school.ncesId);
  const a = academicScore(school, grad);
  const s = safetyScore(school, safety);
  const sc = scaleScore(school);
  return Math.round(0.45 * a + 0.35 * s + 0.2 * sc);
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
export function areaScores(schools: School[]): AreaScores {
  const withRatio = schools.filter(
    (s) => s.studentTeacherRatio && s.studentTeacherRatio > 0
  );
  const ratioStudents = withRatio.reduce((s, x) => s + x.enrollment, 0);
  const ratioTeachers = withRatio.reduce(
    (s, x) => s + x.enrollment / (x.studentTeacherRatio as number),
    0
  );
  const aggRatio = ratioTeachers === 0 ? 0 : ratioStudents / ratioTeachers;

  const gradSchools = schools
    .map((s) => ({ s, g: graduationFor(s.ncesId) }))
    .filter((x) => x.g) as { s: School; g: GraduationRecord }[];
  const gradRate = Math.round(
    weightedAvg(gradSchools.map((x) => [x.g.gradRate4yr, x.s.enrollment]))
  );
  const gradYear = gradSchools[0]?.g.schoolYear ?? "2018-19";

  const absSchools = schools.filter((s) => s.chronicAbsentStudents != null);
  const absStudents = absSchools.reduce(
    (s, x) => s + (x.chronicAbsentStudents as number),
    0
  );
  const absEnroll = absSchools.reduce((s, x) => s + x.enrollment, 0);
  const chronicAbsenteeism = absEnroll === 0 ? 0 : Math.round((absStudents / absEnroll) * 100);

  const academicComponent = weightedAvg(
    schools.map((s) => [academicScore(s, graduationFor(s.ncesId)), s.enrollment])
  );
  const safetyComponent = weightedAvg(
    schools.map((s) => [safetyScore(s, safetyFor(s.ncesId)), s.enrollment])
  );
  const scaleComponent = weightedAvg(
    schools.map((s) => [scaleScore(s), s.enrollment])
  );

  const academic = Math.round(academicComponent);
  const safety = Math.round(safetyComponent);
  const scale = Math.round(scaleComponent);
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
