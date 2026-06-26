import zipcodes from "@/data/zipcodes.json";
import district from "@/data/district.json";
import schools from "@/data/schools.json";
import safety from "@/data/safety.json";
import graduation from "@/data/graduation.json";
import type {
  ZipCode,
  DistrictGeo,
  School,
  SafetyRecord,
  GraduationRecord,
} from "@/lib/types";

export const ZIPCODES = zipcodes as ZipCode[];
export const DISTRICT = district as DistrictGeo;
export const SCHOOLS = schools as School[];
export const SAFETY = safety as SafetyRecord[];
export const GRADUATION = graduation as GraduationRecord[];

export const TARGET_ZIPS = ZIPCODES.map((z) => z.zip);

const safetyById = new Map(SAFETY.map((s) => [s.ncesId, s]));
const gradById = new Map(GRADUATION.map((g) => [g.ncesId, g]));
const zipByCode = new Map(ZIPCODES.map((z) => [z.zip, z]));

export function safetyFor(ncesId: string): SafetyRecord | undefined {
  return safetyById.get(ncesId);
}

export function graduationFor(ncesId: string): GraduationRecord | undefined {
  return gradById.get(ncesId);
}

export function zipInfo(zip: string): ZipCode | undefined {
  return zipByCode.get(zip);
}
