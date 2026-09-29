import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Admin photo uploads are up to 5 MB (checked in src/server/media/storage.ts) + form overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
