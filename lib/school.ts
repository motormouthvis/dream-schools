import { hasDatabase, getPool } from "@/lib/db";
import { SCHOOLS, DISTRICT, safetyFor, graduationFor } from "@/lib/data";
import { safetyScore, schoolScoreBreakdown, type ScoredSchool } from "@/lib/scoring";
import { computeRatings } from "@/lib/ratings";
import type {
  DemographicSlice,
  GraduationRecord,
  SafetyRecord,
  School,
  SchoolDetail,
} from "@/lib/types";

interface Extra {
  level?: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  charter?: boolean | null;
  magnet?: boolean | null;
  titleI?: boolean | null;
  virtual?: boolean | null;
  urbanicity?: string | null;
  freeReducedLunch?: number | null;
  race?: { white: number; black: number; hispanic: number; asian: number; amerind: number; pacific: number; twomore: number } | null;
  sex?: { male: number; female: number } | null;
  testRead?: number | null;
  testMath?: number | null;
  testYear?: string | null;
  apEnrolled?: number | null;
  ibEnrolled?: number | null;
  giftedEnrolled?: number | null;
  satActStudents?: number | null;
  ell?: number | null;
  teachersCertified?: number | null;
  teachersUncertified?: number | null;
  counselors?: number | null;
  security?: number | null;
}

function grades(low: string, high: string): string {
  return low === high ? low : `${low}-${high}`;
}

function slices(
  pairs: [label: string, count: number | null | undefined][],
  total: number
): DemographicSlice[] {
  return pairs
    .map(([label, count]) => ({
      label,
      count: count ?? 0,
      pct: total > 0 ? Math.round(((count ?? 0) / total) * 100) : 0,
    }))
    .filter((s) => s.count > 0);
}

function toDetail(item: ScoredSchool, districtName: string, extra: Extra = {}): SchoolDetail {
  const s = item.school;
  // Chronic absenteeism: CRDC counts vs CCD enrollment can mismatch for
  // alternative/charter schools, yielding implausible >100% values. Suppress
  // those rather than show a misleading 100%.
  const chronicPct =
    s.chronicAbsentStudents != null &&
    s.enrollment > 0 &&
    s.chronicAbsentStudents <= s.enrollment
      ? Math.round((s.chronicAbsentStudents / s.enrollment) * 100)
      : null;

  let demographics: SchoolDetail["demographics"] = null;
  if (extra.race || extra.sex) {
    const r = extra.race;
    const x = extra.sex;
    demographics = {
      byRace: r
        ? slices(
            [
              ["White", r.white],
              ["Black", r.black],
              ["Hispanic", r.hispanic],
              ["Asian", r.asian],
              ["Am. Indian / AK Native", r.amerind],
              ["Native HI / Pacific", r.pacific],
              ["Two or more races", r.twomore],
            ],
            s.enrollment
          )
        : [],
      byGender: x
        ? slices([["Male", x.male], ["Female", x.female]], s.enrollment)
        : [],
    };
  }

  const isHigh = /(^|\b)(9|10|11|12)$/.test(s.gradeHigh) || s.gradeHigh === "12";
  const ratings = computeRatings({
    enrollment: s.enrollment,
    isHigh,
    testRead: extra.testRead ?? null,
    testMath: extra.testMath ?? null,
    testYear: extra.testYear ?? null,
    gradRate: item.grad?.gradRate4yr ?? null,
    apEnrolled: extra.apEnrolled ?? null,
    ibEnrolled: extra.ibEnrolled ?? null,
    giftedEnrolled: extra.giftedEnrolled ?? null,
    satActStudents: extra.satActStudents ?? null,
    freeReducedLunch: extra.freeReducedLunch ?? null,
    ell: extra.ell ?? null,
    teachersCertified: extra.teachersCertified ?? null,
    teachersUncertified: extra.teachersUncertified ?? null,
    counselors: extra.counselors ?? null,
    security: extra.security ?? null,
    safetyScore0to100: safetyScore(s, item.safety),
  });

  return {
    ncesId: s.ncesId,
    name: s.name,
    type: s.type,
    level: extra.level ?? "public",
    grades: grades(s.gradeLow, s.gradeHigh),
    gradeLow: s.gradeLow,
    gradeHigh: s.gradeHigh,
    zip: s.zip,
    lat: s.lat,
    lon: s.lon,
    enrollment: s.enrollment,
    studentTeacherRatio: s.studentTeacherRatio,
    chronicAbsentPct: chronicPct,
    contact: {
      street: extra.street ?? null,
      city: extra.city ?? null,
      state: extra.state ?? null,
      zip: s.zip || null,
      phone: extra.phone ?? null,
    },
    attributes: {
      charter: extra.charter ?? null,
      magnet: extra.magnet ?? null,
      titleI: extra.titleI ?? null,
      virtual: extra.virtual ?? null,
      urbanicity: extra.urbanicity ?? null,
      freeReducedLunchPct: ratings.students.lowIncomePct,
    },
    demographics,
    district: { districtId: s.districtId, name: districtName },
    scores: schoolScoreBreakdown(item),
    summaryRating: ratings.summaryRating,
    testScores: ratings.testScores,
    collegeReadiness: ratings.collegeReadiness,
    advanced: ratings.advanced,
    students: ratings.students,
    teachers: {
      ratio: s.studentTeacherRatio ?? null,
      certifiedPct: ratings.teachers.certifiedPct,
      counselors: ratings.teachers.counselors,
      security: ratings.teachers.security,
    },
    safety: item.safety ?? null,
    graduation: item.grad ?? null,
  };
}

