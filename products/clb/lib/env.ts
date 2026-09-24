// Public build-time settings (CONTRACT §6). Next inlines `process.env.NEXT_PUBLIC_*` only when each
// variable is referenced literally, so every read below spells out the full name.

/** Cloudflare's always-pass test key, used when no site key is configured. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

export const PUBLIC_ENV = {
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY,
  mailingAddress: process.env.NEXT_PUBLIC_MAILING_ADDRESS || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
  cfBeaconToken: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN || '',
  gadsSendTo: process.env.NEXT_PUBLIC_GADS_SEND_TO || '',
} as const
