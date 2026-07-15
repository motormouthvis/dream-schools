import Script from "next/script";

/**
 * Loads School Explorer. Listing pages: popup only.
 * Neighborhood pages: pass `withPopup` + render `#dream-schools-explorer` so both mount.
 */
export function SchoolExplorerScript() {
  return <Script src="/embed.js" strategy="afterInteractive" />;
}

export function SchoolExplorerEmbed({
  address,
  withPopup = false,
}: {
  address: string;
  withPopup?: boolean;
}) {
  return (
    <div
      id="dream-schools-explorer"
      data-address={address}
      data-with-popup={withPopup ? "true" : undefined}
      data-max-width="1100"
      className="min-h-[640px] w-full"
    />
  );
}
