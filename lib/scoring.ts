import type { School, SafetyRecord, GraduationRecord } from "@/lib/types";
import { safetyFor, graduationFor } from "@/lib/data";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Academic sub-score for one school (0-100), from ratio + grad rate. */
function academicScore(school: School, grad?: GraduationRecord): number {
  // Lower student:teacher ratio is better. 12:1 -> 95, 22:1 -> ~55.
  const ratioScore = clamp(95 - (school.studentTeacherRatio - 12) * 4, 50, 98);
  if (grad) {
    return clamp(0.45 * ratioScore + 0.4 * grad.gradRate4yr + 0.15 * grad.collegeGoingRate, 0, 100);
  }
  return ratioScore;
}

/** Safety sub-score for one school (0-100), from SSOCS-style counts. */
export function safetyScore(school: School, safety?: SafetyRecord): number {
  if (!safety) return 75;
  const per1000 = (n: number) => (n / Math.max(school.enrollment, 1)) * 1000;
  let score = 100;
  score -= per1000(safety.violentIncidentsTotal) * 3.5;
  score -= per1000(safety.aggravatedAssaults) * 6;
  score -= per1000(safety.weaponsPossession) * 5;
  score -= per1000(safety.drugIncidents) * 1.5;
  if (safety.securityCameras) score += 3;
  if (safety.controlledBuildingAccess) score += 3;
  if (safety.swornLawEnforcementOnSite) score += 2;
  return clamp(Math.round(score), 55, 98);
}

/** Scale & stability sub-score for one school (0-100). */
function scaleScore(school: School): number {
  // Mid-size schools score best; very small / very large slightly lower.
  const e = school.enrollment;
  const sizeScore = e >= 600 && e <= 1600 ? 88 : e < 600 ? 80 : 78;
  // Stability proxy: schools closer to the district's typical ratio look steadier.
  const stability = clamp(90 - Math.abs(school.studentTeacherRatio - 16) * 2, 70, 92);
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
    collegeRate: number;
  };
  safety: { score: number };
  scale: { score: number; schoolCount: number; avgEnrollment: number };
}

/** Aggregate the three-category quality index across a set of schools. */
export function areaScores(schools: School[]): AreaScores {
  const totalStudents = schools.reduce((s, x) => s + x.enrollment, 0);
  const totalTeachers = schools.reduce(
    (s, x) => s + x.enrollment / x.studentTeacherRatio,
    0
  );
  const aggRatio = totalTeachers === 0 ? 0 : totalStudents / totalTeachers;

  const gradSchools = schools
    .map((s) => ({ s, g: graduationFor(s.ncesId) }))
    .filter((x) => x.g) as { s: School; g: GraduationRecord }[];
  const gradRate = Math.round(
    weightedAvg(gradSchools.map((x) => [x.g.gradRate4yr, x.s.enrollment]))
  );
  const collegeRate = Math.round(
    weightedAvg(gradSchools.map((x) => [x.g.collegeGoingRate, x.s.enrollment]))
  );

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

  return {
    overall,
    academic: {
      score: academic,
      studentTeacherRatio: `${Math.round(aggRatio)}:1`,
      gradRate,
      collegeRate,
    },
    safety: { score: safety },
    scale: {
      score: scale,
      schoolCount: schools.length,
      avgEnrollment: Math.round(totalStudents / Math.max(schools.length, 1)),
    },
  };
}
