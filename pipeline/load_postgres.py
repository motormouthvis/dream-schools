#!/usr/bin/env python3
"""
Dream Neighborhood — NATIONWIDE Postgres + PostGIS loader.

Downloads real, per-school federal data for the entire United States and loads
it into a Postgres + PostGIS database. Designed to run anywhere a DATABASE_URL
is reachable (local dev, Heroku Postgres, Supabase, etc.) with only psycopg2 as
a dependency — no GDAL required (district boundaries are loaded separately and
are optional; address->district falls back to the nearest school's district).

Sources (all via the free Urban Institute Education Data Portal, mirroring the
official federal collections):

  schools           NCES CCD directory 2023-24      (~102k schools)
  school_safety     U.S. DOE CRDC 2021-22           (offenses, suspensions,
                                                      harassment/bullying,
                                                      chronic absenteeism)
  school_graduation EDFacts adjusted-cohort 2018-19 (latest served)
  school_districts  derived from CCD (names/rollups); boundary polygons are
                    added by pipeline/load_boundaries.* (optional)

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  pip install -r pipeline/requirements.txt
  python3 pipeline/load_postgres.py                 # nationwide (default)
  python3 pipeline/load_postgres.py --fips 12       # one state (FL) — fast test
  python3 pipeline/load_postgres.py --year-ccd 2023 --year-crdc 2021

The load is a full refresh: it (re)creates the schema, TRUNCATEs, and COPYs.
It is safe to re-run.
"""

import argparse
import io
import csv
import os
import sys
import time
import urllib.parse
import urllib.request

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 is required: pip install -r pipeline/requirements.txt")

API = "https://educationdata.urban.org/api/v1"
PAGE = 10000

CCD_YEAR_DEFAULT = 2023
CRDC_YEAR_DEFAULT = 2021
GRAD_YEAR_DEFAULT = 2019

GRADE_MAP = {
    -1: "PK", 0: "K", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6",
    7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12", 13: "12",
}

URBANICITY = {
    11: "City (large)", 12: "City (midsize)", 13: "City (small)",
    21: "Suburb (large)", 22: "Suburb (midsize)", 23: "Suburb (small)",
    31: "Town (fringe)", 32: "Town (distant)", 33: "Town (remote)",
    41: "Rural (fringe)", 42: "Rural (distant)", 43: "Rural (remote)",
}


def urbanicity_label(code):
    try:
        return URBANICITY.get(int(code))
    except (TypeError, ValueError):
        return None


def title_i_bool(status):
    try:
        return int(status) in (1, 2, 3, 4, 5)
    except (TypeError, ValueError):
        return False

SCHEMA_SQL = """
create extension if not exists postgis;

create table if not exists school_districts (
    district_id   text primary key,
    name          text not null,
    short_name    text,
    state         text,
    enrollment    integer,
    school_count  integer,
    geom          geometry(MultiPolygon, 4326)
);
create index if not exists school_districts_geom_idx on school_districts using gist (geom);

create table if not exists schools (
    nces_id                 text primary key,
    name                    text not null,
    type                    text,
    level                   text,            -- 'public' or 'private'
    grade_low               text,
    grade_high              text,
    zip                     text,
    district_id             text,
    enrollment              integer,
    student_teacher_ratio   numeric,
    chronic_absent_students integer,
    -- contact / address
    street                  text,
    city                    text,
    state                   text,
    phone                   text,
    -- attributes
    charter                 boolean,
    magnet                  boolean,
    title_i                 boolean,
    virtual                 boolean,
    free_reduced_lunch      integer,
    urbanicity              text,
    -- demographics (enrollment counts; all grades)
    enr_white               integer,
    enr_black               integer,
    enr_hispanic            integer,
    enr_asian               integer,
    enr_amerind             integer,
    enr_pacific             integer,
    enr_twomore             integer,
    enr_male                integer,
    enr_female              integer,
    geom                    geometry(Point, 4326)
);
create index if not exists schools_geom_idx on schools using gist (geom);
create index if not exists schools_zip_idx on schools (zip);
create index if not exists schools_district_idx on schools (district_id);
create index if not exists schools_level_idx on schools (level);

create table if not exists school_safety (
    nces_id                         text primary key,
    school_year                     text,
    source                          text,
    violent_incidents_total         integer,
    physical_attacks_with_weapon    integer,
    physical_attacks_no_weapon      integer,
    threats_of_violence             integer,
    robberies                       integer,
    rape_or_sexual_battery          integer,
    firearm_explosive_possession    integer,
    firearm_incident                boolean,
    out_of_school_suspensions       integer,
    harassment_bullying_allegations integer
);

create table if not exists school_graduation (
    nces_id            text primary key,
    school_year        text,
    source             text,
    grad_rate_4yr      numeric,
    cohort_size        integer
);
"""


