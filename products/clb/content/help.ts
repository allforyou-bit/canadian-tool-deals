// /help/ pages: product documentation (memo B1/B9). Plain English, no articles or guides. Numbers come from
// shared/config.ts through content/site.ts. Zero-capital launch (memo §7.2): sign-in with Google (Z3), no email
// to learners (Z4), speaking feedback can close for the day at the shared capacity (Z2), and every practice page
// offers practice without feedback (Z9).
import { AI_DISCLOSURE, BRAND, FREE } from '../shared/config'
import { FREE_WRITING_PATH, PATHS } from './routes'
import {
  CONTACT_LINES_EN,
  DAILY_RESET_EN,
  FACTS,
  FILTER_EN,
  GOOGLE_SIGN_IN,
  LAST_REVIEWED,
  NO_FEEDBACK_LIMIT,
  NO_LEARNER_EMAIL,
  PAUSE_EXTENSION,
  PRACTICE_MODE,
  QUEBEC_RULE,
  SPEAKING_CAPACITY,
} from './site'
import type { DocPage, DocSection } from './types'

const contactSection = (id = 'contact', heading = 'Contact us'): DocSection => ({
  id,
  heading,
  blocks: [{ ul: CONTACT_LINES_EN }, 'Please never send card numbers or passwords.'],
})

const doc = (p: Omit<DocPage, 'lang' | 'lastReviewed' | 'lastReviewedLabel'>): DocPage => ({
  ...p,
  lang: 'en',
  lastReviewed: LAST_REVIEWED,
  lastReviewedLabel: 'Last reviewed',
})

export const HELP_FEEDBACK: DocPage = doc({
  path: PATHS.helpFeedback,
  title: 'How the feedback works',
  description: 'What happens when you submit a practice task, what the feedback includes, and what it cannot do.',
  intro: [
    'Every answer you submit for feedback gets written feedback from Claude, an AI model made by Anthropic. This page explains what happens to your answer and what the feedback contains.',
    `You can also practise any task without feedback, free and without signing in. See [practising without feedback](${PATHS.helpFeedback}#practice-mode).`,
    { note: AI_DISCLOSURE.en },
  ],
  sections: [
    {
      id: 'steps',
      heading: 'What happens when you submit',
      blocks: [
        {
          ol: [
            'For speaking tasks, your recording is first turned into text by Whisper, a speech-recognition model that runs on Cloudflare Workers AI. The recording is then discarded.',
            'Claude reads your answer together with the task prompt and our instructions, and writes feedback on four criteria. If Claude finds that the text is a request we cannot help with, such as a question about an immigration application or the law, you get a fixed message that we wrote instead of feedback. It points you to a licensed immigration consultant or a lawyer, and it does not count toward your fair-use limits.',
            FILTER_EN,
            `You see the feedback on the page. If you are signed in, your answer and the feedback are also saved, and you can open them again from your [account page](${PATHS.account}) for ${FACTS.retentionDays} days after your last activity. For a free task done without an account, they are not stored.`,
          ],
        },
      ],
    },
    {
      id: 'contents',
      heading: 'What the feedback includes',
      blocks: [
        {
          dl: [
            {
              term: 'Criteria',
              detail:
                'Comments on four criteria: content and task completion, organisation and coherence, vocabulary range and precision, and grammar. Each criterion gets a strength and something to improve.',
            },
            {
              term: 'Most important errors',
              detail: 'Up to three errors that matter most, each with what you wrote, a better version and a short reason.',
            },
            { term: 'Improved versions', detail: 'One or two rewrites of your weaker sentences, or a short model paragraph.' },
            { term: 'Next step', detail: 'One or two sentences on what to focus on in your next task.' },
            { term: 'Transcript (speaking only)', detail: 'The text we heard in your recording, so you can check it.' },
          ],
        },
      ],
    },
    {
      id: 'error-log',
      heading: 'Your recurring error log',
      blocks: [
        'When you are signed in, each piece of feedback records the types of errors it found, for example grammar, vocabulary, spelling or organisation. Your account page shows which types keep coming back, so you know what to practise next.',
        `The text of your answers and feedback is deleted ${FACTS.retentionDays} days after your last activity. The list of error types stays with your account until you delete your account.`,
      ],
    },
    {
      id: 'language',
      heading: 'Explanation language',
      blocks: [
        'Before you submit, choose English or Korean. The explanations (why something is an error and how to improve it) are written in that language. Corrections and improved sentences always stay in English.',
      ],
    },
    {
      id: 'limits',
      heading: 'What the feedback cannot do',
      blocks: [
        {
          ul: [
            'Feedback is not a score and does not predict test results.',
            "The criteria describe our own feedback. They are not any test's marking guide.",
            'Speaking feedback is based on a transcript. Pronunciation and fluency are not assessed. If the transcript contains a word you did not say, the feedback may point out an error you did not make.',
            'AI feedback can be wrong or miss errors, and the same answer can get somewhat different feedback on different attempts.',
            'No person reviews your answer or the feedback.',
          ],
        },
      ],
    },
    {
      id: 'practice-mode',
      heading: 'Practising without feedback',
      blocks: [
        `Every practice page also offers "${PRACTICE_MODE.label.en}". It is free, needs no account and uses no AI, so you get no feedback and nothing is saved to your account.`,
        {
          ul: [
            '**Writing**: the task prompt, a practice timer, a word counter and a short self-check list to review your own answer.',
            '**Speaking**: the preparation and speaking timers, then you record yourself and play the recording back.',
          ],
        },
        `${PRACTICE_MODE.audio.en} What you type in this mode is not sent to us either.`,
        `When you want feedback, submit the task for feedback instead. Your [first writing task with feedback](${FREE_WRITING_PATH}) is free, and [passes](${PATHS.pricing}) cover the rest.`,
      ],
    },
    {
      id: 'tips',
      heading: 'Getting the most out of it',
      blocks: [
        {
          ul: [
            'Pick one recurring error type and focus on it in your next few tasks.',
            'Read the improved versions aloud, then try the same task type again with a different prompt.',
            'If a correction looks wrong to you, check it in a dictionary or a grammar reference.',
          ],
        },
      ],
    },
  ],
  related: [
    { label: 'Practice task formats', href: PATHS.formats },
    { label: 'AI disclosure', href: PATHS.aiDisclosure },
    { label: 'Privacy and your data', href: PATHS.helpPrivacy },
  ],
})

