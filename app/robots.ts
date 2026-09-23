import type { MetadataRoute } from 'next'
import { business } from '@/config/business'

export const dynamic = 'force-static'

// No Disallow on purpose: /admin/ and /print/* carry a noindex robots meta, and a crawler only
// sees that meta if it may fetch the page. Blocking them here would let a linked URL (the
// footer links /print/price-sheet/) be indexed without its noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${business.siteUrl}/sitemap.xml`,
  }
}
