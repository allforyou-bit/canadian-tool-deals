import Link from 'next/link'
import type { TaskType } from '../shared/tasks'
import { t } from '../lib/i18n'
import { AiDisclosure } from './AiDisclosure'
import { cls } from './ui'

/** Static top of a practice page: title, instructions (EN + KO) and the AI disclosure. */
export function TaskIntro(props: { task: TaskType }) {
  const { task } = props
  const { minWords, maxWords, prepSeconds, speakSeconds } = task.target
  const kindKey = task.kind === 'writing' ? 'practice.writing' : 'practice.speaking'
  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/practice/" className={cls.link}>
          {t('en', 'practice.backToList')}
        </Link>
      </p>
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-800">
          {t('en', kindKey)} · <span lang="ko">{t('ko', kindKey)}</span>
        </p>
        <h1 className={cls.h1}>{task.title.en}</h1>
        <p lang="ko" className="text-lg text-slate-700">
          {task.title.ko}
        </p>
      </header>
      <section aria-label={t('en', 'p.instructions')} className="space-y-1">
        <p className="text-slate-900">{task.instructions.en}</p>
        <p lang="ko" className="text-sm text-slate-700">
          {task.instructions.ko}
        </p>
        {minWords !== undefined && maxWords !== undefined && (
          <p className={cls.muted}>{t('en', 'practice.words', { min: minWords, max: maxWords })}</p>
        )}
        {prepSeconds !== undefined && speakSeconds !== undefined && (
          <p className={cls.muted}>{t('en', 'practice.speakTime', { prep: prepSeconds, speak: speakSeconds })}</p>
        )}
      </section>
      <AiDisclosure />
    </div>
  )
}
