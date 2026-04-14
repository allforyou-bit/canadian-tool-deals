import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i5.walmartimages.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'assets.canadiantire.ca' },
      { protocol: 'https', hostname: 'images.homedepot.ca' },
      { protocol: 'https', hostname: 'www.rona.ca' },
      { protocol: 'https', hostname: 'www.princessauto.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/cache/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
    ]
  },
};

export default nextConfig;