def log(msg):
    print(msg, flush=True)


def require_ssl(dburl):
    """Managed Postgres (Heroku, RDS, Supabase, ...) requires SSL."""
    if not dburl:
        return dburl
    import re
    if "sslmode=" not in dburl and re.search(r"heroku|amazonaws|supabase|render|railway", dburl, re.I):
        sep = "&" if "?" in dburl else "?"
        dburl = f"{dburl}{sep}sslmode=require"
    return dburl


def http_get_all(path, params=None, label=""):
    """GET an Urban API endpoint, following pagination, yielding all results."""
    q = dict(params or {})
    q.setdefault("limit", PAGE)
    url = f"{API}{path}?" + urllib.parse.urlencode(q)
    total = 0
    page = 0
    out = []
    while url:
        data = None
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    import json
                    data = json.loads(resp.read().decode())
                break
            except Exception as exc:
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
        out.extend(data.get("results", []))
        total = data.get("count", total)
        url = data.get("next")
        page += 1
        if label:
            log(f"    {label}: {len(out):,}/{total:,} (page {page})")
        if page > 500:
            break
    return out


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    return int(round(f)) if f >= 0 else 0


def grade_label(v):
    try:
        return GRADE_MAP.get(int(v), str(v))
    except (TypeError, ValueError):
        return str(v) if v is not None else None


def classify_type(low_v, high_v, charter):
    try:
        lo, hi = int(low_v), int(high_v)
        if hi <= 5:
            t = "Elementary"
        elif lo >= 6 and hi <= 8:
            t = "Middle"
        elif lo >= 9:
            t = "High"
        else:
            t = "Combined"
    except (TypeError, ValueError):
        t = "Combined"
    return f"{t} (Charter)" if charter else t


def titlecase(name):
    if not name:
        return ""
    keep_upper = {"K-8", "K-12", "PK-8", "PK-12", "K-5", "II", "III", "IV"}
    lower_words = {"of", "the", "for", "and", "at", "to"}
    parts = []
    for i, w in enumerate(name.split()):
        up = w.upper()
        inner_dot = "." in w[:-1]
        if up in keep_upper or any(c.isdigit() for c in w) or inner_dot:
            parts.append(up if (up in keep_upper or inner_dot) else w)
        elif w.lower() in lower_words and i != 0:
            parts.append(w.lower())
        else:
            c = w.capitalize()
            if c.startswith("Mc") and len(c) > 2:
                c = "Mc" + c[2:].capitalize()
            parts.append(c)
    return " ".join(parts)


