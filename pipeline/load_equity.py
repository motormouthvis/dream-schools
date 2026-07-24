#!/usr/bin/env python3
"""
Incremental equity loader — populates school_graduation.grad_rate_disadvantaged
WITHOUT a destructive full reload.

Only does two things, both additive:
  1. ALTER TABLE school_graduation ADD COLUMN IF NOT EXISTS grad_rate_disadvantaged numeric
  2. UPDATE that one column from the free EDFacts economically-disadvantaged
     graduation subgroup (econ_disadvantaged=1).

It never touches other columns/tables. Use to backfill an existing DB; new full
reloads via load_postgres.py already include the column.

Usage:
  DATABASE_URL=... python3 pipeline/load_equity.py --fips 12   # one state (test)
  DATABASE_URL=... python3 pipeline/load_equity.py             # nationwide
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    sys.exit("psycopg2 is required: pip install -r pipeline/requirements.txt")

API = "https://educationdata.urban.org/api/v1"
GRAD_YEAR_DEFAULT = 2019


def log(m):
    print(m, flush=True)


def require_ssl(url):
    if url and "sslmode=" not in url and any(
        h in url for h in ("herokuapp", "amazonaws", "render", "railway", "supabase")
    ):
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def http_get_all(path, params, label):
    out = []
    url = API + path + "?" + urllib.parse.urlencode(params)
    page = 0
    while url:
        page += 1
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=90) as r:
                    j = json.load(r)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        out.extend(j.get("results", []))
        url = j.get("next")
        log(f"    [{label}] page {page}: total {len(out)}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fips", type=int, default=None)
    ap.add_argument("--year", type=int, default=GRAD_YEAR_DEFAULT)
    args = ap.parse_args()

    dburl = require_ssl(os.environ.get("DATABASE_URL"))
    if not dburl:
        sys.exit("Set DATABASE_URL")

    filt = {"race": 99, "sex": 99, "disability": 99, "lep": 99,
            "foster_care": 99, "homeless": 99, "econ_disadvantaged": 1}
    if args.fips:
        filt["fips"] = args.fips

    scope = f"FIPS {args.fips}" if args.fips else "NATIONWIDE"
    log(f"Equity backfill ({scope}), grad year {args.year}")
    rows = http_get_all(f"/schools/edfacts/grad-rates/{args.year}/", filt, "grad disadv")

    updates = []
    for r in rows:
        try:
            mid = int(r.get("grad_rate_midpt"))
        except (TypeError, ValueError):
            continue
        if mid >= 0:
            updates.append((mid, r["ncessch"]))
    log(f"  {len(updates)} schools with a disadvantaged grad rate")

    conn = psycopg2.connect(dburl)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "ALTER TABLE school_graduation "
                "ADD COLUMN IF NOT EXISTS grad_rate_disadvantaged numeric"
            )
            execute_batch(
                cur,
                "UPDATE school_graduation SET grad_rate_disadvantaged = %s WHERE nces_id = %s",
                updates,
                page_size=1000,
            )
            cur.execute(
                "SELECT count(*) FROM school_graduation WHERE grad_rate_disadvantaged IS NOT NULL"
            )
            populated = cur.fetchone()[0]
        conn.commit()
        log(f"  Committed. Rows now populated: {populated}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
