// /legal/privacy/ — draft privacy policy for a sole proprietor in Ontario (PIPEDA, Schedule 1 fair
// information principles). Statutory points were checked against justicecanada/laws-lois-xml on GitHub
// (fetched 2026-09-24): PIPEDA (P-8.6, current to 2026-03-31) Sch. 1 cl. 4.1.3, 4.3.8, 4.5.3, 4.8.2, 4.9,
// 4.10, s.8(3)–(4) (30-day reply, extendable), s.10.1 (breach reports), s.11 (complaints to the
// Commissioner); Income Tax Act (I-3.3, current to 2026-06-21) s.230(4)(b) (six-year record keeping);
// CASL (E-1.6, current to 2026-03-02) s.11(3) (unsubscribe honoured within 10 business days).
// Data practices mirror worker/migrations/0001_init.sql and memo §4.1. Must be reviewed before launch.
import { BRAND, RETENTION_DAYS, SESSION } from '../../shared/config'
import { PATHS } from '../routes'
import { CONTACT_LINES_EN, LAST_REVIEWED, mailingAddressText } from '../site'
import type { LegalPage } from '../types'

export const PRIVACY: LegalPage = {
  path: PATHS.privacy,
  lang: 'en',
  title: 'Privacy policy',
  description: `What personal information ${BRAND.en} collects, why, how long we keep it, who processes it, and your rights.`,
  lastReviewed: LAST_REVIEWED,
  lastReviewedLabel: 'Last updated',
  draftComment:
    'DRAFT privacy policy. The owner (the accountable person under PIPEDA) must review and approve it, and set NEXT_PUBLIC_MAILING_ADDRESS, before launch. See business/online/owner-setup.md. Before launch also confirm: the Anthropic, Cloudflare, Stripe, Resend and Google data-processing terms; and whether Stripe or we send payment receipts. Retention periods here mirror worker/src/cron.ts runDaily; keep them in step.',
  intro: [
    `This policy explains what personal information ${BRAND.en} collects, why we collect it, how long we keep it, who processes it for us and what choices you have. We follow the fair information principles in Schedule 1 of Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).`,
  ],
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: [
        `${BRAND.en} is operated by a sole proprietor in Ontario, Canada ("we", "us"). The owner of the business is the person accountable for our privacy practices and the person to contact about privacy questions or complaints.`,
        `Mailing address: ${BRAND.en}, ${mailingAddressText}`,
      ],
    },
    {
      id: 'what-we-collect',
      heading: 'What we collect',
      blocks: [
        {
          dl: [
            {
              term: 'Account information',
              detail:
                'Your email address, your preferred language, the date you confirmed you are 18 or older, and your marketing-email choice, including the exact consent wording you saw and when you agreed or withdrew.',
            },
            {
              term: 'Your practice answers',
              detail:
                'When you are signed in: the text of your writing answers, the transcripts of your speaking recordings, and the feedback we generate, so they can appear in your history. For a free task done without an account, and for requests we could not give feedback on, we do not store the text or the feedback. For every task we also record the task type, the date, the types of errors found (for example grammar or spelling) and what it cost us to process.',
            },
            {
              term: 'Speaking recordings',
              detail:
                'Your recording is sent to our speech-to-text provider to make a transcript, and then it is discarded. We never store audio.',
            },
            {
              term: 'Security and abuse-prevention data',
              detail:
                'A salted hash of the first part of your IP address (never the full address) and a salted hash of a random device id kept in a cookie. A salted hash is a one-way code: we can compare it but cannot turn it back into the original. We also use the approximate country and province of your connection, as reported by our hosting provider, to check where passes can be sold.',
            },
            {
              term: 'Payment information',
              detail:
                "Stripe collects your card and billing details directly. We receive and keep the pass you bought, the amount and dates, your billing country and province, the country where your card was issued, a card fingerprint (a code from Stripe that recognises the same card without revealing its number) and Stripe's payment references. We never receive or store your full card number.",
            },
            { term: 'Support messages', detail: 'What you write to us through the support form, and our replies.' },
            {
              term: 'Usage counts',
              detail:
                'Counts of visits and steps such as "free task started" or "purchase completed", with the advertising campaign tags in the link (UTM tags or a Google click id) when you arrive from an ad. These counts are not linked to your email address or account.',
            },
          ],
        },
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies and similar tools',
      blocks: [
        {
          ul: [
            `**Sign-in cookie**: keeps you signed in for up to ${SESSION.days} days. It holds a random token; we store only a hash of it.`,
            '**Device cookie**: a random id, kept for up to 400 days, used to limit free tasks to one per device. We store only a salted hash of it.',
            '**Cloudflare Turnstile**: a security check on the free task and sign-in forms that helps stop automated abuse.',
            '**Cloudflare Web Analytics**: counts page views and measures page speed. Cloudflare states that it does not collect or use visitors’ personal data.',
            '**Google Ads conversion tag**: only when we have turned it on, and only on the purchase confirmation page. It tells Google Ads that a purchase happened after an ad click, and Google may use its own cookies for this.',
          ],
        },
        'Your browser may also remember your language choice on your device. We do not use advertising cookies anywhere else on the site.',
      ],
    },
    {
      id: 'why',
      heading: 'Why we use it',
      blocks: [
        {
          ul: [
            '**To provide the service**: sign you in, give feedback on your answers, show your history and your recurring error types.',
            '**To sell and manage passes**: process payments, check that a purchase is from Canada outside Quebec, handle refunds and disputes, and apply the once-per-person and once-per-card refund rule.',
            '**To prevent abuse and keep the service running**: limit free tasks, apply fair-use limits, protect accounts and control our costs.',
            '**To answer you**: reply to support messages and send sign-in links and messages about your pass.',
            '**To check and improve quality**: the owner may look at a small sample of answers and feedback to find and fix problems with the feedback.',
            '**To understand how the service is used**: we look at counts and totals to decide what to improve.',
            '**To send marketing emails**, only if you have agreed (see below).',
            '**To meet legal duties**, such as keeping tax records.',
          ],
        },
        'We do not sell your personal information, and we do not use your answers to train AI models. We use your information only for the purposes above, unless you agree to something else or the law requires it.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      blocks: [
        {
          ul: [
            `**Answers, transcripts and feedback** are deleted ${RETENTION_DAYS} days after your last activity. (For a free task done without an account they are not stored at all.)`,
            '**The list of error types** found in your tasks (no text) stays with your account so the history page can show patterns. It is deleted when you delete your account.',
            '**Account information** is kept until you delete your account.',
            '**Payment and refund records** are kept for as long as Canadian tax law requires. Under the Income Tax Act, business records must generally be kept for six years from the end of the last tax year they relate to. They are kept even if you delete your account.',
            '**A salted hash of your email address** is kept after you delete your account, so the once-per-person refund rule still applies if you sign up again.',
            `**Support messages**: the text is deleted ${RETENTION_DAYS} days after you send it.`,
            '**Sign-in link records** are deleted within two days. **Free-task counters** are deleted within a few days (for the internet-connection counter) or after 400 days (for the device counter).',
          ],
        },
        'When we no longer need information, we delete it or make it anonymous.',
      ],
    },
    {
      id: 'providers',
      heading: 'Service providers and processing outside Canada',
      blocks: [
        'We use these service providers to run the service. Each one processes information on our behalf, and we rely on their contractual terms to protect it.',
        {
          dl: [
            {
              term: 'Cloudflare',
              detail:
                'Hosting, our database, speech-to-text (Whisper on Workers AI), the Turnstile security check and Web Analytics. Receives everything you send to the site.',
            },
            {
              term: 'Anthropic',
              detail: 'Generates feedback with its AI model, Claude. Receives the text of your answer or transcript and the task prompt.',
            },
            { term: 'Stripe', detail: 'Payments, refunds and disputes. Receives your payment details and billing address directly from you.' },
            { term: 'Resend', detail: 'Sends our emails, such as sign-in links. Receives your email address and the message.' },
            {
              term: 'Google',
              detail:
                'Google Ads conversion measurement, only when turned on and only on the purchase confirmation page.',
            },
          ],
        },
        'Some of these providers are based in, or process information in, the United States and other countries. Information processed outside Canada is subject to the laws of those countries and may be accessed by their courts, law enforcement and national security authorities.',
        'If you open a payment dispute, we may share information about the purchase and your use of the pass with Stripe to respond to it. We may also disclose information when the law requires it.',
      ],
    },
    {
      id: 'marketing',
      heading: 'Marketing emails',
      blocks: [
        'We send marketing emails only if you tick the (unticked) consent box when you sign in or on your account page. The box explains what we will send and who we are.',
        `You can withdraw your consent at any time from your [account page](${PATHS.account}) or with the unsubscribe link in any marketing email. We act on it right away, and always within 10 business days as Canada's anti-spam law requires. Sign-in links and messages about your pass or refunds are not marketing, so they are still sent.`,
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights and choices',
      blocks: [
        {
          ul: [
            `**Access**: your recent tasks and feedback are on your account page. To ask for a copy of the personal information we hold about you, or for an account of how it has been used and to whom it has been disclosed, contact us. We reply within 30 days. In a few cases the law lets us extend this, and we will tell you if we do.`,
            '**Correction**: if information we hold about you is wrong or incomplete, ask us to correct it.',
            '**Deletion**: you can delete your account at any time from your account page. This removes your email address, answers, transcripts, feedback, history and support messages. We keep payment records and the salted email hash described above.',
            '**Withdrawing consent**: you can withdraw consent at any time, subject to legal or contractual limits. For example, if you do not want your answers processed, we cannot give you feedback.',
            '**Complaints**: if you are not satisfied with how we handle a request or complaint, you can complain to the Office of the Privacy Commissioner of Canada.',
          ],
        },
        'We may ask you to confirm your identity, for example by signing in, before we act on a request.',
      ],
    },
    {
      id: 'security',
      heading: 'How we protect your information',
      blocks: [
        'The site uses encrypted connections (HTTPS). IP addresses and device ids are stored only as salted hashes, and sign-in links and sessions are stored only as hashes. Access to our systems is limited to the owner and to the automated jobs that need it. User answers are never copied into our code repository, logs or reports.',
        'No system is completely secure. If a breach of our safeguards creates a real risk of significant harm to you, we will notify you and report it to the Privacy Commissioner of Canada, as PIPEDA requires.',
      ],
    },
    {
      id: 'age',
      heading: 'Adults only',
      blocks: [
        'The service is for adults 18 and older. We do not knowingly collect information from anyone under 18. If you believe someone under 18 has an account, contact us and we will delete it.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        'We will post any change on this page and update the date at the top. If a change is significant, we will also tell account holders by email before it takes effect.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [{ ul: CONTACT_LINES_EN }],
    },
  ],
  related: [
    { label: 'Privacy and your data (summary)', href: PATHS.helpPrivacy },
    { label: 'Terms of use', href: PATHS.terms },
    { label: 'AI disclosure', href: PATHS.aiDisclosure },
  ],
}
