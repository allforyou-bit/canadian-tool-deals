// Read-only D1 access for the ops scripts, through the wrangler CLI that products/clb already pins.
// Output format checked against wrangler 4.137.0 (`wrangler d1 execute --remote --json` prints the
// D1 query API result: an array with one { results: Row[], success, meta } per SQL statement, or
// { error: {...} } on failure).

export type Row = Record<string, unknown>

/** Rows of the `statement`-th SQL statement from `wrangler d1 execute --json` output. */
export function parseD1Json(stdout: string, statement = 0): Row[] {
  const start = stdout.search(/[[{]/)
  if (start < 0) throw new Error('d1: no JSON in wrangler output')
  const parsed: unknown = JSON.parse(stdout.slice(start))
  if (!Array.isArray(parsed)) {
    const err = (parsed as { error?: { text?: string; message?: string } }).error
    throw new Error(`d1: wrangler returned an error${err ? `: ${err.text ?? err.message ?? ''}` : ''}`)
  }
  const result = parsed[statement] as { results?: unknown; success?: boolean } | undefined
  if (!result || result.success === false || !Array.isArray(result.results)) throw new Error('d1: unexpected result shape')
  return result.results as Row[]
}

/**
 * Run one read-only SQL statement against the remote database bound as DB. Needs
 * CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment (GitHub Actions secrets).
 */
export async function queryRemoteD1(sql: string, opts: { config?: string; database?: string } = {}): Promise<Row[]> {
  if (!/^\s*select\b/i.test(sql)) throw new Error('d1: ops scripts only run SELECT statements')
  const { execFileSync } = await import('node:child_process')
  const { join } = await import('node:path')
  const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler')
  const args = ['d1', 'execute', opts.database ?? 'DB', '--remote', '--json', '--command', sql, '-c', opts.config ?? 'worker/wrangler.jsonc']
  let stdout: string
  try {
    stdout = execFileSync(wrangler, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr ?? ''
    const out = (e as { stdout?: string }).stdout ?? ''
    // wrangler --json reports errors on stdout as { error }; keep the message short
    const detail = (out.includes('"error"') ? out : stderr).trim().split('\n').slice(-5).join(' ')
    throw new Error(`d1: wrangler d1 execute failed: ${detail.slice(0, 400)}`)
  }
  return parseD1Json(stdout)
}
