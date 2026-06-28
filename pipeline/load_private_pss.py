#!/usr/bin/env python3
"""
Dream Neighborhood — PRIVATE school loader (NCES PSS 2021-22).

Adds private schools to the `schools` table (level='private') from the NCES
Private School Universe Survey (PSS) public-use file, which is the universe of
US private schools. The single public-use CSV already contains everything we
need: name, address, phone, latitude/longitude, grade span, enrollment, gender,
race/ethnicity, religious orientation, and urbanicity.

IMPORTANT — what private schools do and do NOT have:
  * PSS provides: location, contact, enrollment, grade span, type/affiliation,
    and student race & gender.
  * Private schools are NOT in CRDC or EDFacts, so they have NO per-school
    safety incidents and NO graduation-rate data. Those remain null.

Run AFTER pipeline/load_postgres.py (which creates/owns the `schools` table).
Idempotent: deletes existing private rows, then re-inserts.

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  pip install -r pipeline/requirements.txt
  python3 pipeline/load_private_pss.py
"""

import csv
import io
import os
import re
import sys
import urllib.request
import zipfile

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 required: pip install -r pipeline/requirements.txt")

PSS_CSV_ZIP = "https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip"
CSV_NAME = "pss2122_pu.csv"

# LOGR2022 / HIGR2022 recode -> our grade label
PSS_GRADE = {
    1: "UG", 2: "PK", 3: "K", 4: "PK", 5: "1", 6: "1", 7: "2", 8: "3", 9: "4",
    10: "5", 11: "6", 12: "7", 13: "8", 14: "9", 15: "10", 16: "11", 17: "12",
}

RELIG_LABEL = {1: "Catholic", 2: "Religious", 3: "Nonsectarian"}

URBANICITY = {
    11: "City (large)", 12: "City (midsize)", 13: "City (small)",
    21: "Suburb (large)", 22: "Suburb (midsize)", 23: "Suburb (small)",
    31: "Town (fringe)", 32: "Town (distant)", 33: "Town (remote)",
    41: "Rural (fringe)", 42: "Rural (distant)", 43: "Rural (remote)",
}


def require_ssl(dburl):
    if dburl and "sslmode=" not in dburl and re.search(
        r"heroku|amazonaws|supabase|render|railway", dburl, re.I
    ):
        dburl += ("&" if "?" in dburl else "?") + "sslmode=require"
    return dburl


def to_int(v):
    try:
        f = float(v)
        return int(f) if f >= 0 else None
    except (TypeError, ValueError):
        return None


def fmt_phone(p):
    digits = re.sub(r"\D", "", p or "")
    if len(digits) == 10:
        return f"({digits[0:3]}) {digits[3:6]}-{digits[6:]}"
    return p or None


def titlecase(name):
    if not name:
        return ""
    lower_words = {"of", "the", "for", "and", "at", "to", "de", "la", "el"}
    out = []
    for i, w in enumerate(name.split()):
        up = w.upper()
        if up in ("LLC", "INC", "INC.", "USA", "II", "III", "IV", "STEM") or any(c.isdigit() for c in w):
            out.append(up if up in ("LLC", "INC", "INC.", "USA", "II", "III", "IV", "STEM") else w)
        elif w.lower() in lower_words and i != 0:
            out.append(w.lower())
        else:
            c = w.capitalize()
            if c.startswith("Mc") and len(c) > 2:
                c = "Mc" + c[2:].capitalize()
            out.append(c)
    return " ".join(out)


def grade_label(code):
    return PSS_GRADE.get(to_int(code) or -99)


def main():
    dburl = require_ssl(os.environ.get("DATABASE_URL"))
    if not dburl:
        sys.exit("Set DATABASE_URL")

    print(f"Downloading PSS public-use CSV: {PSS_CSV_ZIP}", flush=True)
    with urllib.request.urlopen(PSS_CSV_ZIP, timeout=120) as resp:
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    rows = list(csv.reader(zf.read(CSV_NAME).decode("latin-1").splitlines()))
    hdr = rows[0]
    idx = {c: i for i, c in enumerate(hdr)}
    print(f"  {len(rows)-1:,} private schools in PSS file", flush=True)

    def col(r, name):
        i = idx.get(name)
        return r[i] if i is not None and i < len(r) else None

    out = []
    skipped = 0
    for r in rows[1:]:
        lat = col(r, "LATITUDE22")
        lon = col(r, "LONGITUDE22")
        enr = to_int(col(r, "NUMSTUDS"))
        try:
            latf, lonf = float(lat), float(lon)
        except (TypeError, ValueError):
            skipped += 1
            continue
        if not enr or enr <= 0:
            skipped += 1
            continue

        ppin = col(r, "PPIN")
        relig = to_int(col(r, "RELIG"))
        affil = RELIG_LABEL.get(relig, "")
        stype = f"Private ({affil})" if affil else "Private"
        low = grade_label(col(r, "LOGR2022"))
        high = grade_label(col(r, "HIGR2022"))
        males = to_int(col(r, "MALES"))
        females = (enr - males) if (males is not None and enr >= males) else None
        # Student-teacher ratio from PSS FTE teacher count (NUMTEACH).
        try:
            nt = float(col(r, "NUMTEACH"))
            ratio = round(enr / nt, 1) if nt > 0 else ""
        except (TypeError, ValueError):
            ratio = ""

        def race(c):
            v = to_int(col(r, c))
            return v if v is not None else ""

        out.append([
            f"PSS{ppin}", titlecase(col(r, "PINST") or ""), stype, "private",
            low or "", high or "", (col(r, "PZIP") or "")[:5], "",  # district_id null
            enr, ratio,  # student_teacher_ratio from NUMTEACH
            "",  # chronic_absent_students null
            titlecase(col(r, "PADDRS") or "") or "", titlecase(col(r, "PCITY") or "") or "",
            col(r, "PSTABB") or "", fmt_phone(col(r, "PPHONE")) or "",
            "false", "false", "false", "false",  # charter/magnet/title_i/virtual
            "",  # free_reduced_lunch null
            URBANICITY.get(to_int(col(r, "ULOCALE22")) or -99) or "",
            race("P_WHITE"), race("P_BLACK"), race("P_HISP"), race("P_ASIAN"),
            race("P_INDIAN"), race("P_PACIFIC"), race("P_TR"),
            males if males is not None else "", females if females is not None else "",
            f"SRID=4326;POINT({lonf} {latf})",
        ])

    print(f"  Prepared {len(out):,} private schools ({skipped:,} skipped for missing lat/lon or enrollment)", flush=True)

    conn = psycopg2.connect(dburl)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM schools WHERE level = 'private';")
            buf = io.StringIO()
            csv.writer(buf).writerows(out)
            buf.seek(0)
            cur.copy_expert(
                """COPY schools (nces_id, name, type, level, grade_low, grade_high, zip,
                   district_id, enrollment, student_teacher_ratio, chronic_absent_students,
                   street, city, state, phone, charter, magnet, title_i, virtual,
                   free_reduced_lunch, urbanicity, enr_white, enr_black, enr_hispanic,
                   enr_asian, enr_amerind, enr_pacific, enr_twomore, enr_male, enr_female, geom)
                   FROM STDIN WITH (FORMAT csv, NULL '')""",
                buf,
            )
            cur.execute("ANALYZE schools;")
        conn.commit()
    finally:
        conn.close()
    print(f"Done. Loaded {len(out):,} private schools (level='private').")


if __name__ == "__main__":
    main()
