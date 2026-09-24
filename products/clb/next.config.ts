import type { NextConfig } from 'next'

// Static export served by the Cloudflare Worker's static assets (worker/wrangler.jsonc → ../out).
// No route handlers, cookies(), server actions or proxy: every /api call goes to the Worker.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // products/clb has its own lockfile inside the repo; pin the root so the parent lockfile is ignored
  turbopack: { root: __dirname },
}

export default nextConfig
