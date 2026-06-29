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
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
