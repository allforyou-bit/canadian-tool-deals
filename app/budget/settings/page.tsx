'use client'

import { useRef, useState } from 'react'
import { EXPENSE_CATEGORIES } from '@/lib/budget/categories'
import {
  clearAll,
  exportJson,
  replaceAll,
  saveSettings,
  txsToCsv,
  useBudget,
  useHydrated,
} from '@/lib/budget/store'
import { formatMoney } from '@/lib/budget/stats'
import type { BudgetState, Rule, Settings } from '@/lib/budget/types'
import { Button, Card, CardTitle, Field, Toast, inputClass } from '../ui'

export default function SettingsPage() {
  const state = useBudget()
  const hydrated = useHydrated()
  const [toast, setToast] = useState<string | null>(null)

  const flash = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2400)
  }

  if (!hydrated) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">설정</h1>
      <BudgetSettings settings={state.settings} />
      <RuleSettings settings={state.settings} onSaved={flash} />
      <AutomationGuide onCopied={flash} />
      <BackupSettings state={state} onDone={flash} />
      <Toast message={toast} />
    </div>
  )
}

function BudgetSettings({ settings }: { settings: Settings }) {
  const totalCategoryBudget = Object.values(settings.categoryBudgets).reduce((sum, v) => sum + (v || 0), 0)

  return (
    <Card className="space-y-3">
      <CardTitle>예산과 통화</CardTitle>

      <Field label="통화">
        <select
          value={settings.currency}
          onChange={(e) => saveSettings({ currency: e.target.value as Settings['currency'] })}
          className={inputClass}
        >
          <option value="CAD">CAD — 캐나다 달러</option>
          <option value="KRW">KRW — 원</option>
          <option value="USD">USD — 미국 달러</option>
        </select>
      </Field>

      <Field label="한 달 예산 (0이면 사용 안 함)">
        <input
          type="number"
          inputMode="decimal"
          value={settings.monthlyBudget || ''}
          placeholder="0"
          onChange={(e) => saveSettings({ monthlyBudget: Number(e.target.value) || 0 })}
          className={inputClass}
        />
      </Field>

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">분류별 예산 (선택)</span>
        <ul className="space-y-1.5">
          {EXPENSE_CATEGORIES.map((category) => (
            <li key={category.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-gray-700">
                <span aria-hidden>{category.emoji}</span> {category.name}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={settings.categoryBudgets[category.id] || ''}
                placeholder="0"
                onChange={(e) =>
                  saveSettings({
                    categoryBudgets: {
                      ...settings.categoryBudgets,
                      [category.id]: Number(e.target.value) || 0,
                    },
                  })
                }
                className={`${inputClass} py-2 text-sm`}
              />
            </li>
          ))}
        </ul>
        {totalCategoryBudget > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            분류 예산 합계 {formatMoney(totalCategoryBudget, settings.currency, true)}
          </p>
        )}
      </div>
    </Card>
  )
}

