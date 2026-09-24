// /legal/terms/ — draft terms of use for a sole proprietor in Ontario selling one-time passes to adults in
// Canada outside Quebec (memo §1.1, §1.4, B6, B10). The IRPA s.91 paraphrase was checked against
// justicecanada/laws-lois-xml eng/acts/I-2.5.xml (current to 2026-03-31, fetched 2026-09-24): only lawyers
// and other members of a provincial law society (including paralegals), Chambre des notaires du Québec
// members and members of the College of Immigration and Citizenship Consultants may represent or advise
// for consideration. Consumer-protection rules for Ontario (CPA 2023) were NOT verified; the text avoids
// relying on them and preserves any rights that cannot be waived. Must be reviewed before launch.
// The page date is TERMS_VERSION (shared/config.ts): BuyPass sends it with every checkout and the Worker
// stores it on the purchase, so any change to these terms or the refund policy must bump TERMS_VERSION.
// Zero-capital launch (memo §7.2): the seller is the owner's legal name (Z5), accounts use Google sign-in (Z3),
// no email goes to learners, so notices appear on the site and the account page (Z4), speaking feedback can close
// for the day at the shared capacity (Z2), and practice without feedback is free (Z9).
import { BRAND, NOT_AFFILIATED, TERMS_VERSION } from '../../shared/config'
import { SPEAKING_TASKS, WRITING_TASKS } from '../../shared/tasks'
import { PATHS } from '../routes'
import {
  CONTACT_LINES_EN,
  DAILY_RESET_EN,
  FACTS,
  GOOGLE_SIGN_IN,
  legalNameText,
  NO_FEEDBACK_LIMIT,
  NO_LEARNER_EMAIL,
  PAUSE_EXTENSION,
  PRACTICE_MODE,
  QUEBEC_RULE,
  SELLER,
  SPEAKING_CAPACITY,
} from '../site'
import type { LegalPage } from '../types'

