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
  studentTeacherRatio: number;
  districtId: string;
}

export interface SafetyRecord {
  ncesId: string;
  schoolYear: string;
  source: string;
  aggravatedAssaults: number;
  violentIncidentsTotal: number;
  threatsOfViolence: number;
  theftLarceny: number;
  vandalism: number;
  drugIncidents: number;
  weaponsPossession: number;
  policeCalls: number;
  securityCameras: boolean;
  controlledBuildingAccess: boolean;
  swornLawEnforcementOnSite: boolean;
  visitorSignIn: boolean;
}

export interface GraduationRecord {
  ncesId: string;
  schoolYear: string;
  source: string;
  gradRate4yr: number;
  collegeGoingRate: number;
}

export interface GeocodeResult {
  matchedAddress: string;
  lat: number;
  lon: number;
  zip: string;
  source: "census" | "zip-centroid";
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
