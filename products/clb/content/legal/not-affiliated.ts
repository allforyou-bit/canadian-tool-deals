// /legal/not-affiliated/ — independence and trademark notice. Trademark ownership wording is kept generic
// ("trademarks of their respective owners"): that CELPIP belongs to Paragon Testing Enterprises is prior
// knowledge that was not verified (memo §1.1 "Name rules", §8 item 11).
import { BRAND, NOT_AFFILIATED } from '../../shared/config'
import { PATHS } from '../routes'
import { CONTACT_LINES_EN, LAST_REVIEWED } from '../site'
import type { LegalPage } from '../types'

export const NOT_AFFILIATED_PAGE: LegalPage = {
  path: PATHS.notAffiliated,
  lang: 'en',
  title: 'Not affiliated with any test provider',
  description: `${BRAND.en} is an independent practice tool, not connected with any test provider or government body.`,
  lastReviewed: LAST_REVIEWED,
  lastReviewedLabel: 'Last updated',
  draftComment:
    'DRAFT not-affiliated and trademark notice. The owner must review and approve it before launch (business/online/owner-setup.md). If the test providers publish trademark guidelines, check this wording against them.',
  intro: [{ note: NOT_AFFILIATED.en }],
  sections: [
    {
      id: 'independent',
      heading: 'An independent practice tool',
      blocks: [
        `${BRAND.en} is run by a sole proprietor in Ontario, Canada. We are not connected with any test provider, test centre or government body, and no test provider has reviewed or approved this service.`,
      ],
    },
    {
      id: 'our-tasks',
      heading: 'Our tasks are our own',
      blocks: [
        'We mention the CELPIP-General test only to describe the format our practice tasks are modelled on. We wrote all of our practice prompts ourselves; nothing is copied from any test.',
        "Our timings and word ranges are practice defaults we chose. For current test rules, fees and registration, check the test provider's own website.",
        'Feedback is not a score and does not predict test results.',
      ],
    },
    {
      id: 'trademarks',
      heading: 'Trademarks',
      blocks: [
        'CELPIP and IELTS are trademarks of their respective owners. Other organization names on this site are used only to identify those organizations. Using these names does not mean that any of them endorses or is connected with this service.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [{ ul: CONTACT_LINES_EN }],
    },
  ],
  related: [
    { label: 'Practice task formats', href: PATHS.formats },
    { label: 'Terms of use', href: PATHS.terms },
  ],
}
