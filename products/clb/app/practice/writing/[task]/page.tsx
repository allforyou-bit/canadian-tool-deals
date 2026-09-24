import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TaskIntro } from '../../../../components/TaskIntro'
import { WritingPractice } from '../../../../components/WritingPractice'
import { taskById, WRITING_TASKS } from '../../../../shared/tasks'

type Params = { task: string }

// Static export: exactly the writing task ids; anything else is a 404.
export const dynamicParams = false

export function generateStaticParams(): Params[] {
  return WRITING_TASKS.map((task) => ({ task: task.id }))
}

function writingTask(id: string) {
  const task = taskById(id)
  return task && task.kind === 'writing' ? task : null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const task = writingTask((await params).task)
  if (!task) return {}
  return {
    title: `${task.title.en} – writing practice`,
    description: task.instructions.en,
  }
}

export default async function WritingTaskPage({ params }: { params: Promise<Params> }) {
  const task = writingTask((await params).task)
  if (!task) notFound()
  return (
    <div className="space-y-8">
      <TaskIntro task={task} />
      <WritingPractice task={task} />
    </div>
  )
}
