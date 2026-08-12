'use client'

import { useRef, useState } from 'react'
import { csvToDrafts } from '@/lib/budget/csv'
import type { CsvImportResult, SignMode } from '@/lib/budget/csv'
import { addTxs, useBudget } from '@/lib/budget/store'
import type { DraftTx } from '@/lib/budget/types'
import { DraftReview } from '../DraftReview'
import { Button, Card, CardTitle, Toast, inputClass } from '../ui'

export default function ImportPage() {
  const { settings } = useBudget()
  const fileInput = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [drafts, setDrafts] = useState<DraftTx[] | null>(null)
  const [signMode, setSignMode] = useState<SignMode>('auto')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const run = (text: string, mode: SignMode) => {
    const parsed = csvToDrafts(text, settings.rules, mode)
    if (parsed.drafts.length === 0) {
      setError('거래를 찾지 못했어요. 날짜와 금액 열이 있는 CSV인지 확인해 주세요.')
      setResult(null)
      setDrafts(null)
      return
    }
    setError(null)
    setResult(parsed)
    setDrafts(parsed.drafts)
  }

  const onFile = async (file: File) => {
    const text = await file.text()
    setRaw(text)
    run(text, signMode)
  }

  const flipSign = (mode: SignMode) => {
    setSignMode(mode)
    if (raw) run(raw, mode)
  }

  if (drafts && result) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-gray-900">CSV 확인</h1>
        <Card>
          <CardTitle>자동 인식 결과</CardTitle>
          <p className="text-sm text-gray-600">
            전체 {result.totalRows}행 중 {result.drafts.length}건 인식
            {result.skipped > 0 && ` · ${result.skipped}행 건너뜀(합계·잔액 행 등)`}
          </p>
          <div className="mt-3">
            <span className="mb-1 block text-xs font-medium text-gray-500">금액 부호 해석</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
              {(
                [
                  ['auto', '자동'],
                  ['positive-expense', '양수=지출'],
                  ['negative-expense', '음수=지출'],
                ] as Array<[SignMode, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => flipSign(value)}
                  className={`rounded-lg py-1.5 text-xs font-semibold ${
                    signMode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              지출과 수입이 반대로 보이면 이 버튼으로 뒤집으세요.
            </p>
          </div>
        </Card>

        <DraftReview
          drafts={drafts}
          currency={settings.currency}
          onChange={setDrafts}
          onCancel={() => {
            setDrafts(null)
            setResult(null)
            setRaw('')
          }}
          onSave={(selected) => {
            const { added, duplicates } = addTxs(selected, 'csv')
            setDrafts(null)
            setResult(null)
            setRaw('')
            setToast(duplicates > 0 ? `${added}건 저장 · 중복 ${duplicates}건 제외` : `${added}건 저장했어요`)
            setTimeout(() => setToast(null), 2400)
          }}
        />
        <Toast message={toast} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">CSV 가져오기</h1>

      <Card>
        <p className="text-sm text-gray-600">
          은행·카드사 사이트에서 내려받은 거래내역 CSV를 넣으면 날짜·금액·가맹점 열을 자동으로 찾아
          분류까지 채웁니다.
        </p>
        <div className="mt-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
            }}
          />
          <Button onClick={() => fileInput.current?.click()} className="w-full">
            CSV 파일 선택
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>또는 직접 붙여넣기</CardTitle>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder={'Date,Description,Amount\n2026-08-12,TIM HORTONS,4.35'}
          className={`${inputClass} resize-y font-mono text-xs`}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button onClick={() => run(raw, signMode)} disabled={raw.trim().length === 0} className="mt-3 w-full">
          읽기
        </Button>
      </Card>

      <Card>
        <CardTitle>은행별 CSV 받는 곳</CardTitle>
        <ul className="space-y-1 text-xs leading-relaxed text-gray-600">
          <li>· TD / RBC / Scotiabank / CIBC / BMO: 온라인뱅킹 → 계좌 선택 → Download transactions → CSV</li>
          <li>· Amex: Statements &amp; Activity → Download → CSV</li>
          <li>· 국내 카드사: 홈페이지 → 이용내역 조회 → 엑셀 저장 후 CSV로 변환</li>
        </ul>
      </Card>

      <Toast message={toast} />
    </div>
  )
}
