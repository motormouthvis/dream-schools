/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // The chrome-less explorer is meant to be embedded in an iframe on
        // partner sites, so it must allow framing by any origin. Access is
        // gated by per-host config, not by frame-ancestors.
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // The one-line SDK is loaded cross-origin from partner sites.
        // Browser caches 5 min; a CDN (see docs/SCALING.md) can hold it 10 min
        // and serve stale for a day while revalidating, so the origin dyno sees
        // very few embed.js requests even across many partner sites.
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // The address detector, which embed.js pulls in with a dynamic import
        // from whatever site it is running on — always cross-origin, since the
        // whole point is that it runs on the realtor's page. A module import
        // without this header fails, and it fails into our own reader, so the
        // symptom is not an error but the old answers coming back.
        //
        // Cached hard: it is versioned in lockstep with DN and changes rarely.
        source: "/address-detector/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
