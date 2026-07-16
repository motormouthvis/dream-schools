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
  fadeEdges = false,
}: {
  className?: string;
  /** Override pill styling (defaults match admin lime pills). */
  pillClassName?: string;
  compact?: boolean;
  /** Soft left/right fades so the strip doesn't feel wall-to-wall. */
  fadeEdges?: boolean;
}) {
  const pill =
    pillClassName ||
    (compact
      ? "mr-1.5 shrink-0 rounded-full bg-[#e8f0d4] px-2.5 py-1 text-[10px] font-semibold text-[#3f5a0c]"
      : "mr-1.5 shrink-0 rounded-full bg-lime2-400/25 px-2.5 py-1 text-[11px] font-semibold text-[#49660f] ring-1 ring-inset ring-lime2-500/25");

  return (
    <div className={`relative ${className}`}>
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
      <div className={`space-y-1.5 ${fadeEdges ? "overflow-hidden" : ""}`}>
        {INSIGHT_ROWS.map((row, ri) => (
          <div key={ri} className="dse-insights-marquee">
            <div
              className="dse-insights-marquee-track"
              style={{ animationDuration: `${38 + ri * 7}s` }}
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
      {fadeEdges && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent sm:w-10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:w-10"
          />
        </>
      )}
    </div>
  );
}
