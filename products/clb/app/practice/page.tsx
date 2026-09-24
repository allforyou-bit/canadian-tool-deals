import type { Metadata } from 'next'
import Link from 'next/link'
import { AiDisclosure } from '../../components/AiDisclosure'
import { cls } from '../../components/ui'
import { t } from '../../lib/i18n'
import { SPEAKING_TASKS, WRITING_TASKS, type TaskType } from '../../shared/tasks'

export const metadata: Metadata = {
  title: 'Practice tasks',
  description: 'Two writing and eight speaking practice task types with AI feedback. Your first writing task is free.',
}

function TaskList(props: { tasks: TaskType[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {props.tasks.map((task) => {
        const { minWords, maxWords, prepSeconds, speakSeconds } = task.target
        return (
          <li key={task.id}>
            <Link
              href={`/practice/${task.kind}/${task.id}/`}
              className="block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-red-700 focus-visible:outline-2 focus-visible:outline-red-700"
            >
              <span className="block font-semibold text-slate-950">{task.title.en}</span>
              <span lang="ko" className="block text-sm text-slate-600">
                {task.title.ko}
              </span>
              <span className="mt-2 block text-sm text-slate-700">
                {minWords !== undefined && maxWords !== undefined
                  ? t('en', 'practice.words', { min: minWords, max: maxWords })
                  : t('en', 'practice.speakTime', { prep: prepSeconds ?? 0, speak: speakSeconds ?? 0 })}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Practice index: all writing and speaking task types. */
export default function PracticeIndexPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className={cls.h1}>{t('en', 'practice.title')}</h1>
        <p lang="ko" className="text-lg text-slate-700">
          {t('ko', 'practice.title')}
        </p>
        <p className="text-slate-800">{t('en', 'practice.intro')}</p>
        <p lang="ko" className="text-sm text-slate-700">
          {t('ko', 'practice.intro')}
        </p>
      </header>
      <AiDisclosure />
      <section aria-labelledby="writing-tasks" className="space-y-3">
        <h2 id="writing-tasks" className={cls.h2}>
          {t('en', 'practice.writing')} <span lang="ko" className="text-base font-normal text-slate-600">· {t('ko', 'practice.writing')}</span>
        </h2>
        <TaskList tasks={WRITING_TASKS} />
      </section>
      <section aria-labelledby="speaking-tasks" className="space-y-3">
        <h2 id="speaking-tasks" className={cls.h2}>
          {t('en', 'practice.speaking')} <span lang="ko" className="text-base font-normal text-slate-600">· {t('ko', 'practice.speaking')}</span>
        </h2>
        <TaskList tasks={SPEAKING_TASKS} />
      </section>
    </div>
  )
}
