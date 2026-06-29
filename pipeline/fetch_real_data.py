#!/usr/bin/env python3
"""
Dream Neighborhood — REAL data pipeline (Schools tab demo).

Pulls real, per-school, identifiable data for The School District of St. Lucie
County (NCES LEAID 1201770) — the district that serves all 10 target zip codes
around 34946 (Fort Pierce / Port St. Lucie, FL) — and writes the JSON bundle the
app reads from `data/`.

All data comes from the Urban Institute Education Data Portal
(https://educationdata.urban.org), a free, no-key API that mirrors the official
federal collections:

  * Roster / staffing  : NCES CCD directory, 2023-24  (real NCES ids, lat/lon,
                         enrollment, teacher FTE, grade span, zip)
  * Safety             : U.S. Dept. of Education CRDC, 2021-22 (offenses,
                         out-of-school suspensions, harassment/bullying
                         allegations, chronic absenteeism) — joined on NCES id
  * Graduation         : EDFacts adjusted-cohort grad rate (latest available
                         year that the API serves: 2018-19)

NOTE ON THE EARLIER "SAMPLE" CAVEAT
-----------------------------------
The SSOCS public-use file is a de-identified national *sample* and cannot be
joined to a specific school, so it is NOT used here. CRDC, by contrast, is a
universe collection reported per school and joinable by NCES id, so the safety
numbers below are real for each named school. Facility-security indicators
(security cameras, controlled building access) are an SSOCS-only concept and are
therefore not available per-school in public federal data; we report verified
CRDC incident counts instead.

Run:
    python3 pipeline/fetch_real_data.py      # writes data/*.json (needs network)

The app then runs fully offline off the committed JSON.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))

API = "https://educationdata.urban.org/api/v1"
LEAID = "1201770"  # The School District of St. Lucie County, FL

CCD_YEAR = 2023          # 2023-24 school year
CRDC_YEAR = 2021         # 2021-22 school year
GRAD_YEAR = 2019         # 2018-19 (latest the API serves)

TARGET_ZIPS = {
    "34946", "34947", "34950", "34951", "34981",
    "34982", "34983", "34984", "34986", "34987",
}

# Approximate centroids of the 10 target zips (used for the "within ~10 miles"
# inclusion rule and for the app's offline geocoder fallback).
ZIPCODES = [
    {"zip": "34946", "city": "Fort Pierce", "lat": 27.4790, "lon": -80.3660},
    {"zip": "34947", "city": "Fort Pierce", "lat": 27.4440, "lon": -80.3880},
    {"zip": "34950", "city": "Fort Pierce", "lat": 27.4460, "lon": -80.3270},
    {"zip": "34951", "city": "Fort Pierce", "lat": 27.5530, "lon": -80.3940},
    {"zip": "34981", "city": "Fort Pierce", "lat": 27.4040, "lon": -80.3550},
    {"zip": "34982", "city": "Fort Pierce", "lat": 27.3980, "lon": -80.3180},
    {"zip": "34983", "city": "Port St. Lucie", "lat": 27.3170, "lon": -80.3660},
    {"zip": "34984", "city": "Port St. Lucie", "lat": 27.2550, "lon": -80.3530},
    {"zip": "34986", "city": "Port St. Lucie", "lat": 27.3140, "lon": -80.4050},
    {"zip": "34987", "city": "Port St. Lucie", "lat": 27.2820, "lon": -80.4700},
]

# Simplified district boundary polygon (covers St. Lucie County). The real EDGE
# composite shapefile can be substituted here; a generalized polygon is enough
# for the demo's point-in-polygon "which district?" lookup. GeoJSON [lon, lat].
DISTRICT_BOUNDARY = [
    [-80.2750, 27.5850],
    [-80.2850, 27.4000],
    [-80.3050, 27.1800],
    [-80.7050, 27.1820],
    [-80.7050, 27.5870],
    [-80.4000, 27.5860],
    [-80.2750, 27.5850],
]

INCLUDE_RADIUS_MILES = 10.0


def haversine(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, atan2, sqrt
    r = 3958.7613
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))


def fetch_all(path, params=None):
    """GET an Urban API endpoint, following pagination, returning all results."""
    url = f"{API}{path}"
    q = dict(params or {})
    out = []
    page = 0
    while url:
        full = url + ("?" + urllib.parse.urlencode(q) if q else "")
        for attempt in range(4):
            try:
                req = urllib.request.Request(full, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = json.loads(resp.read().decode())
                break
            except Exception as exc:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        out.extend(data.get("results", []))
        url = data.get("next")
        q = None  # 'next' already contains the query string
        page += 1
        if page > 200:
            break
    return out


def num(v):
    """Coerce a CRDC value to a non-negative int; negatives are suppression
    / 'not applicable' reserve codes and are treated as missing (0)."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    if f < 0:
        return 0
    return int(round(f))


