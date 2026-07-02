import { Check, ArrowRight } from "lucide-react";
import { NeighborhoodExplorerCard } from "@/components/NeighborhoodExplorerCard";

// Landing promo for the main site: the free School Explorer (this product) on the
// left, the paid full Neighborhood Explorer upsell on the right.

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
            href="/installation"
            className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            Add it to your site — free <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* RIGHT — Neighborhood Explorer (paid upgrade) */}
        <NeighborhoodExplorerCard />
      </div>
    </section>
  );
}
