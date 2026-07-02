"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { NeighborhoodExplorerCard } from "@/components/NeighborhoodExplorerCard";

// Key value props (mirrors the marketing site's School Explorer card).
const VALUE_PROPS: [string, React.ReactNode][] = [
  ["Save $50–$100/month", <>vs. other school-data tools — ours is <strong>free, forever</strong>.</>],
  ["No website redesign", <>our unique popup technology installs with <strong>one line of code</strong>.</>],
  ["Embedded option too", <>Embedded School Explorer also available — <strong>one line of code</strong>, minimal website redesign.</>],
];

const BENEFITS: [string, string, string][] = [
  ["🔑", "Data no one else has", "Displays critical school data that no one else has."],
  ["💸", "No expensive data fees", "Avoid paying pricey monthly school-data tools — ours is full features and free forever."],
  ["⏱", "Engagement & SEO", "Rich school data on every listing keeps visitors on your site (not Zillow) and boosts local SEO."],
  ["🎓", "Ratings, tests & safety", "Dream Rating, test scores, college readiness & safety, nationwide."],
  ["💬", "Popup", "Zero website redesign — auto-detects the address of the listing or neighborhood page."],
  ["📐", "Embed", "Minimal website design change — exact placement and size, inline in your page."],
];

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [config, setConfig] = useState<any>(null);
  const [usage, setUsage] = useState<{ views: number; firstSeen: string | null; lastSeen: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/app/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setConfig(j.config);
          setUsage(j.usage ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const domain = config?.allowedHosts?.[0];
  const active = Boolean(domain && config?.enabled);
  const firstInstalled = fmtDateTime(usage?.firstSeen);
  const lastActive = fmtDateTime(usage?.lastSeen);

  return (
    <AppShell active="home">
      {(me) => (
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(240px 190px at top left, rgba(180,220,100,0.24), rgba(180,220,100,0) 72%)",
              }}
            />
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
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <a
                  href="https://www.dreamneighborhoodschools.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
                >
                  See it live
                </a>
                <a
                  href="/edit"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
                >
                  Configure
                </a>
              </div>
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

          {/* Status */}
          <div className="mt-5">
            <div
              className={`overflow-hidden rounded-3xl p-5 shadow-sm ring-1 ring-inset ${
                active
                  ? "border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 ring-brand-600/15"
                  : "border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-lime-50 ring-amber-500/25"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={`text-base font-extrabold ${active ? "text-brand-900" : "text-amber-900"}`}>
                    {active
                      ? `Popup or Embedded School Explorer Active on ${domain}`
                      : "Add your website to activate the popup or embed"}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    {active
                      ? "Free forever · installed."
                      : "Both the popup and the embed stay off until you set an authorized domain."}
                  </div>
                </div>
              </div>
              {active && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Account created" value={fmtDateTime(me.createdAt) || "—"} />
                  <Stat label="First installed" value={firstInstalled || "Not detected yet"} />
                  <Stat label="Last accessed" value={lastActive || "Not detected yet"} />
                  <Stat label="Views" value={(usage?.views ?? 0).toLocaleString()} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-ink-900">{value}</div>
    </div>
  );
}
