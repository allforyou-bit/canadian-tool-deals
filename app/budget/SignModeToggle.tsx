'use client'

import type { SignMode } from '@/lib/budget/csv'

const OPTIONS: Array<[SignMode, string]> = [
  ['auto', '자동'],
  ['positive-expense', '양수=지출'],
  ['negative-expense', '음수=지출'],
]

/** Statement exports disagree on which sign means "spent", so let the user flip it. */
export function SignModeToggle({
  value,
  onChange,
}: {
  value: SignMode
  onChange: (mode: SignMode) => void
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-500">금액 부호 해석</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {OPTIONS.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`rounded-lg py-1.5 text-xs font-semibold ${
              value === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">지출과 수입이 반대로 보이면 이 버튼으로 뒤집으세요.</p>
    </div>
  )
}
