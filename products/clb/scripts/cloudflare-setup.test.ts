// Tests for the one-time Cloudflare setup (cloudflare-setup.ts, setup-cloudflare.yml). No network: wrangler is a
// fake that keeps an in-memory Cloudflare account. The output samples follow wrangler 4.137.0's code
// (wrangler-dist/cli.js): `d1 list --json` prints JSON.stringify(dbs, null, 2) with no banner; `kv namespace list`
// prints JSON.stringify(namespaces, null, "  "); `d1 create` / `kv namespace create` print status lines and then
// a config snippet (JSON without a config file, TOML for a wrangler.toml).
import { describe, expect, it } from 'vitest'
import deployYml from '../../../.github/workflows/deploy.yml?raw'
import setupYml from '../../../.github/workflows/setup-cloudflare.yml?raw'
import wranglerText from '../worker/wrangler.jsonc?raw'
import {
  CLAUDE_PHRASE,
  D1_LOCATION,
  explainFailure,
  firstJson,
  kvTitleFor,
  LEGACY_KV_TITLES,
  parseCreatedD1Id,
  parseCreatedKvId,
  parseD1List,
  parseKvList,
  parseMigrationsOutput,
  parseTargets,
  planD1,
  planKv,
  redact,
  renderCopyBlock,
  renderSummary,
  renderWranglerSnippet,
  runSetup,
  SETUP_WORKFLOW_NAME,
  targetConfig,
  type D1Database,
  type KvNamespace,
  type SetupDeps,
  type Target,
  type TargetResult,
  type WranglerResult,
  type WranglerRunner,
} from './cloudflare-setup'
import { checkWranglerIds, parseJsonc } from './deploy-config'

const ACCOUNT = 'aaaabbbbccccddddeeeeffff00001111'
const PROD_D1 = '0f2c8e0a-1111-4222-8333-944455556666'
const STG_D1 = '1f2c8e0a-1111-4222-8333-944455556666'
const PROD_KV = '0123456789abcdef0123456789abcdef'
const STG_KV = 'fedcba9876543210fedcba9876543210'
const PROD_TITLE = 'maple-practice-coach-flags'
const STG_TITLE = 'maple-practice-coach-staging-flags'

type Entry = Record<string, unknown>
type Section = { d1_databases: Entry[]; kv_namespaces: Entry[] }
/** The committed wrangler.jsonc with ids set (or removed) per target, independent of its comments. */
function withIds(ids: Partial<Record<Target, [d1: string, kv: string]>>): string {
  const c = parseJsonc(wranglerText) as Section & { env: { staging: Section } }
  for (const [section, v] of [
    [c, ids.production],
    [c.env.staging, ids.staging],
  ] as const) {
    const d1 = section.d1_databases.find((d) => d.binding === 'DB')!
    const kv = section.kv_namespaces.find((k) => k.binding === 'FLAGS')!
    if (v) [d1.database_id, kv.id] = v
    else {
      delete d1.database_id
      delete kv.id
    }
  }
  return JSON.stringify(c)
}
const unfilled = withIds({})

// ---- recorded-shape samples ----

const d1CreateOutput = (name: string, uuid: string) =>
  [
    '',
    ' ⛅️ wrangler 4.137.0',
    '───────────────────',
    `✅ Successfully created DB '${name}' using primary location hint ${D1_LOCATION}`,
    'Created your new D1 database.',
    '',
    'To access your new D1 Database in your Worker, add the following snippet to your configuration file:',
    JSON.stringify({ d1_databases: [{ binding: name.replace(/-/g, '_'), database_name: name, database_id: uuid }] }, null, 2),
  ].join('\n')

const kvCreateOutput = (title: string, id: string) =>
  [
    '',
    ' ⛅️ wrangler 4.137.0',
    '───────────────────',
    'Resource location: remote ',
    '',
    `🌀 Creating namespace with title "${title}"`,
    '✨ Success!',
    'To access your new KV Namespace in your Worker, add the following snippet to your configuration file:',
    JSON.stringify({ kv_namespaces: [{ binding: title.replace(/-/g, '_'), id }] }, null, 2),
  ].join('\n')

