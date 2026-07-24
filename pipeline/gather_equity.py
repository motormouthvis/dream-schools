#!/usr/bin/env python3
"""
EQUITY DATA GATHERER (exploration only — no DB writes, no product changes).

Purpose: verify what a *free* federal "equity" signal looks like before we build
any rating or UI. Federal test-score SUBGROUP data is not usable via the Urban
Institute API (the assessments subgroup breakdown returns empty/500), but the
EDFacts GRADUATION-RATE endpoint DOES serve the economically-disadvantaged
subgroup. So the honest, free equity measure is a high-school GRADUATION GAP:
economically-disadvantaged grad rate vs. not-disadvantaged (and vs. the overall).

This script only READS the public API and writes a local CSV + prints stats.
It does NOT touch Postgres, the app, or ratings.

Usage:
  python3 pipeline/gather_equity.py --fips 12            # one state (FL) — fast
  python3 pipeline/gather_equity.py --fips 12 --year 2019
  python3 pipeline/gather_equity.py                      # NATIONWIDE (slow)

Output: pipeline/out/equity_grad_gap_fips<fips>.csv
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://educationdata.urban.org/api/v1"
GRAD_YEAR_DEFAULT = 2019


def log(msg):
    print(msg, flush=True)


def http_get_all(path, params, label):
    """Follow the Urban API pagination (count/next/results)."""
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
            except Exception as exc:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        out.extend(j.get("results", []))
        url = j.get("next")
        log(f"    [{label}] page {page}: +{len(j.get('results', []))} (total {len(out)})")
    return out


def gi(v):
    """grad_rate_midpt → int or None (negatives are suppression codes)."""
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def fetch_grad_subgroup(fips, year, econ_val):
    """Grad rates for one economic subgroup, holding other dims at 'total' (99)."""
    filt = {
        "race": 99, "sex": 99, "disability": 99, "lep": 99,
        "foster_care": 99, "homeless": 99, "econ_disadvantaged": econ_val,
    }
    if fips:
        filt["fips"] = fips
    rows = http_get_all(f"/schools/edfacts/grad-rates/{year}/", filt, f"grad econ={econ_val}")
    out = {}
    for r in rows:
        g = gi(r.get("grad_rate_midpt"))
        if g is not None:
            out[r["ncessch"]] = (g, r.get("cohort_num"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fips", type=int, default=None, help="State FIPS (e.g. 12=FL). Omit = nationwide.")
    ap.add_argument("--year", type=int, default=GRAD_YEAR_DEFAULT)
    args = ap.parse_args()

    scope = f"FIPS {args.fips}" if args.fips else "NATIONWIDE"
    log(f"Equity gatherer — graduation gap, {scope}, year {args.year}")

    log("  Fetching overall (econ=99) ...")
    overall = fetch_grad_subgroup(args.fips, args.year, 99)
    log("  Fetching economically disadvantaged (econ=1) ...")
    disadv = fetch_grad_subgroup(args.fips, args.year, 1)

    out_dir = os.path.join(os.path.dirname(__file__), "out")
    os.makedirs(out_dir, exist_ok=True)
    fname = os.path.join(out_dir, f"equity_grad_gap_fips{args.fips or 'US'}.csv")

    # The "not disadvantaged" (econ=2) subgroup isn't served, so the equity gap is
    # the school's OVERALL grad rate minus its economically-disadvantaged rate:
    # how far the disadvantaged cohort trails the school's own average.
    ids = set(overall) | set(disadv)
    gaps = []
    with open(fname, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["nces_id", "grad_overall", "grad_disadvantaged",
                    "gap_overall_minus_disadv", "cohort_disadvantaged"])
        for nid in sorted(ids):
            go = overall.get(nid, (None, None))[0]
            gd = disadv.get(nid, (None, None))[0]
            gap = (go - gd) if (go is not None and gd is not None) else None
            if gap is not None:
                gaps.append(gap)
            w.writerow([nid, go, gd, gap, disadv.get(nid, (None, None))[1]])

    # --- Summary stats ---
    log("\n================ EQUITY DATA SUMMARY ================")
    log(f"  Schools with an OVERALL grad rate:            {len(overall)}")
    log(f"  Schools with a DISADVANTAGED grad rate:       {len(disadv)}")
    log(f"  Schools with a computable GAP (both):         {len(gaps)}")
    if gaps:
        gaps_sorted = sorted(gaps)
        n = len(gaps_sorted)
        def pct(p):
            return gaps_sorted[min(n - 1, int(p * n))]
        avg = sum(gaps_sorted) / n
        neg = sum(1 for g in gaps_sorted if g <= 0)
        log(f"  Gap (overall − disadvantaged), percentage points:")
        log(f"     min={gaps_sorted[0]}  p25={pct(0.25)}  median={pct(0.5)}  "
            f"p75={pct(0.75)}  max={gaps_sorted[-1]}  mean={avg:.1f}")
        log(f"  Schools where disadvantaged do as well/better (gap<=0): {neg} "
            f"({100*neg/n:.0f}%)")
    log(f"\n  CSV written: {fname}")
    log("  NOTE: graduation gap is HIGH SCHOOL only; elementary/middle have no")
    log("        free federal subgroup outcome, so they'd have no equity signal.")


if __name__ == "__main__":
    main()
