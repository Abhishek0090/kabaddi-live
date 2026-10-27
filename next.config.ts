import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser talks to Supabase directly (live updates, saving taps), so it
  // needs these two. `env` copies them into the bundle at build time, which is
  // what a NEXT_PUBLIC_ prefix would do. Both are public by design: the
  // publishable key only allows what the RLS policies allow. Never add the
  // Supabase secret key here.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
