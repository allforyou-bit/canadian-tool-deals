import { describe, expect, it } from 'vitest'
import { detectInAppBrowser, externalPageUrl, openExternalHref } from './in-app-browser'

// Representative user agents (shapes as the apps send them; version numbers are examples).
const UA = {
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 KAKAOTALK/10.8.5 (INAPP)',
  naverIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.6.3; 15)',
  daumAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 DaumApps/8.10.2',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/476.0.0.39.107;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/476.0.0.49.74;]',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 346.0.0.24.84 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 634108168)',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.12.0',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 13; SM-A536N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36',
  // ordinary browsers
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Mobile/15E148 Safari/604.1',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  whale:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Whale/3.27.1.35 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  desktopFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0',
}

describe('detectInAppBrowser', () => {
  it('recognises the apps the launch posts go to, on iOS and Android', () => {
    expect(detectInAppBrowser(UA.kakaoIos)).toBe('kakaotalk')
    // KakaoTalk on Android is also an Android WebView: the app wins, so the KakaoTalk link is offered
    expect(detectInAppBrowser(UA.kakaoAndroid)).toBe('kakaotalk')
    expect(detectInAppBrowser(UA.naverIos)).toBe('naver')
    expect(detectInAppBrowser(UA.daumAndroid)).toBe('daum')
    expect(detectInAppBrowser(UA.facebookIos)).toBe('facebook')
    expect(detectInAppBrowser(UA.facebookAndroid)).toBe('facebook')
    expect(detectInAppBrowser(UA.instagram)).toBe('instagram')
    expect(detectInAppBrowser(UA.line)).toBe('line')
  })

  it('recognises any other Android WebView by "; wv)"', () => {
    expect(detectInAppBrowser(UA.androidWebview)).toBe('android-webview')
  })

  it('leaves ordinary browsers alone (Chrome, Safari, Samsung Internet, Whale, desktop)', () => {
    for (const ua of [UA.chromeAndroid, UA.safariIos, UA.chromeIos, UA.samsung, UA.whale, UA.desktopChrome, UA.desktopFirefox]) {
      expect({ ua, kind: detectInAppBrowser(ua) }).toEqual({ ua, kind: null })
    }
    expect(detectInAppBrowser('')).toBeNull()
    expect(detectInAppBrowser(undefined)).toBeNull()
    // "Line/" needs a version, so words such as "Outline/" or "Line" alone do not match
    expect(detectInAppBrowser('Mozilla/5.0 Outline/1.0')).toBeNull()
  })
})

describe('externalPageUrl', () => {
  it('keeps the return path, sets the UI language and drops the fragment', () => {
    expect(externalPageUrl('https://coach.test/login/?next=%2Faccount%2F#x', 'ko')).toBe('https://coach.test/login/?next=%2Faccount%2F&lang=ko')
    expect(externalPageUrl('https://coach.test/login/?lang=en', 'ko')).toBe('https://coach.test/login/?lang=ko')
  })
})

describe('openExternalHref', () => {
  const url = 'https://coach.test/login/?next=%2Faccount%2F&lang=ko'

  it('KakaoTalk: its openExternal link with the encoded address, on iOS and Android', () => {
    const expected = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
    expect(openExternalHref('kakaotalk', url, UA.kakaoIos)).toBe(expected)
    expect(openExternalHref('kakaotalk', url, UA.kakaoAndroid)).toBe(expected)
  })

  it('other apps on Android: an intent link for Chrome that falls back to the same address', () => {
    expect(openExternalHref('facebook', url, UA.facebookAndroid)).toBe(
      `intent://coach.test/login/?next=%2Faccount%2F&lang=ko#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    )
    expect(openExternalHref('android-webview', url, UA.androidWebview)).toMatch(/^intent:\/\/coach\.test\/login\//)
  })

  it('other apps on iOS: no link (the visitor copies the address or uses the app menu)', () => {
    expect(openExternalHref('naver', url, UA.naverIos)).toBeNull()
    expect(openExternalHref('instagram', url, UA.instagram)).toBeNull()
    expect(openExternalHref('facebook', url, UA.facebookIos)).toBeNull()
  })

  it('never builds an intent link for a non-https page', () => {
    expect(openExternalHref('facebook', 'http://127.0.0.1:3000/login/', UA.facebookAndroid)).toBeNull()
  })
})
