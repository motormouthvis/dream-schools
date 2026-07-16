import { Sparkles, ArrowRight } from "lucide-react";
import { InsightsMarquee } from "@/components/InsightsMarquee";
import { NEIGHBORHOOD_INSIGHTS } from "@/lib/neighborhoodInsights";

// The paid Neighborhood Explorer upsell card (mirrors the marketing site's
// home page). Shared by the public ExplorerPromo and the account app home.

export function NeighborhoodExplorerCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-sm">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
        <Sparkles className="h-3.5 w-3.5" /> Upgrade · the full picture
      </span>
      <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">Neighborhood Explorer</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Schools are just the start. Give buyers <strong>{NEIGHBORHOOD_INSIGHTS.length} hyperlocal insights</strong> on every
        listing - and turn your site into the most informative in your market.
      </p>
      <InsightsMarquee className="mt-4" />
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
          href="https://app.dreamneighborhood.com/accounts/signup/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Upgrade Now <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