def is_total_row(row, fields):
    return all(row.get(f) == 99 for f in fields if f in row)


GRADE_MAP = {
    -1: "PK", 0: "K", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6",
    7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12", 13: "12",
}


def grade_label(v):
    try:
        return GRADE_MAP.get(int(v), str(v))
    except (TypeError, ValueError):
        return str(v)


def grade_num(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def classify_type(low_v, high_v):
    lo, hi = grade_num(low_v), grade_num(high_v)
    if lo is None or hi is None:
        return "Combined"
    if hi <= 5:
        return "Elementary"
    if lo >= 6 and hi <= 8:
        return "Middle"
    if lo >= 9:
        return "High"
    return "Combined"


def main():
    print("Fetching real data for The School District of St. Lucie County (LEAID 1201770)...")

    # --- Roster (CCD directory) ---
    directory = fetch_all(f"/schools/ccd/directory/{CCD_YEAR}/", {"leaid": LEAID})
    print(f"  CCD directory {CCD_YEAR}: {len(directory)} schools in district")

    # --- Safety: CRDC offenses, suspensions, harassment, chronic absenteeism ---
    offenses = {r["ncessch"]: r for r in fetch_all(f"/schools/crdc/offenses/{CRDC_YEAR}/", {"leaid": LEAID})}
    # disability=99 is the all-students total (categories 0-4 are overlapping
    # breakdowns and must not be summed).
    disc = {r["ncessch"]: r for r in fetch_all(f"/schools/crdc/discipline-instances/{CRDC_YEAR}/", {"leaid": LEAID, "disability": 99})}
    harass = {}
    for r in fetch_all(f"/schools/crdc/harassment-or-bullying/{CRDC_YEAR}/allegations/", {"leaid": LEAID}):
        total = (num(r.get("allegations_harass_disability")) + num(r.get("allegations_harass_orientation"))
                 + num(r.get("allegations_harass_race")) + num(r.get("allegations_harass_religion"))
                 + num(r.get("allegations_harass_sex")))
        harass[r["ncessch"]] = total
    absent = {}
    for r in fetch_all(f"/schools/crdc/chronic-absenteeism/{CRDC_YEAR}/race/sex/", {"leaid": LEAID}):
        if is_total_row(r, ("race", "sex", "disability", "lep", "homeless")):
            absent[r["ncessch"]] = num(r.get("students_chronically_absent"))
    print(f"  CRDC {CRDC_YEAR}: offenses={len(offenses)} suspensions={len(disc)} "
          f"harassment={len(harass)} absenteeism={len(absent)}")

    # --- Graduation (EDFacts adjusted cohort grad rate, all-students rows) ---
    grad = {}
    for r in fetch_all(f"/schools/edfacts/grad-rates/{GRAD_YEAR}/", {"leaid": LEAID}):
        if is_total_row(r, ("race", "sex", "lep", "disability", "econ_disadvantaged", "foster_care", "homeless")):
            mid = r.get("grad_rate_midpt")
            try:
                mid = int(mid)
            except (TypeError, ValueError):
                mid = None
            grad[r["ncessch"]] = {
                "rate": mid if (mid is not None and mid >= 0) else None,
                "cohort": num(r.get("cohort_num")),
            }
    print(f"  EDFacts grad-rates {GRAD_YEAR}: {len(grad)} schools")

    # --- Assemble + filter to the 10 target zips / ~10 mile area ---
    schools, safety, graduation = [], [], []
    for d in directory:
        lat, lon = d.get("latitude"), d.get("longitude")
        enr = d.get("enrollment")
        zip_ = (str(d.get("zip_location") or d.get("zip_mailing") or "")[:5])
        if lat is None or lon is None or not enr or enr <= 0:
            continue
        near = min((haversine(lat, lon, z["lat"], z["lon"]) for z in ZIPCODES), default=99)
        if zip_ not in TARGET_ZIPS and near > INCLUDE_RADIUS_MILES:
            continue

        nces = d["ncessch"]
        teachers = d.get("teachers_fte") or 0
        ratio = round(enr / teachers, 1) if teachers and teachers > 0 else None
        low = grade_label(d.get("lowest_grade_offered"))
        high = grade_label(d.get("highest_grade_offered"))
        is_charter = bool(d.get("charter"))
        stype = classify_type(d.get("lowest_grade_offered"), d.get("highest_grade_offered"))
        if is_charter:
            stype = f"{stype} (Charter)"

        schools.append({
            "ncesId": nces,
            "name": titlecase(d.get("school_name") or ""),
            "type": stype,
            "gradeLow": low,
            "gradeHigh": high,
            "zip": zip_,
            "lat": round(float(lat), 6),
            "lon": round(float(lon), 6),
            "enrollment": int(enr),
            "studentTeacherRatio": ratio,
            "chronicAbsentStudents": absent.get(nces),
            "districtId": LEAID,
        })

        o = offenses.get(nces, {})
        attacks = num(o.get("attack_w_weapon_incidents")) + num(o.get("attack_no_weapon_incidents")) + num(o.get("attack_w_firearm_incidents"))
        threats = num(o.get("threats_w_weapon_incidents")) + num(o.get("threats_no_weapon_incidents")) + num(o.get("threats_w_firearm_incidents"))
        robbery = num(o.get("robbery_w_weapon_incidents")) + num(o.get("robbery_no_weapon_incidents")) + num(o.get("robbery_w_firearm_incidents"))
        sexual = num(o.get("rape_incidents")) + num(o.get("sexual_battery_incidents"))
        violent_total = attacks + threats + robbery + sexual
        safety.append({
            "ncesId": nces,
            "schoolYear": "2021-22",
            "source": "U.S. Dept. of Education, Civil Rights Data Collection (CRDC) 2021-22",
            "violentIncidentsTotal": violent_total,
            "physicalAttacksWithWeapon": num(o.get("attack_w_weapon_incidents")),
            "physicalAttacksNoWeapon": num(o.get("attack_no_weapon_incidents")),
            "threatsOfViolence": threats,
            "robberies": robbery,
            "rapeOrSexualBattery": sexual,
            "firearmExplosivePossession": num(o.get("possession_firearm_incidents")),
            "firearmIncident": bool(o.get("firearm_incident_ind")),
            "outOfSchoolSuspensions": num(disc.get(nces, {}).get("suspensions_instances")),
            "harassmentBullyingAllegations": harass.get(nces, 0),
        })

        if nces in grad and grad[nces]["rate"] is not None:
            graduation.append({
                "ncesId": nces,
                "schoolYear": "2018-19",
                "source": "U.S. Dept. of Education, EDFacts adjusted-cohort graduation rate (latest available)",
                "gradRate4yr": grad[nces]["rate"],
                "cohortSize": grad[nces]["cohort"],
            })

    schools.sort(key=lambda s: s["name"])
    print(f"  -> kept {len(schools)} schools in/near the 10 target zips "
          f"({len(graduation)} with graduation data)")

    district = {
        "districtId": LEAID,
        "name": "The School District of St. Lucie County",
        "shortName": "St. Lucie Public Schools",
        "state": "FL",
        "geometry": {"type": "Polygon", "coordinates": [DISTRICT_BOUNDARY]},
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    write("zipcodes.json", ZIPCODES)
    write("district.json", district)
    write("schools.json", schools)
    write("safety.json", safety)
    write("graduation.json", graduation)
    print("Done. Real data written to data/.")


def titlecase(name: str) -> str:
    """NCES names are upper-case; render them nicely while keeping K-8, St., etc."""
    keep_upper = {"K-8", "K-12", "PK-8", "PK-12", "K-5", "II", "III", "IV"}
    lower_words = {"of", "the", "for", "and", "at", "to"}
    parts = []
    for i, w in enumerate(name.split()):
        up = w.upper()
        inner_dot = "." in w[:-1]  # acronym like W.E.S.T.
        if up in keep_upper or any(c.isdigit() for c in w) or inner_dot:
            parts.append(up if up in keep_upper else (up if inner_dot else w))
        elif w.lower() in lower_words and i != 0:
            parts.append(w.lower())
        else:
            c = w.capitalize()
            if c.startswith("Mc") and len(c) > 2:  # McCarty, McNabb
                c = "Mc" + c[2:].capitalize()
            parts.append(c)
    return " ".join(parts)


def write(name, obj):
    path = os.path.join(DATA_DIR, name)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
    print(f"     wrote {os.path.relpath(path)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[error] real fetch failed: {exc}", file=sys.stderr)
        print("        Network may be unavailable; the committed data/ bundle still works.",
              file=sys.stderr)
        raise SystemExit(1)
