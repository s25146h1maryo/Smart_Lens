import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Basic config
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // default, we use drive direct upload for larger
    }
  }
};

export default nextConfig;