const MIGRATIONS_APPLIED = [
  'Migrations to be applied:',
  '┌───────────────┐',
  '│ name          │',
  '├───────────────┤',
  '│ 0001_init.sql │',
  '└───────────────┘',
  '🌀 Executing on remote database DB (…):',
  '🚣 29 commands executed successfully.',
  '┌───────────────┬────────┐',
  '│ name          │ status │',
  '├───────────────┼────────┤',
  '│ 0001_init.sql │ ✅     │',
  '└───────────────┴────────┘',
].join('\n')
const MIGRATIONS_NONE = 'Resource location: remote \n\n✅ No migrations to apply!'
const AUTH_ERROR: WranglerResult = {
  code: 1,
  stdout: '',
  stderr: `\n✘ [ERROR] A request to the Cloudflare API (/accounts/${ACCOUNT}/d1/database) failed.\n\n  Authentication error [code: 10000]\n\n  If you think this is a bug, please open an issue at: https://github.com/cloudflare/workers-sdk/issues/new/choose\n\n🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler.log"\n`,
}

// ---- a fake Cloudflare account behind a fake wrangler ----

function fakeCloudflare(init: { d1?: D1Database[]; kv?: KvNamespace[]; intercept?: (args: string[]) => WranglerResult | null } = {}) {
  const d1 = [...(init.d1 ?? [])]
  const kv = [...(init.kv ?? [])]
  const calls: string[][] = []
  const configs = new Map<string, { name: string; d1_databases: Entry[] }>()
  const migrated = new Map<string, number>()
  let seq = 0
  const ok = (stdout: string): WranglerResult => ({ code: 0, stdout, stderr: '' })
  const wrangler: WranglerRunner = async (args) => {
    calls.push(args)
    const intercepted = init.intercept?.(args)
    if (intercepted) return intercepted
    const cmd = args.join(' ')
    if (cmd === 'd1 list --json') return ok(JSON.stringify(d1.map((d) => ({ ...d, created_at: '2026-09-24T00:00:00.000Z', version: 'production', num_tables: 0, file_size: 12288 })), null, 2))
    if (cmd === 'kv namespace list') return ok(JSON.stringify(kv.map((n) => ({ ...n, supports_url_encoding: true })), null, '  '))
    if (args[0] === 'd1' && args[1] === 'create') {
      const name = args[2]
      if (d1.some((d) => d.name === name)) return { code: 1, stdout: '', stderr: `✘ [ERROR] A request to the Cloudflare API (/accounts/${ACCOUNT}/d1/database) failed.\n\n  A database with that name already exists [code: 7502]` }
      const uuid = `${(++seq).toString(16).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`
      d1.push({ uuid, name })
      return ok(d1CreateOutput(name, uuid))
    }
    if (args[0] === 'kv' && args[2] === 'create') {
      const title = args[3]
      if (kv.some((n) => n.title === title)) return { code: 1, stdout: '', stderr: `✘ [ERROR] A KV namespace with the title "${title}" already exists.` }
      const id = (++seq).toString(16).padStart(32, 'e')
      kv.push({ id, title })
      return ok(kvCreateOutput(title, id))
    }
    if (cmd.startsWith('d1 migrations apply DB --remote -c ')) {
      const cfg = configs.get(args[args.indexOf('-c') + 1])!
      const id = cfg.d1_databases[0].database_id as string
      if (!d1.some((d) => d.uuid === id)) return { code: 1, stdout: '', stderr: '✘ [ERROR] database not found' }
      const n = (migrated.get(id) ?? 0) + 1
      migrated.set(id, n)
      return ok(n === 1 ? MIGRATIONS_APPLIED : MIGRATIONS_NONE)
    }
    throw new Error(`unexpected wrangler ${cmd}`)
  }
  const deps: SetupDeps = {
    wrangler,
    writeTempConfig: async (target, cfg) => {
      const path = `/tmp/setup/wrangler-${target}.json`
      configs.set(path, cfg as { name: string; d1_databases: Entry[] })
      return path
    },
    configDir: '/repo/products/clb/worker',
    log: () => {},
  }
  const creates = () => calls.filter((c) => c.includes('create')).map((c) => c.join(' '))
  const applies = () => calls.filter((c) => c[1] === 'migrations').map((c) => configs.get(c[c.indexOf('-c') + 1])!.d1_databases[0])
  return { d1, kv, calls, configs, migrated, deps, creates, applies }
}

const byTarget = (results: TargetResult[], t: Target) => results.find((r) => r.target === t)!

// ---------------------------------------------------------------------------------------------------------------

