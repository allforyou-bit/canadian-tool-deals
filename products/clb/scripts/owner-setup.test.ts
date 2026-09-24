// Consistency tests for the owner's Korean step-by-step guide, business/online/owner-setup.md (memo §7.2,
// zero-capital launch). The guide is read as text (`?raw`, as ops-docs.test.ts does) and checked against the
// workflows, scripts/deploy-config.ts, the Worker and the config it describes, so a renamed variable, secret,
// workflow, input, Stripe event or price that the guide does not follow fails CI:
//   - every MPC_* name and every secret-like name the guide mentions exists in the workflows or deploy-config.ts;
//   - every name production deploys require (deploy-config.ts checkDeployConfig, deploy.yml) is in the guide;
//   - the workflow names and inputs the owner is told to click exist;
//   - no ads (memo §7.2 Z1), no terminal commands for the owner (the one-time Cloudflare setup is a workflow);
//   - the sections other files point to (Gate B, 위험 수용, privacy requests, breach log, end_pass, Stripe
//     customer emails off, ServiceOntario) exist, and old section numbers cited elsewhere are mapped.
import { describe, expect, it } from 'vitest'
import anthropicLimitText from '../../../ops/config/anthropic-limit.json?raw'
import dailyRoutine from '../../../ops/routines/daily.md?raw'
import memo from '../../../business/online/decision-memo.md?raw'
import guide from '../../../business/online/owner-setup.md?raw'
import siteText from '../content/site.ts?raw'
import i18nText from '../lib/i18n.ts?raw'
import { AI_DISCLOSURE, REFUND_POLICY, SKUS } from '../shared/config'
import { STRIPE_API_VERSION } from '../worker/src/billing/stripe'
import accountText from '../worker/src/account.ts?raw'
import webhookText from '../worker/src/billing/webhook.ts?raw'
import wranglerText from '../worker/wrangler.jsonc?raw'
import { checkDeployConfig, GOOGLE_CALLBACK_PATH, parseJsonc, wranglerSection } from './deploy-config'
import deployConfigText from './deploy-config.ts?raw'
import reconcileTestText from './reconcile.test.ts?raw'

// Vite's import.meta.glob (transformed at build time). scripts/tsconfig.json does not load vite/client, so the
// one signature used here is declared locally.
declare global {
  interface ImportMeta {
    glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, unknown>
  }
}

// Every workflow file, found by Vite's import.meta.glob so a new workflow (such as the one-time Cloudflare
// setup) is picked up without editing this test.
const WORKFLOW_FILES = import.meta.glob('../../../.github/workflows/*.yml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const WORKFLOWS: Record<string, string> = Object.fromEntries(
  Object.entries(WORKFLOW_FILES).map(([path, text]) => [path.split('/').pop() ?? path, text]),
)
const ALL_WORKFLOW_TEXT = Object.values(WORKFLOWS).join('\n')
/** scripts/cloudflare-setup.ts as text, if present (the one-time setup workflow runs it). */
const SETUP_SCRIPT = import.meta.glob('./cloudflare-setup.ts', { query: '?raw', import: 'default', eager: true })
const KNOWN_NAMES_TEXT = `${ALL_WORKFLOW_TEXT}\n${deployConfigText}`

