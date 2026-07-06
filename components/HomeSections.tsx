"use client";

import { Check, ArrowRight, Handshake, Code2, Percent } from "lucide-react";

// Homepage marketing sections. There are three sections total across the page:
//   1. Hero image + search (the Parents / home-buyer experience) — lives in app/page.tsx
//   2. Realtors & Brokerages — the dominant action area (below)
//   3. Revenue-share Partners — a polished, visually distinct panel (below)

export function HomeSections() {
  return (
    <div className="mt-2 space-y-6">
      {/* Section 2 — Realtors & Brokerages (dominant action area) */}
      <section
        id="realtors"
        className="scroll-mt-4 overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-md sm:p-8"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
          For realtors & brokerages
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Add Free School Explorer for Every Listing — Installs with 1 Line of Code
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
          Stop paying expensive monthly fees to GreatSchools or Niche for school data that lives off
          your site.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [
              "One line of code, site-wide",
              "Zero redesign. Paste one line once and the Explorer goes live on every page in under 60 seconds — on any IDX platform or website.",
            ],
            [
              "Automatic address detection",
              "The Explorer reads each listing's address right off the page, so the correct nearby schools show up everywhere automatically — no per-page setup.",
            ],
            [
              "Save $100–$800 per month",
              "Versus our competitors — free forever, no ads, and your brand stays on your site.",
            ],
            [
              "School data on every listing",
              "Put accurate school ratings, test scores, college readiness, and safety on every listing instantly.",
            ],
            [
              "Keep buyers on your site",
              "Stop leaking traffic to Zillow, GreatSchools, and Niche.",
            ],
            [
              "One-click upgrade path",
              "Buyers can upgrade inside the popup to the full Dream Neighborhood widget — market trends, commute times, demographics, crime links, walkability, and more.",
            ],
          ].map(([title, body]) => (
            <li
              key={title}
              className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3 ring-1 ring-inset ring-brand-600/10"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span className="text-sm text-slate-700">
                <strong className="text-ink-900">{title}.</strong> {body}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <a
            href="/realtors"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md transition hover:bg-brand-700"
          >
            Learn More <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Section 3 — Revenue Share Partners (distinct, polished dark panel) */}
      <section
        id="partners-teaser"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-brand-900 to-brand-800 p-6 shadow-lg sm:p-8"
      >
        {/* Soft brand glow in the corner for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(132,204,22,0.25), rgba(132,204,22,0) 70%)" }}
        />
        <div className="relative">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-lime2-400 ring-1 ring-inset ring-white/15">
            <Handshake className="h-3.5 w-3.5" /> For website developers & IDX providers
          </span>
          <h3 className="mt-3 max-w-2xl text-xl font-extrabold leading-snug tracking-tight text-white sm:text-2xl">
            Are you a real estate website developer, IDX provider, or PropTech company?
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-100">
            White-label the free School Explorer for every client site at zero cost — and earn up to{" "}
            <strong className="font-bold text-white">40% recurring revenue</strong> when they upgrade
            to the full paid widget. It&apos;s our unique revenue-share model.
          </p>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            {[
              { Icon: Code2, title: "1-line install", body: "Works with any IDX or website." },
              { Icon: Percent, title: "Up to 40% recurring", body: "Ongoing revenue on every upgrade." },
              { Icon: Handshake, title: "Zero cost, zero minimums", body: "Free to white-label for all clients." },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10"
              >
                <Icon className="h-4 w-4 text-lime2-400" />
                <p className="mt-1.5 text-sm font-bold text-white">{title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-brand-100/80">{body}</p>
              </div>
            ))}
          </div>

          <a
            href="/partners"
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-lime2-500 px-6 py-3 text-sm font-extrabold text-ink-900 shadow-md transition hover:bg-lime2-400"
          >
            Learn More <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
