import { hasDatabase, getPool } from "@/lib/db";
import { SCHOOLS, DISTRICT, safetyFor, graduationFor } from "@/lib/data";
import { schoolScoreBreakdown, type ScoredSchool } from "@/lib/scoring";
import type {
  GraduationRecord,
  SafetyRecord,
  School,
  SchoolDetail,
} from "@/lib/types";

function grades(low: string, high: string): string {
  return low === high ? low : `${low}-${high}`;
}

function toDetail(
  item: ScoredSchool,
  districtName: string
): SchoolDetail {
  const s = item.school;
  const chronicPct =
    s.chronicAbsentStudents != null && s.enrollment > 0
      ? Math.min(100, Math.round((s.chronicAbsentStudents / s.enrollment) * 100))
      : null;
  return {
    ncesId: s.ncesId,
    name: s.name,
    type: s.type,
    grades: grades(s.gradeLow, s.gradeHigh),
    gradeLow: s.gradeLow,
    gradeHigh: s.gradeHigh,
    zip: s.zip,
    lat: s.lat,
    lon: s.lon,
    enrollment: s.enrollment,
    studentTeacherRatio: s.studentTeacherRatio,
    chronicAbsentPct: chronicPct,
    district: { districtId: s.districtId, name: districtName },
    scores: schoolScoreBreakdown(item),
    safety: item.safety ?? null,
    graduation: item.grad ?? null,
  };
}

async function getFromDb(ncesId: string): Promise<SchoolDetail | null> {
  const pool = getPool();
  const res = await pool.query(
    `select
        s.nces_id, s.name, s.type, s.grade_low, s.grade_high, s.zip, s.district_id,
        s.enrollment, s.student_teacher_ratio, s.chronic_absent_students,
        ST_Y(s.geom) as lat, ST_X(s.geom) as lon,
        coalesce(d.name, s.district_id) as district_name,
        sf.nces_id as s_nces_id, sf.school_year as s_school_year, sf.source as s_source,
        sf.violent_incidents_total, sf.physical_attacks_with_weapon, sf.physical_attacks_no_weapon,
        sf.threats_of_violence, sf.robberies, sf.rape_or_sexual_battery,
        sf.firearm_explosive_possession, sf.firearm_incident, sf.out_of_school_suspensions,
        sf.harassment_bullying_allegations,
        g.nces_id as g_nces_id, g.school_year as g_school_year, g.source as g_source,
        g.grad_rate_4yr, g.cohort_size
      from schools s
      left join school_districts d on d.district_id = s.district_id
      left join school_safety sf on sf.nces_id = s.nces_id
      left join school_graduation g on g.nces_id = s.nces_id
      where s.nces_id = $1
      limit 1`,
    [ncesId]
  );
  const r = res.rows[0];
  if (!r) return null;

  const school: School = {
    ncesId: r.nces_id,
    name: r.name,
    type: r.type,
    gradeLow: r.grade_low,
    gradeHigh: r.grade_high,
    zip: r.zip ?? "",
    lat: r.lat,
    lon: r.lon,
    enrollment: r.enrollment,
    studentTeacherRatio: r.student_teacher_ratio != null ? Number(r.student_teacher_ratio) : null,
    chronicAbsentStudents: r.chronic_absent_students,
    districtId: r.district_id,
  };
  const safety: SafetyRecord | undefined = r.s_nces_id
    ? {
        ncesId: r.s_nces_id,
        schoolYear: r.s_school_year,
        source: r.s_source,
        violentIncidentsTotal: r.violent_incidents_total,
        physicalAttacksWithWeapon: r.physical_attacks_with_weapon,
        physicalAttacksNoWeapon: r.physical_attacks_no_weapon,
        threatsOfViolence: r.threats_of_violence,
        robberies: r.robberies,
        rapeOrSexualBattery: r.rape_or_sexual_battery,
        firearmExplosivePossession: r.firearm_explosive_possession,
        firearmIncident: r.firearm_incident,
        outOfSchoolSuspensions: r.out_of_school_suspensions,
        harassmentBullyingAllegations: r.harassment_bullying_allegations,
      }
    : undefined;
  const grad: GraduationRecord | undefined = r.g_nces_id
    ? {
        ncesId: r.g_nces_id,
        schoolYear: r.g_school_year,
        source: r.g_source,
        gradRate4yr: Number(r.grad_rate_4yr),
        cohortSize: r.cohort_size,
      }
    : undefined;

  return toDetail({ school, safety, grad }, r.district_name);
}

function getFromJson(ncesId: string): SchoolDetail | null {
  const school = SCHOOLS.find((s) => s.ncesId === ncesId);
  if (!school) return null;
  return toDetail(
    { school, safety: safetyFor(ncesId), grad: graduationFor(ncesId) },
    DISTRICT.name
  );
}

export async function getSchoolDetail(ncesId: string): Promise<SchoolDetail | null> {
  return hasDatabase() ? getFromDb(ncesId) : getFromJson(ncesId);
}
