"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

const SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

const BENEFITS: [string, string, string][] = [
  ["💸", "No expensive data fees", "Avoid paying pricey monthly school-data tools — ours is free forever."],
  ["⏱", "Keep buyers on your site", "Rich school data on every listing, so visitors don't leave for Zillow."],
  ["📈", "Stronger SEO", "More time on page and richer local content help listings rank."],
  ["🎓", "Ratings, tests & safety", "Dream Rating, test scores, college readiness & safety, nationwide."],
  ["🧩", "One line of code", "Installs with a single snippet — no website redesign."],
  ["🚫", "No ads, ever", "Your brand, on your site. No credit card — ever."],
];

export default function DashboardPage() {
  const [config, setConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);

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
      {(me) => (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-ink-900">Your School Explorer</h1>
          </div>

          <div
            className={`mt-4 flex items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-inset ${
              active ? "bg-brand-50 ring-brand-600/15" : "bg-amber-50 ring-amber-500/25"
            }`}
          >
            <div className="min-w-0">
              <div className={`text-sm font-bold ${active ? "text-brand-900" : "text-amber-900"}`}>
                {active ? `● Active on ${domain}` : "Add your website to activate the popup"}
              </div>
              <div className="mt-0.5 text-[12px] text-slate-600">
                {active ? "Free forever · installed." : "The popup stays off until you set an authorized domain."}
              </div>
            </div>
            <a
              href="/edit"
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Edit School Explorer →
            </a>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">One-line install</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-900 px-3 py-2 text-[12px] text-slate-100">
                {SNIPPET}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(SNIPPET);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Paste before &lt;/body&gt; on every page.</p>
          </div>

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
        </>
      )}
    </AppShell>
  );
}
