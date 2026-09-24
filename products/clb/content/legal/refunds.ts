// /legal/refunds/ — draft refund policy (memo §1.1 "Refunds", B6): self-serve within REFUND_POLICY.withinDays
// days if at most REFUND_POLICY.maxGradedTasksUsed tasks were used, once per email and per card fingerprint;
// automatic refunds for purchases from outside Canada or from Quebec (and for any non-card payment); disputes
// end the pass; a refund of unused days ends the pass (owner refunds carry end_pass=true, owner-setup.md).
// The page date is TERMS_VERSION, shared with the terms: buyers agree to both at checkout.
import { BRAND, TERMS_VERSION } from '../../shared/config'
import { PATHS } from '../routes'
import { CONTACT_LINES_EN, FACTS, PAUSE_EXTENSION } from '../site'
import type { LegalPage } from '../types'

export const REFUNDS: LegalPage = {
  path: PATHS.refunds,
  lang: 'en',
  title: 'Refund policy',
  description: `When and how you can get a refund for a ${BRAND.en} pass, automatic refunds, and payment disputes.`,
  lastReviewed: TERMS_VERSION,
  lastReviewedLabel: 'Last updated',
  draftComment:
    'DRAFT refund policy. The owner must review and approve it before launch (business/online/owner-setup.md). Keep it in step with worker/src/billing (refund rules) and shared/config.ts REFUND_POLICY. The date at the top is TERMS_VERSION in shared/config.ts; bump it whenever this policy or the terms change.',
  intro: [
    'Passes are one-time purchases with no automatic renewal, so there is nothing to cancel. If a pass is not right for you, this policy explains how to get your money back.',
    `When you buy a pass, you agree to this policy and our [terms of use](${PATHS.terms}) in the version dated at the top of this page.`,
  ],
  sections: [
    {
      id: 'self-serve',
      heading: 'Self-serve refund',
      blocks: [
        'You can get a full refund of your most recent pass if all of these are true:',
        {
          ul: [
            `you ask within ${FACTS.refundDays} days of buying the pass;`,
            `you have used ${FACTS.refundMaxTasks} or fewer tasks with feedback since you bought it (free tasks and requests we could not give feedback on do not count); and`,
            'you have not had a self-serve refund before. Self-serve refunds are available once per person (email address) and once per payment card.',
          ],
        },
      ],
    },
    {
      id: 'how',
      heading: 'How to request a refund',
      blocks: [
        {
          ol: [
            `Sign in and open your [account page](${PATHS.account}).`,
            'Choose "Request a refund" and confirm.',
            'We refund the full price to the card you paid with, through Stripe, and email you a confirmation. Your pass ends as soon as the refund is made.',
          ],
        },
        'How long the money takes to appear on your statement depends on your bank.',
      ],
    },
    {
      id: 'automatic',
      heading: 'Automatic refunds for purchases outside our sales area',
      blocks: [
        'Passes are sold only to residents of Canada outside Quebec who pay with a card issued in Canada. After each payment we check the billing address and the country where the card was issued. If the billing address is outside Canada or in Quebec, the card was issued outside Canada, or the payment was not made by card, we do not activate the pass, we refund the full payment automatically and we email you to let you know.',
      ],
    },
    {
      id: 'other',
      heading: 'Other situations',
      blocks: [
        {
          ul: [
            'If you were charged twice, or something else went wrong with a payment, contact us through the support form on your account page and we will look into it.',
            PAUSE_EXTENSION.en,
            'If we stop offering the service, we refund the unused days of active passes, calculated day by day. If we lower the fair-use limits while your pass is active, you can ask for the same kind of refund.',
            'A refund of the unused days of a pass is a partial refund to the card you paid with. The pass ends when the refund is made.',
            'We consider any other refund request on its own merits.',
          ],
        },
      ],
    },
    {
      id: 'disputes',
      heading: 'Payment disputes (chargebacks)',
      blocks: [
        'If you think a charge is wrong, please contact us before you dispute it with your bank.',
        'If a dispute is opened, the pass paid for by that payment ends straight away. We may share information about the purchase and how the pass was used with Stripe to respond to the dispute.',
      ],
    },
    {
      id: 'rights',
      heading: 'Your legal rights',
      blocks: ['This policy does not limit any right you have under consumer protection laws that apply to you.'],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [{ ul: CONTACT_LINES_EN }],
    },
  ],
  related: [
    { label: 'Pricing', href: PATHS.pricing },
    { label: 'Terms of use', href: PATHS.terms },
    { label: 'Passes and refunds help', href: PATHS.helpPasses },
  ],
}