export const HELP_RECORDING: DocPage = doc({
  path: PATHS.helpRecording,
  title: 'Recording your speaking answers',
  description: 'Browser and microphone requirements, recording limits, and tips for a clear recording.',
  intro: [
    'Speaking tasks record your voice in the browser. To get feedback on a recording, you need to sign in with a Google account; your first speaking task with feedback is free.',
    `To practise without feedback, you do not need to sign in, and your recording never leaves your device. See [recording without feedback](${PATHS.helpRecording}#practice-mode).`,
  ],
  sections: [
    {
      id: 'requirements',
      heading: 'What you need',
      blocks: [
        {
          ul: [
            // Safari on iOS 14+ supports MediaRecorder per mdn/browser-compat-data api/MediaRecorder.json (fetched 2026-09-24).
            'A recent version of Chrome, Edge, Firefox or Safari. On iPhone and iPad, you need iOS 14 or later.',
            'A working microphone. A headset microphone often gives a clearer recording than a built-in laptop microphone.',
            'Permission for this site to use your microphone.',
            'For feedback, an internet connection that can upload your recording.',
          ],
        },
      ],
    },
    {
      id: 'permission',
      heading: 'Allowing the microphone',
      blocks: [
        'The first time you record, your browser asks whether this site may use your microphone. Choose Allow.',
        "If you blocked the microphone by mistake, open your browser's settings for this site, allow the microphone, and reload the page. On iPhone and iPad, also check your device settings to make sure the browser is allowed to use the microphone.",
      ],
    },
    {
      id: 'limits',
      heading: 'Recording limits',
      blocks: [
        {
          ul: [
            `Each recording can be up to ${FACTS.audioMinutes} minutes long and up to ${FACTS.audioMb} MB in size.`,
            `Each task shows its own preparation and speaking time. These are practice defaults we chose; see the [speaking task formats](${PATHS.formatsSpeaking}).`,
            'Recordings that are too short cannot get feedback. If this happens, record again.',
          ],
        },
      ],
    },
    {
      id: 'capacity',
      heading: 'When speaking feedback is closed for the day',
      blocks: [SPEAKING_CAPACITY.en, 'While it is closed, you can still record and play back your answers without feedback.'],
    },
    {
      id: 'practice-mode',
      heading: 'Recording without feedback',
      blocks: [
        `Choose "${PRACTICE_MODE.label.en}" on any speaking task. You get the same preparation and speaking timers, then you can play your recording back to hear how you sound. You do not need to sign in.`,
        PRACTICE_MODE.audio.en,
      ],
    },
    {
      id: 'format',
      heading: 'Recording format',
      blocks: [
        // [unverified] Which container each browser produces (WebM in Chromium/Firefox, MP4 in iPhone Safari) is
        // prior knowledge (memo B4, §8 item 7); the owner's launch-day iPhone test (owner task 17) confirms it.
        'Your browser chooses the audio format. Chrome, Edge and Firefox usually record WebM audio, and Safari on iPhone records MP4 audio. We accept both.',
      ],
    },
    {
      id: 'clear',
      heading: 'Tips for a clear recording',
      blocks: [
        {
          ul: [
            'Find a quiet room and turn off music or the TV.',
            'Keep the microphone at the same distance from your mouth the whole time.',
            'Speak at a natural pace and volume.',
            'Listen to your recording before you send it, and record again if it is unclear.',
          ],
        },
      ],
    },
    {
      id: 'privacy',
      heading: 'What happens to your recording',
      blocks: [
        `When you ask for feedback, your recording is sent to Whisper, a speech-recognition model that runs on Cloudflare Workers AI, to make a transcript. The recording is then discarded: we never store audio. The transcript and your feedback are saved to your account page and deleted ${FACTS.retentionDays} days after your last activity. [More about your data](${PATHS.helpPrivacy}).`,
      ],
    },
    {
      id: 'pronunciation',
      heading: 'Pronunciation is not assessed',
      blocks: [
        'The feedback is based only on the transcript, so it cannot judge pronunciation, fluency, intonation or pace. Background noise or an unclear recording can put wrong words into the transcript, and the feedback may then point out errors you did not make.',
      ],
    },
  ],
  related: [
    { label: 'Speaking task formats', href: PATHS.formatsSpeaking },
    { label: 'Troubleshooting', href: PATHS.helpTroubleshooting },
    { label: 'How the feedback works', href: PATHS.helpFeedback },
  ],
})

