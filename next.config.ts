import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore ffprobe binary files during build
      config.externals = config.externals || [];
      config.externals.push('@ffprobe-installer/ffprobe');
    }
    return config;
  },
};

export default nextConfig;