function RuleSettings({ settings, onSaved }: { settings: Settings; onSaved: (message: string) => void }) {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id)

  const add = () => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    const rule: Rule = { id: `${Date.now()}`, keyword: trimmed, category }
    saveSettings({ rules: [rule, ...settings.rules] })
    setKeyword('')
    onSaved('규칙을 추가했어요')
  }

  const remove = (id: string) => {
    saveSettings({ rules: settings.rules.filter((r) => r.id !== id) })
  }

  return (
    <Card className="space-y-3">
      <CardTitle>내 분류 규칙</CardTitle>
      <p className="text-xs text-gray-500">
        가맹점 이름에 이 단어가 들어가면 해당 분류로 자동 저장됩니다. 기본 규칙보다 우선합니다.
      </p>

      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 스타벅스, COSTCO"
          className={`${inputClass} py-2 text-sm`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} w-36 py-2 text-sm`}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
        <Button onClick={add} disabled={!keyword.trim()}>
          추가
        </Button>
      </div>

      {settings.rules.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {settings.rules.map((rule) => {
            const target = EXPENSE_CATEGORIES.find((c) => c.id === rule.category)
            return (
              <li key={rule.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="truncate text-gray-800">
                  <span className="font-medium">{rule.keyword}</span>
                  <span className="text-gray-400"> → </span>
                  {target?.emoji} {target?.name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(rule.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function AutomationGuide({ onCopied }: { onCopied: (message: string) => void }) {
  // Read on the client only — the URL depends on where the app is deployed.
  const origin = useHydrated() ? window.location.origin : ''
  const ingestUrl = `${origin}/budget/ingest?auto=1&text=`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ingestUrl)
      onCopied('주소를 복사했어요')
    } catch {
      onCopied('복사가 막혀 있어요. 주소를 길게 눌러 복사하세요.')
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>휴대폰 자동 등록</CardTitle>
      <p className="text-sm text-gray-600">
        결제 문자가 오면 자동으로 가계부에 쌓이게 만들 수 있어요. 아래 주소 뒤에 문자 내용을 붙여 여는
        방식입니다.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-3 text-[11px] break-all whitespace-pre-wrap text-gray-100">
        {ingestUrl}
      </pre>
      <Button variant="secondary" onClick={copy} className="w-full">
        주소 복사
      </Button>

      <details className="rounded-xl bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          아이폰 (단축어 앱)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-gray-600">
          <li>단축어 앱 → 자동화 → 새 자동화 → &ldquo;메시지&rdquo;를 선택합니다.</li>
          <li>보낸 사람에 카드사·은행 번호를 넣고, &ldquo;즉시 실행&rdquo;으로 설정합니다.</li>
          <li>동작으로 &ldquo;URL 열기&rdquo;를 추가하고, 위 주소 뒤에 &ldquo;메시지 내용&rdquo; 변수를 붙입니다.</li>
          <li>테스트로 문자를 하나 받아 보면 자동 저장 화면이 뜹니다.</li>
        </ol>
      </details>

      <details className="rounded-xl bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          안드로이드 (MacroDroid · Tasker)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-gray-600">
          <li>트리거: SMS 수신(발신번호에 카드사 번호 지정).</li>
          <li>동작: 웹페이지 열기 → 위 주소 + [sms_message] 변수.</li>
          <li>브라우저가 열리며 자동 저장됩니다. 배경 실행을 원하면 &ldquo;HTTP 요청&rdquo; 대신 브라우저 열기를 사용하세요.</li>
        </ol>
      </details>

      <details className="rounded-xl bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          자동화 없이 쓰는 방법
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          문자를 길게 눌러 복사한 뒤 &ldquo;입력 → 문자 붙여넣기&rdquo;에 붙여넣으면 됩니다. 여러 건을 한 번에
          붙여넣어도 각각 분리해서 인식합니다. 홈 화면에 추가해 두면 앱처럼 열립니다.
        </p>
      </details>

      <p className="text-[11px] leading-relaxed text-gray-400">
        데이터는 이 브라우저 안에만 저장됩니다. 자동화는 평소 쓰는 브라우저에서 열어야 같은 데이터에
        쌓입니다(홈 화면 앱과 브라우저의 저장 공간이 분리될 수 있어요).
      </p>
    </Card>
  )
}

function BackupSettings({ state, onDone }: { state: BudgetState; onDone: (message: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const stamp = new Date().toISOString().slice(0, 10)

  const restore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BudgetState
      if (!Array.isArray(parsed.txs)) throw new Error('bad file')
      replaceAll(parsed)
      onDone(`${parsed.txs.length}건을 복원했어요`)
    } catch {
      onDone('백업 파일을 읽지 못했어요')
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>백업과 초기화</CardTitle>
      <p className="text-xs text-gray-500">
        내역 {state.txs.length}건이 이 기기에 저장돼 있어요. 기기를 바꾸기 전에 백업을 받아 두세요.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => download(exportJson(state), `budget-backup-${stamp}.json`, 'application/json')}
        >
          백업 내려받기
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          백업 복원
        </Button>
        <Button
          variant="secondary"
          onClick={() => download(txsToCsv(state.txs), `budget-${stamp}.csv`, 'text/csv')}
          className="col-span-2"
        >
          CSV로 내보내기
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void restore(file)
        }}
      />
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (window.confirm('모든 내역과 설정을 지웁니다. 되돌릴 수 없어요. 계속할까요?')) {
            clearAll()
            onDone('모두 지웠어요')
          }
        }}
      >
        전체 삭제
      </Button>
    </Card>
  )
}
