import type { NextConfig } from "next";
import { STORE_IDS } from "./lib/domain/catalog";
import { ALL_STORES, DEFAULT_STORE, DEFAULT_VIEW, VIEWS, viewHref } from "./lib/nav";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Don't let `next dev` generate AGENTS.md: its guidance lives in CLAUDE.md.
  agentRules: false,
  // Bottom-right is where the assistant's message box sits.
  devIndicators: { position: "bottom-left" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    const scopes = [ALL_STORES, ...STORE_IDS].join("|");
    const singleStoreViews = VIEWS.filter((v) => !v.allStores)
      .map((v) => v.id)
      .join("|");
    return [
      // The live view of the flagship store is the home page.
      { source: "/", destination: viewHref(DEFAULT_STORE, DEFAULT_VIEW), permanent: false },
      // A bare scope opens its default view.
      { source: `/:scope(${scopes})`, destination: `/:scope/${DEFAULT_VIEW}`, permanent: false },
      // Views that need one store can't show the whole chain.
      {
        source: `/${ALL_STORES}/:view(${singleStoreViews})`,
        destination: `/${DEFAULT_STORE}/:view`,
        permanent: false,
      },
      // Old live-view URLs.
      { source: "/stores/:store", destination: `/:store/${DEFAULT_VIEW}`, permanent: true },
    ];
  },
};

export default nextConfig;