def copy_rows(cur, table, columns, rows):
    """Fast bulk load via COPY FROM a CSV buffer."""
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    cols = ",".join(columns)
    cur.copy_expert(
        f"COPY {table} ({cols}) FROM STDIN WITH (FORMAT csv, NULL '')", buf
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fips", type=int, default=None,
                    help="Limit to one state FIPS (e.g. 12=FL) for a quick test")
    ap.add_argument("--year-ccd", type=int, default=CCD_YEAR_DEFAULT)
    ap.add_argument("--year-crdc", type=int, default=CRDC_YEAR_DEFAULT)
    ap.add_argument("--year-grad", type=int, default=GRAD_YEAR_DEFAULT)
    args = ap.parse_args()

    dburl = require_ssl(os.environ.get("DATABASE_URL"))
    if not dburl:
        sys.exit("Set DATABASE_URL (e.g. postgresql://user:pass@host:5432/db)")

    scope = f"state FIPS {args.fips}" if args.fips else "NATIONWIDE"
    log(f"Loading {scope}: CCD {args.year_ccd}, CRDC {args.year_crdc}, "
        f"grad {args.year_grad}")
    filt = {"fips": args.fips} if args.fips else {}

    t0 = time.time()

    # --- 1. Download ---------------------------------------------------------
    log("  Downloading CCD school directory ...")
    directory = http_get_all(f"/schools/ccd/directory/{args.year_ccd}/", filt, "schools")

    log("  Downloading CRDC offenses ...")
    offenses = {r["ncessch"]: r for r in
                http_get_all(f"/schools/crdc/offenses/{args.year_crdc}/", filt, "offenses")}
    log("  Downloading CRDC discipline (suspensions) ...")
    # disability=99 is the all-students total row (categories 0-4 are overlapping
    # breakdowns and must not be summed).
    disc = {r["ncessch"]: r for r in
            http_get_all(f"/schools/crdc/discipline-instances/{args.year_crdc}/",
                         dict(filt, disability=99), "discipline")}
    log("  Downloading CRDC harassment/bullying ...")
    harass = {}
    for r in http_get_all(f"/schools/crdc/harassment-or-bullying/{args.year_crdc}/allegations/", filt, "harassment"):
        harass[r["ncessch"]] = (num(r.get("allegations_harass_disability"))
                                + num(r.get("allegations_harass_orientation"))
                                + num(r.get("allegations_harass_race"))
                                + num(r.get("allegations_harass_religion"))
                                + num(r.get("allegations_harass_sex")))
    log("  Downloading CRDC chronic absenteeism (totals) ...")
    abs_filt = dict(filt, race=99, sex=99, disability=99, lep=99, homeless=99)
    absent = {r["ncessch"]: num(r.get("students_chronically_absent"))
              for r in http_get_all(f"/schools/crdc/chronic-absenteeism/{args.year_crdc}/race/sex/", abs_filt, "absenteeism")}
    log("  Downloading EDFacts graduation rates (totals) ...")
    grad_filt = dict(filt, race=99, sex=99, disability=99, lep=99,
                     econ_disadvantaged=99, foster_care=99, homeless=99)
    grad = {}
    for r in http_get_all(f"/schools/edfacts/grad-rates/{args.year_grad}/", grad_filt, "graduation"):
        mid = r.get("grad_rate_midpt")
        try:
            mid = int(mid)
        except (TypeError, ValueError):
            mid = None
        if mid is not None and mid >= 0:
            grad[r["ncessch"]] = (mid, num(r.get("cohort_num")))

    log("  Downloading CCD enrollment by race (all grades) ...")
    # race codes: 1 White, 2 Black, 3 Hispanic, 4 Asian, 5 Am.Indian/AK,
    # 6 Native HI/Pacific, 7 Two+; 99 total.
    race = {}
    for r in http_get_all(f"/schools/ccd/enrollment/{args.year_ccd}/grade-99/race/", filt, "race"):
        d = race.setdefault(r["ncessch"], {})
        d[r.get("race")] = num(r.get("enrollment"))
    log("  Downloading CCD enrollment by sex (all grades) ...")
    sex = {}
    for r in http_get_all(f"/schools/ccd/enrollment/{args.year_ccd}/grade-99/sex/", filt, "sex"):
        d = sex.setdefault(r["ncessch"], {})
        d[r.get("sex")] = num(r.get("enrollment"))

    log(f"  Download complete in {time.time()-t0:.0f}s. "
        f"Building rows for {len(directory):,} schools ...")

    # --- 2. Build rows -------------------------------------------------------
    school_rows, safety_rows, grad_rows = [], [], []
    districts = {}  # district_id -> [name, state, enrollment, count]
    crdc_src = f"U.S. Dept. of Education, Civil Rights Data Collection (CRDC) {args.year_crdc}-{str(args.year_crdc+1)[2:]}"
    grad_src = "U.S. Dept. of Education, EDFacts adjusted-cohort graduation rate"

    for d in directory:
        lat, lon, enr = d.get("latitude"), d.get("longitude"), d.get("enrollment")
        if lat is None or lon is None or not enr or enr <= 0:
            continue
        nces = d["ncessch"]
        leaid = d.get("leaid")
        teachers = d.get("teachers_fte") or 0
        ratio = round(enr / teachers, 1) if teachers and teachers > 0 else None
        charter = bool(d.get("charter"))
        stype = classify_type(d.get("lowest_grade_offered"), d.get("highest_grade_offered"), charter)
        zip_ = (str(d.get("zip_location") or d.get("zip_mailing") or "")[:5]) or None
        geom = f"SRID=4326;POINT({lon} {lat})"
        rc = race.get(nces, {})
        sx = sex.get(nces, {})
        def rget(code):
            v = rc.get(code)
            return v if v is not None else ""

        school_rows.append([
            nces, titlecase(d.get("school_name") or ""), stype, "public",
            grade_label(d.get("lowest_grade_offered")), grade_label(d.get("highest_grade_offered")),
            zip_, leaid, int(enr), ratio if ratio is not None else "",
            absent.get(nces, ""),
            titlecase(d.get("street_location") or "") or "", titlecase(d.get("city_location") or "") or "",
            (d.get("state_location") or "") or "", d.get("phone") or "",
            "true" if charter else "false",
            "true" if d.get("magnet") else "false",
            "true" if title_i_bool(d.get("title_i_status")) else "false",
            "true" if d.get("virtual") else "false",
            num(d.get("free_or_reduced_price_lunch")) if d.get("free_or_reduced_price_lunch") is not None else "",
            urbanicity_label(d.get("urban_centric_locale")) or "",
            rget(1), rget(2), rget(3), rget(4), rget(5), rget(6), rget(7),
            sx.get(1, ""), sx.get(2, ""),
            geom,
        ])

        if leaid:
            agg = districts.setdefault(leaid, [titlecase(d.get("lea_name") or ""),
                                                (d.get("state_location") or d.get("state_mailing") or ""), 0, 0])
            agg[2] += int(enr)
            agg[3] += 1

        o = offenses.get(nces, {})
        attacks = num(o.get("attack_w_weapon_incidents")) + num(o.get("attack_no_weapon_incidents")) + num(o.get("attack_w_firearm_incidents"))
        threats = num(o.get("threats_w_weapon_incidents")) + num(o.get("threats_no_weapon_incidents")) + num(o.get("threats_w_firearm_incidents"))
        robbery = num(o.get("robbery_w_weapon_incidents")) + num(o.get("robbery_no_weapon_incidents")) + num(o.get("robbery_w_firearm_incidents"))
        sexual = num(o.get("rape_incidents")) + num(o.get("sexual_battery_incidents"))
        violent = attacks + threats + robbery + sexual
        safety_rows.append([
            nces, f"{args.year_crdc}-{str(args.year_crdc+1)[2:]}", crdc_src,
            violent, num(o.get("attack_w_weapon_incidents")), num(o.get("attack_no_weapon_incidents")),
            threats, robbery, sexual, num(o.get("possession_firearm_incidents")),
            "true" if o.get("firearm_incident_ind") else "false",
            num(disc.get(nces, {}).get("suspensions_instances")), harass.get(nces, 0),
        ])

        if nces in grad:
            rate, cohort = grad[nces]
            grad_rows.append([nces, f"{args.year_grad}-{str(args.year_grad+1)[2:]}", grad_src, rate, cohort])

    district_rows = [[did, name or did, None, state, enr, cnt, ""]
                     for did, (name, state, enr, cnt) in districts.items()]

    log(f"  Rows: {len(school_rows):,} schools, {len(safety_rows):,} safety, "
        f"{len(grad_rows):,} graduation, {len(district_rows):,} districts")

    # --- 3. Load -------------------------------------------------------------
    conn = psycopg2.connect(dburl)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            log("  Applying schema (drop + recreate) ...")
            cur.execute("DROP TABLE IF EXISTS school_safety, school_graduation, schools, school_districts CASCADE;")
            cur.execute(SCHEMA_SQL)

            log("  COPY school_districts ...")
            copy_rows(cur, "school_districts",
                      ["district_id", "name", "short_name", "state", "enrollment", "school_count", "geom"],
                      district_rows)
            log("  COPY schools ...")
            copy_rows(cur, "schools",
                      ["nces_id", "name", "type", "level", "grade_low", "grade_high", "zip",
                       "district_id", "enrollment", "student_teacher_ratio",
                       "chronic_absent_students", "street", "city", "state", "phone",
                       "charter", "magnet", "title_i", "virtual", "free_reduced_lunch",
                       "urbanicity", "enr_white", "enr_black", "enr_hispanic", "enr_asian",
                       "enr_amerind", "enr_pacific", "enr_twomore", "enr_male", "enr_female",
                       "geom"],
                      school_rows)
            log("  COPY school_safety ...")
            copy_rows(cur, "school_safety",
                      ["nces_id", "school_year", "source", "violent_incidents_total",
                       "physical_attacks_with_weapon", "physical_attacks_no_weapon",
                       "threats_of_violence", "robberies", "rape_or_sexual_battery",
                       "firearm_explosive_possession", "firearm_incident",
                       "out_of_school_suspensions", "harassment_bullying_allegations"],
                      safety_rows)
            log("  COPY school_graduation ...")
            copy_rows(cur, "school_graduation",
                      ["nces_id", "school_year", "source", "grad_rate_4yr", "cohort_size"],
                      grad_rows)
            log("  ANALYZE ...")
            cur.execute("ANALYZE schools; ANALYZE school_safety; ANALYZE school_graduation; ANALYZE school_districts;")
        conn.commit()
    finally:
        conn.close()

    log(f"Done in {time.time()-t0:.0f}s. Loaded {scope} into Postgres.")


if __name__ == "__main__":
    main()
