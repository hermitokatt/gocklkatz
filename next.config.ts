import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portfolio does not need to advertise its server stack in every response header.
  poweredByHeader: false,
};

export default nextConfig;
