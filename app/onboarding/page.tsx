"use client";

import { useEffect, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";

export default function OnboardingPage() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (!j.user) window.location.href = "/login";
        else setReady(true);
      })
      .catch(() => window.location.href = "/login");
  }, []);

  async function save(skip: boolean) {
    setError(null);
    if (skip) {
      window.location.href = "/dashboard";
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/app/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizedDomain: domain }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not save.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2">
          <SchoolhouseMark className="h-7 w-7 rounded" />
          <span className="font-extrabold text-brand-700">Dream Neighborhood Schools</span>
        </div>
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15">
          ✓ Email verified — you&apos;re in!
        </div>
        <h1 className="mt-4 text-lg font-extrabold text-ink-900">Add your website</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          The School Explorer only turns on for a website you authorize.
        </p>

        <label className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-600">
          Enter your base URL
          <span className="relative">
            <button
              type="button"
              aria-label="Why the base URL?"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold text-white"
            >
              i
            </button>
            {showInfo && (
              <span className="absolute left-0 top-5 z-10 w-64 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] font-normal leading-relaxed text-slate-600 shadow-xl">
                Enter just your base domain (e.g. <strong>youragency.com</strong>). The popup/embed
                automatically works on <strong>all variations</strong> — www, subdomains, and every
                page/listing on that site.
              </span>
            )}
          </span>
        </label>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="youragency.com"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={busy || !domain.trim()}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "…" : "Save & continue →"}
          </button>
          <button
            onClick={() => save(true)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Skip for now
          </button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          You can add or change this anytime. Until a domain is set, the popup stays off.
        </p>
      </div>
    </main>
  );
}