async function getFromDb(ncesId: string): Promise<SchoolDetail | null> {
  const pool = getPool();
  const res = await pool.query(
    `select
        s.nces_id, s.name, s.type, s.level, s.grade_low, s.grade_high, s.zip, s.district_id,
        s.enrollment, s.student_teacher_ratio, s.chronic_absent_students,
        s.street, s.city, s.state, s.phone, s.charter, s.magnet, s.title_i, s.virtual,
        s.free_reduced_lunch, s.urbanicity,
        s.enr_white, s.enr_black, s.enr_hispanic, s.enr_asian, s.enr_amerind,
        s.enr_pacific, s.enr_twomore, s.enr_male, s.enr_female,
        s.test_read_prof, s.test_math_prof, s.test_year,
        s.ap_enrolled, s.ib_enrolled, s.gifted_enrolled, s.sat_act_students, s.ell_students,
        s.teachers_certified, s.teachers_uncertified, s.counselors_fte, s.security_fte,
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

  const extra: Extra = {
    level: r.level ?? "public",
    street: r.street ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    phone: r.phone ?? null,
    charter: r.charter,
    magnet: r.magnet,
    titleI: r.title_i,
    virtual: r.virtual,
    urbanicity: r.urbanicity ?? null,
    freeReducedLunch: r.free_reduced_lunch,
    race: {
      white: r.enr_white ?? 0,
      black: r.enr_black ?? 0,
      hispanic: r.enr_hispanic ?? 0,
      asian: r.enr_asian ?? 0,
      amerind: r.enr_amerind ?? 0,
      pacific: r.enr_pacific ?? 0,
      twomore: r.enr_twomore ?? 0,
    },
    sex: { male: r.enr_male ?? 0, female: r.enr_female ?? 0 },
    testRead: r.test_read_prof,
    testMath: r.test_math_prof,
    testYear: r.test_year,
    apEnrolled: r.ap_enrolled,
    ibEnrolled: r.ib_enrolled,
    giftedEnrolled: r.gifted_enrolled,
    satActStudents: r.sat_act_students,
    ell: r.ell_students,
    teachersCertified: r.teachers_certified != null ? Number(r.teachers_certified) : null,
    teachersUncertified: r.teachers_uncertified != null ? Number(r.teachers_uncertified) : null,
    counselors: r.counselors_fte != null ? Number(r.counselors_fte) : null,
    security: r.security_fte != null ? Number(r.security_fte) : null,
  };
  const districtName =
    r.district_name || (r.level === "private" ? "Private school" : r.district_id);
  return toDetail({ school, safety, grad }, districtName, extra);
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
