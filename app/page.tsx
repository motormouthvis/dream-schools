"use client";

import { useEffect, useState } from "react";
import { SchoolsTab } from "@/components/SchoolsTab";
import type { LookupResult } from "@/lib/types";

const SAMPLE_ADDRESSES = [
  "1500 N 23rd St, Fort Pierce, FL 34950",
  "2901 S 25th St, Fort Pierce, FL 34981",
  "1801 Panther Ln, Fort Pierce, FL 34947",
  "1485 SW Cashmere Blvd, Port St. Lucie, FL 34986",
  "Lennard Rd, Port St. Lucie, FL 34983",
  "Tradition, Port St. Lucie, FL 34987",
];

export default function Home() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("address");
    if (initial) {
      setAddress(initial);
      runLookup(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLookup(query: string) {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setData(null);
      } else {
        setData(json as LookupResult);
      }
    } catch {
      setError("Network error. Is the dev server running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Dream Neighborhood
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Schools</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
          Enter an address to see its school district, an overall quality score, the three-category
          quality index, and nearby schools. Demo coverage: 10 zip codes around 34946 (Fort Pierce /
          St. Lucie County, FL).
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runLookup(address);
        }}
        className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌖
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 1500 N 23rd St, Fort Pierce, FL 34950"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mx-auto mt-3 flex max-w-2xl flex-wrap gap-2">
        <span className="self-center text-xs text-slate-400">Try:</span>
        {SAMPLE_ADDRESSES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAddress(a);
              runLookup(a);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            {a.split(",")[0]} · {a.match(/3\d{4}/)?.[0]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading && (
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow">
            Looking up schools…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && data && <SchoolsTab data={data} />}

        {!loading && !error && !data && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-400">
            Enter an address above or pick a sample to load the Schools tab.
          </div>
        )}
      </div>
    </main>
  );
}
