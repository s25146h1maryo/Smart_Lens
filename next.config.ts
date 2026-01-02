import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Basic config
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // default, we use drive direct upload for larger
    }
  },
  async rewrites() {
    return [
      {
        source: '/google9521b8956bb3057c.html',
        destination: '/api/google-verification',
      },
    ];
  },
};

export default nextConfig;
