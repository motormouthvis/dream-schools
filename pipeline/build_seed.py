#!/usr/bin/env python3
"""
Dream Neighborhood — Schools tab demo
Seed / data-pipeline builder (limited to 10 zip codes around 34946, Fort Pierce FL).

This script produces the JSON data bundle consumed by the Next.js app:

    data/zipcodes.json     - the 10 target zip codes + centroids
    data/district.json     - the St. Lucie County school-district boundary (GeoJSON)
    data/schools.json      - public schools in / near the 10 zip codes
    data/safety.json        - SSOCS-style school safety records (join on ncesId)
    data/graduation.json    - graduation + college-going rates (join on ncesId)

ABOUT THE DATA
--------------
The real public sources for a production build are:
  * Public School Characteristics 2023-24 (NCES / NCES open data on ArcGIS)
  * School District Boundaries (NCES EDGE composite shapefile)
  * SSOCS 2021-22 School Survey on Crime and Safety (public-use file)
  * Graduation rates (NCES CCD / ED Data Express)

The SSOCS public-use file is a *sample* and is de-identified, so true
per-school safety counts are not publicly downloadable. For this self-contained
demo we therefore ship a curated, realistic dataset built around the *real*
schools of The School District of St. Lucie County (the district that serves
all 10 target zip codes). School names, types and grade spans are real; exact
enrollment, ratios, safety counts and rates are representative/illustrative and
are deterministically generated here so the demo runs with no external accounts.

See pipeline/fetch_real_data.py for the (optional) real-download + filter path.
"""

import json
import os
import hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))

# --- Target zip codes (10 around 34946, Fort Pierce / St. Lucie County, FL) ---
# Centroids are approximate (decimal degrees).
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

# --- District (The School District of St. Lucie County) ---
# NCES LEA id is representative for the demo.
DISTRICT = {
    "districtId": "1201440",
    "name": "The School District of St. Lucie County",
    "shortName": "St. Lucie Public Schools",
    "state": "FL",
    # Simplified boundary polygon (covers all 10 zip centroids). GeoJSON [lon,lat].
    "boundary": [
        [-80.2750, 27.5850],
        [-80.2850, 27.4000],
        [-80.3050, 27.1800],
        [-80.7050, 27.1820],
        [-80.7050, 27.5870],
        [-80.4000, 27.5860],
        [-80.2750, 27.5850],
    ],
}

# --- Schools (real St. Lucie County schools; metrics are illustrative) ---
# fields: name, type, low, high (grades), zip, lat, lon, enrollment, ratio
SCHOOLS = [
    # name, type, grade_low, grade_high, zip, lat, lon, enrollment, st_ratio
    ("Lincoln Park Academy", "Combined (Magnet)", "6", "12", "34950", 27.4560, -80.3450, 1850, 18),
    ("Fort Pierce Central High School", "High", "9", "12", "34947", 27.4300, -80.4000, 2300, 19),
    ("Fort Pierce Westwood Academy", "High", "9", "12", "34946", 27.4700, -80.3750, 1100, 16),
    ("St. Lucie West Centennial High School", "High", "9", "12", "34986", 27.3180, -80.4080, 2600, 20),
    ("Treasure Coast High School", "High", "9", "12", "34987", 27.2900, -80.4600, 2700, 20),
    ("Dan McCarty Middle School", "Middle", "7", "8", "34947", 27.4380, -80.3780, 900, 17),
    ("Forest Grove Middle School", "Middle", "6", "8", "34982", 27.4000, -80.3300, 1050, 18),
    ("Southern Oaks Middle School", "Middle", "6", "8", "34986", 27.3050, -80.4000, 1100, 18),
    ("Samuel S. Gaines Academy K-8", "Combined", "K", "8", "34947", 27.4400, -80.3950, 1100, 17),
    ("Northport K-8 School", "Combined", "K", "8", "34983", 27.3220, -80.3550, 1300, 17),
    ("Manatee Academy K-8", "Combined", "K", "8", "34984", 27.2500, -80.3500, 1250, 17),
    ("Allapattah Flats K-8 School", "Combined", "K", "8", "34987", 27.2950, -80.4550, 1450, 17),
    ("Windmill Point Elementary School", "Elementary", "K", "5", "34986", 27.3100, -80.4100, 820, 16),
    ("Chester A. Moore Elementary School", "Elementary", "K", "5", "34950", 27.4500, -80.3350, 600, 14),
    ("Frances K. Sweet Elementary School", "Elementary", "K", "5", "34947", 27.4450, -80.3820, 650, 15),
    ("Lawnwood Elementary School", "Elementary", "K", "5", "34950", 27.4520, -80.3480, 580, 14),
    ("Lakewood Park Elementary School", "Elementary", "K", "5", "34951", 27.5600, -80.3980, 720, 15),
    ("White City Elementary School", "Elementary", "K", "5", "34982", 27.3920, -80.3450, 540, 14),
    ("Weatherbee Elementary School", "Elementary", "K", "5", "34982", 27.4050, -80.3220, 600, 15),
    ("Fairlawn Elementary School", "Elementary", "K", "5", "34981", 27.3950, -80.3520, 560, 14),
    ("Bayshore Elementary School", "Elementary", "K", "5", "34983", 27.3300, -80.3600, 760, 15),
    ("Morningside Elementary School", "Elementary", "K", "5", "34983", 27.3000, -80.3450, 700, 15),
    ("Rivers Edge Elementary School", "Elementary", "K", "5", "34983", 27.3150, -80.3500, 700, 15),
    ("Village Green Elementary School", "Elementary", "K", "5", "34983", 27.3250, -80.3580, 600, 14),
    ("Mariposa Elementary School", "Elementary", "K", "5", "34984", 27.2600, -80.3600, 740, 15),
    ("Savanna Ridge Elementary School", "Elementary", "K", "5", "34987", 27.2800, -80.4700, 800, 16),
    ("Renaissance Charter School of St. Lucie", "Charter (K-8)", "K", "8", "34986", 27.3120, -80.4200, 900, 18),
]


