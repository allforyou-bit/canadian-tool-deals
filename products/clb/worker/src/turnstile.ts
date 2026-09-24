// Cloudflare Turnstile server-side validation (cloudflare-docs turnstile/get-started/server-side-validation.mdx,
// read 2026-09-24): POST https://challenges.cloudflare.com/turnstile/v0/siteverify with {secret, response};
// tokens are single-use, valid 300 s, max 2048 chars. Test sitekey 1x00000000000000000000AA always passes.
import type { Env } from './env'

export async function verifyTurnstile(env: Env, token: string | undefined | null): Promise<boolean> {
  if (!token || token.length > 2048) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
