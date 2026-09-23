// Shapes for bilingual site content. Customer-facing text is written in both languages;
// where a legal text differs, the English version governs and the Korean one is a courtesy
// translation.

export type ServiceKey = 'cleaning' | 'gutters' | 'snow'

export interface Bilingual {
  en: string
  ko: string
}

export interface FaqItem {
  id: string
  /** show only when this service is enabled; omit for general questions */
  service?: ServiceKey
  /** show only when the business has / has not bound liability insurance */
  when?: 'insured' | 'notInsured'
  q: Bilingual
  /** plain text; blank lines separate paragraphs */
  a: Bilingual
}

export interface AgreementSection {
  heading: Bilingual
  /** each clause is one paragraph or list item */
  clauses: Bilingual[]
}

export interface Agreement {
  service: ServiceKey
  title: Bilingual
  /** short line under the title, e.g. "Not legal advice — have it reviewed" */
  notice: Bilingual
  sections: AgreementSection[]
  /** fields the customer and owner fill in on the printed copy */
  signatureFields: Bilingual[]
}