export const HELP_ACCOUNT: DocPage = doc({
  path: PATHS.helpAccount,
  title: 'Account and sign-in',
  description: 'How sign-in with Google works, what we receive from Google, what to do if sign-in fails, and how to delete your account.',
  intro: [
    'You do not need an account for your first free writing task or to practise without feedback. Sign in to do the free speaking task, buy a pass and see your practice history.',
    `**You need a Google account to sign in.** There is no separate password for this site. ${GOOGLE_SIGN_IN.en}`,
  ],
  sections: [
    {
      id: 'how',
      heading: 'How sign-in works',
      blocks: [
        {
          ol: [
            `Go to [Sign in](${PATHS.login}).`,
            'Confirm that you are 18 or older.',
            'Choose "Continue with Google". Google opens its own sign-in page.',
            "Choose the Google account you want to use, and follow the steps on Google's page.",
            'Google sends you back to our site, signed in.',
            `You stay signed in on that browser for up to ${FACTS.sessionDays} days, or until you sign out.`,
          ],
        },
      ],
    },
    {
      id: 'no-google-account',
      heading: 'If you do not have a Google account',
      blocks: [
        // [unverified] Creating a Google account is free and can use an existing non-Gmail address: prior
        // knowledge (research: sign-in and owner-alert email, frontend notes), not checked on Google's own pages.
        "You can create a Google account free of charge on Google's website, and you can use an email address you already have for it. Then come back and sign in.",
        'You do not need a Google account to practise without feedback or for your first free writing task.',
      ],
    },
    {
      id: 'what-google-shares',
      heading: 'What Google shares with us',
      blocks: [
        'We ask Google only for your email address. With it, Google sends your Google account id, a code that identifies your Google account. We use the id to recognise you when you sign in again, and the email address for your purchases, the once-per-person refund rule and our replies to your support messages.',
        'We do not receive your name, photo, contacts or password, and we keep no Google access codes. We do not send Google anything about your practice.',
        `[Read the privacy policy](${PATHS.privacy}).`,
      ],
    },
    {
      id: 'trouble',
      heading: 'If sign-in does not work',
      blocks: [
        {
          ul: [
            `If you closed Google's page or chose Cancel, start again from the [sign-in page](${PATHS.login}).`,
            'If the sign-in page says your email address is not verified, verify it in your Google account, then try again.',
            'Start and finish signing in in the same browser, and allow cookies for this site: a short-lived cookie links the two steps.',
            'If it still does not work, wait a few minutes and try again.',
          ],
        },
      ],
    },
    {
      id: 'adults',
      heading: 'Adults only',
      blocks: [`${BRAND.en} is for adults 18 and older.`],
    },
    {
      id: 'emails',
      heading: 'Emails from us',
      blocks: [
        `We do not send marketing email. ${NO_LEARNER_EMAIL.en} If you write to us through the support form, we reply by email.`,
        'If we ever start sending marketing email, we will ask for your permission first, and every marketing email will end with an unsubscribe link that works without signing in.',
      ],
    },
    {
      id: 'sign-out',
      heading: 'Signing out',
      blocks: ['Use Sign out on your account page. This ends your session on that browser. It does not sign you out of Google.'],
    },
    {
      id: 'change-account',
      heading: 'Using a different Google account',
      blocks: [
        'Your account here is linked to the Google account you signed in with. To move your pass or history to a different Google account, contact us through the support form on your account page.',
      ],
    },
    {
      id: 'delete',
      heading: 'Deleting your account',
      blocks: [
        'You can delete your account at any time from your account page. This removes your email address, the link to your Google account, and your answers, transcripts, feedback, error types and support messages. It cannot be undone. Your Google account itself is not affected.',
        'Payment records are kept because tax law requires it. We also keep a record of each task’s type, date and processing cost for our cost accounting, without anything that links it to you. If you have an active pass, it ends when you delete your account, so request a refund first if you qualify.',
        `[Read the privacy policy](${PATHS.privacy}).`,
      ],
    },
  ],
  related: [
    { label: 'Passes and refunds', href: PATHS.helpPasses },
    { label: 'Privacy and your data', href: PATHS.helpPrivacy },
    { label: 'Troubleshooting', href: PATHS.helpTroubleshooting },
  ],
})

