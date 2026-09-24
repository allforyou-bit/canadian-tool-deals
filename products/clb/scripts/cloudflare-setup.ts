// One-time Cloudflare setup (.github/workflows/setup-cloudflare.yml, "Set up Cloudflare (one time)"): for each
// target, find or create the D1 database and the FLAGS KV namespace, apply the D1 migrations, and write the ids
// to the job summary, as a block the owner sends to Claude in the chat and as a snippet for worker/wrangler.jsonc.
// It replaces the owner's local `wrangler d1 create` / `wrangler kv namespace create` steps.
//
//   node scripts/run.mjs scripts/cloudflare-setup.ts --target production|staging|both
//
// Needs CLOUDFLARE_API_TOKEN (Account: D1 Edit, Workers KV Storage Edit) and CLOUDFLARE_ACCOUNT_ID. Prints ids
// and names only, never the token. Safe to run again: it reuses what exists and never creates a second
// database or namespace for a target.
//
// Find-or-create, per resource:
//   1. the id already in worker/wrangler.jsonc, when that resource exists in the account (the config is what
//      deploys use, so it wins; a different name only gives a warning);
//   2. else the resource with the expected name: D1 `database_name` from wrangler.jsonc ("mpc", "mpc-staging");
//      KV title `<Worker name>-flags` ("maple-practice-coach-flags", "maple-practice-coach-staging-flags", the
//      name wrangler's own auto-provisioning would give the FLAGS binding);
//   3. else, for KV, a title from the earlier manual guide (FLAGS; FLAGS_STAGING or staging-FLAGS), with a warning;
//   4. else create it, then list again and take the new id from the list (the id printed by `create` is the
//      fallback). A create refused because the name exists (a second run at the same moment) lists again too.
// Both resources of a target are decided before anything is created. A target never takes a resource the other
// target uses (its id in wrangler.jsonc, or found for it in this run) unless the resource carries this target's own
// name; the mistaken target then fails with a message for Claude, and nothing is created for it.
// The migrations are applied to exactly the database found, through a temporary wrangler config holding its id,
// whatever worker/wrangler.jsonc says.
//
// Wrangler 4.137.0, checked with `--help` and wrangler-dist/cli.js:
//   d1 list --json                   JSON array of { uuid, name, … } (every page), no banner
//   d1 create <name> --location enam text, then a config snippet with "database_id" (there is no --json)
//   kv namespace list                always a JSON array of { id, title, … } (there is no --json flag)
//   kv namespace create <title>      text, then a snippet with "id"; refused when the title exists; without
//                                    --env the title is used as given
//   d1 migrations apply DB --remote -c <config>  no prompt when not interactive; "No migrations to apply" when done
// No command gets a wrangler config except `migrations apply`, and products/clb has none of its own, so wrangler
// never offers to edit one (it would not in CI anyway: its confirm falls back to "no").
import { looksLikeId, parseJsonc, SETUP_WORKFLOW_NAME, wranglerSection, type Target } from './deploy-config'

export { SETUP_WORKFLOW_NAME }
export type { Target }

export const TARGETS: readonly Target[] = ['production', 'staging']

/** The phrase the owner sends to Claude with the block (the block's first line). */
export const CLAUDE_PHRASE = '클라우드플레어 설정 결과야'

/** D1 location hint for new databases: Eastern North America (learners are in Canada; as the earlier guide). */
export const D1_LOCATION = 'enam'

/** Default D1 names, used only when wrangler.jsonc has no database_name (it has: mpc, mpc-staging). */
const DEFAULT_D1_NAME: Record<Target, string> = { production: 'mpc', staging: 'mpc-staging' }

/** KV titles the earlier manual guide created (owner-setup `wrangler kv namespace create …`), reused if present. */
export const LEGACY_KV_TITLES: Record<Target, readonly string[]> = {
  production: ['FLAGS'],
  staging: ['FLAGS_STAGING', 'staging-FLAGS'],
}

/** The KV title for a Worker's FLAGS binding: `<worker name>-flags` (wrangler's auto-provisioned name). */
export const kvTitleFor = (workerName: string): string => `${workerName}-flags`

