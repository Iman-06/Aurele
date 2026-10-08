import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Phone on the same Wi-Fi loads the dev server by this LAN address. Without it, Next blocks the dev JS.
  allowedDevOrigins: ["10.251.114.4"],
  experimental: {
    serverActions: {
      // Admin photo uploads are up to 5 MB (checked in src/server/media/storage.ts) + form overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        // Basic hardening for every page and API response.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Admin pages must never be cached by browsers/CDNs or indexed.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
