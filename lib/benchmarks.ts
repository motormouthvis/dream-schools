import { getPool, hasDatabase } from "@/lib/db";

// National + per-state averages for key metrics, so a school can be compared
// against its state and the nation. Computed once and cached for the process
// lifetime (the dataset is static between reloads).

export interface MetricBench {
  testRead: number | null;
  testMath: number | null;
  gradRate: number | null;
  violentPer100: number | null;
  suspensionsPer100: number | null;
}

export interface Benchmarks {
  national: MetricBench;
  byState: Record<string, MetricBench>;
}

let cache: Benchmarks | null = null;
let inflight: Promise<Benchmarks> | null = null;

const EMPTY: MetricBench = {
  testRead: null,
  testMath: null,
  gradRate: null,
  violentPer100: null,
  suspensionsPer100: null,
};

async function compute(): Promise<Benchmarks> {
  const pool = getPool();
  const byState: Record<string, MetricBench> = {};
  const ensure = (st: string) => (byState[st] ??= { ...EMPTY });

  // Test scores + (by state) from schools
  const tests = await pool.query(
    `select state,
            round(avg(test_read_prof)) as tr,
            round(avg(test_math_prof)) as tm
       from schools
      where level <> 'private' and state is not null
      group by state`
  );
  for (const r of tests.rows) {
    const m = ensure(r.state);
    m.testRead = r.tr != null ? Number(r.tr) : null;
    m.testMath = r.tm != null ? Number(r.tm) : null;
  }

  // Graduation by state
  const grad = await pool.query(
    `select s.state, round(avg(g.grad_rate_4yr)) as gr
       from school_graduation g join schools s on s.nces_id = g.nces_id
      where s.state is not null
      group by s.state`
  );
  for (const r of grad.rows) ensure(r.state).gradRate = r.gr != null ? Number(r.gr) : null;

  // Safety per-100 by state
  const safety = await pool.query(
    `select s.state,
            round(100.0 * sum(sf.violent_incidents_total) / nullif(sum(s.enrollment),0), 1) as vp,
            round(100.0 * sum(sf.out_of_school_suspensions) / nullif(sum(s.enrollment),0), 1) as sp
       from schools s join school_safety sf on sf.nces_id = s.nces_id
      where s.state is not null
      group by s.state`
  );
  for (const r of safety.rows) {
    const m = ensure(r.state);
    m.violentPer100 = r.vp != null ? Number(r.vp) : null;
    m.suspensionsPer100 = r.sp != null ? Number(r.sp) : null;
  }

  // National
  const nt = await pool.query(
    `select round(avg(test_read_prof)) tr, round(avg(test_math_prof)) tm
       from schools where level <> 'private'`
  );
  const ng = await pool.query(`select round(avg(grad_rate_4yr)) gr from school_graduation`);
  const ns = await pool.query(
    `select round(100.0 * sum(sf.violent_incidents_total) / nullif(sum(s.enrollment),0), 1) vp,
            round(100.0 * sum(sf.out_of_school_suspensions) / nullif(sum(s.enrollment),0), 1) sp
       from schools s join school_safety sf on sf.nces_id = s.nces_id`
  );
  const national: MetricBench = {
    testRead: nt.rows[0]?.tr != null ? Number(nt.rows[0].tr) : null,
    testMath: nt.rows[0]?.tm != null ? Number(nt.rows[0].tm) : null,
    gradRate: ng.rows[0]?.gr != null ? Number(ng.rows[0].gr) : null,
    violentPer100: ns.rows[0]?.vp != null ? Number(ns.rows[0].vp) : null,
    suspensionsPer100: ns.rows[0]?.sp != null ? Number(ns.rows[0].sp) : null,
  };

  return { national, byState };
}

export async function getBenchmarks(): Promise<Benchmarks | null> {
  if (!hasDatabase()) return null;
  if (cache) return cache;
  if (!inflight) {
    inflight = compute()
      .then((b) => {
        cache = b;
        return b;
      })
      .catch(() => ({ national: EMPTY, byState: {} }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
