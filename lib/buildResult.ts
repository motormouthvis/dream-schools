import { areaScores, listScore, type ScoredSchool } from "@/lib/scoring";
import type {
  AreaAverages,
  GeocodeResult,
  GeoJsonGeometry,
  LookupResult,
  NearbySchool,
  SafetyDetail,
  School,
} from "@/lib/types";

function grades(s: School): string {
  return s.gradeLow === s.gradeHigh ? s.gradeLow : `${s.gradeLow}-${s.gradeHigh}`;
}

export interface DistrictInfo {
  districtId: string;
  name: string;
  shortName: string;
  state: string;
  studentCount: number;
  schoolCount: number;
  allSchools?: number;
  allStudents?: number;
  publicSchools?: number;
  privateSchools?: number;
  inDistrict: boolean;
}

/**
 * Assemble the LookupResult shown by the Schools tab. Both the JSON-bundle path
 * and the Postgres path resolve the same inputs and call this builder, so the UI
 * is identical regardless of the data source.
 */
export function buildResult(params: {
  query: string;
  geocode: GeocodeResult;
  district: DistrictInfo;
  areaItems: ScoredSchool[]; // schools serving the area (for the 3-category index)
  nearby: { item: ScoredSchool; miles: number }[]; // closest schools, sorted asc
  districtBoundary?: GeoJsonGeometry | null;
  areaAverages?: Omit<AreaAverages, "overallRating"> | null;
}): LookupResult {
  const { query, geocode, district, areaItems, nearby } = params;
  const scores = areaScores(areaItems);

  const nearbySchools: NearbySchool[] = nearby.map(({ item, miles }) => ({
    ncesId: item.school.ncesId,
    name: item.school.name,
    type: item.school.type,
    level: item.school.level ?? "public",
    grades: grades(item.school),
    zip: item.school.zip,
    miles: Math.round(miles * 10) / 10,
    score: listScore(item),
    enrollment: item.school.enrollment,
    lat: item.school.lat,
    lon: item.school.lon,
  }));

  const safetyDetails: SafetyDetail[] = nearby
    .filter((n) => n.item.safety)
    .map(({ item, miles }) => ({
      ncesId: item.school.ncesId,
      name: item.school.name,
      miles: Math.round(miles * 10) / 10,
      record: item.safety!,
    }));

  // Headline safety comes from the nearest school that actually has CRDC data
  // (private schools have none), so the Safety card stays meaningful.
  const primary = nearby.find((n) => n.item.safety) ?? nearby[0];
  const headline = primary.item.safety ?? null;

  const safetyMetrics = headline
    ? [
        { label: "Violent incidents total", value: String(headline.violentIncidentsTotal) },
        { label: "Physical attacks w/ weapon", value: String(headline.physicalAttacksWithWeapon) },
        { label: "Firearm/explosive possession", value: String(headline.firearmExplosivePossession) },
        { label: "Out-of-school suspensions", value: String(headline.outOfSchoolSuspensions) },
      ]
    : [{ label: "Safety data", value: "Not reported nearby" }];

  return {
    query,
    geocode,
    district,
    overallScore: scores.overall,
    scoreBasis: "Based on NCES CCD 2023-24 + U.S. DOE CRDC 2021-22 safety data",
    categories: {
      academic: {
        label: "Academic & Staffing",
        score: scores.academic.score,
        metrics: [
          { label: "Student-teacher ratio", value: scores.academic.studentTeacherRatio },
          {
            label: `4-year graduation rate (${scores.academic.gradYear})`,
            value: scores.academic.gradRate > 0 ? `${scores.academic.gradRate}%` : "Not reported",
          },
          { label: "Chronic absenteeism", value: `${scores.academic.chronicAbsenteeism}%` },
        ],
      },
      safety: {
        label: "Safety & Climate",
        score: scores.safety.score,
        schoolYear: headline?.schoolYear ?? "2021-22",
        primarySchoolName: primary.item.school.name,
        headline,
        metrics: safetyMetrics,
      },
      scale: {
        label: "Scale & Stability",
        score: scores.scale.score,
        metrics: [
          { label: "Schools serving area", value: String(scores.scale.schoolCount) },
          { label: "Average enrollment", value: scores.scale.avgEnrollment.toLocaleString() },
          { label: "District enrollment", value: district.studentCount.toLocaleString() },
        ],
      },
    },
    safetyDetails,
    nearbySchools,
    center: { lat: geocode.lat, lon: geocode.lon },
    districtBoundary: params.districtBoundary ?? null,
    areaAverages: params.areaAverages
      ? { overallRating: Math.round(scores.overall / 10) || 1, ...params.areaAverages }
      : { overallRating: Math.round(scores.overall / 10) || 1, testRead: null, testMath: null,
          gradRate: scores.academic.gradRate || null, ratio: null, lowIncomePct: null,
          violentPer100: null, suspensionsPer100: null },
  };
}