const REFUND_RULE = `Request a refund from your [account page](${PATHS.account}) within ${FACTS.refundDays} days of purchase if you have used ${FACTS.refundMaxTasks} or fewer tasks with feedback.`

export const HELP_PASSES: DocPage = doc({
  path: PATHS.helpPasses,
  title: 'Passes and refunds',
  description: 'How passes work, fair-use limits, who can buy a pass, and how to request a refund.',
  intro: [
    `A pass gives you feedback on every practice task for ${FACTS.days.pass30} or ${FACTS.days.pass90} days. See [pricing](${PATHS.pricing}) for current prices.`,
  ],
  sections: [
    {
      id: 'how',
      heading: 'How passes work',
      blocks: [
        {
          ul: [
            'A pass is a one-time payment, not a subscription. It never renews automatically.',
            'It starts as soon as your payment is confirmed. Your account page shows when it ends.',
            'If you buy another pass while one is active, the new days are added after your current pass ends.',
            PAUSE_EXTENSION.en,
            NO_LEARNER_EMAIL.en,
          ],
        },
      ],
    },
    {
      id: 'buying',
      heading: 'Buying a pass',
      blocks: [
        {
          ol: [
            `[Sign in](${PATHS.login}) with your Google account.`,
            `On the [pricing page](${PATHS.pricing}), tick "I live in Canada, outside Quebec" and choose a pass. By buying, you agree to the [terms of use](${PATHS.terms}) and the [refund policy](${PATHS.refunds}).`,
            'Pay on the secure Stripe checkout page with a card issued in Canada. Card is the only payment method.',
            'You come back to our site, and your pass is active as soon as the payment is confirmed. The confirmation page and your account page show it.',
          ],
        },
      ],
    },
    {
      id: 'who-can-buy',
      heading: 'Who can buy',
      blocks: [
        `Passes are for adults who live in Canada outside Quebec and pay with a card issued in Canada. ${QUEBEC_RULE.en} The free tasks can be used from anywhere. After payment we check the billing address and the country where the card was issued. If they do not meet these conditions, we do not activate the pass and we refund the full payment automatically.`,
        'We also check the location of your internet connection before checkout. If you use a VPN, turn it off before you buy.',
      ],
    },
    {
      id: 'fair-use',
      heading: 'Fair-use limits',
      blocks: [
        `Each account can get feedback on up to ${FACTS.writingPerDay} writing tasks and ${FACTS.speakingPerDay} speaking tasks per day, and up to ${FACTS.gradedPer30Days} tasks in any 30 days. Daily limits reset at ${DAILY_RESET_EN}. Your account page shows how many you have used.`,
        NO_FEEDBACK_LIMIT.en,
        SPEAKING_CAPACITY.en,
      ],
    },
    {
      id: 'refunds',
      heading: 'Refunds',
      blocks: [
        {
          ul: [
            REFUND_RULE,
            'Self-serve refunds are available once per person and once per card.',
            'The refund goes back to the card you paid with, and your pass ends as soon as the refund is made. Your account page shows the refund.',
            'How long the money takes to reach your account depends on your bank.',
          ],
        },
        `[Read the full refund policy](${PATHS.refunds}).`,
      ],
    },
    {
      id: 'problems',
      heading: 'Payment problems',
      blocks: [
        'If you paid but your pass does not appear after a few minutes, refresh your account page and check that you are signed in with the Google account you used to buy the pass. If it still does not appear, contact us through the support form on your account page. Please do not pay again.',
        'If you think a charge is wrong, please contact us before you dispute it with your bank.',
      ],
    },
  ],
  related: [
    { label: 'Pricing', href: PATHS.pricing },
    { label: 'Refund policy', href: PATHS.refunds },
    { label: 'Terms of use', href: PATHS.terms },
  ],
})