describe('parsing wrangler output', () => {
  it('reads `d1 list --json`, also after a warning line, and keeps only uuid and name', () => {
    const out = `▲ [WARNING] Proxy environment variables detected. We'll use your proxy for fetch requests.\n\n${JSON.stringify([
      { uuid: PROD_D1, name: 'mpc', created_at: '2026-09-24T00:00:00.000Z', version: 'production', num_tables: 3, file_size: 40960 },
      { name: 'broken' },
    ])}\n`
    expect(parseD1List(out)).toEqual([{ uuid: PROD_D1, name: 'mpc' }])
    expect(parseD1List('[]')).toEqual([])
    expect(() => parseD1List('✘ [ERROR] Authentication error')).toThrow(/no JSON/)
    expect(() => parseD1List('{"error": {"text": "nope"}}')).toThrow(/did not print a list/)
  })

  it('reads `kv namespace list` (always JSON)', () => {
    const out = JSON.stringify([{ id: PROD_KV, title: PROD_TITLE, supports_url_encoding: true }, { id: STG_KV, title: 'FLAGS_STAGING', supports_url_encoding: true }], null, '  ')
    expect(parseKvList(out)).toEqual([
      { id: PROD_KV, title: PROD_TITLE },
      { id: STG_KV, title: 'FLAGS_STAGING' },
    ])
    expect(() => parseKvList('')).toThrow()
  })

  it('finds the first JSON value that starts a line, skipping a non-JSON bracket line and trailing text', () => {
    expect(firstJson('[WARNING] not json\n{"a": [1]}\ntrailing words')).toEqual({ a: [1] })
    expect(firstJson('\u001b[33mbanner\u001b[0m\n  [1, 2]')).toEqual([1, 2])
  })

  it('reads the new id from `d1 create` and `kv namespace create` output (JSON or TOML snippet)', () => {
    expect(parseCreatedD1Id(d1CreateOutput('mpc', PROD_D1))).toBe(PROD_D1)
    expect(parseCreatedD1Id(`[[d1_databases]]\nbinding = "mpc"\ndatabase_name = "mpc"\ndatabase_id = "${STG_D1}"\n`)).toBe(STG_D1)
    expect(parseCreatedD1Id('✅ Successfully created DB')).toBeNull()
    expect(parseCreatedKvId(kvCreateOutput(PROD_TITLE, PROD_KV))).toBe(PROD_KV)
    expect(parseCreatedKvId(`[[kv_namespaces]]\nbinding = "FLAGS"\nid = "${STG_KV}"\n`)).toBe(STG_KV)
    // a D1 database_id is never taken for a KV id
    expect(parseCreatedKvId(d1CreateOutput('mpc', PROD_D1))).toBeNull()
  })

  it('reads what `d1 migrations apply` did', () => {
    expect(parseMigrationsOutput(MIGRATIONS_APPLIED)).toEqual({ applied: ['0001_init.sql'], upToDate: false })
    expect(parseMigrationsOutput(MIGRATIONS_NONE)).toEqual({ applied: [], upToDate: true })
  })

  it('explains a refused token with the permissions to add, and never shows the account id', () => {
    const msg = explainFailure('Listing the D1 databases', AUTH_ERROR)
    expect(msg).toContain('Listing the D1 databases failed: A request to the Cloudflare API (/accounts/<account id>/d1/database) failed. Authentication error [code: 10000].')
    expect(msg).toContain('"D1 Edit" and "Workers KV Storage Edit"')
    expect(msg).not.toContain(ACCOUNT)
    expect(explainFailure('x', { code: 1, stdout: '', stderr: '' })).toBe('x failed: exit code 1.')
    expect(explainFailure('x', { code: 1, stdout: '', stderr: '✘ [ERROR] Could not route to /accounts/abc, perhaps your object identifier is invalid? [code: 7003]' })).toMatch(/CLOUDFLARE_ACCOUNT_ID is the id/)
  })

  it('redacts secret values and account ids', () => {
    expect(redact(`token s3cr3t-token-value in /accounts/${ACCOUNT}/kv`, ['s3cr3t-token-value', undefined, ''])).toBe('token <redacted> in /accounts/<account id>/kv')
  })
})

