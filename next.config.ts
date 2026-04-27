import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["omni.longevipedia.net"],
  htmlLimitedBots: /.*/,
  async rewrites() {
    return [
      {
        source: "/session/:runId([0-9a-fA-F-]{36})",
        destination: "/?run=:runId",
      },
    ];
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
