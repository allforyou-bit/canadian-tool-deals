// Consistency tests for the ops documents and the owner's launch drafts (memo §7.2, zero-capital launch):
// the Routine prompts (ops/routines/*.md), ops/README.md, ops/metrics/README.md, the Korean legal summary,
// the Gate B email and the organic launch kit. They read the committed files as text (`?raw`, as
// deploy.test.ts does) and check them against shared/config.ts, shared/content-rules.ts and the workflows,
// so a price, cap or rule change that the documents do not follow fails CI.
import { describe, expect, it } from 'vitest'
import opsReadme from '../../../ops/README.md?raw'
import metricsReadme from '../../../ops/metrics/README.md?raw'
import books from '../../../ops/routines/books.md?raw'
import daily from '../../../ops/routines/daily.md?raw'
import day90 from '../../../ops/routines/day90.md?raw'
import evalRoutine from '../../../ops/routines/eval.md?raw'
import kpi from '../../../ops/routines/kpi.md?raw'
import nov30 from '../../../ops/routines/nov30.md?raw'
import auditYml from '../../../.github/workflows/audit.yml?raw'
import ciYml from '../../../.github/workflows/ci.yml?raw'
import deployYml from '../../../.github/workflows/deploy.yml?raw'
import evalYml from '../../../.github/workflows/eval.yml?raw'
import flagsYml from '../../../.github/workflows/flags.yml?raw'
import levelBYml from '../../../.github/workflows/level-b.yml?raw'
import metricsGuardYml from '../../../.github/workflows/metrics-guard.yml?raw'
import metricsYml from '../../../.github/workflows/metrics.yml?raw'
import reconcileYml from '../../../.github/workflows/reconcile.yml?raw'
import refundYml from '../../../.github/workflows/refund.yml?raw'
import setupCloudflareYml from '../../../.github/workflows/setup-cloudflare.yml?raw'
import gateB from '../../../business/online/gate-b-anthropic-email.md?raw'
import launchKit from '../../../business/online/launch-kit-ko.md?raw'
import legalKo from '../../../business/online/legal-summary-ko.md?raw'
import { CAPS, FREE, NOT_AFFILIATED, PREPAID, REFUND_POLICY, RETENTION_DAYS, SKUS } from '../shared/config'
import { AD_ONLY_FORBIDDEN, FORBIDDEN_CLAIMS, GRADER_OUTPUT_RULES, findClaims, type ClaimRule } from '../shared/content-rules'

const WORKFLOWS: Record<string, string> = {
  audit: auditYml,
  ci: ciYml,
  deploy: deployYml,
  eval: evalYml,
  flags: flagsYml,
  'level-b': levelBYml,
  metrics: metricsYml,
  'metrics-guard': metricsGuardYml,
  reconcile: reconcileYml,
  refund: refundYml,
  'setup-cloudflare': setupCloudflareYml,
}

const ROUTINES: Record<string, string> = { books, daily, day90, eval: evalRoutine, kpi, nov30 }
const OPS_DOCS: Record<string, string> = { ...ROUTINES, 'ops/README.md': opsReadme, 'ops/metrics/README.md': metricsReadme }

/** Blocks between `<!-- launch-kit:<name> -->` and `<!-- /launch-kit -->`. */
function kitBlocks(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of text.matchAll(/<!-- launch-kit:([^>]+?) -->\n([\s\S]*?)<!-- \/launch-kit -->/g)) out[m[1].trim()] = m[2]
  return out
}

// Community posts read like ads: the page and ad rules, plus the grader's Korean result words (수준, 합격, N점).
const KO_EXTRA = GRADER_OUTPUT_RULES.filter((r) => ['ko_points', 'ko_level', 'ko_pass'].includes(r.id))
const POST_RULES: ClaimRule[] = [...FORBIDDEN_CLAIMS, ...AD_ONLY_FORBIDDEN, ...KO_EXTRA]

const cad = (sku: keyof typeof SKUS) => `C$${SKUS[sku].priceCents / 100}`