describe('the find-or-create decision', () => {
  const list: D1Database[] = [
    { uuid: PROD_D1, name: 'mpc' },
    { uuid: STG_D1, name: 'mpc-staging' },
  ]

  it('creates only when nothing matches', () => {
    expect(planD1([], { name: 'mpc', configuredId: null })).toEqual({ action: 'create', name: 'mpc', warnings: [] })
    expect(planKv([{ id: STG_KV, title: 'other' }], { title: PROD_TITLE, earlierTitles: LEGACY_KV_TITLES.production, configuredId: null }).action).toBe('create')
  })

  it('reuses the resource with the expected name', () => {
    expect(planD1(list, { name: 'mpc-staging', configuredId: null })).toEqual({ action: 'reuse', id: STG_D1, name: 'mpc-staging', via: 'name', warnings: [] })
  })

  it('prefers the id already in wrangler.jsonc, even under another name (with a warning)', () => {
    expect(planD1(list, { name: 'mpc', configuredId: PROD_D1 })).toMatchObject({ action: 'reuse', id: PROD_D1, via: 'wrangler.jsonc', warnings: [] })
    const renamed = planD1([{ uuid: PROD_D1, name: 'old-mpc' }, ...list.slice(1)], { name: 'mpc', configuredId: PROD_D1 })
    expect(renamed).toMatchObject({ action: 'reuse', id: PROD_D1, name: 'old-mpc', via: 'wrangler.jsonc' })
    expect(renamed.warnings.join(' ')).toMatch(/belongs to "old-mpc"/)
  })

  it('falls back to the name when the configured id is not in the account', () => {
    const p = planD1(list, { name: 'mpc', configuredId: '99999999-1111-4222-8333-944455556666' })
    expect(p).toMatchObject({ action: 'reuse', id: PROD_D1, via: 'name' })
    expect(p.warnings.join(' ')).toMatch(/is not in this Cloudflare account/)
    expect(planD1([], { name: 'mpc', configuredId: PROD_D1 })).toMatchObject({ action: 'create' })
  })

  it('reuses a namespace from the earlier manual guide instead of creating a second one', () => {
    const p = planKv([{ id: STG_KV, title: 'FLAGS_STAGING' }], { title: STG_TITLE, earlierTitles: LEGACY_KV_TITLES.staging, configuredId: null })
    expect(p).toMatchObject({ action: 'reuse', id: STG_KV, name: 'FLAGS_STAGING', via: 'earlier name' })
    const two = planKv(
      [
        { id: STG_KV, title: 'staging-FLAGS' },
        { id: PROD_KV, title: 'FLAGS_STAGING' },
      ],
      { title: STG_TITLE, earlierTitles: LEGACY_KV_TITLES.staging, configuredId: null },
    )
    expect(two).toMatchObject({ action: 'reuse', id: PROD_KV, name: 'FLAGS_STAGING' })
    expect(two.warnings.join(' ')).toMatch(/Several KV namespaces/)
    // the expected title wins over an earlier one
    expect(planKv([{ id: STG_KV, title: 'FLAGS' }, { id: PROD_KV, title: PROD_TITLE }], { title: PROD_TITLE, earlierTitles: LEGACY_KV_TITLES.production, configuredId: null })).toMatchObject({ id: PROD_KV, via: 'name' })
  })

  it('refuses to choose between two resources with the expected name', () => {
    expect(planD1([...list, { uuid: STG_D1.replace('1f', '2f'), name: 'mpc' }], { name: 'mpc', configuredId: null })).toMatchObject({ action: 'error' })
  })
})

describe('worker/wrangler.jsonc per target', () => {
  it('names the D1 databases after database_name and the KV namespaces after the Worker', () => {
    const config = parseJsonc(wranglerText)
    const prod = targetConfig(config, 'production')
    const stg = targetConfig(config, 'staging')
    expect([prod.d1Name, prod.kvTitle, prod.migrationsDir]).toEqual(['mpc', PROD_TITLE, 'migrations'])
    expect([stg.d1Name, stg.kvTitle, stg.migrationsDir]).toEqual(['mpc-staging', STG_TITLE, 'migrations'])
    expect(kvTitleFor(prod.workerName)).toBe(PROD_TITLE)
    expect(targetConfig(parseJsonc(unfilled), 'production')).toMatchObject({ configuredD1Id: null, configuredKvId: null })
    expect(targetConfig(parseJsonc(withIds({ staging: [STG_D1, STG_KV] })), 'staging')).toMatchObject({ configuredD1Id: STG_D1, configuredKvId: STG_KV })
  })

  it('reports a missing section or binding', () => {
    expect(() => targetConfig({ name: 'w', d1_databases: [], kv_namespaces: [] }, 'staging')).toThrow(/env\.staging is missing/)
    expect(() => targetConfig({ name: 'w', d1_databases: [], kv_namespaces: [{ binding: 'FLAGS' }] }, 'production')).toThrow(/binding DB/)
  })
})

