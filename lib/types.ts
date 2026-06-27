export interface ZipCode {
  zip: string;
  city: string;
  lat: number;
  lon: number;
}

export interface DistrictGeo {
  districtId: string;
  name: string;
  shortName: string;
  state: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface School {
  ncesId: string;
  name: string;
  type: string;
  gradeLow: string;
  gradeHigh: string;
  zip: string;
  lat: number;
  lon: number;
  enrollment: number;
  studentTeacherRatio: number | null;
  chronicAbsentStudents: number | null;
  districtId: string;
}

// Real per-school safety, sourced from the U.S. Dept. of Education Civil Rights
// Data Collection (CRDC) 2021-22. Counts are CRDC offense/discipline items.
export interface SafetyRecord {
  ncesId: string;
  schoolYear: string;
  source: string;
  violentIncidentsTotal: number;
  physicalAttacksWithWeapon: number;
  physicalAttacksNoWeapon: number;
  threatsOfViolence: number;
  robberies: number;
  rapeOrSexualBattery: number;
  firearmExplosivePossession: number;
  firearmIncident: boolean;
  outOfSchoolSuspensions: number;
  harassmentBullyingAllegations: number;
}

export interface GraduationRecord {
  ncesId: string;
  schoolYear: string;
  source: string;
  gradRate4yr: number;
  cohortSize: number;
}

export interface GeocodeResult {
  matchedAddress: string;
  lat: number;
  lon: number;
  zip: string;
  source: "census" | "zip-centroid" | "autocomplete";
  approximate: boolean;
}

export interface NearbySchool {
  ncesId: string;
  name: string;
  type: string;
  grades: string;
  zip: string;
  miles: number;
  score: number;
  enrollment: number;
}

export interface CategoryScore {
  label: string;
  score: number;
  metrics: { label: string; value: string }[];
}

export interface SafetyDetail {
  ncesId: string;
  name: string;
  miles: number;
  record: SafetyRecord;
}

export interface DemographicSlice {
  label: string;
  count: number;
  pct: number;
}

export interface SchoolDetail {
  ncesId: string;
  name: string;
  type: string;
  level: string;
  grades: string;
  gradeLow: string;
  gradeHigh: string;
  zip: string;
  lat: number;
  lon: number;
  enrollment: number;
  studentTeacherRatio: number | null;
  chronicAbsentPct: number | null;
  contact: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
  };
  attributes: {
    charter: boolean | null;
    magnet: boolean | null;
    titleI: boolean | null;
    virtual: boolean | null;
    urbanicity: string | null;
    freeReducedLunchPct: number | null;
  };
  demographics: {
    byRace: DemographicSlice[];
    byGender: DemographicSlice[];
  } | null;
  district: { districtId: string; name: string };
  scores: { overall: number; academic: number; safety: number; scale: number };
  safety: SafetyRecord | null;
  graduation: GraduationRecord | null;
}

export interface LookupResult {
  query: string;
  geocode: GeocodeResult;
  district: {
    districtId: string;
    name: string;
    shortName: string;
    state: string;
    studentCount: number;
    schoolCount: number;
    inDistrict: boolean;
  };
  overallScore: number;
  scoreBasis: string;
  categories: {
    academic: CategoryScore;
    safety: CategoryScore & {
      schoolYear: string;
      primarySchoolName: string;
      headline: SafetyRecord;
    };
    scale: CategoryScore;
  };
  safetyDetails: SafetyDetail[];
  nearbySchools: NearbySchool[];
}
