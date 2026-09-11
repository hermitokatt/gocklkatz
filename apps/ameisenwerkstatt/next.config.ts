import type { NextConfig } from "next";

// This app lives inside a monorepo that also has a root lockfile. Next infers its workspace
// root by walking up for lockfiles, finds the repository root as well, and picks that — which
// changes where it resolves and traces files from. The app is self-contained by design, so the
// root is pinned to this directory rather than left to inference.
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
