#!/usr/bin/env python3
"""
Dream Neighborhood — OPTIONAL real-data pipeline (production path).

This script documents and (where possible) performs the real downloads and
filters them to the 10 target zip codes. It is intentionally separate from
build_seed.py so the demo always works offline.

Sources
-------
1) Public School Characteristics 2023-24 (NCES open data on ArcGIS)
   https://data-nces.opendata.arcgis.com/datasets/nces::public-school-characteristics-current-1
   The ArcGIS Feature Service supports server-side filtering, so we only pull
   schools near the target area instead of the whole country.

2) School District Boundaries (NCES EDGE composite shapefile)
   https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries
   Download the latest composite, then keep only the St. Lucie County LEA.

3) SSOCS 2021-22 (public-use file)
   https://nces.ed.gov/use-work/dataset/2021-22-school-survey-crime-and-safety-ssocs-public-use-data-files-and-users-manual
   NOTE: SSOCS is a de-identified national *sample*; it cannot be joined to a
   specific school. For the demo we therefore synthesize representative
   per-school records in build_seed.py.

4) Graduation rates — NCES CCD / ED Data Express.

Usage
-----
    pip install -r pipeline/requirements.txt
    python pipeline/fetch_real_data.py            # writes pipeline/raw/*.json

This is provided for completeness; the demo runs entirely off build_seed.py.
"""

import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, "raw")

TARGET_ZIPS = [
    "34946", "34947", "34950", "34951", "34981",
    "34982", "34983", "34984", "34986", "34987",
]

# A bounding box around Fort Pierce / St. Lucie County (lon/lat) used to limit
# the ArcGIS query to roughly a 10-mile radius around the target zips.
BBOX = {"xmin": -80.75, "ymin": 27.10, "xmax": -80.25, "ymax": 27.62}

# Public School Characteristics current — ArcGIS FeatureServer query endpoint.
NCES_SCHOOLS_QUERY = (
    "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/"
    "Public_School_Characteristics_Current/FeatureServer/0/query"
)


def fetch_schools_arcgis() -> dict:
    """Pull only schools inside the bounding box from the ArcGIS service."""
    params = {
        "where": "1=1",
        "geometry": f'{BBOX["xmin"]},{BBOX["ymin"]},{BBOX["xmax"]},{BBOX["ymax"]}',
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
    }
    url = NCES_SCHOOLS_QUERY + "?" + urllib.parse.urlencode(params)
    print(f"GET {url}")
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    os.makedirs(RAW_DIR, exist_ok=True)
    try:
        gj = fetch_schools_arcgis()
    except Exception as exc:  # network may be unavailable in the demo sandbox
        print(f"[warn] could not fetch ArcGIS schools: {exc}", file=sys.stderr)
        print("       Fall back to the offline seed: python pipeline/build_seed.py")
        return 1

    feats = gj.get("features", [])
    # Keep only features whose zip is one of the targets (field name varies by
    # vintage; common ones are LZIP / ZIP).
    kept = []
    for f in feats:
        props = f.get("properties", {})
        zip_ = str(props.get("LZIP") or props.get("ZIP") or "")[:5]
        if zip_ in TARGET_ZIPS:
            kept.append(f)

    out = os.path.join(RAW_DIR, "schools_arcgis.geojson")
    with open(out, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": kept}, fh)
    print(f"Saved {len(kept)} schools (of {len(feats)} in bbox) -> {out}")
    print("District boundaries + SSOCS: see docstring for manual steps.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
