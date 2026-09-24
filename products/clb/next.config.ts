import type { NextConfig } from 'next'

// Static export served by the Cloudflare Worker's static assets (worker/wrangler.jsonc → ../out).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
