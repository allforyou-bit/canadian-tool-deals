// One card per practice task type on /formats/writing/ and /formats/speaking/ (copy: content/formats.ts).
import Link from 'next/link'
import { FORMAT_LABELS, type FormatTaskView } from '../../content/formats'
import { cls } from '../ui'

function TaskCard({ task }: { task: FormatTaskView }) {
  const headingId = `${task.id}-heading`
  return (
    <section id={task.id} aria-labelledby={headingId} className={`${cls.card} scroll-mt-24`}>
      <h2 id={headingId} className={cls.h2}>
        {task.title}
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-semibold text-slate-950">{FORMAT_LABELS.whatYouDo}</dt>
          <dd className="mt-1 leading-7 text-slate-800">{task.whatYouDo}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-950">{FORMAT_LABELS.defaults}</dt>
          <dd className="mt-1 text-slate-800">
            <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
              {task.defaults.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-950">{FORMAT_LABELS.criteria}</dt>
          <dd className="mt-1 text-slate-800">
            <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
              {task.criteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-950">{FORMAT_LABELS.example}</dt>
          <dd className="mt-1 border-l-4 border-slate-200 pl-4 leading-7 text-slate-700">{task.examplePrompt}</dd>
        </div>
        {task.note && (
          <div>
            <dt className="sr-only">{FORMAT_LABELS.note}</dt>
            <dd className="leading-7 text-slate-800">{task.note}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-semibold text-slate-950">{FORMAT_LABELS.tips}</dt>
          <dd className="mt-1 text-slate-800">
            <ul className="list-disc space-y-1 pl-5 leading-7 marker:text-slate-400">
              {task.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="mt-6">
        <Link href={task.practiceHref} className={`${cls.btn} ${cls.secondary}`}>
          {FORMAT_LABELS.practise}
          <span className="sr-only">: {task.title}</span>
        </Link>
      </p>
    </section>
  )
}

export function FormatTasks({ tasks }: { tasks: FormatTaskView[] }) {
  return (
    <div className="mt-10 space-y-6">
      <nav aria-label={FORMAT_LABELS.taskNav} className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className={cls.link}>
                {t.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  )
}