/** The top-level `name:` of a workflow file. */
function workflowName(text: string): string {
  const m = /^name:\s*(.+)$/m.exec(text)
  return (m?.[1] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2')
}

/** The workflow_dispatch input names of a workflow file (keys indented under `inputs:`). */
function dispatchInputs(text: string): string[] {
  const block = /workflow_dispatch:\s*\n\s+inputs:\s*\n((?:\s{6,}.*\n)+)/.exec(text)
  if (!block) return []
  return [...block[1].matchAll(/^ {6}([a-z_]+):\s*$/gm)].map((m) => m[1])
}

/** The workflow whose file name is `file`, or undefined. */
const workflow = (file: string): string | undefined => WORKFLOWS[file]

/**
 * The guide without bold markers, for quoting checks: a quoted label is written "**Label**" (bold inside the
 * quotes) so CommonMark closes the bold before a Korean particle, e.g. "**Settings**"를.
 */
const plain = guide.replace(/\*\*/g, '')

/** `## …` / `### …` headings of the guide. */
const HEADINGS = guide.split('\n').filter((l) => /^#{2,3} /.test(l))

/** The text of the section that starts at the first heading matching `re`, up to the next heading of the same or a higher level. */
function section(re: RegExp): string {
  const lines = guide.split('\n')
  const start = lines.findIndex((l) => /^#{2,3} /.test(l) && re.test(l))
  if (start < 0) return ''
  const level = (lines[start].match(/^#+/) ?? [''])[0].length
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+) /.exec(lines[i])
    if (m && m[1].length <= level) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/** The numbered steps of `text` in order: each `N. …` line with the indented lines under it. */
function numberedSteps(text: string): string[] {
  const out: string[] = []
  let open = false
  for (const line of text.split('\n')) {
    if (/^\d+\. /.test(line)) {
      out.push(line)
      open = true
    } else if (open && /^\s+\S/.test(line)) out[out.length - 1] += `\n${line}`
    else if (line.trim() !== '') open = false
  }
  return out
}

/** The position of the first numbered step of `text` that matches every regex, or -1. */
const stepIndex = (text: string, ...res: RegExp[]): number => numberedSteps(text).findIndex((s) => res.every((re) => re.test(s)))

/** Memo §7.2 (zero-capital launch), which the guide's honest expectations quote. */
const MEMO_72 = memo.slice(memo.indexOf('### 7.2 '), memo.indexOf('\n## 8. '))

/** Upper-case identifiers with an underscore written in backticks, e.g. `STRIPE_SECRET_KEY`. */
const backtickedNames = (text: string): string[] => [...new Set([...text.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]))]

// Names in backticks that are not repository variables or secrets: a Claude Code environment variable
// the owner may set in the session's cloud environment (section 12).
const NOT_REPO_SETTINGS = new Set(['CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION'])

describe('owner-setup.md: names match the workflows and deploy-config.ts', () => {
  it('every MPC_* name in the guide is read by a workflow or by deploy-config.ts', () => {
    const names = [...new Set([...guide.matchAll(/\bMPC_[A-Z0-9_]+\b/g)].map((m) => m[0]))]
    expect(names.length).toBeGreaterThan(10)
    const unknown = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(KNOWN_NAMES_TEXT))
    expect(unknown, 'MPC_* names in the guide that no workflow or deploy-config.ts reads').toEqual([])
    // MPC_STAGING (a PR-staging switch) was removed with the zero-capital launch (memo §7.2 Z7)
    expect(guide).not.toMatch(/\bMPC_STAGING\b(?!_)/)
  })

  it('every secret or variable name in backticks exists in the workflows or deploy-config.ts', () => {
    const names = backtickedNames(guide).filter((n) => !NOT_REPO_SETTINGS.has(n))
    const unknown = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(KNOWN_NAMES_TEXT))
    expect(unknown, 'names in the guide that no workflow or deploy-config.ts uses').toEqual([])
  })

  it('every secret the workflows read is explained in the guide (secrets table)', () => {
    const secrets = [...new Set([...ALL_WORKFLOW_TEXT.matchAll(/secrets\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))].filter((n) => n !== 'GITHUB_TOKEN')
    expect(secrets.length).toBeGreaterThan(8)
    const table = section(/비밀\(Secrets\) 표/)
    expect(table).not.toBe('')
    for (const s of secrets) expect(table, s).toContain(`| \`${s}\` |`)
  })

  it('every name a production deploy requires (deploy-config.ts, deploy.yml) is in the guide and marked required', () => {
    // run the real configuration check with nothing configured: its errors name every required variable/secret
    const r = checkDeployConfig({ target: 'production', env: {}, wranglerText, anthropicLimitText })
    // only repository settings: MPC_* variables and the secrets the workflows read (not Worker var names)
    const repoSecrets = new Set([...ALL_WORKFLOW_TEXT.matchAll(/secrets\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))
    const fromErrors = [...new Set(r.errors.flatMap((e) => [...e.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map((m) => m[0])))].filter(
      (n) => n.startsWith('MPC_') || repoSecrets.has(n),
    )
    for (const n of ['MPC_SITE_URL', 'MPC_LEGAL_NAME', 'MPC_OWNER_EMAIL', 'MPC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'MPC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET']) {
      expect(fromErrors, `deploy-config.ts no longer requires ${n}; update this test and the guide`).toContain(n)
    }
    // deploy.yml: Cloudflare secrets (else the deploy is skipped), the first-deploy salt, the production switch
    const deployYml = workflow('deploy.yml') ?? ''
    expect(deployYml).toMatch(/vars\.MPC_DEPLOY == 'true'/)
    expect(deployYml).toMatch(/First deploy needs the HASH_SALT secret/)
    const required = [...fromErrors, 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'HASH_SALT', 'MPC_DEPLOY']
    const tables = `${section(/비밀\(Secrets\) 표/)}\n${section(/변수\(Variables\) 표/)}`
    for (const n of required) {
      const row = tables.split('\n').find((l) => l.startsWith(`| \`${n}\` |`))
      expect(row, `${n} has no row in the guide's secrets/variables tables`).toBeDefined()
      expect(row, `${n} is required for production but its row does not say so`).toMatch(/\*\*필수|필수/)
    }
    // 8-2 lists what the first production deploy checks
    const firstDeploy = section(/8-2\./)
    for (const n of fromErrors) expect(firstDeploy, n).toContain(n)
  })

  it('names the Google callback, the Stripe webhook path, its five events and the pinned API version', () => {
    expect(guide).toContain(`<운영 주소>${GOOGLE_CALLBACK_PATH}`)
    expect(guide).toContain(`<스테이징 주소>${GOOGLE_CALLBACK_PATH}`)
    const events = [...webhookText.matchAll(/^\s+case '([a-z_.]+)':/gm)].map((m) => m[1])
    expect(events).toHaveLength(5)
    const stripe = section(/4-4\. Stripe/)
    for (const e of events) expect(stripe, e).toContain(`\`${e}\``)
    expect(stripe).toMatch(/정확히 5개/)
    expect(stripe).toContain(`\`${STRIPE_API_VERSION}\``)
    expect(guide).toContain('/api/stripe/webhook')
  })

  it('uses the Worker names from wrangler.jsonc for the workers.dev addresses', () => {
    const config = parseJsonc(wranglerText) as Record<string, unknown>
    const prod = String(config.name)
    const staging = String((wranglerSection(config, 'staging') ?? {}).name)
    expect(guide).toContain(`https://${prod}.<내 서브도메인>.workers.dev`)
    expect(guide).toContain(`https://${staging}.<내 서브도메인>.workers.dev`)
  })

  it('names the ops/config/anthropic-limit.json fields that exist, with the file’s limits', () => {
    const limit = JSON.parse(anthropicLimitText) as Record<string, unknown>
    for (const f of ['prepaidUsd', 'prepaidSince', 'monthlyLimitUsd', 'evalMonthlyLimitUsd', 'confirmedByOwner']) {
      expect(Object.keys(limit), f).toContain(f)
      expect(guide, f).toContain(`\`${f}\``)
    }
    const anthropic = section(/4-5\. Anthropic/)
    expect(anthropic).toContain(`production 한도 US$${limit.monthlyLimitUsd}`)
    expect(anthropic).toContain(`eval 한도 US$${limit.evalMonthlyLimitUsd}`)
  })

  it('quotes the site’s own button labels and AI notice (lib/i18n.ts, content/site.ts, shared/config.ts)', () => {
    const labels: [string, string][] = [
      ['Continue with Google', i18nText],
      ['Request a refund', i18nText],
      ['View receipt', i18nText],
      ['I live in Canada, outside Quebec', i18nText],
      ['Practise without feedback', siteText],
    ]
    for (const [label, source] of labels) {
      expect(source, `the site no longer has the label "${label}"`).toContain(`'${label}'`)
      expect(plain, label).toContain(`"${label}"`)
    }
    expect(plain).toContain(`"${AI_DISCLOSURE.en.split('. ')[0]}. …"`)
  })

  it('quotes the pass prices from shared/config.ts', () => {
    const c30 = `C$${SKUS.pass30.priceCents / 100}`
    expect(section(/8-6\./)).toContain(`${c30}(30일 이용권)`)
    expect(section(/9-8\./)).toContain(`C$${SKUS.pass30.priceCents / 100} 30일 이용권`)
  })
})

describe('owner-setup.md: workflows and inputs the owner is told to use', () => {
  const byName = Object.fromEntries(Object.values(WORKFLOWS).map((t) => [workflowName(t), t]))

  it('every workflow the guide names in quotes exists with that exact name', () => {
    const named = ['Deploy practice coach', 'Set a kill switch', 'Level-B checks', 'Grading eval', 'Reconcile payments', 'Daily metrics', 'CI']
    for (const n of named) {
      expect(Object.keys(byName), `no workflow is named "${n}"`).toContain(n)
      expect(plain, n).toContain(`"${n}"`)
    }
  })

  it('deploy.yml has the target and rollback_drill inputs the guide uses', () => {
    const inputs = dispatchInputs(workflow('deploy.yml') ?? '')
    expect(inputs).toEqual(expect.arrayContaining(['target', 'rollback_drill']))
    expect(section(/7-4\./)).toMatch(/`rollback_drill`/)
    expect(workflow('deploy.yml')).toContain('Rollback drill passed')
    expect(section(/7-4\./)).toContain('Rollback drill passed')
  })

  it('flags.yml offers exactly the switches the guide lists, with flag/value/target inputs', () => {
    const flags = workflow('flags.yml') ?? ''
    expect(dispatchInputs(flags)).toEqual(['flag', 'value', 'target'])
    const options = /flag:[\s\S]*?options:\s*\n((?:\s+- .+\n)+)/.exec(flags)?.[1] ?? ''
    const offered = [...options.matchAll(/- (\S+)/g)].map((m) => m[1])
    expect(offered.sort()).toEqual(['banner', 'checkout_enabled', 'free_enabled', 'grading_enabled'])
    const kill = section(/9-4\./)
    for (const f of offered) expect(kill, f).toContain(`| \`${f}\` |`)
  })

  it('level-b.yml takes target (and the guide runs it on staging)', () => {
    expect(dispatchInputs(workflow('level-b.yml') ?? '')).toEqual(expect.arrayContaining(['target', 'cache_check']))
    expect(section(/7-2\./)).toMatch(/"Level-B checks"[^\n]*`target`: `staging`/)
  })

  it('the one-time Cloudflare setup is a workflow run, and its name and inputs match when the file exists', () => {
    const setup = section(/^## 6\./)
    expect(setup.replace(/\*\*/g, '')).toContain('"Set up Cloudflare (one time)"')
    expect(setup).toMatch(/`target`\S*은 \*\*`both`\*\*/)
    expect(setup).toContain('클라우드플레어 설정 결과야')
    // the phrase and the summary title come from scripts/cloudflare-setup.ts, when that script exists
    const script = Object.values(SETUP_SCRIPT)[0] as string | undefined
    if (script !== undefined) {
      expect(script).toContain("CLAUDE_PHRASE = '클라우드플레어 설정 결과야'")
      expect(script).toContain("'완료'")
      expect(setup.replace(/\*\*/g, '')).toContain(': 완료"')
    }
    const file = workflow('setup-cloudflare.yml')
    if (file !== undefined) {
      expect(workflowName(file)).toBe('Set up Cloudflare (one time)')
      expect(dispatchInputs(file)).toContain('target')
      for (const o of ['production', 'staging', 'both']) expect(file, o).toMatch(new RegExp(`- ${o}\\b`))
      expect(file).toMatch(/secrets\.CLOUDFLARE_API_TOKEN/)
      expect(file).toMatch(/secrets\.CLOUDFLARE_ACCOUNT_ID/)
    }
  })
})

describe('owner-setup.md: zero capital, no terminal, no secrets in chat', () => {
  it('has no ads plan (memo §7.2 Z1): every line that mentions 광고 says there are none', () => {
    expect(guide).not.toMatch(/Google Ads|Gate C|광고비|광고 예산|MPC_GADS|ad-cap|ops\/ads|Ads Editor|캠페인|conversion tag/i)
    const lines = guide.split('\n').filter((l) => l.includes('광고'))
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) expect(l, l).toMatch(/없|않|금지|아니/)
  })

  it('never asks the owner to run a terminal command', () => {
    expect(guide).not.toMatch(/npx wrangler|wrangler (login|d1|kv|deploy)|npm (ci|install|run)|node -e|```(bash|sh|shell)|\bcurl\b/)
  })

  it('states the no-secrets-in-chat rule, and no "say this to Claude" line carries a key-shaped value', () => {
    expect(guide).toMatch(/키, 토큰, 비밀번호, 비밀 값은 절대 Claude 대화창에 붙여 넣지 마세요/)
    const say = guide.split('\n').filter((l) => l.includes('💬'))
    expect(say.length).toBeGreaterThan(15)
    for (const l of say) expect(l, l).not.toMatch(/sk_(live|test)_|rk_(live|test)_|whsec_|sk-ant-|GOCSPX-|cfut_|\bre_[A-Za-z0-9]{6,}/)
  })

  it('names the only required spend (Anthropic credits, auto-reload off) and a cost line on every account lesson', () => {
    expect(guide).toMatch(/약 US\$10 \(약 C\$13\.70\) — 이 안내서에서 유일한 필수 지출/)
    expect(guide).toMatch(/자동 충전은 \*\*꺼요\(OFF\)\.\*\*/)
    for (const re of [/4-1\. Cloudflare/, /4-2\. Google/, /4-3\. Resend/, /4-4\. Stripe/, /4-5\. Anthropic/, /^## 1\./, /^## 5\./, /^## 6\./]) {
      expect(section(re), String(re)).toMatch(/\*\*비용: /)
    }
    // no paid plan is suggested: Workers Paid, GitHub Pro and a payment method stay off
    expect(section(/1-2\./)).toMatch(/결제수단\(카드\)을 등록하지 마세요/)
    expect(section(/4-1\. Cloudflare/)).toMatch(/올리지 않아요/)
  })

  it('gives honest expectations at the top (memo §7.2): well below 1%, cash at risk C$15–100', () => {
    const top = section(/솔직한 기대치/)
    expect(top).toMatch(/1%보다 훨씬 낮아요/)
    expect(top).toMatch(/C\$15–100/)
    expect(top).toMatch(/\+C\$8.*\+C\$66/)
    expect(top.split('\n').filter((l) => /^\d\. /.test(l))).toHaveLength(3)
  })

  it('gives the expected results as memo §7.2 does: before the one-time credit purchase, a loss with no sales', () => {
    const top = section(/솔직한 기대치/)
    // every C$ figure at the top is one memo §7.2 prints: no figures of the guide's own
    const figures = [...new Set([...top.matchAll(/[+−-]?C\$[\d,.]+(?:–[\d,.]+)?/g)].map((m) => m[0].replace(/[,.]+$/, '')))]
    expect(figures.length).toBeGreaterThan(4)
    for (const f of figures) expect(MEMO_72, `${f} is not a memo §7.2 figure`).toContain(f)
    // the memo's table leaves the credit purchase out and subtracts it right under the table; with zero sales
    // (the likeliest case) the owner is down by that purchase, not up by the table's +C$8
    const credit = /Minus the one-time Anthropic credit purchase \(≈ (C\$[\d.]+–[\d.]+)\)/.exec(MEMO_72)?.[1]
    expect(credit, 'memo §7.2 no longer names the credit purchase under its table').toBeDefined()
    const outcome = top.split('\n').find((l) => l.includes('+C$8')) ?? ''
    expect(outcome).toContain(String(credit))
    expect(outcome).toMatch(/빼기 전/)
    expect(outcome).toMatch(/0건이면[^.]*손해/)
    expect(outcome).toMatch(/\(추정\)/)
  })

  it('every step has a time estimate and the guide gives a total', () => {
    for (const re of [/^## 0\./, /^## 1\./, /^## 2\./, /^## 5\./, /^## 6\./, /^## 7\./, /^## 8\./, /^## 10\./, /^## 12\./]) {
      expect(section(re), String(re)).toMatch(/시간: /)
    }
    expect(section(/0-3\./)).toMatch(/\| \*\*합계\*\* \|/)
  })
})

describe('owner-setup.md: steps that must happen in a safe order', () => {
  it('7-3 and 8-6 do the iPhone speaking test while the pass is active: before the self-refund, within the refund rule', () => {
    for (const re of [/7-3\./, /8-6\./]) {
      const s = section(re)
      const speaking = stepIndex(s, /iPhone/, /Safari/)
      const refund = stepIndex(s, /"Request a refund"/)
      expect(speaking, `${re}: no iPhone speaking step`).toBeGreaterThanOrEqual(0)
      expect(refund, `${re}: no self-refund step`).toBeGreaterThanOrEqual(0)
      // speaking feedback needs a pass (else the one free sample, which may be used or switched off) and a
      // self-refund ends the pass, so a speaking test after the refund can fail for a reason that is not iOS
      expect(speaking, `${re}: the iPhone speaking step comes after the self-refund`).toBeLessThan(refund)
      expect(s, String(re)).toContain('말하기 피드백에는 이용권이 필요하고, 셀프 환불은 이용권을 끝내요')
    }
    expect(section(/8-6\./)).toContain(`AI 피드백 ${REFUND_POLICY.maxGradedTasksUsed}회 이하`)
  })

  it('re-records the Console balance after the step-7 spend, before the first production deploy (4-5, 8-2, 8-3, 9-3)', () => {
    // the production Worker counts only its own spend since prepaidSince (deploy.yml passes the prepaid pair to
    // production only), so step 7's staging, eval and level-B runs leave it believing the first purchase is intact
    const deployYml = workflow('deploy.yml') ?? ''
    expect(deployYml).toMatch(/ANTHROPIC_PREPAID_USD:\$PREPAID_USD/)
    expect(deployYml).toContain("- 'ops/config/anthropic-limit.json'")
    const firstDeploy = section(/8-2\./)
    const rerecord = stepIndex(firstDeploy, /Console/, /잔액/, /산 게 없어도/, /`prepaidUsd`/, /`prepaidSince`/, /직접 병합/)
    expect(rerecord, '8-2 has no step that re-records the Console balance').toBeGreaterThanOrEqual(0)
    // merged before MPC_DEPLOY is set (so the merge itself deploys nothing) and before the first production run
    expect(stepIndex(firstDeploy, /`MPC_DEPLOY`/)).toBeGreaterThan(rerecord)
    expect(stepIndex(firstDeploy, /"Deploy practice coach"/, /`production`/)).toBeGreaterThan(rerecord)
    // 4-5 ⑤ and the 8-3 checklist point to that step by its number
    const n = /^(\d+)\. /.exec(numberedSteps(firstDeploy)[rerecord] ?? '')?.[1]
    expect(section(/4-5\. Anthropic/)).toContain(`(8-2 ${n}번)`)
    const checklist = section(/8-3\./).split('\n').filter((l) => l.startsWith('- [ ] '))
    expect(checklist.some((l) => /Console 잔액/.test(l) && /다시 적/.test(l) && l.includes(`(8-2 ${n}번)`)), '8-3 has no re-record checkbox').toBe(true)
    // 9-3: after eval, staging or level-B runs, re-record even with no purchase, in the form the daily Routine reads
    const topUp = section(/9-3\./)
    const start = topUp.indexOf('산 게 없어도')
    const end = topUp.indexOf('**순서가 중요해요:**')
    expect(start, '9-3 does not say to re-record the balance after runs that spend credits').toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = topUp.slice(start, end)
    for (const s of ['"Grading eval"', '"Level-B checks"', '`staging`', 'Console', '`prepaidUsd`', '`prepaidSince`', '직접 병합']) expect(block, s).toContain(s)
    const title = /\*\*"(Anthropic credits: top up)"\*\*/.exec(block)?.[1]
    expect(title, '9-3 does not name the top-up issue').toBeDefined()
    expect(dailyRoutine).toContain(`**"${title}"**`)
    expect(block).toMatch(/`잔액 US\$[\d.]+`/)
    expect(dailyRoutine).toMatch(/`잔액 US\$[\d.]+`/)
    expect(dailyRoutine).toMatch(/even if you bought nothing/)
  })
})

describe('owner-setup.md: sections other files and the memo point to', () => {
  it('keeps the steps in the agreed order', () => {
    const steps = HEADINGS.filter((h) => /^## \d+\. /.test(h)).map((h) => Number(/^## (\d+)\./.exec(h)?.[1]))
    expect(steps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('has Gate 0, Gate B and the 위험 수용 section the memo cites, with a place to sign', () => {
    expect(HEADINGS.some((h) => /Gate 0/.test(h))).toBe(true)
    expect(section(/Gate B/)).toMatch(/Effective September 15, 2025/)
    expect(section(/Gate B/)).toMatch(/10월 18일/)
    const risk = section(/위험 수용$/)
    expect(risk).toContain('section "위험 수용"')
    expect(risk).toMatch(/서명: _+ {2}날짜: _+/)
    expect(risk).toMatch(/"Probably outside" is not a pass/)
  })

  it('has the privacy-request procedure (30 days, PIPEDA s.8)', () => {
    const s = section(/개인정보 요청/)
    expect(s).toMatch(/30일 안에/)
    expect(s).toMatch(/s\.8\(3\)/)
    expect(s).toMatch(/s\.8\(4\)/)
  })

  it('has the breach record (24 months, RROSH, report to the OPC)', () => {
    const s = section(/유출 기록/)
    expect(s).toMatch(/24개월/)
    expect(s).toMatch(/RROSH/)
    expect(s).toMatch(/git 밖/)
  })

  it('has pro-rated refunds that end the pass with end_pass=true (as the refund policy says)', () => {
    const s = section(/end_pass/)
    expect(s).toMatch(/`end_pass` = `true`/)
    expect(s).toMatch(/39 × 12 ÷ 30 = \*\*C\$15\.60\*\*/)
  })

  it('turns Stripe customer emails off (the privacy page promises no learner email) and Link/BNPL off', () => {
    const s = section(/4-4\. Stripe/)
    expect(s).toMatch(/Customer emails OFF/)
    expect(s).toMatch(/\*\*꺼요\(OFF\)\*\*/)
    expect(s).toMatch(/Link.*후불 결제/)
  })

  it('has the ServiceOntario call (business name) and the PIPEDA address question marked unverified', () => {
    expect(section(/ServiceOntario/)).toMatch(/Business Names Act/)
    expect(section(/책임자 주소/)).toMatch(/\[미확인\]/)
  })

  it('every section number other files cite is a current heading of the guide', () => {
    const citing = [deployConfigText, reconcileTestText, accountText, wranglerText, ...Object.values(WORKFLOWS)].join('\n')
    const cited = [...new Set([...citing.matchAll(/owner-setup(?:\.md)?\s+(?:step\s+)?(\d+(?:-\d+a?)?)\b/g)].map((m) => m[1]))]
    expect(cited.length).toBeGreaterThan(0)
    for (const n of cited) {
      const heading = n.includes('-') ? `### ${n}. ` : `## ${n}. `
      expect(HEADINGS.some((h) => h.startsWith(heading)), `owner-setup ${n}`).toBe(true)
    }
  })

  it('keeps the table of old section numbers for older notes and issues', () => {
    const map = section(/예전 번호/)
    for (const n of ['2-2', '2-3', '2-4', '2-7a', '2-10', '3-1']) expect(map, `old section ${n}`).toContain(`| \`${n}\` |`)
  })
})

describe('owner-setup.md: renders on GitHub', () => {
  it('has no bold that CommonMark leaves as literal ** (bold ending in punctuation right before a letter)', () => {
    // CommonMark only closes ** after punctuation when whitespace or punctuation follows, so **"Settings"**를
    // shows the asterisks on GitHub; write "**Settings**"를 instead.
    const bad: string[] = []
    for (const line of guide.split('\n')) {
      for (const m of line.matchAll(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g)) {
        const inner = m[1] ?? ''
        const after = line[(m.index ?? 0) + m[0].length] ?? ''
        const before = line[(m.index ?? 0) - 1] ?? ''
        if (/\p{P}|[`$%+<>=|~^]/u.test(inner.at(-1) ?? '') && /[\p{L}\p{N}]/u.test(after)) bad.push(m[0] + after)
        if (/\p{P}|[`$%+<>=|~^]/u.test(inner[0] ?? '') && /[\p{L}\p{N}]/u.test(before)) bad.push(before + m[0])
      }
    }
    expect(bad).toEqual([])
  })
})
