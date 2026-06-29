import { Check, ArrowRight, Sparkles } from "lucide-react";

// Landing promo for the main site: the free School Explorer (this product) on the
// left, the paid full Neighborhood Explorer upsell on the right.

const FULL_INSIGHTS = [
  "Crime & safety", "Market trends", "Walkability", "Commute times",
  "Demographics", "Home values", "Parks", "Dining", "+30 more",
];

export function ExplorerPromo() {
  return (
    <section className="mt-2">
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
            href="https://app.dreamneighborhood.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            Add it to your site — free <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* RIGHT — Neighborhood Explorer (paid upgrade) */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d5c52] via-brand-800 to-brand-700 p-6 text-white shadow-md">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-300/15 blur-3xl"
            aria-hidden
          />
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#d9f99d] ring-1 ring-inset ring-white/15">
            <Sparkles className="h-3.5 w-3.5" /> The full picture
          </span>
          <h3 className="mt-3 text-xl font-extrabold tracking-tight">Neighborhood Explorer</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/85">
            Schools are just the start. Give buyers <strong>38 hyperlocal insights</strong> on every
            listing — and turn your site into the most informative in your market.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {FULL_INSIGHTS.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 ring-1 ring-inset ring-white/10"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <a
              href="https://www.dreamneighborhood.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/40 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Learn more
            </a>
            <a
              href="https://app.dreamneighborhood.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#d9f99d] px-4 py-2 text-sm font-bold text-[#0d5c52] shadow-sm transition hover:bg-[#cded8f]"
            >
              Sign up here <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
