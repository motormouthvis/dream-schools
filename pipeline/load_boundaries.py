#!/usr/bin/env python3
"""
Dream Neighborhood — OPTIONAL district boundary loader (point-in-polygon).

Downloads the U.S. Census Bureau national cartographic-boundary shapefiles for
school districts (unified, elementary, secondary) and loads the polygons into
school_districts.geom, keyed by GEOID (= NCES LEAID). With boundaries loaded,
address->district uses true point-in-polygon (ST_Contains); without them, the
app falls back to the nearest school's district, so this step is optional.

Pure Python (pyshp + psycopg2) — no GDAL/ogr2ogr required, so it runs on a plain
Heroku one-off dyno.

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  pip install -r pipeline/requirements.txt
  python3 pipeline/load_boundaries.py [--year 2023]

Run AFTER load_postgres.py (which creates school_districts).
"""

import argparse
import io
import os
import sys
import zipfile
import urllib.request

try:
    import shapefile  # pyshp
    import psycopg2
except ImportError:
    sys.exit("Needs pyshp + psycopg2: pip install -r pipeline/requirements.txt")

# National cartographic boundary files (single nationwide file each).
CB_BASE = "https://www2.census.gov/geo/tiger/GENZ{year}/shp"
LAYERS = ["unsd", "elsd", "scsd"]  # unified, elementary, secondary school districts


def download_shp(year, layer):
    url = f"{CB_BASE.format(year=year)}/cb_{year}_us_{layer}_500k.zip"
    print(f"  GET {url}", flush=True)
    with urllib.request.urlopen(url, timeout=180) as resp:
        data = resp.read()
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = {os.path.splitext(n)[1].lower(): n for n in zf.namelist()}
    shp = zf.open(names[".shp"])
    dbf = zf.open(names[".dbf"])
    shx = zf.open(names[".shx"]) if ".shx" in names else None
    return shapefile.Reader(shp=shp, dbf=dbf, shx=shx)


def parts_to_wkt(shape):
    """Convert a pyshp polygon shape to a MULTIPOLYGON WKT (each part a ring)."""
    pts = shape.points
    parts = list(shape.parts) + [len(pts)]
    rings = []
    for i in range(len(parts) - 1):
        ring = pts[parts[i]:parts[i + 1]]
        if len(ring) < 4:
            continue
        coords = ", ".join(f"{x} {y}" for x, y in ring)
        rings.append(f"(({coords}))")
    if not rings:
        return None
    # Treat every ring as its own polygon; PostGIS will normalize via ST_MakeValid.
    return "MULTIPOLYGON(" + ", ".join(rings) + ")"


def geoid_field(reader):
    for i, f in enumerate(reader.fields[1:]):  # skip DeletionFlag
        if f[0].upper() in ("GEOID", "GEOID20", "GEOID10"):
            return i
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2023)
    args = ap.parse_args()

    dburl = os.environ.get("DATABASE_URL")
    if not dburl:
        sys.exit("Set DATABASE_URL")
    import re
    if "sslmode=" not in dburl and re.search(r"heroku|amazonaws|supabase|render|railway", dburl, re.I):
        dburl += ("&" if "?" in dburl else "?") + "sslmode=require"

    conn = psycopg2.connect(dburl)
    conn.autocommit = False
    updated = 0
    try:
        with conn.cursor() as cur:
            for layer in LAYERS:
                try:
                    reader = download_shp(args.year, layer)
                except Exception as exc:
                    print(f"  [warn] skip {layer}: {exc}", file=sys.stderr)
                    continue
                gi = geoid_field(reader)
                if gi is None:
                    print(f"  [warn] no GEOID field in {layer}", file=sys.stderr)
                    continue
                count = 0
                for sr in reader.iterShapeRecords():
                    geoid = str(sr.record[gi])
                    wkt = parts_to_wkt(sr.shape)
                    if not wkt:
                        continue
                    cur.execute(
                        """update school_districts
                              set geom = ST_Multi(ST_CollectionExtract(
                                          ST_MakeValid(ST_GeomFromText(%s, 4326)), 3))
                            where district_id = %s""",
                        (wkt, geoid),
                    )
                    count += cur.rowcount
                print(f"  {layer}: matched {count} districts", flush=True)
                updated += count
        conn.commit()
    finally:
        conn.close()
    print(f"Done. Updated boundaries for {updated} districts.")


if __name__ == "__main__":
    main()
