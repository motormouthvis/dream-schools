import Script from "next/script";

/**
 * Loads School Explorer.
 * - Listing / popup neighborhood pages: script only (floating popup).
 * - Embed neighborhood pages: also render `#dream-schools-explorer` (no popup).
 */
export function SchoolExplorerScript() {
  // Cache-bust so the demo picks up SPA address-detection fixes without waiting
  // out the CDN/browser cache (embed.js is served with max-age=300).
  return <Script src="/embed.js?v=spa-settle-2" strategy="afterInteractive" />;
}

export function SchoolExplorerEmbed({
  address,
  withPopup = false,
  /** When true, iframe has no outer border/shadow (use when the page already frames it). */
  frameless = false,
}: {
  address: string;
  withPopup?: boolean;
  frameless?: boolean;
}) {
  return (
    <div
      id="dream-schools-explorer"
      data-address={address}
      data-with-popup={withPopup ? "true" : undefined}
      data-frameless={frameless ? "true" : undefined}
      data-max-width="920"
      className="min-h-[540px] w-full"
    />
  );
}
