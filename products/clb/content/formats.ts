// /formats/ pages: our own descriptions of the 10 practice task types in shared/tasks.ts. Everything here
// describes THIS product's tasks. Nothing is copied from any official test, and timings are product
// practice defaults, not statements about any test's rules.
import { BRAND, NOT_AFFILIATED } from '../shared/config'
import { SPEAKING_TASKS, TASKS, WRITING_TASKS, type TaskType } from '../shared/tasks'
import { PATHS, practicePath } from './routes'
import { FACTS, LAST_REVIEWED } from './site'
import type { DocPage } from './types'

/** Our own study tips for each task type (keyed by task id in shared/tasks.ts). */
export const FORMAT_TIPS: Record<string, string[]> = {
  email: [
    'Cover every point in the prompt. One short paragraph per point is an easy structure to follow.',
    'Match your tone to the reader: friendly for a neighbour or coworker, polite and more formal for a manager or a business.',
    'Open with a greeting and one sentence that says why you are writing. Close with a clear request or next step, then a sign-off.',
    'Keep two or three minutes at the end to reread your email for small errors.',
  ],
  survey: [
    'State your choice in the first sentence so the reader knows your position straight away.',
    'Give two or three reasons, each with a specific example from daily life.',
    'Mention the other option briefly and explain why it suits the situation less well.',
    'Finish with one sentence that restates your choice.',
  ],
  advice: [
    'Start with your most useful suggestion.',
    'Explain why each suggestion would help, not only what to do.',
    'Use linking words such as first, also and finally so the listener can follow you.',
  ],
  experience: [
    'Set the scene quickly: when it happened, where you were and who was there.',
    'Tell the events in order and keep your past tenses consistent.',
    'End with how you felt and what you learned.',
  ],
  scene: [
    'Start with an overview of the whole scene, then move through it in a clear order, for example from left to right or from front to back.',
    'Describe the people, what they are doing and a few small details. The present continuous works well here: "A man is carrying a box of apples."',
    'Add realistic details of your own so the listener can picture the scene.',
  ],
  predictions: [
    'Use a range of future forms: will, be going to, might and probably.',
    'Give a reason for each prediction.',
    'Cover several people or things in the scene, not just one.',
  ],
  compare: [
    'Choose one option quickly and stay with it.',
    'Compare both options on two or three points, such as cost, convenience and comfort.',
    'Speak directly to the person you are persuading and end with a clear recommendation.',
  ],
  difficult: [
    'Decide who you will talk to, and make that clear in your first sentence.',
    'Stay polite: explain the problem, show that you understand the other person, and offer a solution.',
    'Use softening phrases such as "I\'m afraid", "I was wondering if" and "Would it be possible to".',
  ],
  opinions: [
    'Give your opinion clearly in your first sentence.',
    'Support it with two reasons and a short example for each.',
    'Finish by restating your opinion in different words.',
  ],
  unusual: [
    'Describe size, shape, colour and material.',
    'Compare it with familiar things: "It looks like…", "It is about the size of…".',
    'Explain where it is, or how to find it, so the listener could recognise it.',
  ],
}

/** Extra notes on how our version of a task works. */
export const FORMAT_NOTES: Record<string, string> = {
  scene: 'In our version, the scene is given as a short written description. Picture it first, then describe it in your own words.',
  predictions: 'Our prompts for this task continue the scenes from the "Describing a scene" task.',
}

export const FORMAT_LABELS = {
  whatYouDo: 'What you do',
  defaults: 'Practice defaults',
  criteria: 'What the feedback looks at',
  example: 'Example prompt (written by us)',
  tips: 'Tips',
  practise: 'Practise this task',
  note: 'Note',
  taskNav: 'Task types on this page',
} as const

export interface FormatTaskView {
  id: string
  kind: TaskType['kind']
  title: string
  whatYouDo: string
  defaults: string[]
  criteria: string[]
  examplePrompt: string
  note: string | null
  tips: string[]
  practiceHref: string
}

function defaultsFor(t: TaskType): string[] {
  if (t.kind === 'writing') {
    return [
      `Length: ${t.target.minWords}–${t.target.maxWords} words`,
      `Practice timer: ${Math.round((t.timerSeconds ?? 0) / 60)} minutes`,
    ]
  }
  return [`Preparation: ${t.target.prepSeconds} seconds`, `Speaking: up to ${t.target.speakSeconds} seconds`]
}

/** One-line version for lists, e.g. "150–200 words, 27-minute practice timer". */
function shortDefaults(t: TaskType): string {
  return t.kind === 'writing'
    ? `${t.target.minWords}–${t.target.maxWords} words, ${Math.round((t.timerSeconds ?? 0) / 60)}-minute practice timer`
    : `${t.target.prepSeconds} seconds to prepare, up to ${t.target.speakSeconds} seconds to speak`
}

export const formatTaskView = (t: TaskType): FormatTaskView => ({
  id: t.id,
  kind: t.kind,
  title: t.title.en,
  whatYouDo: t.instructions.en,
  defaults: defaultsFor(t),
  criteria: t.criteria.map((c) => c.en),
  examplePrompt: t.prompts[0]?.en ?? '',
  note: FORMAT_NOTES[t.id] ?? null,
  tips: FORMAT_TIPS[t.id] ?? [],
  practiceHref: practicePath(t),
})

const CRITERIA_LIST = WRITING_TASKS[0].criteria.map((c) => c.en.toLowerCase())

