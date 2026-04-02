import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from "next";
import { APP_BASE_PATH } from './src/lib/app-config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  distDir: 'dist',
  basePath: APP_BASE_PATH,
  experimental: {
    trustHostHeader: true,
  } as NextConfig['experimental'],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
