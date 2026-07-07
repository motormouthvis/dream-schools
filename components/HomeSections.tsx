"use client";

import { Check, ArrowRight, Handshake, Code2, Percent, Award, Search } from "lucide-react";

// Homepage marketing sections. Three audience sections across the page:
//   1. Parents & home buyers - the hero/search (app/page.tsx) + the content block below
//   2. Realtors & Brokerages - the dominant action area (below)
//   3. Website developers & IDX providers - a lighter, secondary card (below)

export function HomeSections({ onSearchNow }: { onSearchNow?: () => void }) {
  return (
    <div className="mt-2 space-y-6">
      {/* Section 1 - Parents & Home Buyers (warm, simple, complete) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
          For parents & home buyers
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          School Explorer - <span className="text-brand-700">Free</span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
          See real school ratings, test scores, college readiness, and safety for any address or
          neighborhood - instantly and free.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Enter any address and get clear, helpful information about nearby schools. No account
          needed. No ads. No catch.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-extrabold text-ink-900">What you&apos;ll see</h3>
            <ul className="mt-2.5 space-y-2">
              {[
                "School ratings and test scores",
                "College readiness information",
                "Safety data",
                "School type, grade levels & distance from the address",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-extrabold text-ink-900">Why families love it</h3>
            <ul className="mt-2.5 space-y-2">
              {[
                "Free forever - no credit card or account required",
                "No ads - just the information you need",
                "Works for any address in the United States",
                "Fast and easy to use",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-ink-900">How it works</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
              Just type in an address or neighborhood name. The School Explorer instantly shows you
              the relevant schools with the information that matters most to families.
            </p>
          </div>
          {onSearchNow && (
            <button
              type="button"
              onClick={onSearchNow}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-lime2-500 px-5 py-2.5 text-sm font-bold text-ink-900 shadow-sm transition hover:bg-lime2-400"
            >
              <Search className="h-4 w-4" /> Search now
            </button>
          )}
        </div>
      </section>

      {/* Section 2 - Realtors & Brokerages (primary action area) */}
      <section
        id="realtors"
        className="scroll-mt-4 overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-md sm:p-8"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
          For realtors & brokerages
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Add Free School Explorer for Every Listing - Installs with 1 Line of Code
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
          One line of code. Zero website redesign. Our unique popup technology puts accurate school
          data on every listing and <strong className="text-ink-900">saves you $100-$800/month</strong>{" "}
          versus GreatSchools or Niche - free forever, no ads, your brand.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [
              "Installs in under 60 seconds",
              "Paste one line once and the Explorer goes live site-wide on any IDX platform or website - no redesign, no maintenance.",
            ],
            [
              "Save $100-$800 per month",
              "Versus our competitors - free forever, no ads, and your brand stays on your site.",
            ],
            [
              "Automatic address detection",
              "The Explorer reads each listing's address right off the page, so the correct nearby schools appear everywhere automatically.",
            ],
            [
              "Keep buyers on your site",
              "Rich school data on every listing keeps buyers with you instead of leaking to Zillow, GreatSchools, and Niche.",
            ],
            [
              "School data on every listing",
              "Ratings, test scores, college readiness, and safety - nationwide, on every property page instantly.",
            ],
            [
              "One-click upgrade path",
              "Buyers can upgrade inside the popup to the full Dream Neighborhood widget - market trends, commute, demographics, walkability, and more.",
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="/installation"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md transition hover:bg-brand-700"
          >
            Add to My Site - Free <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href="https://www.dreamneighborhood.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-brand-600 px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            See Full Widget Upgrade
          </a>
        </div>
        <a
          href="/realtors"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Learn more about School Explorer for realtors <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      {/* Section 3 - Website developers & IDX providers (lighter, secondary card) */}
      <section
        id="partners-teaser"
        className="rounded-3xl border border-brand-200 bg-brand-50/50 p-6 shadow-sm sm:p-7"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
          <Handshake className="h-3.5 w-3.5" /> For website developers & IDX providers
        </span>
        <h3 className="mt-3 max-w-2xl text-lg font-extrabold leading-snug tracking-tight text-ink-900 sm:text-xl">
          Are you a real estate website developer, IDX provider, or PropTech company?
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          White-label the free School Explorer across every client site - and share in the revenue
          when they upgrade. A sticky, competitive edge for your platform at zero cost.
        </p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Handshake, title: "Zero cost to white-label", body: "Free for every client site, no minimums." },
            { Icon: Percent, title: "Up to 40% recurring revenue", body: "On every client upgrade." },
            { Icon: Award, title: "A competitive edge", body: "School data competitors charge for." },
            { Icon: Code2, title: "Easy 1-line install", body: "Push to all client sites at once." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-inset ring-brand-600/10">
              <Icon className="h-4 w-4 text-brand-600" />
              <p className="mt-1.5 text-sm font-bold text-ink-900">{title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{body}</p>
            </div>
          ))}
        </div>

        <a
          href="/partners"
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          See Partnership Details <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