export const HELP_PRIVACY: DocPage = doc({
  path: PATHS.helpPrivacy,
  title: 'Privacy and your data',
  description: 'A plain-language summary of what we keep, for how long, who processes it, and how to delete it.',
  intro: [`This is a short summary. The [privacy policy](${PATHS.privacy}) has the full details.`],
  sections: [
    {
      id: 'summary',
      heading: 'The short version',
      blocks: [
        {
          ul: [
            '**Audio is never stored.** When you ask for feedback, your recording is used only to make a transcript, and then it is discarded.',
            `**Practice without feedback stays on your device.** ${PRACTICE_MODE.audio.en} What you type in that mode is not sent to us either.`,
            `**You sign in with Google.** ${GOOGLE_SIGN_IN.en}`,
            `**Text is deleted after ${FACTS.retentionDays} days.** When you are signed in, the text of your answers, your transcripts and your feedback are saved so you can open them again from your account page, and deleted ${FACTS.retentionDays} days after your last activity. For a free task done without an account, they are not stored at all.`,
            '**You can delete your account at any time.** This removes your email address, the link to your Google account, and your answers, transcripts, feedback, error types and support messages.',
            `**Support messages go to our business email.** Messages from the support form (you need to be signed in) are forwarded, with your email address, to our business mailbox at Google (Gmail). An AI assistant (Claude by Anthropic) may draft a reply, and the owner reviews every reply before sending it. Copies, including our replies, are deleted ${FACTS.retentionDays} days after you send the message, and when you delete your account.`,
            '**No raw IP addresses.** We keep only salted hashes (one-way codes) of part of your IP address and of a random device id, to limit free tasks and prevent abuse.',
            "**We never see your full card number.** Stripe handles payments. We keep only what we need for the refund and region rules, such as your billing country and province, the card's country and a card fingerprint.",
            `**No automatic emails.** We do not send marketing email. ${NO_LEARNER_EMAIL.en} We email you only to reply when you write to us, or when the law requires it.`,
            '**We do not sell your data**, and we do not use your answers to train AI models.',
          ],
        },
      ],
    },
    {
      id: 'providers',
      heading: 'Who processes your data for us',
      blocks: [
        {
          dl: [
            {
              term: 'Cloudflare',
              detail: 'Hosts the site and database, turns recordings into text, runs the security check on forms, and provides privacy-focused site analytics.',
            },
            {
              term: 'Anthropic',
              detail:
                'Its AI model, Claude, writes feedback from your answer or transcript. The owner also uses Claude to draft replies to support messages.',
            },
            { term: 'Stripe', detail: 'Processes payments and refunds.' },
            {
              term: 'Resend',
              detail: "Delivers the site's email alerts to the owner, including the support messages you send us, with your email address. We do not use it to email you.",
            },
            {
              term: 'Google',
              detail: 'Signs you in (Google sends us your email address and Google account id) and hosts our business email (Gmail), where support messages arrive.',
            },
          ],
        },
        'Some of these providers process data outside Canada, including in the United States.',
      ],
    },
    {
      id: 'after-delete',
      heading: 'What we keep after you delete your account',
      blocks: [
        'Payment records, which tax law requires us to keep, and a salted hash of your email address, so that if you sign up again with the same email, the once-per-person refund rule still applies and the free speaking task is not given again.',
        'A record of each task’s type, date and processing cost, for our cost accounting. After deletion it has nothing that links it to you.',
      ],
    },
    contactSection('requests', 'Questions or requests about your data'),
  ],
  related: [
    { label: 'Privacy policy', href: PATHS.privacy },
    { label: 'Account and sign-in', href: PATHS.helpAccount },
  ],
})