describe('runSetup against a fake account', () => {
  it('creates everything once on an empty account and applies the migrations to exactly those databases', async () => {
    const cf = fakeCloudflare()
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    expect(results.map((r) => [r.target, r.ok, r.errors])).toEqual([
      ['production', true, []],
      ['staging', true, []],
    ])
    expect(cf.creates()).toEqual([`d1 create mpc --location ${D1_LOCATION}`, `kv namespace create ${PROD_TITLE}`, `d1 create mpc-staging --location ${D1_LOCATION}`, `kv namespace create ${STG_TITLE}`])
    const prod = byTarget(results, 'production')
    const stg = byTarget(results, 'staging')
    expect(prod.d1).toMatchObject({ name: 'mpc', action: 'created', via: 'created', config: 'missing' })
    expect(prod.kv).toMatchObject({ name: PROD_TITLE, action: 'created', config: 'missing' })
    expect(cf.d1.map((d) => d.uuid)).toEqual([prod.d1!.id, stg.d1!.id])
    expect(cf.kv.map((n) => n.id)).toEqual([prod.kv!.id, stg.kv!.id])
    expect(cf.applies()).toEqual([
      { binding: 'DB', database_name: 'mpc', database_id: prod.d1!.id, migrations_dir: '/repo/products/clb/worker/migrations' },
      { binding: 'DB', database_name: 'mpc-staging', database_id: stg.d1!.id, migrations_dir: '/repo/products/clb/worker/migrations' },
    ])
    expect(prod.migrations).toEqual({ applied: ['0001_init.sql'], upToDate: false })
    // the lists are read once, and again after each create
    expect(cf.calls.filter((c) => c.join(' ') === 'd1 list --json')).toHaveLength(3)
  })

  it('is idempotent: a second run creates nothing and finds the migrations applied', async () => {
    const cf = fakeCloudflare()
    const first = await runSetup(['production', 'staging'], unfilled, cf.deps)
    const createsAfterFirst = cf.creates().length
    const second = await runSetup(['production', 'staging'], unfilled, cf.deps)
    expect(cf.creates()).toHaveLength(createsAfterFirst)
    expect(cf.d1).toHaveLength(2)
    expect(cf.kv).toHaveLength(2)
    for (const t of ['production', 'staging'] as const) {
      expect(byTarget(second, t).d1).toMatchObject({ id: byTarget(first, t).d1!.id, action: 'reused', via: 'name' })
      expect(byTarget(second, t).kv).toMatchObject({ id: byTarget(first, t).kv!.id, action: 'reused', via: 'name' })
      expect(byTarget(second, t).migrations).toEqual({ applied: [], upToDate: true })
    }
  })

  it('reuses the ids in wrangler.jsonc and says nothing needs to change', async () => {
    const cf = fakeCloudflare({
      d1: [
        { uuid: PROD_D1, name: 'mpc' },
        { uuid: STG_D1, name: 'mpc-staging' },
      ],
      kv: [
        { id: PROD_KV, title: 'FLAGS' },
        { id: STG_KV, title: STG_TITLE },
      ],
    })
    const results = await runSetup(['production', 'staging'], withIds({ production: [PROD_D1, PROD_KV], staging: [STG_D1, STG_KV] }), cf.deps)
    expect(cf.creates()).toEqual([])
    expect(byTarget(results, 'production').kv).toMatchObject({ id: PROD_KV, via: 'wrangler.jsonc', config: 'same' })
    expect(renderCopyBlock(results, { date: '2026-09-24' })).toContain('wrangler.jsonc: already has these ids (nothing to change)')
  })

  it('sets up one target only when asked', async () => {
    const cf = fakeCloudflare()
    const results = await runSetup(['staging'], unfilled, cf.deps)
    expect(results.map((r) => r.target)).toEqual(['staging'])
    expect(cf.creates()).toEqual([`d1 create mpc-staging --location ${D1_LOCATION}`, `kv namespace create ${STG_TITLE}`])
  })

  it('reuses a namespace made by the earlier manual guide and says so', async () => {
    const cf = fakeCloudflare({ kv: [{ id: STG_KV, title: 'FLAGS_STAGING' }] })
    const results = await runSetup(['staging'], unfilled, cf.deps)
    expect(cf.creates()).toEqual([`d1 create mpc-staging --location ${D1_LOCATION}`])
    expect(results[0].kv).toMatchObject({ id: STG_KV, name: 'FLAGS_STAGING', via: 'earlier name' })
    expect(renderCopyBlock(results, { date: '2026-09-24' })).toMatch(/warning: The KV namespace "FLAGS_STAGING" from the earlier manual setup is reused/)
  })

  it('replaces a wrangler.jsonc id that is not in the account, by name', async () => {
    const cf = fakeCloudflare({ d1: [{ uuid: PROD_D1, name: 'mpc' }] })
    const results = await runSetup(['production'], withIds({ production: ['99999999-1111-4222-8333-944455556666', PROD_KV] }), cf.deps)
    expect(results[0].d1).toMatchObject({ id: PROD_D1, via: 'name', config: 'different' })
    expect(results[0].kv).toMatchObject({ action: 'created', config: 'different' })
    expect(renderCopyBlock(results, { date: '2026-09-24' })).toContain('wrangler.jsonc: has other ids; replace them with these')
  })

  it('reuses a database that appeared while creating it (a create refused because the name exists)', async () => {
    const cf = fakeCloudflare({
      intercept: (args) => {
        if (args[0] !== 'd1' || args[1] !== 'create') return null
        cf.d1.push({ uuid: PROD_D1, name: args[2] }) // another run was faster
        return { code: 1, stdout: '', stderr: '✘ [ERROR] A database with that name already exists [code: 7502]' }
      },
    })
    const results = await runSetup(['production'], unfilled, cf.deps)
    expect(results[0].ok).toBe(true)
    expect(results[0].d1).toMatchObject({ id: PROD_D1, action: 'reused', via: 'name' })
    expect(results[0].warnings.join(' ')).toMatch(/appeared while this run was creating it/)
    expect(cf.d1).toHaveLength(1)
  })

  it('falls back to the id printed by create when the list does not show the new resource yet', async () => {
    const cf = fakeCloudflare()
    let lists = 0
    cf.deps.wrangler = ((inner) => async (args: string[]) => {
      // the first two `kv namespace list` calls miss the new namespace (eventual consistency)
      if (args.join(' ') === 'kv namespace list' && ++lists <= 2) return { code: 0, stdout: '[]', stderr: '' }
      return inner(args)
    })(cf.deps.wrangler)
    const results = await runSetup(['production'], unfilled, cf.deps)
    expect(results[0].kv).toMatchObject({ id: cf.kv[0].id, action: 'created' })
  })

  it('stops a target on a refused token, before creating anything, and explains which permissions to add', async () => {
    const cf = fakeCloudflare({ intercept: (args) => (args.join(' ') === 'd1 list --json' ? AUTH_ERROR : null) })
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    expect(results.every((r) => !r.ok)).toBe(true)
    expect(cf.creates()).toEqual([])
    expect(cf.applies()).toEqual([])
    expect(results[0].errors[0]).toMatch(/"D1 Edit" and "Workers KV Storage Edit"/)
    const block = renderCopyBlock(results, { date: '2026-09-24' })
    expect(block).toMatch(/FAILED: Listing the D1 databases failed/)
    expect(block).not.toContain(ACCOUNT)
  })

  it('never lets staging take a resource production uses', async () => {
    const cf = fakeCloudflare({
      d1: [{ uuid: PROD_D1, name: 'mpc' }],
      kv: [{ id: PROD_KV, title: PROD_TITLE }],
    })
    // a copy-paste mistake: staging's KV id is production's
    const results = await runSetup(['production', 'staging'], withIds({ production: [PROD_D1, PROD_KV], staging: [STG_D1, PROD_KV] }), cf.deps)
    expect(byTarget(results, 'production').ok).toBe(true)
    const stg = byTarget(results, 'staging')
    expect(stg.ok).toBe(false)
    expect(stg.errors.join(' ')).toMatch(/belongs to the other target; staging needs its own "maple-practice-coach-staging-flags"\. Nothing was changed/)
    // decided before anything is created: no staging database was made either
    expect(cf.creates()).toEqual([])
    expect(cf.applies().map((e) => e.database_name)).toEqual(['mpc'])
    // the same mistake the other way round is reported on production
    const cf2 = fakeCloudflare({ d1: [{ uuid: STG_D1, name: 'mpc-staging' }] })
    const swapped = await runSetup(['production', 'staging'], withIds({ production: [STG_D1, PROD_KV], staging: [STG_D1, STG_KV] }), cf2.deps)
    expect(byTarget(swapped, 'production').errors.join(' ')).toMatch(/D1 database .* belongs to the other target; production needs its own "mpc"/)
    expect(byTarget(swapped, 'staging').ok).toBe(true)
    // …also when only production is set up and staging has no ids yet: the name gives it away
    const cf3 = fakeCloudflare({ d1: [{ uuid: STG_D1, name: 'mpc-staging' }], kv: [{ id: STG_KV, title: 'FLAGS_STAGING' }] })
    const alone = await runSetup(['production'], withIds({ production: [STG_D1, PROD_KV] }), cf3.deps)
    expect(alone[0].errors.join(' ')).toMatch(/\("mpc-staging"\) in worker\/wrangler\.jsonc belongs to the other target/)
    const kvAlone = await runSetup(['production'], withIds({ production: ['99999999-1111-4222-8333-944455556666', STG_KV] }), cf3.deps)
    expect(kvAlone[0].errors.join(' ')).toMatch(/KV namespace .*\("FLAGS_STAGING"\) in worker\/wrangler\.jsonc belongs to the other target/)
    expect(cf3.creates()).toEqual([])
  })

  it('fails a target whose migrations fail, and still sets up the other one', async () => {
    const cf = fakeCloudflare({
      intercept: (args) => (args[1] === 'migrations' && args.includes('/tmp/setup/wrangler-production.json') ? { code: 1, stdout: '', stderr: '✘ [ERROR] Migration 0001_init.sql failed' } : null),
    })
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    expect(byTarget(results, 'production')).toMatchObject({ ok: false, errors: [expect.stringMatching(/Applying the D1 migrations to "mpc" failed: Migration 0001_init.sql failed/)] })
    expect(byTarget(results, 'staging').ok).toBe(true)
  })

  it('reports a wrangler.jsonc without a staging section for staging only', async () => {
    const config = parseJsonc(unfilled) as Record<string, unknown>
    delete config.env
    const cf = fakeCloudflare()
    const results = await runSetup(['production', 'staging'], JSON.stringify(config), cf.deps)
    expect(byTarget(results, 'production').ok).toBe(true)
    expect(byTarget(results, 'staging')).toMatchObject({ ok: false, errors: ['worker/wrangler.jsonc env.staging is missing'] })
  })
})

