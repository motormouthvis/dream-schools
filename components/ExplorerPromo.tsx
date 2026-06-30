import { Check, ArrowRight, Sparkles } from "lucide-react";

// Landing promo for the main site: the free School Explorer (this product) on the
// left, the paid full Neighborhood Explorer upsell on the right.

// The 38 hyperlocal insights in the full Neighborhood Explorer (labels shortened
// from dreamneighborhood.com's data section). Shown as a 3-row right-to-left marquee.
const FULL_INSIGHTS = [
  "Neighborhood Map", "Median Home Price", "Median Rent", "Price / Sq Ft",
  "Housing Inventory", "Days on Market", "Home Price Trend", "Homeownership Rate",
  "High-Density Housing %", "Mobile Homes %", "Household Income", "Per Capita Income",
  "Employment Rate", "HS Graduation Rate", "College Degree %", "Neighborhood Population",
  "City Population", "Median Age", "% Under 18", "Gender Mix", "% Born in USA",
  "English Fluency", "Walk Score", "Bike Score", "Commute Calculator",
  "Drive Commute Times", "Transit Commute Times", "Walk Commute Times",
  "Bike Commute Times", "Schools", "Grocery Stores", "Restaurants", "Shopping Centers",
  "Cafes", "Nightlife", "Gyms", "Parks", "Hospitals",
];

// Split the 38 insights across three rows.
const ROWS = [
  FULL_INSIGHTS.filter((_, i) => i % 3 === 0),
  FULL_INSIGHTS.filter((_, i) => i % 3 === 1),
  FULL_INSIGHTS.filter((_, i) => i % 3 === 2),
];

export function ExplorerPromo() {
  return (
    <section className="mt-2">
      <style>{`
        @keyframes promo-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .promo-marquee { overflow: hidden; }
        .promo-marquee-track { display: inline-flex; white-space: nowrap; animation: promo-marquee linear infinite; }
        .promo-marquee:hover .promo-marquee-track { animation-play-state: paused; }
      `}</style>
      <div className="grid gap-4 md:grid-cols-2">
        {/* LEFT — School Explorer (free) */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-sm">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
            ★ Free forever · no ads
          </span>
          <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">
            School Explorer
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Put a beautiful school-ratings explorer on every listing — ratings, test scores,
            college readiness &amp; safety, nationwide.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>Save $50–$100/month</strong> vs. other school-data tools — ours is free,
                forever.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>No website redesign</strong> — our unique popup technology installs with one
                line of code.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>No ads, ever. Your brand, on your site.</span>
            </li>
          </ul>
          <a
            href="/installation"
            className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            Add it to your site — free <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* RIGHT — Neighborhood Explorer (paid upgrade) */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-sm">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
            <Sparkles className="h-3.5 w-3.5" /> Upgrade · the full picture
          </span>
          <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">
            Neighborhood Explorer
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Schools are just the start. Give buyers <strong>38 hyperlocal insights</strong> on every
            listing — and turn your site into the most informative in your market.
          </p>
          {/* 38 insights — three rows, scrolling right-to-left */}
          <div className="mt-4 space-y-1.5">
            {ROWS.map((row, ri) => (
              <div key={ri} className="promo-marquee">
                <div
                  className="promo-marquee-track"
                  style={{ animationDuration: `${48 + ri * 6}s` }}
                >
                  {[...row, ...row].map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="mr-1.5 shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <a
              href="https://www.dreamneighborhood.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
            >
              Learn more
            </a>
            <a
              href="https://app.dreamneighborhood.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Sign up here <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
