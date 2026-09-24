// Landing page body for / and /ko/ (copy: content/landing.ts). The Korean page puts the
// "explanations in Korean" section first, because that is its main benefit.
import Link from 'next/link'
import type { LandingCopy, TaskLine } from '../../content/landing'
import { cls, tone } from '../ui'
import { Faq } from './Faq'
import { Rich } from './Rich'

function TaskList({ heading, tasks, id }: { heading: string; tasks: TaskLine[]; id: string }) {
  return (
    <div>
      <h3 id={id} className="text-lg font-semibold text-slate-950">
        {heading}
      </h3>
      <ul className="mt-3 space-y-3" aria-labelledby={id}>
        {tasks.map((t) => (
          <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <Link href={t.href} className={`${cls.link} text-base`}>
              {t.title}
            </Link>
            <p className="mt-1 text-sm font-medium text-slate-600">{t.detail}</p>
            <p className="mt-2 text-sm leading-6 text-slate-800">{t.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KoreanSection({ copy }: { copy: LandingCopy }) {
  return (
    <section aria-labelledby="korean-heading" className="max-w-3xl rounded-lg border border-red-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 id="korean-heading" className={cls.h2}>
        {copy.korean.heading}
      </h2>
      <div className="mt-4 space-y-3">
        {copy.korean.paragraphs.map((p, i) => (
          <p key={i} className="leading-7 text-slate-800">
            <Rich text={p} />
          </p>
        ))}
      </div>
    </section>
  )
}

export function Landing({ copy }: { copy: LandingCopy }) {
  const koreanFirst = copy.lang === 'ko'
  return (
    <div lang={copy.lang} className="space-y-14 sm:space-y-16 sm:py-4">
      <section aria-labelledby="hero-heading" className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-red-800">{copy.hero.eyebrow}</p>
        <h1 id="hero-heading" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {copy.hero.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-700">{copy.hero.lead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={copy.hero.cta.href} className={`${cls.btn} ${cls.primary}`}>
            {copy.hero.cta.label}
          </Link>
          <Link href={copy.hero.secondary.href} className={`${cls.btn} ${cls.secondary}`}>
            {copy.hero.secondary.label}
          </Link>
        </div>
        <p className={`${cls.muted} mt-3`}>{copy.hero.note}</p>
      </section>

      <aside aria-labelledby="disclosure-heading" className={`${tone.info} max-w-3xl text-base`}>
        <h2 id="disclosure-heading" className="font-semibold">
          {copy.disclosure.heading}
        </h2>
        <p className="mt-1">{copy.disclosure.text}</p>
      </aside>

      {koreanFirst && <KoreanSection copy={copy} />}

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className={cls.h2}>
          {copy.steps.heading}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {copy.steps.items.map((step, i) => (
            <li key={i} className={cls.card}>
              <span
                aria-hidden="true"
                className="inline-flex size-8 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-800">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className={cls.h2}>
          {copy.tasks.heading}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-700">{copy.tasks.intro}</p>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <TaskList id="tasks-writing" heading={copy.tasks.writingHeading} tasks={copy.tasks.writing} />
          <TaskList id="tasks-speaking" heading={copy.tasks.speakingHeading} tasks={copy.tasks.speaking} />
        </div>
        <p className="mt-6 text-slate-800">
          <Rich text={copy.tasks.more} />
        </p>
      </section>

      <section aria-labelledby="feedback-heading">
        <h2 id="feedback-heading" className={cls.h2}>
          {copy.feedback.heading}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className={cls.card}>
            <h3 className="text-base font-semibold text-slate-950">{copy.feedback.includesHeading}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800 marker:text-slate-400">
              {copy.feedback.includes.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={cls.card}>
            <h3 className="text-base font-semibold text-slate-950">{copy.feedback.excludesHeading}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800 marker:text-slate-400">
              {copy.feedback.excludes.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-slate-800">
          <Rich text={copy.feedback.more} />
        </p>
      </section>

      {!koreanFirst && <KoreanSection copy={copy} />}

      <section aria-labelledby="pricing-heading" className={`${cls.card} max-w-3xl`}>
        <h2 id="pricing-heading" className={cls.h2}>
          {copy.pricing.heading}
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-800 marker:text-slate-400">
          {copy.pricing.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 font-semibold text-slate-900">{copy.pricing.note}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={copy.pricing.cta.href} className={`${cls.btn} ${cls.primary}`}>
            {copy.pricing.cta.label}
          </Link>
          <Link href={copy.hero.cta.href} className={`${cls.btn} ${cls.secondary}`}>
            {copy.hero.cta.label}
          </Link>
        </div>
      </section>

      <div className="max-w-3xl">
        <Faq id="faq" heading={copy.faq.heading} items={copy.faq.items} lang={copy.lang} />
      </div>
    </div>
  )
}