const RULES_NOTE = "For the current rules of any test, check the test provider's own website."
const DEFAULTS_NOTE = `The timings and word ranges are practice defaults we chose for this product. ${RULES_NOTE}`
const WRITING_DEFAULTS_NOTE = `The word ranges and timer lengths are practice defaults we chose for this product. ${RULES_NOTE}`
const SPEAKING_DEFAULTS_NOTE = `The preparation and speaking times are practice defaults we chose for this product. ${RULES_NOTE}`

export const FORMATS_INDEX: DocPage = {
  path: PATHS.formats,
  lang: 'en',
  title: 'Practice task formats',
  description: `The ${TASKS.length} practice task types in ${BRAND.en}: ${WRITING_TASKS.length} writing and ${SPEAKING_TASKS.length} speaking, modelled on the format of the CELPIP-General test, with our own prompts and practice timings.`,
  lastReviewed: LAST_REVIEWED,
  lastReviewedLabel: 'Last reviewed',
  intro: [
    `${BRAND.en} has ${TASKS.length} practice task types: ${WRITING_TASKS.length} writing and ${SPEAKING_TASKS.length} speaking. They are modelled on the format of the CELPIP-General test, so you can get used to this style of task. We wrote every prompt ourselves, and nothing is copied from any test.`,
    DEFAULTS_NOTE,
    { note: NOT_AFFILIATED.en },
  ],
  sections: [
    {
      id: 'writing',
      heading: 'Writing tasks',
      blocks: [
        `Read a short situation or question, then type your answer in the browser. [See the writing tasks in detail](${PATHS.formatsWriting}).`,
        { ul: WRITING_TASKS.map((t) => `**${t.title.en}**: ${shortDefaults(t)}.`) },
      ],
    },
    {
      id: 'speaking',
      heading: 'Speaking tasks',
      blocks: [
        `Use the preparation time to plan, then record your answer. [See the speaking tasks in detail](${PATHS.formatsSpeaking}).`,
        { ul: SPEAKING_TASKS.map((t) => `**${t.title.en}**: ${shortDefaults(t)}.`) },
      ],
    },
    {
      id: 'feedback',
      heading: 'What the feedback looks at',
      blocks: [
        `For every task, the feedback comments on four criteria: ${CRITERIA_LIST.join('; ')}. For speaking tasks, grammar is judged from the transcript of your recording.`,
        "These criteria describe our own feedback. They are not any test's marking guide.",
        'Feedback is not a score and does not predict test results.',
      ],
    },
  ],
  related: [
    { label: 'How the feedback works', href: PATHS.helpFeedback },
    { label: 'Recording your speaking answers', href: PATHS.helpRecording },
    { label: 'Pricing', href: PATHS.pricing },
  ],
}

export interface FormatsKindPage {
  page: DocPage
  tasks: FormatTaskView[]
}

export const FORMATS_WRITING: FormatsKindPage = {
  page: {
    path: PATHS.formatsWriting,
    lang: 'en',
    title: 'Writing task formats',
    description: `How the ${WRITING_TASKS.length} writing practice tasks work: what you do, practice word ranges and timers, what the feedback looks at, and tips.`,
    lastReviewed: LAST_REVIEWED,
    lastReviewedLabel: 'Last reviewed',
    intro: [
      `There are ${WRITING_TASKS.length} writing task types. You read a short situation or question that we wrote, then type your answer in the browser. A word counter and a practice timer help you stay on target. The timer is for practice only and never stops you from submitting.`,
      WRITING_DEFAULTS_NOTE,
      { note: NOT_AFFILIATED.en },
    ],
    sections: [],
    related: [
      { label: 'Speaking task formats', href: PATHS.formatsSpeaking },
      { label: 'How the feedback works', href: PATHS.helpFeedback },
      { label: 'All task formats', href: PATHS.formats },
    ],
  },
  tasks: WRITING_TASKS.map(formatTaskView),
}

export const FORMATS_SPEAKING: FormatsKindPage = {
  page: {
    path: PATHS.formatsSpeaking,
    lang: 'en',
    title: 'Speaking task formats',
    description: `How the ${SPEAKING_TASKS.length} speaking practice tasks work: what you do, preparation and speaking times, what the feedback looks at, and tips.`,
    lastReviewed: LAST_REVIEWED,
    lastReviewedLabel: 'Last reviewed',
    intro: [
      `There are ${SPEAKING_TASKS.length} speaking task types. Each one gives you preparation time to plan, then speaking time to record your answer in the browser. A recording can be up to ${FACTS.audioMinutes} minutes long.`,
      `Speaking feedback is based on a transcript of your recording. Pronunciation and fluency are not assessed. [How recording works](${PATHS.helpRecording}).`,
      SPEAKING_DEFAULTS_NOTE,
      { note: NOT_AFFILIATED.en },
    ],
    sections: [],
    related: [
      { label: 'Writing task formats', href: PATHS.formatsWriting },
      { label: 'Recording your speaking answers', href: PATHS.helpRecording },
      { label: 'All task formats', href: PATHS.formats },
    ],
  },
  tasks: SPEAKING_TASKS.map(formatTaskView),
}

/** Task ids covered by the two detail pages (the test checks this is all 10). */
export const FORMAT_TASK_IDS: string[] = [...FORMATS_WRITING.tasks, ...FORMATS_SPEAKING.tasks].map((t) => t.id)
