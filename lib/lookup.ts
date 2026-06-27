import { SCHOOLS, DISTRICT, safetyFor, graduationFor } from "@/lib/data";
import { haversineMiles, pointInPolygon } from "@/lib/geo";
import { geocode } from "@/lib/geocode";
import { buildResult } from "@/lib/buildResult";
import type { ScoredSchool } from "@/lib/scoring";
import type { GeocodeResult, LookupResult } from "@/lib/types";

const AREA_RADIUS_MILES = 10;
const NEARBY_COUNT = 12;

function toScored(ncesId: string): ScoredSchool {
  const school = SCHOOLS.find((s) => s.ncesId === ncesId)!;
  return { school, safety: safetyFor(ncesId), grad: graduationFor(ncesId) };
}

/** JSON-bundle lookup (10-zip demo). Used when DATABASE_URL is not set. */
export async function lookupAddress(
  address: string,
  presetGeo?: GeocodeResult
): Promise<LookupResult | null> {
  const geo = presetGeo ?? (await geocode(address));
  if (!geo) return null;

  const hasPoint = Number.isFinite(geo.lat) && Number.isFinite(geo.lon);
  const inDistrict = hasPoint
    ? pointInPolygon(geo.lon, geo.lat, DISTRICT.geometry.coordinates[0])
    : false;

  const districtSchools = SCHOOLS.filter((s) => s.districtId === DISTRICT.districtId);
  const studentCount = districtSchools.reduce((sum, s) => sum + s.enrollment, 0);

  const withDistance = SCHOOLS.map((s) => ({
    school: s,
    miles: hasPoint ? haversineMiles(geo.lat, geo.lon, s.lat, s.lon) : 0,
  })).sort((a, b) => a.miles - b.miles);

  let areaSchools = withDistance
    .filter((x) => !hasPoint || x.miles <= AREA_RADIUS_MILES)
    .map((x) => x.school);
  if (areaSchools.length < 4) areaSchools = districtSchools;

  const areaItems: ScoredSchool[] = areaSchools.map((s) => toScored(s.ncesId));
  const nearby = withDistance.slice(0, NEARBY_COUNT).map((x) => ({
    item: toScored(x.school.ncesId),
    miles: x.miles,
  }));

  return buildResult({
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
    areaItems,
    nearby,
  });
}
