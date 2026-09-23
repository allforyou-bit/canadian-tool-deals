import type { NextConfig } from 'next'

// Static export: `npm run build` writes plain HTML/CSS/JS to ./out, which any static host
// can serve (Cloudflare Pages Free is the recommended host — see business/08-배포-가이드.md).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
