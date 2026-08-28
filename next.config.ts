import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicit Node.js runtime everywhere (ADR 0001) — no route opts into Edge.
  reactStrictMode: true,
  // Standalone output keeps the production Docker image small (ADR 0007) —
  // only traced runtime files are copied into the final image stage.
  output: "standalone",
  // Next.js 16 no longer runs ESLint as part of `next build` (the option
  // that used to control that was removed from NextConfig) — linting is
  // simply its own explicit CI/local step (`npm run lint`), which is what
  // we want anyway.
  outputFileTracingIncludes: {
    // argon2's native prebuild must survive Next's output file tracing
    // when the app is deployed as a standalone build (Docker image).
    "/**": ["./node_modules/argon2/**"],
  },
};

export default nextConfig;
