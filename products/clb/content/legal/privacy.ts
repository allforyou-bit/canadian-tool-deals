// /legal/privacy/ — draft privacy policy for a sole proprietor in Ontario (PIPEDA, Schedule 1 fair
// information principles). Statutory points were checked against justicecanada/laws-lois-xml on GitHub
// (fetched 2026-09-24): PIPEDA (P-8.6, current to 2026-03-31) Sch. 1 cl. 4.1.3, 4.3.8, 4.5.3, 4.8.2, 4.9,
// 4.10, s.8(3)–(4) (30-day reply, extendable), s.10.1 (breach reports), s.11 (complaints to the
// Commissioner); Income Tax Act (I-3.3, current to 2026-06-21) s.230(4)(b) (six-year record keeping);
// CASL (E-1.6, current to 2026-03-02) s.11(3) (unsubscribe honoured within 10 business days).
// Data practices mirror worker/migrations/0001_init.sql, memo §4.1 and the review-round-1 integrator
// decisions: deletion de-identifies grades rows (cost ledger kept, device hash never stored with answers),
// saved answers open from the account page (GET /api/history/item), support mail goes to the owner's Gmail
// with Claude-drafted replies the owner reviews, and a re-signup with the same email keeps the used free
// speaking task and self-serve refund. Zero-capital launch (memo §7.2): no advertising tag (Z1); learners sign
// in with Google, scope "openid email", no Google tokens kept (Z3); no email to learners, owner alerts through
// Resend, Stripe's receipt link on the account page, no marketing-consent request (Z4); the seller is the
// owner's legal name, the mailing address is shown only when set (Z5); practice without feedback keeps
// everything on the device (Z9). Must be reviewed before launch.
import { BRAND, RETENTION_DAYS, SESSION } from '../../shared/config'
import { PATHS } from '../routes'
import {
  CONTACT_LINES_EN,
  GOOGLE_SIGN_IN,
  LAST_REVIEWED,
  legalNameOrPlaceholder,
  LEGAL_NAME,
  MAILING_ADDRESS,
  NO_LEARNER_EMAIL,
  PRACTICE_MODE,
  sellerLine,
  SUPPORT_FORM_LINE,
} from '../site'
import type { Block, LegalPage } from '../types'

/**
 * "Who we are": the seller's legal name, the accountable person and how to reach them (PIPEDA Sch. 1
 * cl. 4.8.2(a) asks for the accountable person's name and address). The mailing address appears only when it
 * is set; otherwise the page points to the signed-in support form (Z5).
 */
export function whoWeAreBlocks(opts: { legalName: string | null; mailingAddress: string | null }): Block[] {
  const name = legalNameOrPlaceholder(opts.legalName)
  return [
    `${sellerLine(opts.legalName).en} In this policy, "we" and "us" mean ${name}, who runs ${BRAND.en} from Ontario, Canada.`,
    `${name}, the owner of the business, is the person accountable for our privacy practices and the person to contact about privacy questions or complaints.`,
    opts.mailingAddress
      ? `Mailing address: ${name} (${BRAND.en}), ${opts.mailingAddress}`
      : `To reach the owner, ${SUPPORT_FORM_LINE.charAt(0).toLowerCase()}${SUPPORT_FORM_LINE.slice(1)} All the ways to contact us are listed at the end of this policy.`,
  ]
}

