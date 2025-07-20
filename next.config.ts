import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Only run ESLint on these directories during production builds
    dirs: ['src/app', 'src/components'],
    // Ignore build errors from ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore build errors from TypeScript
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
