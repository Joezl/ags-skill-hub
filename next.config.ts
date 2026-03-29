import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: 'dist',
  basePath: '/skill-hub',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