export const HELP_TROUBLESHOOTING: DocPage = doc({
  path: PATHS.helpTroubleshooting,
  title: 'Troubleshooting',
  description: 'Fixes for common problems with free tasks, recording, limits, sign-in and checkout.',
  intro: ['Find your problem below. If none of these steps help, contact us (see the end of this page).'],
  sections: [
    {
      id: 'free',
      heading: 'It says my free task is not available',
      blocks: [
        `The free writing task is limited to ${FACTS.freeWriting} per device and ${FREE.anonymousWritingPerIpPerDay} per internet connection per day. If you have used it, sign in and buy a pass to continue.`,
        `Free tasks can also be paused at busy times. Try again later, or check the [service status](${PATHS.status}).`,
        `You can still practise any task without feedback ("${PRACTICE_MODE.label.en}"), free and without signing in.`,
      ],
    },
    {
      id: 'microphone',
      heading: 'I cannot record',
      blocks: [
        {
          ul: [
            'Check that your browser has permission to use the microphone, then reload the page.',
            'Close other apps that might be using the microphone, such as video-call apps.',
            'Use a recent version of Chrome, Edge, Firefox or Safari.',
            'On iPhone and iPad, make sure you have iOS 14 or later.',
          ],
        },
        `[Read the recording guide](${PATHS.helpRecording}).`,
      ],
    },
    {
      id: 'rejected',
      heading: 'My recording was rejected',
      blocks: [
        `Recordings can be up to ${FACTS.audioMinutes} minutes long and ${FACTS.audioMb} MB in size. Record a shorter answer. Recordings that are too short are also rejected.`,
      ],
    },
    {
      id: 'speaking-closed',
      heading: 'Speaking feedback is closed for today',
      blocks: [SPEAKING_CAPACITY.en, `Meanwhile, you can practise speaking without feedback, or check the [service status](${PATHS.status}).`],
    },
    {
      id: 'transcript',
      heading: 'The transcript has words I did not say',
      blocks: [
        'Background noise, a distant microphone or overlapping sounds can cause transcription mistakes. Record again in a quieter place, with the microphone closer to you.',
      ],
    },
    {
      id: 'limit',
      heading: 'I reached my limit',
      blocks: [
        `Each account can get feedback on up to ${FACTS.writingPerDay} writing tasks and ${FACTS.speakingPerDay} speaking tasks per day, and up to ${FACTS.gradedPer30Days} tasks in any 30 days. Daily limits reset at ${DAILY_RESET_EN}. Your account page shows how many you have used.`,
        NO_FEEDBACK_LIMIT.en,
      ],
    },
    {
      id: 'paused',
      heading: 'Feedback is paused',
      blocks: [
        `Sometimes we pause feedback, for example for maintenance or to stop unusual activity. A notice appears at the top of the page while this lasts. ${PAUSE_EXTENSION.en}`,
      ],
    },
    {
      id: 'no-feedback',
      heading: 'I got a message instead of feedback',
      blocks: [
        `We do not give feedback on requests that are not practice answers, such as questions about immigration applications or the law. Write your text as an answer to the task prompt and submit it again. These requests do not count toward your fair-use limits, but each account can have up to ${FACTS.noFeedbackPerDay} requests without feedback per day.`,
      ],
    },
    {
      id: 'sign-in',
      heading: 'I cannot sign in with Google',
      blocks: [
        {
          ul: [
            `You need a Google account. See [account and sign-in](${PATHS.helpAccount}) if you do not have one.`,
            `If you closed Google's page or chose Cancel, start again from the [sign-in page](${PATHS.login}).`,
            'If the sign-in page says your email address is not verified, verify it in your Google account, then try again.',
            'Start and finish signing in in the same browser, and allow cookies for this site.',
          ],
        },
      ],
    },
    {
      id: 'region',
      heading: 'Checkout says passes are not available where I am',
      blocks: [
        'Passes are sold only to residents of Canada outside Quebec. We check the location of your internet connection, so turn off any VPN and try again. If you live in Canada outside Quebec and still see this message, contact us.',
      ],
    },
    {
      id: 'pass-missing',
      heading: 'I paid but do not see my pass',
      blocks: [
        'Wait a minute and refresh your account page. Make sure you are signed in with the Google account you used to buy the pass. If the pass still does not appear, contact us through the support form on your account page. Please do not pay again.',
      ],
    },
    {
      ...contactSection('contact', 'Still stuck?'),
      blocks: [
        { ul: CONTACT_LINES_EN },
        'Tell us which device and browser you use and what you see on the screen. Please never send card numbers or passwords.',
      ],
    },
  ],
  related: [
    { label: 'Recording your speaking answers', href: PATHS.helpRecording },
    { label: 'Account and sign-in', href: PATHS.helpAccount },
    { label: 'Passes and refunds', href: PATHS.helpPasses },
  ],
})

