"use client";

import { INSIGHT_ROWS } from "@/lib/neighborhoodInsights";

/**
 * Three-row horizontal marquee of all 38 Neighborhood Explorer insights.
 * Matches the admin-panel upsell card motion (right → left, staggered speeds).
 */
export function InsightsMarquee({
  className = "",
  pillClassName,
  compact = false,
}: {
  className?: string;
  /** Override pill styling (defaults match admin lime pills). */
  pillClassName?: string;
  compact?: boolean;
}) {
  const pill =
    pillClassName ||
    (compact
      ? "mr-1.5 shrink-0 rounded-full bg-lime2-400/30 px-2 py-0.5 text-[10px] font-semibold text-[#3f5a0c] ring-1 ring-inset ring-lime2-500/30"
      : "mr-1.5 shrink-0 rounded-full bg-lime2-400/25 px-2.5 py-1 text-[11px] font-semibold text-[#49660f] ring-1 ring-inset ring-lime2-500/25");

  return (
    <div className={`space-y-1.5 ${className}`}>
      <style>{`
        @keyframes dse-insights-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .dse-insights-marquee { overflow: hidden; }
        .dse-insights-marquee-track {
          display: inline-flex;
          white-space: nowrap;
          animation: dse-insights-marquee linear infinite;
          will-change: transform;
        }
        .dse-insights-marquee:hover .dse-insights-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .dse-insights-marquee-track { animation: none !important; }
        }
      `}</style>
      {INSIGHT_ROWS.map((row, ri) => (
        <div key={ri} className="dse-insights-marquee">
          <div
            className="dse-insights-marquee-track"
            style={{ animationDuration: `${42 + ri * 8}s` }}
          >
            {[...row, ...row].map((t, i) => (
              <span key={`${t}-${i}`} className={pill}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