def _rng(seed: str) -> float:
    """Deterministic pseudo-random float in [0,1) from a string seed."""
    h = hashlib.sha256(seed.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def has_grade_12(low: str, high: str) -> bool:
    return high == "12"


def make_school_id(idx: int) -> str:
    # 12-digit NCES-style id: state(12) + district(01440) + 5-digit school
    return f"120144000{idx:03d}"


def build():
    schools = []
    safety = []
    graduation = []

    for i, (name, stype, low, high, zip_, lat, lon, enr, ratio) in enumerate(SCHOOLS, start=1):
        nces_id = make_school_id(i)
        schools.append({
            "ncesId": nces_id,
            "name": name,
            "type": stype,
            "gradeLow": low,
            "gradeHigh": high,
            "zip": zip_,
            "lat": lat,
            "lon": lon,
            "enrollment": enr,
            "studentTeacherRatio": ratio,
            "districtId": DISTRICT["districtId"],
        })

        # --- Safety (SSOCS 2021-22 style, illustrative, scaled by enrollment) ---
        r = _rng(nces_id)
        r2 = _rng(nces_id + "b")
        r3 = _rng(nces_id + "c")
        scale = enr / 1000.0
        aggravated = round(r * 2 * scale)
        violent_total = aggravated + 1 + round(r2 * 4 * scale)
        threats = round(r3 * 5 * scale)
        theft = round(_rng(nces_id + "d") * 8 * scale)
        vandalism = round(_rng(nces_id + "e") * 6 * scale)
        drug = round(_rng(nces_id + "f") * 5 * scale)
        weapons = round(_rng(nces_id + "g") * 2 * scale)
        police_calls = violent_total + theft + round(_rng(nces_id + "h") * 6 * scale)
        safety.append({
            "ncesId": nces_id,
            "schoolYear": "2021-22",
            "source": "NCES SSOCS (illustrative)",
            "aggravatedAssaults": aggravated,
            "violentIncidentsTotal": violent_total,
            "threatsOfViolence": threats,
            "theftLarceny": theft,
            "vandalism": vandalism,
            "drugIncidents": drug,
            "weaponsPossession": weapons,
            "policeCalls": police_calls,
            "securityCameras": True,
            "controlledBuildingAccess": r > 0.15,
            "swornLawEnforcementOnSite": stype in ("High", "Combined (Magnet)") or r2 > 0.5,
            "visitorSignIn": True,
        })

        # --- Graduation / college-going (only schools serving grade 12) ---
        if has_grade_12(low, high):
            grad = 80 + round(_rng(nces_id + "grad") * 17)  # 80-97
            college = 60 + round(_rng(nces_id + "coll") * 22)  # 60-82
            graduation.append({
                "ncesId": nces_id,
                "schoolYear": "2022-23",
                "source": "NCES CCD / ED Data Express (illustrative)",
                "gradRate4yr": grad,
                "collegeGoingRate": college,
            })

    os.makedirs(DATA_DIR, exist_ok=True)

    district_geojson = {
        "districtId": DISTRICT["districtId"],
        "name": DISTRICT["name"],
        "shortName": DISTRICT["shortName"],
        "state": DISTRICT["state"],
        "geometry": {
            "type": "Polygon",
            "coordinates": [DISTRICT["boundary"]],
        },
    }

    _write("zipcodes.json", ZIPCODES)
    _write("district.json", district_geojson)
    _write("schools.json", schools)
    _write("safety.json", safety)
    _write("graduation.json", graduation)

    print(f"Wrote {len(schools)} schools, {len(safety)} safety records, "
          f"{len(graduation)} graduation records, {len(ZIPCODES)} zip codes.")


def _write(name: str, obj) -> None:
    path = os.path.join(DATA_DIR, name)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
    print(f"  -> {os.path.relpath(path)}")


if __name__ == "__main__":
    build()
