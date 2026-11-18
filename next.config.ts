import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Don't let `next dev` generate AGENTS.md: its guidance lives in CLAUDE.md.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // The live view of the flagship store is the home page.
    return [{ source: "/", destination: "/stores/mad-granvia", permanent: false }];
  },
};

export default nextConfig;
