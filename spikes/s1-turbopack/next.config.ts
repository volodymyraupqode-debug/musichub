import type { NextConfig } from 'next';

// Spike S1: default Next.js 16 build (Turbopack), no webpack plugin (ADR-0004).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