export const PRIVACY: LegalPage = {
  path: PATHS.privacy,
  lang: 'en',
  title: 'Privacy policy',
  description: `What personal information ${BRAND.en} collects, why, how long we keep it, who processes it, and your rights.`,
  lastReviewed: LAST_REVIEWED,
  lastReviewedLabel: 'Last updated',
  draftComment:
    'DRAFT privacy policy. The owner (the accountable person under PIPEDA) must review and approve it, and set MPC_LEGAL_NAME (built into the site as NEXT_PUBLIC_LEGAL_NAME), before launch. See business/online/owner-setup.md. Before launch also confirm: the Anthropic, Cloudflare, Stripe, Resend and Google data-processing terms; that Stripe customer emails (receipts) stay off in the Stripe dashboard, because this page says we send learners no email; and that sign-in asks Google only for "openid email". [미확인] Whether PIPEDA Schedule 1 clause 4.8.2(a) ("the address" of the accountable person) is met without a postal address: until MPC_MAILING_ADDRESS is set, this page offers only the signed-in support form (and the support email, if set). Retention periods here mirror worker/src/cron.ts runDaily; keep them in step. The support-mailbox retention (copies deleted after 90 days and on account deletion) is an owner task in owner-setup.md, not code: confirm it is being done.',
  intro: [
    `This policy explains what personal information ${BRAND.en} collects, why we collect it, how long we keep it, who processes it for us and what choices you have. We follow the fair information principles in Schedule 1 of Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).`,
  ],
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: whoWeAreBlocks({ legalName: LEGAL_NAME, mailingAddress: MAILING_ADDRESS }),
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
                'Your email address and your Google account id (a code that identifies your Google account), which Google sends us when you sign in with Google; your preferred language; and the date you confirmed you are 18 or older. We receive nothing else from Google: not your name, photo, contacts or password. We do not keep any Google access codes (tokens).',
            },
            {
              term: 'Your practice answers',
              detail:
                `When you are signed in: the text of your writing answers, the transcripts of your speaking recordings, and the feedback we generate, so you can open them again from your [account page](${PATHS.account}). For a free task done without an account, and for requests we could not give feedback on, we do not store the text or the feedback. For every task we also record the task type, the date, whether feedback was given, the types of errors found (for example grammar or spelling) and what it cost us to process.`,
            },
            {
              term: 'Speaking recordings',
              detail:
                'When you ask for feedback on a speaking task, your recording is sent to our speech-to-text provider to make a transcript, and then it is discarded. We never store audio.',
            },
            {
              term: 'Practice without feedback',
              detail: `Nothing you write or record. ${PRACTICE_MODE.audio.en} What you type in this mode is not sent to us either. We only count that a practice started or finished, with no content, as part of the usage counts below.`,
            },
            {
              term: 'Security and abuse-prevention data',
              detail:
                'A salted hash of the first part of your IP address (never the full address) and a salted hash of a random device id kept in a cookie. A salted hash is a one-way code: we can compare it but cannot turn it back into the original. We use these hashes to count free tasks and to limit how often forms can be used, and we do not store them with your answers. We also use the approximate country and province of your connection, as reported by our hosting provider, to check where passes can be sold.',
            },
            {
              term: 'Payment information',
              detail:
                "Stripe collects your card and billing details directly. We receive and keep the pass you bought, the amount and dates, your billing country and province, the country where your card was issued, a card fingerprint (a code from Stripe that recognises the same card without revealing its number), Stripe's payment references and the link to Stripe's receipt for your payment. We never receive or store your full card number.",
            },
            {
              term: 'Support messages',
              detail:
                'What you write to us through the support form (you need to be signed in to use it), your email address so we can reply, and our replies.',
            },
            {
              term: 'Usage counts',
              detail:
                'Counts of visits and steps such as "free task started", "practice finished" or "purchase completed", with the campaign tags in the link you followed to reach us, if it had any (for example utm_source). These counts are not linked to your email address or account.',
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
            '**Google sign-in cookie**: a short-lived cookie set while you sign in with Google, so that only the browser that started the sign-in can finish it. It holds a random code and expires within minutes.',
            '**Cloudflare Turnstile**: a security check on the free task and sign-in forms that helps stop automated abuse.',
            '**Cloudflare Web Analytics**: counts page views and measures page speed. Cloudflare states that it does not collect or use visitors’ personal data.',
          ],
        },
        "Your browser may also remember your language choice on your device. When you choose to continue with Google, you use Google's own sign-in page, which Google's privacy policy covers. We do not use advertising cookies or advertising tags anywhere on the site.",
      ],
    },
    {
      id: 'why',
      heading: 'Why we use it',
      blocks: [
        {
          ul: [
            '**To provide the service**: sign you in with Google, give feedback on your answers, and show your saved answers, feedback, recurring error types, pass, refunds and payment receipt link.',
            '**To sell and manage passes**: process payments, check that a purchase is from Canada outside Quebec, handle refunds and disputes, and apply the once-per-person and once-per-card refund rule.',
            '**To prevent abuse and keep the service running**: limit free tasks, apply fair-use limits, protect accounts and control our costs.',
            '**To answer you**: reply to support messages.',
            '**To check and improve quality**: the owner may look at a small sample of answers and feedback to find and fix problems with the feedback.',
            '**To understand how the service is used**: we look at counts and totals to decide what to improve.',
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
            `**Answers, transcripts and feedback** can be opened from your account page, and are deleted ${RETENTION_DAYS} days after your last activity or when you delete your account, whichever comes first. (For a free task done without an account they are not stored at all.)`,
            '**The list of error types** found in your tasks (no text) stays with your account so the account page can show patterns. It is deleted when you delete your account.',
            '**Task and cost records**: for each task we keep the task type, the date, whether feedback was given and what it cost us to process, for our cost accounting. When you delete your account, these records are kept without anything that links them to you.',
            '**Account information** is kept until you delete your account.',
            '**Payment and refund records** are kept for as long as Canadian tax law requires. Under the Income Tax Act, business records must generally be kept for six years from the end of the last tax year they relate to. They are kept even if you delete your account.',
            '**A salted hash of your email address** is kept after you delete your account, so that if you sign up again with the same email, the once-per-person refund rule still applies and the free speaking task is not given again.',
            `**Support messages**: the text is deleted from our database ${RETENTION_DAYS} days after you send it. Copies in our business mailbox, including our replies, are deleted ${RETENTION_DAYS} days after you send the message. When you delete your account, both are deleted.`,
            '**Temporary sign-in records** (the one-time codes used while you sign in with Google) are deleted within two days. **Counters** used to limit free tasks and form use are deleted within a few days, except the per-device free-task counter, which is deleted after 400 days.',
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
                'Hosting, our database, speech-to-text (Whisper on Workers AI), the Turnstile security check and Web Analytics. Receives everything you send to the site (but not what you write or record while practising without feedback, which stays on your device).',
            },
            {
              term: 'Anthropic',
              detail:
                'Generates feedback with its AI model, Claude. Receives the text of your answer or transcript and the task prompt. The owner also uses Claude as an assistant to draft replies to support messages; for this it receives your support message and your email address. The owner reviews every reply and sends it.',
            },
            { term: 'Stripe', detail: 'Payments, refunds and disputes. Receives your payment details and billing address directly from you.' },
            {
              term: 'Resend',
              detail:
                "Delivers the site's email alerts to the owner's mailbox. This includes the support messages you send us, with your email address so we can reply. We do not use Resend to email you.",
            },
            {
              term: 'Google',
              detail: `Sign-in: when you choose to continue with Google, Google confirms who you are and sends us your email address and your Google account id. ${GOOGLE_SIGN_IN.en} Google also hosts our business email (Gmail). Support messages are forwarded there by email, with your email address, and we reply from there.`,
            },
          ],
        },
        'Some of these providers are based in, or process information in, the United States and other countries. Information processed outside Canada is subject to the laws of those countries and may be accessed by their courts, law enforcement and national security authorities.',
        'If you open a payment dispute, we may share information about the purchase and your use of the pass with Stripe to respond to it. We may also disclose information when the law requires it.',
      ],
    },
    {
      id: 'marketing',
      heading: 'Emails and marketing',
      blocks: [
        `We do not send marketing email, and we do not ask for permission to send it. ${NO_LEARNER_EMAIL.en} We email you only to reply when you write to us through the support form, or when the law requires us to contact you (for example, about a privacy breach).`,
        `If we ever start sending marketing email, we will send it only to people who agree to it with a box that starts unticked, and every marketing email will end with an unsubscribe link. That link opens a page on our site that stops marketing emails without signing in. We would act on it right away, and always within 10 business days as Canada's anti-spam law requires.`,
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights and choices',
      blocks: [
        {
          ul: [
            `**Access**: you can open your saved answers and feedback from your account page for ${RETENTION_DAYS} days after your last activity. To ask for a copy of the personal information we hold about you, or for an account of how it has been used and to whom it has been disclosed, contact us. We reply within 30 days. In a few cases the law lets us extend this, and we will tell you if we do.`,
            '**Correction**: if information we hold about you is wrong or incomplete, ask us to correct it.',
            '**Deletion**: you can delete your account at any time from your account page. This removes your email address, answers, transcripts, feedback, error types and support messages, and the link to your Google account (your Google account id). We keep payment records, the salted email hash and the task and cost records without anything that links them to you, as described above.',
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
        'The site uses encrypted connections (HTTPS). IP addresses and device ids are stored only as salted hashes, sessions are stored only as hashes, and we keep no Google passwords or access codes. Access to our systems is limited to the owner and to the automated jobs that need it. User answers are never copied into our code repository, logs or reports, and the AI assistant that drafts support replies is set up never to read the practice answers stored in our database.',
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
        'We will post any change on this page and update the date at the top. If a change is significant, we will also show a notice on the site and on your account page before it takes effect.',
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
