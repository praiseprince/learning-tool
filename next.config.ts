import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // files shared in the chat travel in the message (up to 6 files of 20 MB, see lib/chat/file-types.ts)
  experimental: { serverActions: { bodySizeLimit: "125mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
