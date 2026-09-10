import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → tiny self-contained server bundle for Docker/VPS deploys
  output: "standalone",
};

export default nextConfig;
