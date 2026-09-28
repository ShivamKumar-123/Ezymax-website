import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@kalks/ui", "@kalks/mock"],
  devIndicators: false,
  agentRules: false,
  images: { unoptimized: true },
};

export default config;