describe('Routine prompts (ops/routines)', () => {
  it('each ends with exactly one ASSERT line', () => {
    for (const [name, text] of Object.entries(ROUTINES)) {
      const lines = text.trimEnd().split('\n')
      expect(lines.filter((l) => l.startsWith('ASSERT:')), name).toHaveLength(1)
      expect(lines[lines.length - 1].startsWith('ASSERT:'), name).toBe(true)
    }
  })

  it('kpi.md evaluates exactly the zero-capital rules (K3, K4 and S0–S2 are gone with the ads)', () => {
    const rules = ['K1', 'K2', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10', 'K11', 'S3']
    const template = kpi.match(/`RULES: ([^`]+)`/g) ?? []
    expect(template).toHaveLength(1)
    expect([...(template[0] ?? '').matchAll(/([KS]\d+)=<v>/g)].map((m) => m[1])).toEqual(rules)
    // one row per rule in the rules table, and no row for a removed rule
    const rows = kpi.split('\n').filter((l) => /^\| [KS]\d+ /.test(l)).map((l) => l.split(' ')[1])
    expect(rows).toEqual(rules)
    expect(kpi).toMatch(/all 10 rules/)
  })

  it('kpi.md states the memo §7.2 thresholds (K5 10 samples, K10 C$100, K11 −C$20 or 1 h/week)', () => {
    expect(kpi).toMatch(/2026-11-15 < \*\*10\*\*/)
    expect(kpi).toMatch(/`cashOut − cashIn` > \*\*C\$100\*\*/)
    expect(kpi).toMatch(/< \*\*−C\$20\*\*/)
    expect(kpi).toMatch(/`supportHours` over the last 4 weeks that have one is > \*\*1\*\*/)
    expect(day90).toMatch(/below \*\*−C\$20\*\*/)
    expect(day90).toMatch(/K11=<WIND-DOWN\|KEEP\|NEEDS-OWNER>/)
  })

  it('the prepaid thresholds in the documents match PREPAID in shared/config.ts', () => {
    const pct = (x: number) => `${Math.round(x * 100)}%`
    for (const [name, text] of Object.entries({ daily, kpi, 'ops/README.md': opsReadme })) {
      for (const x of [PREPAID.freeOffAt, ...PREPAID.alertAt, PREPAID.pauseAt]) expect(text, `${name} ${pct(x)}`).toContain(pct(x))
    }
  })

  it('the free-sample budget in the ops README matches FREE in shared/config.ts', () => {
    expect(opsReadme).toContain(`US$${FREE.budgetUsdPerDay.toFixed(2)} a day and\nUS$${FREE.budgetUsdPerMonth} a month`)
  })

  it('the top-up issue title is the same in the daily and KPI Routines and the ops README', () => {
    const title = '"Anthropic credits: top up"'
    expect(daily).toContain(`**${title}**`)
    expect(kpi).toContain("'Anthropic credits: top up'")
    expect(opsReadme).toContain(title)
  })

  it('names the free practice events next to the free AI sample events', () => {
    for (const text of [kpi, metricsReadme]) {
      expect(text).toContain('practice_start')
      expect(text).toContain('practice_done')
    }
    expect(nov30).toMatch(/landing → practice_start → practice_done/)
  })

  it('carries no trace of the removed ad plan', () => {
    const gone = ['ad-cap.json', 'google.csv', 'gclid', 'cac14', 'spendCad', 'paidSamples', 'capCad', 'MPC_GADS_SEND_TO', 'Ads report missing', 'ads.ts']
    for (const [name, text] of Object.entries(OPS_DOCS)) {
      for (const word of gone) expect(text.includes(word), `${name}: ${word}`).toBe(false)
    }
    for (const [name, text] of Object.entries({ ...ROUTINES, 'ops/README.md': opsReadme })) expect(text.includes('ads.json'), name).toBe(false)
    // the metrics README says once that the old export is no longer written
    expect(metricsReadme.match(/ads\.json/g)).toHaveLength(1)
    expect(metricsReadme).toMatch(/`ads\.json` of the earlier plan is no longer\s+written/)
  })

  it('the eval Routine follows the unscheduled eval (manual runs and prompt PRs, compare-models option)', () => {
    expect(evalRoutine).toContain('no new eval run')
    expect(evalRoutine).toContain('`compare` input')
    expect(evalRoutine).toContain('Do not')
    expect(evalRoutine).toMatch(/recommend a model/)
  })
})

describe('ops/README.md GitHub Actions table', () => {
  const section = opsReadme.slice(opsReadme.indexOf('## GitHub Actions'), opsReadme.indexOf('### Kill switch without Actions'))
  const rows = [...section.matchAll(/^\| `([a-z0-9-]+)\.yml` \|/gm)].map((m) => m[1])

  it('has one row per workflow file, and no row for a workflow that is gone', () => {
    expect(rows.slice().sort()).toEqual(Object.keys(WORKFLOWS).sort())
  })

  it('names the one-time Cloudflare setup the way the Actions tab shows it', () => {
    const name = /^name: (.+)$/m.exec(setupCloudflareYml)?.[1]
    expect(name).toBe('Set up Cloudflare (one time)')
    expect(section).toContain(`"${name}"`)
  })
})

describe('ops/README.md secrets and variables', () => {
  const workflowText = Object.values(WORKFLOWS).join('\n')
  const inWorkflows = new Set([...workflowText.matchAll(/\b(?:vars|secrets)\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))
  const section = opsReadme.slice(opsReadme.indexOf('## Repository secrets and variables'))
  const documented = new Set([...section.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map((m) => m[1]))

  it('finds names on both sides', () => {
    expect(inWorkflows.size).toBeGreaterThan(10)
    expect(documented.has('MPC_SITE_URL') && documented.has('HASH_SALT')).toBe(true)
    // memo §7.2: Google sign-in and the legal-name seller are in; the ad conversion tag is out
    for (const n of ['MPC_LEGAL_NAME', 'MPC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) expect(documented.has(n), n).toBe(true)
    expect(inWorkflows.has('MPC_GADS_SEND_TO') || documented.has('MPC_GADS_SEND_TO')).toBe(false)
  })

  it('documents only names the workflows use', () => {
    const unknown = [...documented].filter((n) => !inWorkflows.has(n))
    expect(unknown).toEqual([])
  })

  it('documents every name the workflows use', () => {
    const missing = [...inWorkflows].filter((n) => !documented.has(n))
    expect(missing).toEqual([])
  })
})

describe('launch kit (business/online/launch-kit-ko.md)', () => {
  const blocks = kitBlocks(launchKit)
  const posts = Object.entries(blocks).filter(([k]) => k.startsWith('post '))

  it('has 2–3 Korean community posts and one outreach email, each in a copyable text block', () => {
    expect(Object.keys(blocks).sort()).toEqual(['email', 'post A', 'post B', 'post C'])
    for (const [name, text] of Object.entries(blocks)) expect(text, name).toMatch(/^```text\n[\s\S]*\n```\n$/)
    expect(posts.length).toBeGreaterThanOrEqual(2)
    expect(posts.length).toBeLessThanOrEqual(3)
    expect(blocks.email).toBeDefined()
  })

  it('the post rules catch the words they must (so the next test is not vacuous)', () => {
    expect(findClaims('점수 공식 보장 레벨 수준 합격 9점 CELPIP', POST_RULES).sort()).toEqual(
      ['celpip', 'ko_band_level', 'ko_guarantee', 'ko_level', 'ko_official', 'ko_pass', 'ko_points', 'ko_score'].sort(),
    )
  })

  it('no post makes a score, official, guarantee, level or test-name claim', () => {
    for (const [name, text] of posts) expect(findClaims(text, POST_RULES), name).toEqual([])
  })

  it('every post discloses the owner made it, leads with the free practice mode and links the placeholder', () => {
    for (const [name, text] of posts) {
      expect(text, name).toMatch(/제가 (직접 )?만든/)
      expect(text, name).toContain('홍보 글')
      expect(text, name).toContain('{사이트 주소}/practice/?lang=ko')
      expect(text, name).toMatch(/로그인(은)? (없이|필요 없)/)
      // the free practice mode (its button label on the practice pages) comes before any mention of paid passes
      expect(text, name).toContain('"피드백 없이 연습하기"')
      expect(text.indexOf('피드백 없이 연습하기'), name).toBeLessThan(text.indexOf('이용권'))
      expect(text, name).toMatch(/틀릴 수 있/)
      expect(text, name).toMatch(/내 (휴대폰이나 컴퓨터의 브라우저 안|기기)/)
    }
  })

  it('states prices and free counts that match shared/config.ts', () => {
    expect(FREE.anonymousWritingPerDevice).toBe(1)
    expect(FREE.speakingAfterEmailVerification).toBe(1)
    const a = blocks['post A']
    expect(a).toContain(`30일 ${cad('pass30')}`)
    expect(a).toContain(`90일 ${cad('pass90')}`)
    expect(blocks.email).toContain(`${cad('pass30')} for 30 days, ${cad('pass90')} for 90 days`)
    for (const [name, text] of posts) expect(text, name).toMatch(/퀘벡을 제외한 캐나다/)
  })

  it('the outreach email passes the claim rules and carries what CASL asks for', () => {
    const email = blocks.email
    expect(findClaims(email, [...FORBIDDEN_CLAIMS, ...AD_ONLY_FORBIDDEN])).toEqual([])
    expect(email).toContain(NOT_AFFILIATED.en)
    expect(email).toContain('[your full legal name]')
    expect(email).toContain('[your mailing address]')
    expect(email).toMatch(/reply to this email with "unsubscribe"/)
    expect(email).toContain('I will not write again')
  })

  it('keeps the "what not to do" list: no mass posting, no automated posting, Reddit only with an established account', () => {
    const list = launchKit.slice(launchKit.indexOf('## 4. 하지 말아야 할 것'))
    expect(list).toContain('대량 게시')
    expect(list).toContain('자동 게시')
    expect(list).toMatch(/레딧\(Reddit\)은 조건이 있을 때만/)
    expect(list).toContain('오래 써 온 본인 계정')
  })
})

describe('Korean legal summary (business/online/legal-summary-ko.md)', () => {
  it('follows memo §7.2: legal-name seller, Google sign-in, no learner email, no ads', () => {
    expect(legalKo).toContain('is sold by <오너의 법적 이름>')
    expect(legalKo).toContain('MPC_LEGAL_NAME')
    expect(legalKo).toContain('Google로 로그인')
    expect(legalKo).toContain('마케팅 이메일을 보내지 않고')
    expect(legalKo).toContain('계정이나 이용권에 관한 이메일도 보내지 않아요')
    expect(legalKo).toContain('광고 쿠키나 광고 태그는 어디에도 쓰지 않아요')
    expect(legalKo.includes('Google Ads')).toBe(false)
    expect(legalKo.match(/\[미확인\]/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('uses the numbers in shared/config.ts', () => {
    expect(legalKo).toContain(`하루 쓰기 ${CAPS.writingPerDay}개·말하기 ${CAPS.speakingPerDay}개`)
    expect(legalKo).toContain(`30일에 ${CAPS.gradedPer30Days}개`)
    expect(legalKo).toContain(`**하루 ${CAPS.noFeedbackPerDay}개**`)
    expect(legalKo).toContain(`쓰기 최대 ${CAPS.maxEssayChars.toLocaleString('en-CA')}자`)
    expect(legalKo).toContain(`녹음 최대 **${CAPS.maxAudioSeconds / 60}분·${CAPS.maxAudioBytes / (1024 * 1024)}MB**`)
    expect(legalKo).toContain(`구매 후 **${REFUND_POLICY.withinDays}일 안**`)
    expect(legalKo).toContain(`**${REFUND_POLICY.maxGradedTasksUsed}개 이하**`)
    expect(legalKo).toContain(`마지막 활동 후 **${RETENTION_DAYS}일**`)
  })
})

describe('Gate B email (business/online/gate-b-anthropic-email.md)', () => {
  const body = gateB.slice(gateB.indexOf('**Subject:**'), gateB.indexOf('## 보낸 뒤'))

  it('sends through the Console help/support channel, not the harmful-output address', () => {
    expect(gateB).toMatch(/Anthropic Console의 도움말\(Help\)·지원\(Support\) 창구/)
    expect(body.includes('usersafety@anthropic.com')).toBe(false)
    expect(gateB).toMatch(/usersafety@anthropic\.com[^\n]*\n[^\n]*신고하는 용도/)
  })

  it('quotes the archived Usage Policy wording exactly and signs with the legal name, not a mailing address', () => {
    expect(body).toContain(
      '"Academic testing, accreditation and admissions: Use cases related to\nstandardized testing companies that administer school admissions …, language proficiency, or professional\ncertification exams"',
    )
    expect(body).toContain('**[Your full legal name]**')
    expect(body.includes('MPC_MAILING_ADDRESS')).toBe(false)
    expect(gateB.includes('광고')).toBe(false)
  })
})
