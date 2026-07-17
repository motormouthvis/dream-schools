import Script from "next/script";

/**
 * Loads School Explorer. Listing pages: popup only.
 * Neighborhood pages: pass `withPopup` + render `#dream-schools-explorer` so both mount.
 */
export function SchoolExplorerScript() {
  // Cache-bust so partners/demos pick up SPA mount fixes without a stale CDN/browser cache.
  return <Script src="/embed.js" strategy="afterInteractive" />;
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