describe('the job summary', () => {
  const meta = { date: '2026-09-24', sha: 'abcdef1234567', runUrl: 'https://github.com/o/r/actions/runs/1' }

  it('gives the owner one block to send to Claude, starting with the phrase', async () => {
    const cf = fakeCloudflare()
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    const block = renderCopyBlock(results, meta)
    const lines = block.split('\n')
    expect(lines[0]).toBe(CLAUDE_PHRASE)
    expect(lines[1]).toBe(`workflow: ${SETUP_WORKFLOW_NAME}, 2026-09-24, commit abcdef1, https://github.com/o/r/actions/runs/1`)
    const prod = byTarget(results, 'production')
    expect(block).toContain(`[production] Worker maple-practice-coach\nD1 database: name=mpc database_id=${prod.d1!.id} (created now)\nKV FLAGS: title=${PROD_TITLE} id=${prod.kv!.id} (created now)\nD1 migrations: applied 0001_init.sql\nwrangler.jsonc: ids not there yet; add these`)
    expect(block).toContain('[staging] Worker maple-practice-coach-staging')
  })

  it('has a wrangler.jsonc snippet that makes the deploy check pass', async () => {
    const cf = fakeCloudflare()
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    const snippet = renderWranglerSnippet(results)
    const [prodPart, stagingPart] = snippet.split('\n\n')
    expect(prodPart.split('\n')[0]).toBe('// worker/wrangler.jsonc, top level (production)')
    expect(stagingPart.split('\n')[0]).toBe('// worker/wrangler.jsonc, inside "env" → "staging"')
    // pasted over the entries of each target, the check deploy.yml runs has nothing left to report
    const config = parseJsonc(unfilled) as Record<string, unknown> & { env: { staging: Record<string, unknown> } }
    Object.assign(config, parseJsonc(`{${prodPart}}`))
    Object.assign(config.env.staging, parseJsonc(`{${stagingPart}}`))
    expect(checkWranglerIds(config, 'production')).toEqual([])
    expect(checkWranglerIds(config, 'staging')).toEqual([])
    expect((parseJsonc(`{${prodPart}}`) as { d1_databases: Entry[] }).d1_databases[0]).toEqual({
      binding: 'DB',
      database_name: 'mpc',
      database_id: byTarget(results, 'production').d1!.id,
      migrations_dir: 'migrations',
    })
  })

  it('explains the steps in plain Korean and shows the block and the snippet', async () => {
    const cf = fakeCloudflare()
    const results = await runSetup(['production', 'staging'], unfilled, cf.deps)
    const md = renderSummary(results, meta)
    expect(md).toMatch(new RegExp(`^## ${SETUP_WORKFLOW_NAME.replace(/[()]/g, '\\$&')}: 완료`))
    expect(md).toContain('운영(production)과 스테이징(staging)')
    expect(md).toContain('Claude와의 채팅에 붙여 넣고 보내요')
    expect(md).toContain(`\`\`\`text\n${renderCopyBlock(results, meta)}\n\`\`\``)
    expect(md).toContain(`\`\`\`jsonc\n${renderWranglerSnippet(results)}\n\`\`\``)
    expect(md).toContain('API 토큰은 이 페이지 어디에도 나오지 않아요')
  })

  it('on a failure, says so and still gives the block (with the FAILED lines) to send', async () => {
    const cf = fakeCloudflare({ intercept: (args) => (args.join(' ') === 'kv namespace list' ? AUTH_ERROR : null) })
    const results = await runSetup(['production'], unfilled, cf.deps)
    const md = renderSummary(results, meta)
    expect(md).toContain(': 끝나지 않았어요')
    expect(md).toContain('FAILED: Listing the KV namespaces failed')
    expect(md).not.toContain('```jsonc')
  })
})

