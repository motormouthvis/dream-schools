"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { NeighborhoodExplorerCard } from "@/components/NeighborhoodExplorerCard";

// Key value props (mirrors the marketing site's School Explorer card).
const VALUE_PROPS: [string, React.ReactNode][] = [
  ["Save $50–$100/month", <>vs. other school-data tools — ours is <strong>free, forever</strong>.</>],
  ["No website redesign", <>our unique popup technology installs with <strong>one line of code</strong>.</>],
  ["No ads, ever", <>Your brand, on your site. <strong>No Credit Card — Ever.</strong></>],
];

const BENEFITS: [string, string, string][] = [
  ["🔑", "Data no one else has", "Displays critical school data that no one else has."],
  ["💸", "No expensive data fees", "Avoid paying pricey monthly school-data tools — ours is free forever."],
  ["⏱", "Keep buyers on your site", "Rich school data on every listing, so visitors don't leave for Zillow."],
  ["📈", "Stronger SEO", "More time on page and richer local content help listings rank."],
  ["🎓", "Ratings, tests & safety", "Dream Rating, test scores, college readiness & safety, nationwide."],
  ["🧩", "One line of code", "Installs with a single snippet — no website redesign."],
];

export default function DashboardPage() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetch("/api/app/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setConfig(j.config))
      .catch(() => {});
  }, []);

  const domain = config?.allowedHosts?.[0];
  const active = Boolean(domain && config?.enabled);

  return (
    <AppShell active="home">
      {() => (
        <>
          {/* Hero banner — matches the marketing site */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-inset ring-brand-600/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-banner.png"
              alt="A friendly neighborhood with a school and children walking"
              className="h-[200px] w-full object-cover object-right sm:h-[230px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30 sm:via-white/75 sm:to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
              <h1 className="max-w-md text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
                School Explorer
              </h1>
              <p className="mt-1 max-w-[15rem] text-base font-bold leading-snug text-ink-800 sm:max-w-md sm:text-xl">
                Find the Best Schools in Your New Neighborhood
              </p>
              <p className="mt-2 max-w-[17rem] text-xs font-semibold leading-snug text-slate-700 sm:max-w-sm">
                Real ratings, test scores &amp; safety for any address
              </p>
            </div>
          </div>

          {/* Two halves: School Explorer (this product) + Neighborhood Explorer upgrade */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* LEFT — School Explorer value props */}
            <div className="flex flex-col rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-sm">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
                ★ Free forever · no ads - no credit card required
              </span>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">School Explorer</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Put a beautiful school-ratings explorer on every listing — ratings, test scores,
                college readiness &amp; safety, nationwide.
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                {VALUE_PROPS.map(([title, desc], i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      ✓
                    </span>
                    <span>
                      <strong>{title}</strong> — {desc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT — Neighborhood Explorer upgrade CTA */}
            <NeighborhoodExplorerCard />
          </div>

          {/* Benefits grid */}
          <div className="mt-5 text-sm font-bold text-slate-700">Why agents love it</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(([icon, title, desc]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-lg">{icon}</div>
                <div className="mt-1 text-[13px] font-bold text-ink-900">{title}</div>
                <div className="text-[11px] leading-relaxed text-slate-500">{desc}</div>
              </div>
            ))}
          </div>

          {/* Status (half) + link to the marketing website (half) */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div
              className={`flex flex-col justify-center rounded-xl p-4 ring-1 ring-inset ${
                active ? "bg-brand-50 ring-brand-600/15" : "bg-amber-50 ring-amber-500/25"
              }`}
            >
              <div className={`text-sm font-bold ${active ? "text-brand-900" : "text-amber-900"}`}>
                {active ? `● Active on ${domain}` : "Add your website to activate the popup"}
              </div>
              <div className="mt-0.5 text-[12px] text-slate-600">
                {active
                  ? "Free forever · installed."
                  : "The popup stays off until you set an authorized domain."}
              </div>
            </div>

            <a
              href="https://www.dreamneighborhoodschools.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col justify-center rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="text-sm font-bold text-ink-900">See it live on our website →</div>
              <div className="mt-0.5 text-[12px] text-slate-600">
                Explore the public School Explorer at dreamneighborhoodschools.com.
              </div>
            </a>
          </div>

          {/* Coverage + footer — matches the marketing site */}
          <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-slate-400">
            Coverage: ~119k U.S. public &amp; private schools (NCES CCD, CRDC, EDFacts, PSS).
            Private-school data is limited.
          </p>
          <footer className="mx-auto mt-6 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
            <p>© 2026 Dream Neighborhood. All rights reserved.</p>
            <div className="mt-2 flex items-center justify-center gap-5">
              <a
                href="https://docs.google.com/document/d/e/2PACX-1vSndxJR71x1k8uI1vmjOZGYvWfpxM-TJSFuMVXclgzx_h5P1Iey2BdKlY0DDiVPSGTJLn0NMLYKXTB5/pub"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 transition hover:text-brand-700"
              >
                Terms of Service
              </a>
              <a
                href="https://docs.google.com/document/d/e/2PACX-1vREF8QKsVkEpUyWff3FWUU8D4GoS2aRtz67qgCTmMb2uIQcXHjaqgBtJi6OBhUw-uZsqgM5itrsrxFR/pub"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 transition hover:text-brand-700"
              >
                Privacy Policy
              </a>
            </div>
          </footer>
        </>
      )}
    </AppShell>
  );
}
