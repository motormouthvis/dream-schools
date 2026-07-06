"use client";

import { Check, ArrowRight, ArrowUp } from "lucide-react";

// Homepage marketing sections for three audiences. Parents are served primarily
// by the hero search bar (so this Parents band has no redundant search button);
// Realtors & Brokerages is the dominant action area; Revenue-share Partners is a
// visible-but-secondary card.

export function HomeSections({ onSearchNow }: { onSearchNow?: () => void }) {
  return (
    <div className="mt-2 space-y-6">
      {/* Section 1 — Parents & Home Buyers (clean; the hero search bar is the CTA) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
              For parents & home buyers
            </span>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900">
              Check Schools in Any Neighborhood — Free
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Enter any U.S. address above to see nearby schools with ratings, test scores, college
              readiness, and safety. No account, no cost, no ads.
            </p>
          </div>
          <button
            type="button"
            onClick={onSearchNow}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:self-center"
          >
            <ArrowUp className="h-4 w-4" /> Search an address
          </button>
        </div>
      </section>

      {/* Section 2 — Realtors & Brokerages (dominant action area) */}
      <section id="realtors" className="scroll-mt-4 overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-md sm:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
          For realtors & brokerages
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Free School Explorer for Every Listing — Installs with 1 Line of Code
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
          Stop paying expensive monthly fees to GreatSchools or Niche for school data that lives off
          your site.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [
              "One line of code",
              "Zero website redesign required. Our unique popup technology installs site-wide in under 60 seconds on any IDX platform or website.",
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
            <li key={title} className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3 ring-1 ring-inset ring-brand-600/10">
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
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-extrabold text-white shadow-md transition hover:bg-brand-700"
          >
            Add to My Site — Free <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href="https://www.dreamneighborhood.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-brand-600 px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            See Full Widget Upgrade
          </a>
        </div>
      </section>

      {/* Section 3 — Revenue Share Partners (visible but clearly secondary) */}
      <section id="partners-teaser" className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
              For website developers & IDX providers
            </span>
            <h3 className="mt-2 text-base font-extrabold leading-snug text-ink-900">
              Are you a Real Estate Website Developer, an IDX provider or a Real Estate Technology
              Company? Learn how we can partner with you with our unique revenue share model.
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              White-label the free School Explorer for your clients at zero cost. Earn up to 40%
              recurring revenue when they upgrade to the full paid widget.
            </p>
          </div>
          <a
            href="/partners"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow-sm ring-1 ring-inset ring-brand-600/20 transition hover:bg-brand-50"
          >
            Learn More <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
