import { getPool } from "@/lib/db";
import { geocode } from "@/lib/geocode";
import { buildResult, type DistrictInfo } from "@/lib/buildResult";
import type { ScoredSchool } from "@/lib/scoring";
import type {
  GeocodeResult,
  GraduationRecord,
  LookupResult,
  SafetyRecord,
  School,
} from "@/lib/types";

const AREA_RADIUS_MILES = 10;
const NEARBY_COUNT = 12;
const METERS_PER_MILE = 1609.34;

function rowToScored(r: any): { item: ScoredSchool; miles: number } {
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
  return { item: { school, safety, grad }, miles: Number(r.miles) };
}

const SELECT = `
  s.nces_id, s.name, s.type, s.grade_low, s.grade_high, s.zip, s.district_id,
  s.enrollment, s.student_teacher_ratio, s.chronic_absent_students,
  ST_Y(s.geom) as lat, ST_X(s.geom) as lon,
  ST_Distance(s.geom::geography, $1::geography) / ${METERS_PER_MILE} as miles,
  sf.nces_id as s_nces_id, sf.school_year as s_school_year, sf.source as s_source,
  sf.violent_incidents_total, sf.physical_attacks_with_weapon, sf.physical_attacks_no_weapon,
  sf.threats_of_violence, sf.robberies, sf.rape_or_sexual_battery,
  sf.firearm_explosive_possession, sf.firearm_incident, sf.out_of_school_suspensions,
  sf.harassment_bullying_allegations,
  g.nces_id as g_nces_id, g.school_year as g_school_year, g.source as g_source,
  g.grad_rate_4yr, g.cohort_size
  from schools s
  left join school_safety sf on sf.nces_id = s.nces_id
  left join school_graduation g on g.nces_id = s.nces_id
`;

/** Nationwide lookup served from Postgres + PostGIS. */
export async function lookupAddressDb(
  address: string,
  presetGeo?: GeocodeResult
): Promise<LookupResult | null> {
  const geo = presetGeo ?? (await geocode(address));
  if (!geo) return null;
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return null;

  const pool = getPool();
  const point = `SRID=4326;POINT(${geo.lon} ${geo.lat})`;

  // 1) District via point-in-polygon; fall back to the nearest school's district.
  const districtRes = await pool.query(
    `select district_id, name, short_name, state, enrollment, school_count
       from school_districts
      where geom is not null and ST_Contains(geom, ST_SetSRID(ST_Point($1,$2),4326))
      limit 1`,
    [geo.lon, geo.lat]
  );
  let district = districtRes.rows[0];
  let inDistrict = Boolean(district);
  if (!district) {
    const nearestDistrict = await pool.query(
      `select d.district_id, d.name, d.short_name, d.state, d.enrollment, d.school_count
         from schools s join school_districts d on d.district_id = s.district_id
        order by s.geom <-> ST_SetSRID(ST_Point($1,$2),4326)
        limit 1`,
      [geo.lon, geo.lat]
    );
    district = nearestDistrict.rows[0];
    inDistrict = false;
  }
  if (!district) return null;

  // 2) Nearby schools (closest N) using the KNN operator.
  const nearbyRes = await pool.query(
    `select ${SELECT}
      order by s.geom <-> $1
      limit ${NEARBY_COUNT}`,
    [point]
  );

  // 3) Area schools for the 3-category index: within ~10 miles (cap for perf),
  //    falling back to the district's schools if too few.
  let areaRes = await pool.query(
    `select ${SELECT}
      where s.level <> 'private'
        and ST_DWithin(s.geom::geography, $1::geography, ${AREA_RADIUS_MILES * METERS_PER_MILE})
      order by s.geom <-> $1
      limit 60`,
    [point]
  );
  if (areaRes.rows.length < 4) {
    areaRes = await pool.query(
      `select ${SELECT} where s.district_id = $2 and s.level <> 'private' order by s.geom <-> $1 limit 60`,
      [point, district.district_id]
    );
  }

  const nearby = nearbyRes.rows.map(rowToScored);
  const areaItems = areaRes.rows.map((r) => rowToScored(r).item);
  if (nearby.length === 0) return null;

  const info: DistrictInfo = {
    districtId: district.district_id,
    name: district.name,
    shortName: district.short_name ?? district.name,
    state: district.state ?? geo.zip,
    studentCount: district.enrollment ?? 0,
    schoolCount: district.school_count ?? 0,
    inDistrict,
  };

  return buildResult({ query: address, geocode: geo, district: info, areaItems, nearby });
}
