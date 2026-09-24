import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SpeakingPractice } from '../../../../components/SpeakingPractice'
import { TaskIntro } from '../../../../components/TaskIntro'
import { SPEAKING_TASKS, taskById } from '../../../../shared/tasks'

type Params = { task: string }

// Static export: exactly the speaking task ids; anything else is a 404.
export const dynamicParams = false

export function generateStaticParams(): Params[] {
  return SPEAKING_TASKS.map((task) => ({ task: task.id }))
}

function speakingTask(id: string) {
  const task = taskById(id)
  return task && task.kind === 'speaking' ? task : null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const task = speakingTask((await params).task)
  if (!task) return {}
  return {
    title: `${task.title.en} – speaking practice`,
    description: task.instructions.en,
  }
}

export default async function SpeakingTaskPage({ params }: { params: Promise<Params> }) {
  const task = speakingTask((await params).task)
  if (!task) notFound()
  return (
    <div className="space-y-8">
      <TaskIntro task={task} />
      <SpeakingPractice task={task} />
    </div>
  )
}