// ---------------------------------------------------------------------------------------------------------------
// Parsing wrangler output

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')

/**
 * The first JSON value in `text` that starts at the beginning of a line (wrangler may print a warning such as
 * "▲ [WARNING] …" or a banner first). Throws when there is none.
 */
export function firstJson(text: string): unknown {
  const t = stripAnsi(text)
  for (const m of t.matchAll(/^[ \t]*[[{]/gm)) {
    const start = m.index + m[0].length - 1
    const rest = t.slice(start)
    const close = rest[0] === '[' ? ']' : '}'
    for (const candidate of [rest, rest.slice(0, rest.lastIndexOf(close) + 1)]) {
      try {
        return JSON.parse(candidate)
      } catch {
        // try the next candidate
      }
    }
  }
  throw new Error('no JSON in the wrangler output')
}

export interface D1Database {
  uuid: string
  name: string
}

export interface KvNamespace {
  id: string
  title: string
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** `wrangler d1 list --json` → the databases (uuid and name). Throws when the output is not that list. */
export function parseD1List(text: string): D1Database[] {
  const j = firstJson(text)
  if (!Array.isArray(j)) throw new Error('`wrangler d1 list --json` did not print a list')
  return j.filter((d): d is Obj => isObj(d) && typeof d.uuid === 'string' && typeof d.name === 'string').map((d) => ({ uuid: d.uuid as string, name: d.name as string }))
}

/** `wrangler kv namespace list` → the namespaces (id and title). Throws when the output is not that list. */
export function parseKvList(text: string): KvNamespace[] {
  const j = firstJson(text)
  if (!Array.isArray(j)) throw new Error('`wrangler kv namespace list` did not print a list')
  return j.filter((n): n is Obj => isObj(n) && typeof n.id === 'string' && typeof n.title === 'string').map((n) => ({ id: n.id as string, title: n.title as string }))
}

/** The database_id in `wrangler d1 create` output (its JSON or TOML config snippet), or null. */
export function parseCreatedD1Id(text: string): string | null {
  const m = /"?database_id"?\s*[:=]\s*"([0-9a-fA-F-]{8,64})"/.exec(stripAnsi(text))
  return m ? m[1] : null
}

/** The namespace id in `wrangler kv namespace create` output (its JSON or TOML config snippet), or null. */
export function parseCreatedKvId(text: string): string | null {
  const m = /(?:^|[\s{,])"?id"?\s*[:=]\s*"([0-9a-fA-F]{32})"/m.exec(stripAnsi(text))
  return m ? m[1] : null
}

export interface MigrationsOutcome {
  /** migration files applied by this run ([] when the database was already up to date) */
  applied: string[]
  upToDate: boolean
}

/** `wrangler d1 migrations apply --remote` output → what was applied. */
export function parseMigrationsOutput(text: string): MigrationsOutcome {
  const t = stripAnsi(text)
  if (/No migrations to apply/i.test(t)) return { applied: [], upToDate: true }
  const applied = [...new Set([...t.matchAll(/\b(\d{4}_[A-Za-z0-9_.-]*?\.sql)\b/g)].map((m) => m[1]))]
  return { applied, upToDate: false }
}

/**
 * Replaces each secret value (the token and the account id, passed by main) and any account id in an API path
 * with a placeholder, so wrangler output can go into logs and the job summary.
 */
export function redact(text: string, secrets: (string | undefined)[] = []): string {
  let out = text.replace(/\/accounts\/[0-9a-fA-F]{32}\b/g, '/accounts/<account id>')
  for (const s of secrets) if (s && s.length >= 8) out = out.split(s).join('<redacted>')
  return out
}

/** A short explanation of a failed wrangler command (no account id), with a hint for permission problems. */
export function explainFailure(what: string, r: WranglerResult): string {
  const text = redact(stripAnsi(`${r.stderr}\n${r.stdout}`))
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(⛅️|─+$|Resource location|🪵|Logs were written|If you think this is a bug)/.test(l))
  // wrangler prints "✘ [ERROR] A request to the Cloudflare API (…) failed." and the API's reason on the next line
  const i = lines.findIndex((l) => /\[ERROR\]/.test(l))
  const picked = i >= 0 ? lines.slice(i, i + 2) : lines.slice(-1)
  const detail = (picked.join(' ').replace(/^✘\s*\[ERROR\]\s*/, '') || `exit code ${r.code}`).slice(0, 400)
  let hint = ''
  if (/Authentication error|code: 10000|code: 9109|Unauthorized|forbidden|\b403\b|permission/i.test(text)) {
    hint = ' The API token was refused: it needs the account permissions "D1 Edit" and "Workers KV Storage Edit" for this account, and CLOUDFLARE_ACCOUNT_ID must be that account\'s id.'
  } else if (/code: 7003|Could not route to/i.test(text)) {
    hint = ' Check that CLOUDFLARE_ACCOUNT_ID is the id of the account the token belongs to.'
  }
  return `${what} failed: ${detail.replace(/\.$/, '')}.${hint}`
}

// ---------------------------------------------------------------------------------------------------------------
// The find-or-create decision

export type Via = 'wrangler.jsonc' | 'name' | 'earlier name'

export type Plan =
  | { action: 'reuse'; id: string; name: string; via: Via; warnings: string[] }
  | { action: 'create'; name: string; warnings: string[] }
  | { action: 'error'; message: string; warnings: string[] }

interface Item {
  id: string
  name: string
}

/**
 * Pure decision for one resource: reuse the configured id if it exists, else the resource with the wanted name,
 * else one with an earlier name, else create one with the wanted name. `kind` only words the messages.
 */
export function planResource(kind: string, items: Item[], want: { name: string; earlierNames?: readonly string[]; configuredId: string | null }): Plan {
  const warnings: string[] = []
  if (want.configuredId) {
    const hit = items.find((i) => i.id === want.configuredId)
    if (hit) {
      if (hit.name !== want.name) warnings.push(`The ${kind} id in worker/wrangler.jsonc belongs to "${hit.name}", not "${want.name}"; it is kept, because deploys already use it.`)
      return { action: 'reuse', id: hit.id, name: hit.name, via: 'wrangler.jsonc', warnings }
    }
    warnings.push(`The ${kind} id in worker/wrangler.jsonc (${want.configuredId}) is not in this Cloudflare account; the one found or created by name replaces it.`)
  }
  const named = items.filter((i) => i.name === want.name)
  if (named.length > 1) return { action: 'error', message: `There are ${named.length} ${kind}s named "${want.name}" in this account; nothing was chosen. Send this message to Claude.`, warnings }
  if (named.length === 1) return { action: 'reuse', id: named[0].id, name: named[0].name, via: 'name', warnings }
  const earlier = (want.earlierNames ?? []).flatMap((n) => items.filter((i) => i.name === n))
  if (earlier.length) {
    if (earlier.length > 1) warnings.push(`Several ${kind}s from the earlier manual setup exist (${earlier.map((e) => `"${e.name}"`).join(', ')}); "${earlier[0].name}" is used.`)
    else warnings.push(`The ${kind} "${earlier[0].name}" from the earlier manual setup is reused (no new "${want.name}" was created).`)
    return { action: 'reuse', id: earlier[0].id, name: earlier[0].name, via: 'earlier name', warnings }
  }
  return { action: 'create', name: want.name, warnings }
}

export const planD1 = (list: D1Database[], want: { name: string; configuredId: string | null }): Plan =>
  planResource('D1 database', list.map((d) => ({ id: d.uuid, name: d.name })), want)

export const planKv = (list: KvNamespace[], want: { title: string; earlierTitles?: readonly string[]; configuredId: string | null }): Plan =>
  planResource('KV namespace', list.map((n) => ({ id: n.id, name: n.title })), { name: want.title, earlierNames: want.earlierTitles, configuredId: want.configuredId })

// ---------------------------------------------------------------------------------------------------------------
// What worker/wrangler.jsonc says per target

export interface TargetConfig {
  target: Target
  workerName: string
  /** the DB binding's entry as written (binding, database_name, migrations_dir, …) */
  d1Entry: Obj
  kvEntry: Obj
  d1Name: string
  kvTitle: string
  configuredD1Id: string | null
  configuredKvId: string | null
  migrationsDir: string
}

/** Reads a target's Worker name, D1 entry (binding DB) and KV entry (binding FLAGS). Throws when a part is missing. */
export function targetConfig(config: unknown, target: Target): TargetConfig {
  const s = wranglerSection(config, target)
  const where = target === 'production' ? 'worker/wrangler.jsonc' : 'worker/wrangler.jsonc env.staging'
  if (!s) throw new Error(`${where} is missing`)
  if (typeof s.name !== 'string' || !s.name) throw new Error(`${where} has no Worker name`)
  const d1 = Array.isArray(s.d1_databases) ? s.d1_databases.find((d) => isObj(d) && d.binding === 'DB') : undefined
  const kv = Array.isArray(s.kv_namespaces) ? s.kv_namespaces.find((k) => isObj(k) && k.binding === 'FLAGS') : undefined
  if (!isObj(d1)) throw new Error(`${where} has no d1_databases entry with binding DB`)
  if (!isObj(kv)) throw new Error(`${where} has no kv_namespaces entry with binding FLAGS`)
  const d1Name = typeof d1.database_name === 'string' && d1.database_name ? d1.database_name : DEFAULT_D1_NAME[target]
  return {
    target,
    workerName: s.name,
    d1Entry: d1,
    kvEntry: kv,
    d1Name,
    kvTitle: kvTitleFor(s.name),
    configuredD1Id: looksLikeId(d1.database_id) ? (d1.database_id as string) : null,
    configuredKvId: looksLikeId(kv.id) ? (kv.id as string) : null,
    migrationsDir: typeof d1.migrations_dir === 'string' && d1.migrations_dir ? d1.migrations_dir : 'migrations',
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Running it

export interface WranglerResult {
  code: number
  stdout: string
  stderr: string
}

/** Runs `wrangler <args>` (in products/clb) and returns its exit code and output. Tests pass a fake. */
export type WranglerRunner = (args: string[]) => Promise<WranglerResult>

export interface SetupDeps {
  wrangler: WranglerRunner
  /** writes a temporary wrangler config (JSON) for the migrations of `target` and returns its path */
  writeTempConfig: (target: Target, config: Obj) => Promise<string>
  /** absolute path of the directory holding worker/wrangler.jsonc (migrations_dir is relative to it) */
  configDir: string
  log: (line: string) => void
}

export type ConfigStatus = 'same' | 'missing' | 'different'

export interface ResourceResult {
  name: string
  id: string
  action: 'created' | 'reused'
  via: Via | 'created'
  /** how worker/wrangler.jsonc compares: already this id, no id yet, or another id */
  config: ConfigStatus
}

export interface TargetResult {
  target: Target
  workerName: string
  ok: boolean
  d1?: ResourceResult
  kv?: ResourceResult
  migrations?: MigrationsOutcome
  errors: string[]
  warnings: string[]
  /** the entries as they belong in worker/wrangler.jsonc (only when ok) */
  d1Entry?: Obj
  kvEntry?: Obj
}

const configStatus = (configured: string | null, id: string): ConfigStatus => (!configured ? 'missing' : configured === id ? 'same' : 'different')

async function mustRun(deps: SetupDeps, what: string, args: string[]): Promise<WranglerResult> {
  deps.log(`$ wrangler ${args.join(' ')}`)
  const r = await deps.wrangler(args)
  if (r.code !== 0) throw new Error(explainFailure(what, r))
  return r
}

/**
 * Finds or creates the D1 database and the FLAGS KV namespace of each target, then applies the D1 migrations.
 * A failure stops that target only; the other target still runs. The lists are read once and again after a create.
 */
export async function runSetup(targets: readonly Target[], wranglerText: string, deps: SetupDeps): Promise<TargetResult[]> {
  const config = parseJsonc(wranglerText)
  const configs = new Map<Target, TargetConfig>()
  const results: TargetResult[] = []
  for (const t of TARGETS) {
    try {
      configs.set(t, targetConfig(config, t))
    } catch (e) {
      if (targets.includes(t)) results.push({ target: t, workerName: '', ok: false, errors: [(e as Error).message], warnings: [] })
    }
  }
  let d1List: D1Database[] | null = null
  let kvList: KvNamespace[] | null = null
  const listD1 = async () => (d1List = parseD1List((await mustRun(deps, 'Listing the D1 databases', ['d1', 'list', '--json'])).stdout))
  const listKv = async () => (kvList = parseKvList((await mustRun(deps, 'Listing the KV namespaces', ['kv', 'namespace', 'list'])).stdout))

  for (const target of targets) {
    const tc = configs.get(target)
    if (!tc) continue
    const other = configs.get(target === 'production' ? 'staging' : 'production')
    const otherResult = results.find((x) => x.target !== target)
    const r: TargetResult = { target, workerName: tc.workerName, ok: false, errors: [], warnings: [] }
    results.push(r)
    deps.log(`— ${target}: Worker ${tc.workerName}, D1 "${tc.d1Name}", KV "${tc.kvTitle}"`)
    try {
      // ---- decide both resources before changing anything ----
      const d1Plan = planD1(d1List ?? (await listD1()), { name: tc.d1Name, configuredId: tc.configuredD1Id })
      const kvPlan = planKv(kvList ?? (await listKv()), { title: tc.kvTitle, earlierTitles: LEGACY_KV_TITLES[target], configuredId: tc.configuredKvId })
      r.warnings.push(...d1Plan.warnings, ...kvPlan.warnings)
      if (d1Plan.action === 'error') throw new Error(d1Plan.message)
      if (kvPlan.action === 'error') throw new Error(kvPlan.message)
      // A resource that carries the other target's name, or that the other target uses (its id in wrangler.jsonc,
      // or found for it in this run), is never taken, unless it carries this target's own name (then the other
      // target's entry is the mistake, reported there). Only an id from wrangler.jsonc can lead here.
      const otherKvNames = other ? [other.kvTitle, ...LEGACY_KV_TITLES[other.target]] : []
      const foreign = (name: string, id: string, otherNames: string[], otherIds: (string | null | undefined)[]) => otherNames.includes(name) || otherIds.includes(id)
      if (d1Plan.action === 'reuse' && d1Plan.name !== tc.d1Name && foreign(d1Plan.name, d1Plan.id, other ? [other.d1Name] : [], [other?.configuredD1Id, otherResult?.d1?.id])) {
        throw new Error(`The D1 database ${d1Plan.id} ("${d1Plan.name}") in worker/wrangler.jsonc belongs to the other target; ${target} needs its own "${tc.d1Name}". Nothing was changed. Send this message to Claude.`)
      }
      const ownKvName = (name: string) => name === tc.kvTitle || LEGACY_KV_TITLES[target].includes(name)
      if (kvPlan.action === 'reuse' && !ownKvName(kvPlan.name) && foreign(kvPlan.name, kvPlan.id, otherKvNames, [other?.configuredKvId, otherResult?.kv?.id])) {
        throw new Error(`The KV namespace ${kvPlan.id} ("${kvPlan.name}") in worker/wrangler.jsonc belongs to the other target; ${target} needs its own "${tc.kvTitle}". Nothing was changed. Send this message to Claude.`)
      }

      // ---- D1 ----
      if (d1Plan.action === 'reuse') {
        r.d1 = { name: d1Plan.name, id: d1Plan.id, action: 'reused', via: d1Plan.via, config: configStatus(tc.configuredD1Id, d1Plan.id) }
      } else {
        const made = await createAndReadBack(deps, r, {
          what: `the D1 database "${d1Plan.name}"`,
          args: ['d1', 'create', d1Plan.name, '--location', D1_LOCATION],
          relist: async () => (await listD1()).filter((d) => d.name === d1Plan.name).map((d) => d.uuid),
          parseId: parseCreatedD1Id,
        })
        r.d1 = { name: d1Plan.name, id: made.id, action: made.byUs ? 'created' : 'reused', via: made.byUs ? 'created' : 'name', config: configStatus(tc.configuredD1Id, made.id) }
      }

      // ---- KV ----
      if (kvPlan.action === 'reuse') {
        r.kv = { name: kvPlan.name, id: kvPlan.id, action: 'reused', via: kvPlan.via, config: configStatus(tc.configuredKvId, kvPlan.id) }
      } else {
        const made = await createAndReadBack(deps, r, {
          what: `the KV namespace "${kvPlan.name}"`,
          args: ['kv', 'namespace', 'create', kvPlan.name],
          relist: async () => (await listKv()).filter((n) => n.title === kvPlan.name).map((n) => n.id),
          parseId: parseCreatedKvId,
        })
        r.kv = { name: kvPlan.name, id: made.id, action: made.byUs ? 'created' : 'reused', via: made.byUs ? 'created' : 'name', config: configStatus(tc.configuredKvId, made.id) }
      }

      // ---- D1 migrations, on exactly this database ----
      const migrationsDir = tc.migrationsDir.startsWith('/') ? tc.migrationsDir : `${deps.configDir.replace(/\/+$/, '')}/${tc.migrationsDir}`
      const entry: Obj = { binding: 'DB', database_name: r.d1.name, database_id: r.d1.id, migrations_dir: migrationsDir }
      if (typeof tc.d1Entry.migrations_table === 'string') entry.migrations_table = tc.d1Entry.migrations_table
      const tempConfig = await deps.writeTempConfig(target, { name: tc.workerName, d1_databases: [entry] })
      const applied = await mustRun(deps, `Applying the D1 migrations to "${r.d1.name}"`, ['d1', 'migrations', 'apply', 'DB', '--remote', '-c', tempConfig])
      deps.log(stripAnsi(applied.stdout).trim())
      r.migrations = parseMigrationsOutput(applied.stdout)

      r.d1Entry = { binding: 'DB', database_name: r.d1.name, database_id: r.d1.id, ...omit(tc.d1Entry, ['binding', 'database_name', 'database_id']) }
      r.kvEntry = { binding: 'FLAGS', id: r.kv.id, ...omit(tc.kvEntry, ['binding', 'id']) }
      r.ok = true
    } catch (e) {
      r.errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  return results
}

/**
 * Runs a create command, then lists again and takes the id from the list (the id printed by the create is the
 * fallback while the list does not show it yet). A create refused because the name now exists (another run was
 * faster) is fine when the list shows it: that resource is reused.
 */
async function createAndReadBack(
  deps: SetupDeps,
  r: TargetResult,
  c: { what: string; args: string[]; relist: () => Promise<string[]>; parseId: (text: string) => string | null },
): Promise<{ id: string; byUs: boolean }> {
  deps.log(`$ wrangler ${c.args.join(' ')}`)
  const created = await deps.wrangler(c.args)
  const byUs = created.code === 0
  if (byUs) deps.log(stripAnsi(created.stdout).trim())
  const found = await c.relist()
  const id = found.length === 1 ? found[0] : byUs ? c.parseId(created.stdout) : null
  if (!id) throw new Error(byUs ? `Created ${c.what}, but its id could not be read back.` : explainFailure(`Creating ${c.what}`, created))
  if (!byUs) r.warnings.push(`${c.what[0].toUpperCase()}${c.what.slice(1)} appeared while this run was creating it (another run?); it is reused.`)
  return { id, byUs }
}

const omit = (o: Obj, keys: string[]): Obj => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))

// ---------------------------------------------------------------------------------------------------------------
// The job summary

export interface SummaryMeta {
  /** YYYY-MM-DD */
  date: string
  sha?: string
  runUrl?: string
}

const TARGET_KO: Record<Target, string> = { production: '운영', staging: '스테이징' }

function configLine(r: TargetResult): string {
  const s = [r.d1?.config, r.kv?.config]
  if (s.every((c) => c === 'same')) return 'wrangler.jsonc: already has these ids (nothing to change)'
  if (s.includes('different')) return 'wrangler.jsonc: has other ids; replace them with these'
  return 'wrangler.jsonc: ids not there yet; add these'
}

/** The block the owner copies to Claude: the phrase first, then plain `key: value` lines per target. */
export function renderCopyBlock(results: TargetResult[], meta: SummaryMeta): string {
  const lines = [CLAUDE_PHRASE, `workflow: ${SETUP_WORKFLOW_NAME}, ${meta.date}${meta.sha ? `, commit ${meta.sha.slice(0, 7)}` : ''}${meta.runUrl ? `, ${meta.runUrl}` : ''}`]
  for (const r of results) {
    lines.push('', `[${r.target}]${r.workerName ? ` Worker ${r.workerName}` : ''}`)
    if (r.d1) lines.push(`D1 database: name=${r.d1.name} database_id=${r.d1.id} (${r.d1.action === 'created' ? 'created now' : `already existed, found by ${r.d1.via}`})`)
    if (r.kv) lines.push(`KV FLAGS: title=${r.kv.name} id=${r.kv.id} (${r.kv.action === 'created' ? 'created now' : `already existed, found by ${r.kv.via}`})`)
    if (r.migrations) lines.push(`D1 migrations: ${r.migrations.upToDate ? 'already up to date' : r.migrations.applied.length ? `applied ${r.migrations.applied.join(', ')}` : 'applied'}`)
    if (r.ok) lines.push(configLine(r))
    for (const w of r.warnings) lines.push(`warning: ${w}`)
    for (const e of r.errors) lines.push(`FAILED: ${e}`)
  }
  return lines.join('\n')
}

/** The d1_databases / kv_namespaces arrays per successful target, ready to paste into worker/wrangler.jsonc. */
export function renderWranglerSnippet(results: TargetResult[]): string {
  const parts: string[] = []
  for (const r of results) {
    if (!r.ok || !r.d1Entry || !r.kvEntry) continue
    parts.push(
      r.target === 'production' ? '// worker/wrangler.jsonc, top level (production)' : '// worker/wrangler.jsonc, inside "env" → "staging"',
      `"d1_databases": ${JSON.stringify([r.d1Entry], null, 2)},`,
      `"kv_namespaces": ${JSON.stringify([r.kvEntry], null, 2)},`,
      '',
    )
  }
  return parts.join('\n').trimEnd()
}

/** The whole job summary (Markdown): plain-language steps in Korean, the copy block, then the wrangler.jsonc snippet. */
export function renderSummary(results: TargetResult[], meta: SummaryMeta): string {
  const ok = results.length > 0 && results.every((r) => r.ok)
  const names = results.map((r) => `${TARGET_KO[r.target]}(${r.target})`).join('과 ')
  const out: string[] = [`## ${SETUP_WORKFLOW_NAME}: ${ok ? '완료' : '끝나지 않았어요'}`, '']
  if (ok) {
    out.push(`${names}의 데이터베이스(D1)와 스위치 저장소(KV)가 준비됐고, 데이터베이스 표도 최신 상태예요.`, '')
  } else {
    out.push('일부가 실패했어요. 아래 상자 안의 `FAILED:` 줄에 이유가 있어요. 그대로 Claude에게 보내면 다음에 할 일을 알려 줘요. 이 워크플로는 다시 실행해도 안전해요(있는 것은 다시 쓰고, 두 번 만들지 않아요).', '')
  }
  out.push(
    '### 할 일: 아래 상자를 Claude에게 보내기',
    '',
    '1. 아래 회색 상자 안의 글을 **처음부터 끝까지 전부** 복사해요.',
    `2. Claude와의 채팅에 붙여 넣고 보내요. 첫 줄 \`${CLAUDE_PHRASE}\`는 상자 안에 이미 들어 있어요.`,
    ok
      ? '3. Claude가 이 ID들을 `products/clb/worker/wrangler.jsonc`에 넣어 줘요. 그다음 배포(**Deploy practice coach**)를 실행하면 돼요.'
      : '3. Claude가 무엇을 고칠지 알려 주면, 고친 뒤 이 워크플로를 다시 실행해요.',
    '',
    '이 ID들은 비밀번호가 아니에요. API 토큰은 이 페이지 어디에도 나오지 않아요.',
    '',
    '```text',
    renderCopyBlock(results, meta),
    '```',
    '',
  )
  const snippet = renderWranglerSnippet(results)
  if (snippet) {
    out.push(
      '### worker/wrangler.jsonc에 넣을 부분 (Claude가 넣어요)',
      '',
      'Copy-ready entries for `products/clb/worker/wrangler.jsonc`: they replace the `d1_databases` and `kv_namespaces` entries of each target (the commented-out `database_id` / `id` placeholders).',
      '',
      '```jsonc',
      snippet,
      '```',
      '',
    )
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------------------------------------------
// CLI

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

/** `--target production|staging|both` → the targets, or null. */
export function parseTargets(value: string | undefined): Target[] | null {
  if (value === 'both') return [...TARGETS]
  return value === 'production' || value === 'staging' ? [value] : null
}

export async function main(args: string[]): Promise<number> {
  const targets = parseTargets(argValue(args, '--target') ?? 'both')
  if (!targets) {
    console.error('usage: cloudflare-setup.ts --target production|staging|both')
    return 2
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.log('::error::CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (repository secrets); nothing was changed.')
    return 1
  }
  const { readFile, appendFile, writeFile, mkdtemp, rm } = await import('node:fs/promises')
  const { spawn } = await import('node:child_process')
  const { join, resolve } = await import('node:path')
  const { tmpdir } = await import('node:os')

  const secrets = [process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ACCOUNT_ID]
  const wranglerText = await readFile('worker/wrangler.jsonc', 'utf8')
  const tmp = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'mpc-cloudflare-setup-'))
  const bin = join(process.cwd(), 'node_modules', '.bin', 'wrangler')
  const wrangler: WranglerRunner = (a) =>
    new Promise((done) => {
      // the token reaches wrangler through the inherited environment only; it is never an argument, and the
      // output is redacted before anything prints it
      const child = spawn(bin, a, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' } })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += String(d)))
      child.stderr.on('data', (d) => (stderr += String(d)))
      const finish = (code: number, extra = '') => done({ code, stdout: redact(stdout, secrets), stderr: redact(`${stderr}${extra}`, secrets) })
      child.on('error', (e) => finish(127, `\n${e.message}`))
      child.on('close', (code) => finish(code ?? 1))
    })
  let results: TargetResult[]
  try {
    results = await runSetup(targets, wranglerText, {
      wrangler,
      writeTempConfig: async (target, cfg) => {
        const path = join(tmp, `wrangler-${target}.json`)
        await writeFile(path, JSON.stringify(cfg, null, 2))
        return path
      },
      configDir: resolve('worker'),
      log: (line) => console.log(line),
    })
  } catch (e) {
    // an unexpected failure (for example worker/wrangler.jsonc that does not parse): report it like a target failure
    const message = redact(e instanceof Error ? e.message : String(e), secrets)
    results = targets.map((target) => ({ target, workerName: '', ok: false, errors: [`Setup stopped: ${message}`], warnings: [] }))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }

  const server = process.env.GITHUB_SERVER_URL
  const repo = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID
  const meta: SummaryMeta = {
    date: new Date().toISOString().slice(0, 10),
    sha: process.env.GITHUB_SHA,
    runUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined,
  }
  for (const r of results) {
    for (const w of r.warnings) console.log(`::warning::${r.target}: ${w}`)
    for (const e of r.errors) console.log(`::error::${r.target}: ${e}`)
  }
  const summary = renderSummary(results, meta)
  console.log(`\n${renderCopyBlock(results, meta)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  else console.log(summary)
  const failed = results.filter((r) => !r.ok).length
  if (!failed) console.log(`::notice::${SETUP_WORKFLOW_NAME}: done for ${results.map((r) => r.target).join(' and ')}. Copy the block in the run summary and send it to Claude in the chat.`)
  return failed ? 1 : 0
}
