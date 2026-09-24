// Structured data as a native <script type="application/ld+json"> (Next.js JSON-LD guide).
import { serializeJsonLd, type JsonLdObject } from '../../content/jsonld'

export function JsonLd({ data }: { data: JsonLdObject }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