describe('the workflow files', () => {
  it('setup-cloudflare.yml: the name the guide and deploy messages use, manual trigger only, target input', () => {
    expect(setupYml).toMatch(new RegExp(`^name: ${SETUP_WORKFLOW_NAME.replace(/[()]/g, '\\$&')}$`, 'm'))
    const on = setupYml.slice(setupYml.indexOf('\non:'), setupYml.indexOf('\npermissions:'))
    expect(on).toContain('workflow_dispatch:')
    expect(on).not.toMatch(/\b(push|pull_request|schedule|workflow_run):/)
    expect(on).toMatch(/default: both\n\s+options:\n\s+- production\n\s+- staging\n\s+- both\n/)
    expect(setupYml).toContain('runs-on: ubuntu-24.04')
    expect(setupYml).toContain('working-directory: products/clb')
    expect(setupYml).toContain('run: npm ci')
    expect(setupYml).toContain('run: node scripts/run.mjs scripts/cloudflare-setup.ts --target "$TARGET"')
    // the secrets go only to the secrets check and the setup step (never to npm ci), and missing ones end in a notice
    expect(setupYml.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(2)
    expect(setupYml).toMatch(/::notice::Nothing was set up/)
  })

  it('parses the target input', () => {
    expect(parseTargets('both')).toEqual(['production', 'staging'])
    expect(parseTargets('staging')).toEqual(['staging'])
    expect(parseTargets('prod')).toBeNull()
  })

  it('deploy.yml checks the ids before it touches Cloudflare, and never opts into auto-provisioning', () => {
    const check = deployYml.indexOf('node scripts/run.mjs scripts/deploy-config.ts check')
    const migrate = deployYml.indexOf('npx wrangler d1 migrations apply')
    const deploy = deployYml.indexOf('npx wrangler deploy "${args[@]}"')
    expect(check).toBeGreaterThan(0)
    expect(check).toBeLessThan(migrate)
    expect(migrate).toBeLessThan(deploy)
    expect(deployYml).not.toMatch(/x-provision|experimental-provision|x-auto-create/)
  })
})
