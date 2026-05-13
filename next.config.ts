import type { NextConfig } from "next";
import path from "node:path";

const emptyEncodingShim = path.join(process.cwd(), "src/shims/empty-encoding.ts");

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "omni.longevipedia.net",
    "horse-battery-staple.omniharness.dev",
  ],
  htmlLimitedBots: /.*/,
  async rewrites() {
    return [
      {
        source: "/session/:runId([0-9a-fA-F]{12}|[0-9a-fA-F-]{36})",
        destination: "/?run=:runId",
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      encoding: emptyEncodingShim,
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias.encoding = emptyEncodingShim;
    return config;
  },
};

export default nextConfig;
