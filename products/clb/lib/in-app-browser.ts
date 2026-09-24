// In-app browsers (embedded webviews) and Google sign-in (memo §7.2 Z3). Google refuses OAuth sign-in inside
// embedded webviews ("Error 403: disallowed_useragent") [unverified: Google's own policy page was not read; the
// behaviour is reported by many projects on GitHub]. The launch posts go to KakaoTalk, Naver/Daum cafés and
// Facebook groups, whose apps open links in such webviews, so the sign-in page asks those visitors to continue
// in Chrome or Safari. Pure functions, unit-tested; practice pages and the practice mode are not affected.

/** The in-app browser a user agent belongs to, or null for an ordinary browser. */
export type InAppBrowser = 'kakaotalk' | 'naver' | 'daum' | 'facebook' | 'instagram' | 'line' | 'android-webview'

/**
 * User-agent markers, most specific first [unverified: prior knowledge of what each app puts in its user agent,
 * cross-checked against open-source detection code on GitHub, not against the apps' own documentation]:
 * KakaoTalk adds "KAKAOTALK <version>"; the Naver app "NAVER(inapp; …)"; the Daum app "DaumApps"; Facebook
 * "FBAN/…", "FBAV/…" or "[FB_IAB/…"; Instagram "Instagram <version>"; LINE "Line/<version>". Any other Android
 * WebView marks itself with "; wv)" in the platform part. Naver's Whale browser and Samsung Internet are real
 * browsers and do not match.
 */
const MARKERS: readonly (readonly [InAppBrowser, RegExp])[] = [
  ['kakaotalk', /\bKAKAOTALK\b/i],
  ['naver', /\bNAVER\(inapp;/i],
  ['daum', /\bDaumApps\b/i],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b/],
  ['instagram', /\bInstagram\b/],
  ['line', /\bLine\/\d/],
  ['android-webview', /Android[^)]*;\s*wv\)/],
]

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  const ua = userAgent ?? ''
  for (const [name, re] of MARKERS) if (re.test(ua)) return name
  return null
}

export const isAndroid = (userAgent: string): boolean => /\bAndroid\b/i.test(userAgent)

/**
 * The address to hand to the other browser: this page with its query (the return path in ?next=) and the
 * current UI language, because the other browser does not share this one's remembered language.
 */
export function externalPageUrl(href: string, lang: string): string {
  const url = new URL(href)
  url.hash = ''
  url.searchParams.set('lang', lang)
  return url.toString()
}

/**
 * A link that asks the app to open `url` in the phone's own browser, or null when there is no known way (then the
 * visitor copies the link). [unverified: neither scheme is in documentation that was read; both are widely used in
 * open-source code on GitHub]
 * - KakaoTalk (Android and iOS): kakaotalk://web/openExternal?url=<encoded url>
 * - any other in-app browser on Android: an intent:// link for Chrome, falling back to the same https address
 *   when Chrome is not installed.
 * iOS apps other than KakaoTalk offer no such link; their menus have "Open in Safari" / "Open in browser".
 */
export function openExternalHref(kind: InAppBrowser, url: string, userAgent: string): string | null {
  if (kind === 'kakaotalk') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
  if (!isAndroid(userAgent)) return null
  const u = new URL(url)
  if (u.protocol !== 'https:') return null
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}
