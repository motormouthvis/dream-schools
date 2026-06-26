import { SCHOOLS, DISTRICT, safetyFor } from "@/lib/data";
import { haversineMiles, pointInPolygon } from "@/lib/geo";
import { areaScores, quickSchoolScore } from "@/lib/scoring";
import { geocode } from "@/lib/geocode";
import type {
  LookupResult,
  School,
  NearbySchool,
  SafetyDetail,
} from "@/lib/types";

const AREA_RADIUS_MILES = 10;
const NEARBY_COUNT = 8;

function grades(s: School): string {
  return s.gradeLow === s.gradeHigh ? s.gradeLow : `${s.gradeLow}-${s.gradeHigh}`;
}

export async function lookupAddress(address: string): Promise<LookupResult | null> {
  const geo = await geocode(address);
  if (!geo) return null;

  const hasPoint = Number.isFinite(geo.lat) && Number.isFinite(geo.lon);

  const inDistrict = hasPoint
    ? pointInPolygon(geo.lon, geo.lat, DISTRICT.geometry.coordinates[0])
    : false;

  // District-level totals for the header.
  const districtSchools = SCHOOLS.filter((s) => s.districtId === DISTRICT.districtId);
  const studentCount = districtSchools.reduce((sum, s) => sum + s.enrollment, 0);

  // Distance-annotated schools (nearest first).
  const withDistance = SCHOOLS.map((s) => ({
    school: s,
    miles: hasPoint ? haversineMiles(geo.lat, geo.lon, s.lat, s.lon) : 0,
  })).sort((a, b) => a.miles - b.miles);

  // Schools serving the area (used for the 3-category index).
  let areaSet = withDistance
    .filter((x) => !hasPoint || x.miles <= AREA_RADIUS_MILES)
    .map((x) => x.school);
  if (areaSet.length < 4) areaSet = districtSchools;

  const scores = areaScores(areaSet);

  const nearbySchools: NearbySchool[] = withDistance
    .slice(0, NEARBY_COUNT)
    .map(({ school, miles }) => ({
      ncesId: school.ncesId,
      name: school.name,
      type: school.type,
      grades: grades(school),
      zip: school.zip,
      miles: Math.round(miles * 10) / 10,
      score: quickSchoolScore(school),
      enrollment: school.enrollment,
    }));

  const primary = withDistance[0];
  const headline = safetyFor(primary.school.ncesId)!;

  const safetyDetails: SafetyDetail[] = withDistance
    .slice(0, NEARBY_COUNT)
    .map(({ school, miles }) => ({
      ncesId: school.ncesId,
      name: school.name,
      miles: Math.round(miles * 10) / 10,
      record: safetyFor(school.ncesId)!,
    }));

  return {
    query: address,
    geocode: geo,
    district: {
      districtId: DISTRICT.districtId,
      name: DISTRICT.name,
      shortName: DISTRICT.shortName,
      state: DISTRICT.state,
      studentCount,
      schoolCount: districtSchools.length,
      inDistrict,
    },
    overallScore: scores.overall,
    scoreBasis: "Based on NCES 2023-24 + 2021-22 safety data",
    categories: {
      academic: {
        label: "Academic & Staffing",
        score: scores.academic.score,
        metrics: [
          { label: "Student-teacher ratio", value: scores.academic.studentTeacherRatio },
          { label: "4-year graduation rate", value: `${scores.academic.gradRate}%` },
          { label: "College-going rate", value: `${scores.academic.collegeRate}%` },
        ],
      },
      safety: {
        label: "Safety & Climate",
        score: scores.safety.score,
        schoolYear: headline.schoolYear,
        primarySchoolName: primary.school.name,
        headline,
        metrics: [
          { label: "Aggravated assaults", value: String(headline.aggravatedAssaults) },
          { label: "Violent incidents total", value: String(headline.violentIncidentsTotal) },
          { label: "Security cameras", value: headline.securityCameras ? "Yes" : "No" },
          {
            label: "Controlled access",
            value: headline.controlledBuildingAccess ? "Yes" : "No",
          },
        ],
      },
      scale: {
        label: "Scale & Stability",
        score: scores.scale.score,
        metrics: [
          { label: "Schools serving area", value: String(scores.scale.schoolCount) },
          { label: "Average enrollment", value: scores.scale.avgEnrollment.toLocaleString() },
          { label: "District enrollment", value: studentCount.toLocaleString() },
        ],
      },
    },
    safetyDetails,
    nearbySchools,
  };
}
