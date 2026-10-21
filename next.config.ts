import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable image optimization requiring external loader in standalone
  images: {
    unoptimized: true,
  },
  // Expose only non-sensitive env vars to the browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION || "local",
  },
};

export default nextConfig;
