// Renders content blocks (paragraphs, lists, notes, definition lists) from content/types.ts.
import type { Block } from '../../content/types'
import { tone } from '../ui'
import { Rich } from './Rich'

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (typeof block === 'string') {
          return (
            <p key={i} className="leading-7 text-slate-800">
              <Rich text={block} />
            </p>
          )
        }
        if ('ul' in block) {
          return (
            <ul key={i} className="list-disc space-y-2 pl-6 leading-7 text-slate-800 marker:text-slate-400">
              {block.ul.map((item, j) => (
                <li key={j}>
                  <Rich text={item} />
                </li>
              ))}
            </ul>
          )
        }
        if ('ol' in block) {
          return (
            <ol key={i} className="list-decimal space-y-2 pl-6 leading-7 text-slate-800 marker:text-slate-500">
              {block.ol.map((item, j) => (
                <li key={j}>
                  <Rich text={item} />
                </li>
              ))}
            </ol>
          )
        }
        if ('note' in block) {
          return (
            <div key={i} className={`${tone[block.tone ?? 'info']} text-base leading-7`}>
              <Rich text={block.note} />
            </div>
          )
        }
        return (
          <dl key={i} className="space-y-4">
            {block.dl.map((row, j) => (
              <div key={j}>
                <dt className="font-semibold text-slate-950">
                  <Rich text={row.term} />
                </dt>
                <dd className="mt-1 leading-7 text-slate-800">
                  <Rich text={row.detail} />
                </dd>
              </div>
            ))}
          </dl>
        )
      })}
    </>
  )
}