export const TERMS: LegalPage = {
  path: PATHS.terms,
  lang: 'en',
  title: 'Terms of use',
  description: `The terms for using ${BRAND.en} and buying a pass: eligibility, passes, fair use, AI feedback, refunds and liability.`,
  lastReviewed: TERMS_VERSION,
  lastReviewedLabel: 'Last updated',
  draftComment:
    'DRAFT terms of use. Must be reviewed (ideally by an Ontario lawyer) and approved by the owner before launch; see business/online/owner-setup.md. Ontario Consumer Protection Act, 2023 rules for online agreements were not verified; check the notice period for changes, the liability cap and the dispute clause against them. The date at the top is TERMS_VERSION in shared/config.ts; bump it whenever these terms or the refund policy change. [미확인] Ontario Business Names Act: whether selling under the product title, with the owner\'s legal name shown as the seller, avoids registering the product title as a business name. The owner asks ServiceOntario (a free call) before launch. [미확인] Ontario consumer rules on delivering a copy of an online agreement: the site sends no email, so check whether the account page and this page are enough.',
  intro: [
    `${SELLER.en} These terms are an agreement between you and ${legalNameText} ("we", "us"). They apply when you use the website, the free practice tasks or a pass you buy. Our [privacy policy](${PATHS.privacy}), [refund policy](${PATHS.refunds}) and [AI disclosure](${PATHS.aiDisclosure}) are part of these terms. By using the service you agree to these terms; if you do not agree, please do not use it. When you buy a pass, you agree to these terms and our refund policy, as shown next to the buy button, and we record the version (the date at the top of this page) with your purchase.`,
  ],
  sections: [
    {
      id: 'eligibility',
      heading: '1. Who can use the service',
      blocks: [
        {
          ul: [
            'You must be at least 18 years old.',
            'The service is designed for adults who live in Canada. You can use the free tasks from anywhere.',
            `Passes are sold only to residents of Canada outside Quebec who pay with a card issued in Canada (see section 5). ${QUEBEC_RULE.en}`,
          ],
        },
      ],
    },
    {
      id: 'service',
      heading: '2. What the service is, and what it is not',
      blocks: [
        `${BRAND.en} gives AI-generated feedback on English writing and speaking practice tasks: ${WRITING_TASKS.length} writing and ${SPEAKING_TASKS.length} speaking task types. The tasks are modelled on the format of the CELPIP-General test, but we wrote all prompts ourselves, and our timings are practice defaults we chose.`,
        NOT_AFFILIATED.en,
        'Feedback is not a score and does not predict test results.',
        'We do not guarantee any test result.',
        '**No immigration or legal advice.** We do not give immigration or legal advice, and the service declines questions about immigration applications, eligibility or the law. In Canada, section 91 of the Immigration and Refugee Protection Act allows only the following people, with limited exceptions, to represent or advise others for a fee in connection with an immigration application or proceeding: lawyers and paralegals who are members in good standing of a provincial law society, notaries who are members in good standing of the Chambre des notaires du Québec, and members in good standing of the College of Immigration and Citizenship Consultants (CICC). For immigration advice, contact a licensed immigration consultant or a lawyer.',
      ],
    },
    {
      id: 'accounts',
      heading: '3. Your account',
      blocks: [
        {
          ul: [
            `You sign in with your Google account, so you need one to create an account. ${GOOGLE_SIGN_IN.en} Anyone who can use your Google account can sign in to your account here, so keep your Google account secure.`,
            'One account is for one person. Use a Google account that belongs to you, and do not share your account or pass with anyone else.',
            'You are responsible for what happens in your account. Tell us promptly if you think someone else has used it.',
          ],
        },
      ],
    },
    {
      id: 'free',
      heading: '4. Free tasks',
      blocks: [
        `We offer ${FACTS.freeWriting} free writing task with feedback without an account and ${FACTS.freeSpeaking} free speaking task with feedback after you sign in with Google. We may limit, pause or end free tasks at any time, for example to prevent abuse or to control costs.`,
        `You can also practise any task without feedback ("${PRACTICE_MODE.label.en}"), free and without an account. This mode uses no AI. ${PRACTICE_MODE.audio.en}`,
      ],
    },
    {
      id: 'passes',
      heading: '5. Passes and payment',
      blocks: [
        {
          ul: [
            `A pass gives you feedback on practice tasks for ${FACTS.days.pass30} or ${FACTS.days.pass90} days, starting when your payment is confirmed. If you buy a pass while another is active, the new days are added after the current pass ends.`,
            `Prices are in Canadian dollars and are shown on the [pricing page](${PATHS.pricing}). You pay once. Passes are not subscriptions and do not renew automatically; we never charge your card again unless you buy another pass.`,
            'You pay by card on the secure checkout page of our payment processor, Stripe. We do not accept other payment methods. We never receive or store your full card number.',
            NO_LEARNER_EMAIL.en,
            'When you buy, you confirm that you live in Canada outside Quebec. After payment we check the billing address and the country where your card was issued. If the billing address is outside Canada or in Quebec, the card was issued outside Canada, or the payment was not made by card, we do not activate the pass and we refund the full payment automatically.',
            PAUSE_EXTENSION.en,
            'We may change prices for future purchases. A price change never affects a pass you have already bought.',
          ],
        },
      ],
    },
    {
      id: 'fair-use',
      heading: '6. Fair use',
      blocks: [
        `Each account can get feedback on up to ${FACTS.writingPerDay} writing tasks and ${FACTS.speakingPerDay} speaking tasks per day, and up to ${FACTS.gradedPer30Days} tasks in any 30 days. Daily limits reset at ${DAILY_RESET_EN}.`,
        NO_FEEDBACK_LIMIT.en,
        SPEAKING_CAPACITY.en,
        `Writing answers can be up to ${FACTS.maxEssayChars} characters; recordings can be up to ${FACTS.audioMinutes} minutes and ${FACTS.audioMb} MB.`,
        'These limits keep the service available and affordable for everyone. If we lower them while your pass is active, you may ask us for a refund of the unused days of your pass, calculated day by day.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: '7. Acceptable use',
      blocks: [
        'When you use the service, do not:',
        {
          ul: [
            'use scripts, bots or other automated tools to submit tasks or collect content from the site;',
            'create several accounts or use other tricks to get around free-task or fair-use limits;',
            'resell, share or give others access to your pass or to the feedback service;',
            'try to break, overload or get around the security of the service, or to make the AI produce content unrelated to English practice;',
            "submit content that is illegal, threatening or hateful, or that infringes someone else's rights;",
            'submit other people’s personal information, or sensitive information about yourself (such as health details, identity document numbers or immigration file numbers).',
          ],
        },
        'We may suspend or close an account that breaks these rules.',
      ],
    },
    {
      id: 'your-content',
      heading: '8. Your answers',
      blocks: [
        'You keep ownership of what you write and say. You allow us, and the service providers listed in our privacy policy, to process your answers only to transcribe them, give you feedback, show you your history and run the service. We do not use your answers to train AI models.',
      ],
    },
    {
      id: 'ai-feedback',
      heading: '9. AI feedback',
      blocks: [
        `Feedback is generated automatically by an AI model, and no person reviews it. It can be wrong, incomplete or inconsistent, and the same answer can get different feedback on different attempts. Use it as one input to your own study, not as the final word. [Read our AI disclosure](${PATHS.aiDisclosure}).`,
      ],
    },
    {
      id: 'refunds',
      heading: '10. Refunds',
      blocks: [
        `You can request a refund within ${FACTS.refundDays} days of purchase if you have used ${FACTS.refundMaxTasks} or fewer tasks with feedback, once per person and once per card. The full rules, including automatic refunds, refunds of unused days and chargebacks, are in our [refund policy](${PATHS.refunds}).`,
        'When we refund the unused days of a pass (for example under sections 6, 11, 12 or 16), the refund is calculated day by day and the pass ends when the refund is made.',
      ],
    },
    {
      id: 'availability',
      heading: '11. Availability and changes to the service',
      blocks: [
        'We work to keep the service running, but it may sometimes be unavailable, slow or paused. We may change, add or remove features.',
        'If we stop offering the service, we will refund the unused days of active passes, calculated day by day.',
      ],
    },
    {
      id: 'ending',
      heading: '12. Ending your use',
      blocks: [
        'You can stop using the service at any time and delete your account from your account page. Deleting your account ends any active pass. If you qualify for a refund, request it before you delete your account.',
        'We may suspend or close your account if you seriously or repeatedly break these terms. If we close your account for any other reason, we will refund the unused days of your pass, calculated day by day.',
      ],
    },
    {
      id: 'ip',
      heading: '13. Our content and trademarks',
      blocks: [
        `The site, our practice prompts, the feedback format and the software belong to us. You may use them for your own personal practice only. CELPIP and IELTS are trademarks of their respective owners; we name tests only to describe the format of our practice tasks. See our [not-affiliated notice](${PATHS.notAffiliated}).`,
      ],
    },
    {
      id: 'liability',
      heading: '14. Limitation of liability',
      blocks: [
        {
          ul: [
            'The service is a study aid. We provide it with reasonable care, but we do not promise that it will be error-free or always available.',
            'To the extent the law allows, we are not responsible for indirect or consequential losses, such as test fees, missed deadlines, lost opportunities or immigration outcomes.',
            'To the extent the law allows, our total liability to you for all claims about the service is limited to the amount you paid us in the 12 months before the claim.',
            'Nothing in these terms limits any right you have under consumer protection laws that cannot be waived by contract, or our liability for anything that cannot legally be limited.',
          ],
        },
      ],
    },
    {
      id: 'law',
      heading: '15. Governing law',
      blocks: [
        'These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there. You may bring a claim in the courts of Ontario or of the province where you live. This does not take away any protection given to you by the consumer protection laws of the province where you live.',
        'If you have a problem, please contact us first so we can try to fix it.',
      ],
    },
    {
      id: 'changes',
      heading: '16. Changes to these terms',
      blocks: [
        'We may update these terms. We will post the new version on this page with a new date. If a change significantly affects a pass you have already bought, we will tell you at least 30 days before it takes effect, with a notice on the site and on your account page, and you may then ask for a refund of the unused days of your pass, calculated day by day.',
      ],
    },
    {
      id: 'contact',
      heading: '17. Contact us',
      blocks: [{ ul: CONTACT_LINES_EN }],
    },
  ],
  related: [
    { label: 'Refund policy', href: PATHS.refunds },
    { label: 'Privacy policy', href: PATHS.privacy },
    { label: 'AI disclosure', href: PATHS.aiDisclosure },
  ],
}
