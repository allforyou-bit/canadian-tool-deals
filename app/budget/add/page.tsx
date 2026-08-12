'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EXPENSE_CATEGORIES, guessCategory } from '@/lib/budget/categories'
import { parseMessages, today } from '@/lib/budget/parse'
import { addTxs, useBudget } from '@/lib/budget/store'
import { formatMoney } from '@/lib/budget/stats'
import type { DraftTx } from '@/lib/budget/types'
import { DraftReview } from '../DraftReview'
import { Button, Card, Field, Toast, inputClass } from '../ui'

type Tab = 'quick' | 'paste'

export default function AddPage() {
  const [tab, setTab] = useState<Tab>('paste')
  const [toast, setToast] = useState<string | null>(null)

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">내역 추가</h1>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200/70 p-1">
        {(
          [
            ['paste', '문자 붙여넣기'],
            ['quick', '직접 입력'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'paste' ? <PasteForm onSaved={flash} /> : <QuickForm onSaved={flash} />}

      <Toast message={toast} />
    </div>
  )
}

const SAMPLE = `[Web발신]
신한카드(1234)승인
12,000원 일시불
08/12 14:23 스타벅스강남점`

function PasteForm({ onSaved }: { onSaved: (message: string) => void }) {
  const { settings } = useBudget()
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<DraftTx[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parse = () => {
    const parsed = parseMessages(text, settings.rules)
    if (parsed.length === 0) {
      setError('금액을 찾지 못했어요. 문자 전체를 그대로 붙여넣어 보세요.')
      setDrafts(null)
      return
    }
    setError(null)
    setDrafts(parsed)
  }

  if (drafts) {
    return (
      <DraftReview
        drafts={drafts}
        currency={settings.currency}
        onChange={setDrafts}
        onCancel={() => setDrafts(null)}
        onSave={(selected) => {
          const { added, duplicates } = addTxs(selected, 'sms')
          setDrafts(null)
          setText('')
          onSaved(
            duplicates > 0 ? `${added}건 저장 · 중복 ${duplicates}건 제외` : `${added}건 저장했어요`,
          )
        }}
      />
    )
  }

  return (
    <Card>
      <p className="mb-2 text-sm text-gray-600">
        카드 승인 문자나 은행 알림을 그대로 붙여넣으세요. 여러 건을 한 번에 붙여넣어도 됩니다.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={SAMPLE}
        className={`${inputClass} resize-y font-mono text-sm`}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={parse} disabled={text.trim().length === 0} className="flex-1">
          자동으로 읽기
        </Button>
        <Button variant="secondary" onClick={() => setText(SAMPLE)}>
          예시 넣기
        </Button>
      </div>
    </Card>
  )
}

function QuickForm({ onSaved }: { onSaved: (message: string) => void }) {
  const router = useRouter()
  const { txs, settings } = useBudget()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(today())
  const [account, setAccount] = useState('')

  const knownAccounts = useMemo(
    () => [...new Set(txs.map((tx) => tx.account).filter(Boolean))].slice(0, 12),
    [txs],
  )

  const numericAmount = Number(amount)
  const canSave = Number.isFinite(numericAmount) && numericAmount > 0

  const save = (stay: boolean) => {
    if (!canSave) return
    addTxs(
      [
        {
          date,
          amount: numericAmount,
          type,
          merchant: merchant.trim() || (type === 'income' ? '수입' : '지출'),
          category: type === 'income' ? 'income' : category,
          account: account.trim() || '직접 입력',
          raw: '',
          confidence: 1,
        },
      ],
      'manual',
    )
    onSaved('저장했어요')
    setAmount('')
    setMerchant('')
    if (!stay) router.push('/budget')
  }

  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ['expense', '지출'],
            ['income', '수입'],
          ] as Array<['expense' | 'income', string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={`rounded-lg py-1.5 text-sm font-semibold ${
              type === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Field label="금액">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className={`${inputClass} text-2xl font-bold tabular-nums`}
        />
      </Field>
      {canSave && (
        <p className="-mt-1 text-xs text-gray-400">{formatMoney(numericAmount, settings.currency)}</p>
      )}

      <Field label="내용">
        <input
          value={merchant}
          onChange={(e) => {
            setMerchant(e.target.value)
            if (type === 'expense') setCategory(guessCategory(e.target.value, settings.rules, category))
          }}
          placeholder="예: 이마트, Tim Hortons"
          className={inputClass}
        />
      </Field>

      {type === 'expense' && (
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-500">분류</span>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  category === c.id
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                <span aria-hidden>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="결제 수단">
          <input
            list="known-accounts"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="예: 신한카드, TD Visa"
            className={inputClass}
          />
          <datalist id="known-accounts">
            {knownAccounts.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={() => save(false)} disabled={!canSave} className="flex-1">
          저장하고 홈으로
        </Button>
        <Button variant="secondary" onClick={() => save(true)} disabled={!canSave}>
          계속 입력
        </Button>
      </div>
    </Card>
  )
}
