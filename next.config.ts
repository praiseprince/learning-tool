import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the Mac app carries a self-contained server (desktop/bundle.mjs builds with this set)
  ...(process.env.MARGINALIA_STANDALONE ? {output: "standalone" as const} : {}),
  // files read with process.cwd() make the tracer take the whole folder; desktop/bundle.mjs copies the few it needs
  outputFileTracingExcludes: {"*": ["desktop/**", "design/**", "data/**", ".tools/**", ".claude/**", ".agents/**", "tests/**", "evals/**", "scripts/**", "docs/**", "*.md", ".git/**", "package-lock.json", "tsconfig.tsbuildinfo"]},
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