/** The six help pages, in the order the help index lists them. */
export const HELP_PAGES: DocPage[] = [
  HELP_FEEDBACK,
  HELP_RECORDING,
  HELP_ACCOUNT,
  HELP_PASSES,
  HELP_PRIVACY,
  HELP_TROUBLESHOOTING,
]

export const HELP_INDEX: DocPage = doc({
  path: PATHS.help,
  title: 'Help centre',
  description: `Answers about feedback, practising without feedback, recording, signing in with Google, passes, refunds and your data in ${BRAND.en}.`,
  intro: ['Short guides to using the service. If you cannot find an answer, contact us (see the end of this page).'],
  sections: [
    {
      id: 'guides',
      heading: 'Guides',
      blocks: [{ dl: HELP_PAGES.map((p) => ({ term: `[${p.title}](${p.path})`, detail: p.description })) }],
    },
    {
      id: 'formats',
      heading: 'Task formats',
      blocks: [
        `The [writing task formats](${PATHS.formatsWriting}) and [speaking task formats](${PATHS.formatsSpeaking}) pages describe each practice task, its practice timings and tips.`,
      ],
    },
    {
      id: 'policies',
      heading: 'Policies',
      blocks: [
        {
          ul: [
            `[Privacy policy](${PATHS.privacy})`,
            `[Terms of use](${PATHS.terms})`,
            `[Refund policy](${PATHS.refunds})`,
            `[AI disclosure](${PATHS.aiDisclosure})`,
            `[Not-affiliated notice](${PATHS.notAffiliated})`,
          ],
        },
      ],
    },
    contactSection(),
  ],
})
