'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Bedrooms, DrivewaySize, PriceBook } from '@/config/prices'
import { DICT, marketingConsentText, money, SNOW_MINIMUM_DEADLINE, type Lang } from '@/lib/i18n'
import type { LeadPayload } from '@/lib/lead'
import { leadSummary } from '@/lib/lead'
import {
  CLEANING_TYPE_LABEL,
  DRIVEWAY_LABEL,
  estimateCleaning,
  estimateGutters,
  estimateSnow,
  type CleaningType,
  type Estimate,
} from '@/lib/quote'

type ServiceKey = 'cleaning' | 'gutters' | 'snow'

export interface QuoteToolProps {
  lang: Lang
  book: PriceBook
  services: Record<ServiceKey, boolean>
  gutterMaxStoreys: 2 | 3
  tax: { registered: boolean; ratePct: number; label: string }
  contact: { phone: string; email: string }
  brand: string
  leadEndpoint: string
  turnstileSiteKey: string
  /** heading level of the form/result titles: 2 under a page h1 (default), 3 under a section h2 */
  headingLevel?: 2 | 3
  /**
   * CASL consent request shown next to the marketing opt-in box and stored as the consent record
   * (SOR/2012-36 s.4). Preferably built on the server with marketingConsentText() from config;
   * when absent it is built here from brand, contact and NEXT_PUBLIC_MAILING_ADDRESS.
   */
  consentText?: string
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
        },
      ) => string
      remove?: (widgetId: string) => void
    }
  }
}

// Referenced literally so Next inlines it into the client bundle at build time (config/business.ts
// reads env vars dynamically, which works only on the server). CASL mailing address for the opt-in.
const MAILING_ADDRESS = (process.env.NEXT_PUBLIC_MAILING_ADDRESS ?? '').trim()

/** contact.phone is '' or 1 + 10 digits (lib/site.ts dialPhone) → 416-555-0123 */
const displayPhone = (dial: string) => (dial.length === 11 ? `${dial.slice(1, 4)}-${dial.slice(4, 7)}-${dial.slice(7)}` : dial)

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** with no token after this long, stop blocking submit and offer the text/email fallback */
const TURNSTILE_TIMEOUT_MS = 10_000

// Strings used only here (kept local so lib/i18n.ts stays untouched by this component's edge cases).
const LOCAL: Record<Lang, Record<'notConfigured' | 'turnstileHint' | 'turnstileFallback' | 'turnstileNoContact' | 'errorNoContact' | 'edit', string>> = {
  en: {
    notConfigured: 'Online requests are not set up yet, so this form cannot send anything. The estimate still works.',
    turnstileHint: 'The security check did not load. You can still send your request.',
    turnstileFallback: 'The security check did not load, so your request may not reach us online. Please also send it by text or email.',
    turnstileNoContact: 'The security check did not load, so your request may not reach us. Please try again later.',
    errorNoContact: 'Something went wrong sending the form. Please check your connection and try again.',
    edit: 'Edit request',
  },
  ko: {
    notConfigured: '온라인 요청 기능이 아직 설정되지 않아 이 양식으로는 요청을 보낼 수 없어요. 예상 견적은 그대로 볼 수 있어요.',
    turnstileHint: '보안 확인을 불러오지 못했어요. 그래도 요청은 보낼 수 있어요.',
    turnstileFallback: '보안 확인을 불러오지 못해 온라인 요청이 전달되지 않았을 수 있어요. 아래 버튼으로 문자나 이메일도 보내 주세요.',
    turnstileNoContact: '보안 확인을 불러오지 못해 요청이 전달되지 않았을 수 있어요. 잠시 뒤 다시 시도해 주세요.',
    errorNoContact: '양식을 보내는 중에 문제가 생겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
    edit: '요청 내용 고치기',
  },
}

const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const chipCls = (on: boolean) =>
  `cursor-pointer rounded-full border px-3.5 py-2 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-foreground hover:border-brand'
  }`

function smsHref(phone: string, body: string) {
  return `sms:+${phone}?&body=${encodeURIComponent(body)}`
}

function mailHref(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function QuoteTool(props: QuoteToolProps) {
  const { lang, book, services, tax, contact } = props
  const d = DICT[lang]
  const q = d.quote
  const f = d.form
  const L = LOCAL[lang]
  const H = props.headingLevel === 3 ? 'h3' : 'h2'
  // SOR/2012-36 s.4: the consent request names the business, gives its mailing address and a
  // phone/email, and says consent can be withdrawn. The same string is stored as the record (CASL s.13).
  const consentText =
    props.consentText ||
    marketingConsentText(lang, {
      brand: props.brand,
      mailingAddress: MAILING_ADDRESS,
      phone: displayPhone(contact.phone),
      email: contact.email,
    })

  // Where a request can go: the lead endpoint, or the one-tap text/email buttons.
  const hasContact = Boolean(contact.phone || contact.email)
  const canDeliver = Boolean(props.leadEndpoint) || hasContact
  // A Turnstile token is only checked by the lead endpoint, so never block the no-endpoint path on it.
  const useTurnstile = Boolean(props.leadEndpoint && props.turnstileSiteKey)

  const enabled = (['cleaning', 'gutters', 'snow'] as ServiceKey[]).filter((s) => services[s])
  const [service, setService] = useState<ServiceKey>(enabled[0] ?? 'cleaning')

  // cleaning
  const [ctype, setCtype] = useState<CleaningType>('deep')
  const [bedrooms, setBedrooms] = useState<Bedrooms>(2)
  const [bathrooms, setBathrooms] = useState(1)
  const [addOns, setAddOns] = useState<string[]>([])
  const [rush, setRush] = useState(false)
  // gutters
  const [storeys, setStoreys] = useState<1 | 2 | 3>(2)
  const [downspouts, setDownspouts] = useState(false)
  // snow
  const [driveway, setDriveway] = useState<DrivewaySize>('single')
  const [walkway, setWalkway] = useState(false)
  const [salting, setSalting] = useState(false)

  const taxRate = tax.registered ? tax.ratePct : null

  const estimate: Estimate | null = useMemo(() => {
    try {
      if (service === 'cleaning')
        return estimateCleaning(book, { type: ctype, bedrooms, bathrooms, addOns, rush }, taxRate, tax.label)
      if (service === 'gutters') return estimateGutters(book, { storeys, downspouts }, taxRate, tax.label)
      return estimateSnow(book, { driveway, walkway, salting }, taxRate, tax.label)
    } catch {
      return null
    }
  }, [service, book, ctype, bedrooms, bathrooms, addOns, rush, storeys, downspouts, driveway, walkway, salting, taxRate, tax.label])

  const selections = useMemo(() => {
    if (!estimate) return ''
    return estimate.lines.map((l) => `- ${l[lang]}: ${money(l.amount)}`).join('\n')
  }, [estimate, lang])

  // ---------------- form ----------------
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [dates, setDates] = useState('')
  const [notes, setNotes] = useState('')
  const [optIn, setOptIn] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'fallback' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState('')
  const [turnstileFailed, setTurnstileFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [payload, setPayload] = useState<LeadPayload | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const panelHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusFormNext = useRef(false)
  const messageId = useId()
  const panelShown = status === 'sent' || status === 'fallback' || status === 'error'

  // Move focus to the result panel when it replaces the form, and back to the form after "Edit".
  useEffect(() => {
    if (panelShown) panelHeadingRef.current?.focus()
    else if (focusFormNext.current) {
      focusFormNext.current = false
      nameRef.current?.focus()
    }
  }, [panelShown])

  // Turnstile: if the script is blocked, the widget errors or no token arrives in time, mark it
  // failed so submit is not stuck disabled; submit then routes to the text/email fallback.
  useEffect(() => {
    if (!useTurnstile || panelShown || !turnstileRef.current) return
    const el = turnstileRef.current
    let widgetId: string | undefined
    let gotToken = false
    const fail = () => setTurnstileFailed(true)
    const timer = window.setTimeout(() => {
      if (!gotToken) fail()
    }, TURNSTILE_TIMEOUT_MS)
    const render = () => {
      if (!window.turnstile) {
        fail()
        return
      }
      if (el.childElementCount > 0) return
      try {
        widgetId = window.turnstile.render(el, {
          sitekey: props.turnstileSiteKey,
          callback: (t) => {
            gotToken = true
            setToken(t)
            setTurnstileFailed(false)
          },
          'error-callback': fail,
          'expired-callback': () => setToken(''),
        })
      } catch {
        fail()
      }
    }
    let script: HTMLScriptElement | null = null
    if (window.turnstile) render()
    else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`)
      if (!script) {
        script = document.createElement('script')
        script.src = TURNSTILE_SRC
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', render)
      script.addEventListener('error', fail)
    }
    return () => {
      window.clearTimeout(timer)
      script?.removeEventListener('load', render)
      script?.removeEventListener('error', fail)
      if (widgetId !== undefined) {
        try {
          window.turnstile?.remove?.(widgetId)
        } catch {
          // widget already gone
        }
      }
    }
  }, [useTurnstile, props.turnstileSiteKey, panelShown])

  function editRequest() {
    setNotice('')
    setToken('') // a Turnstile token is single-use; a fresh widget renders with the form
    setTurnstileFailed(false)
    focusFormNext.current = true
    setStatus('idle')
  }

  const invalid = (v: string) => (triedSubmit && !v.trim()) || undefined

  const toggleAddOn = (id: string) =>
    setAddOns((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canDeliver) return
    setTriedSubmit(true)
    const firstInvalid = !name.trim() ? nameRef : !phone.trim() ? phoneRef : !address.trim() ? addressRef : null
    if (firstInvalid) {
      setMessage(f.required)
      firstInvalid.current?.focus()
      return
    }
    setMessage('')
    const p: LeadPayload = {
      v: 1,
      submittedAt: new Date().toISOString(),
      lang,
      page: `${window.location.pathname}${window.location.search}`,
      service,
      selections,
      estimateLow: estimate ? estimate.low : null,
      estimateHigh: estimate ? estimate.high : null,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      preferredDates: dates.trim(),
      notes: notes.trim(),
      marketingOptIn: optIn,
      marketingConsentText: optIn ? consentText : '',
      turnstileToken: token,
      website,
    }
    setPayload(p)
    setNotice('')
    if (!props.leadEndpoint) {
      setStatus('fallback')
      return
    }
    // Turnstile failed (blocked, errored or timed out): still POST, since the Apps Script keeps
    // token-less leads in its "Rejected" tab, then show the text/email fallback.
    const noToken = useTurnstile && !token
    if (noToken) setNotice(hasContact ? L.turnstileFallback : L.turnstileNoContact)
    setStatus('sending')
    try {
      // Apps Script web apps do not send CORS headers; "no-cors" + text/plain delivers the body anyway.
      await fetch(props.leadEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(p),
      })
      setStatus(noToken ? 'fallback' : 'sent')
    } catch {
      setStatus('error')
    }
  }

  const summary = payload ? leadSummary(payload) : ''
  const subject = `${props.brand}: ${q.services[service]} — ${payload?.name ?? ''}`

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ---------- calculator ---------- */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm lg:col-span-3">
        {enabled.length > 1 && (
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-semibold text-muted">{q.service}</legend>
            <div className="flex flex-wrap gap-2">
              {enabled.map((s) => (
                <button key={s} type="button" className={chipCls(service === s)} onClick={() => setService(s)} aria-pressed={service === s}>
                  {q.services[s]}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {service === 'cleaning' && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted">{q.cleaningType}</legend>
              <div className="flex flex-wrap gap-2">
                {(['standard', 'deep', 'moveOut'] as CleaningType[]).map((c) => (
                  <button key={c} type="button" className={chipCls(ctype === c)} onClick={() => setCtype(c)} aria-pressed={ctype === c}>
                    {CLEANING_TYPE_LABEL[c][lang]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-muted">{q.bedrooms}</span>
                <select className={inputCls} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value) as Bedrooms)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 5 ? q.bedroomsFive : n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-muted">{q.bathrooms}</span>
                <select className={inputCls} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted">{q.addOns}</legend>
              <div className="flex flex-wrap gap-2">
                {book.cleaning.addOns.map((a) => (
                  <button key={a.id} type="button" className={chipCls(addOns.includes(a.id))} onClick={() => toggleAddOn(a.id)} aria-pressed={addOns.includes(a.id)}>
                    {a[lang]} +{money(a.price)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={rush} onChange={(e) => setRush(e.target.checked)} />
              <span>
                {q.rush} (+{book.cleaning.rushPremiumPct}%)
              </span>
            </label>
          </div>
        )}

        {service === 'gutters' && book.gutters && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted">{q.storeys}</legend>
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3] as const).filter((n) => n <= props.gutterMaxStoreys).map((n) => (
                  <button key={n} type="button" className={chipCls(storeys === n)} onClick={() => setStoreys(n)} aria-pressed={storeys === n}>
                    {q.storeyOptions[n]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={downspouts} onChange={(e) => setDownspouts(e.target.checked)} />
              <span>
                {q.downspouts} (+{money(book.gutters.downspoutFlush)})
              </span>
            </label>
          </div>
        )}

        {service === 'snow' && book.snow && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted">{q.driveway}</legend>
              <div className="flex flex-wrap gap-2">
                {(['single', 'double', 'large'] as DrivewaySize[]).map((s) => (
                  <button key={s} type="button" className={chipCls(driveway === s)} onClick={() => setDriveway(s)} aria-pressed={driveway === s}>
                    {DRIVEWAY_LABEL[s][lang]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={walkway} onChange={(e) => setWalkway(e.target.checked)} />
              <span>{q.walkway}</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={salting} onChange={(e) => setSalting(e.target.checked)} />
              <span>{q.salting}</span>
            </label>
          </div>
        )}

        {/* ---------- result ---------- */}
        {estimate && (
          <div className="mt-6 rounded-xl bg-brand-soft p-4" aria-live="polite">
            <p className="text-sm font-semibold text-brand-dark">{q.estimate}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {money(estimate.low)} – {money(estimate.high)}
              {estimate.tax && (
                <span className="ml-2 text-base font-medium text-muted">
                  {q.plusTax} {estimate.tax.label}
                </span>
              )}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-foreground/80">
              {estimate.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{l[lang]}</span>
                  <span className="tabular-nums">{money(l.amount)}</span>
                </li>
              ))}
            </ul>
            {estimate.schedule && (
              <div className="mt-3 space-y-1 border-t border-brand/20 pt-3 text-sm">
                <p>{q.snowSchedule(estimate.schedule.instalments, money(estimate.schedule.each))}</p>
                {estimate.perVisit !== undefined && <p>{q.snowPerVisit(money(estimate.perVisit))}</p>}
                <p>{q.snowVoid(SNOW_MINIMUM_DEADLINE[lang])}</p>
                <p>{q.snowRoad}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">{q.estimateNote}</p>
            {!tax.registered && <p className="mt-1 text-xs text-muted">{d.notRegisteredLine}</p>}
          </div>
        )}
      </div>

      {/* ---------- lead form ---------- */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm lg:col-span-2">
        {panelShown ? (
          <div className="space-y-4">
            <H ref={panelHeadingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              {status === 'sent' ? f.sentTitle : f.fallbackTitle}
            </H>
            {status === 'error' && <p className="text-sm text-red-700">{hasContact ? f.error : L.errorNoContact}</p>}
            {status === 'fallback' && notice && <p className="text-sm text-red-700">{notice}</p>}
            {/* these lines point at the text/email buttons, so show them only when a button exists */}
            {hasContact && <p className="text-sm text-muted">{status === 'sent' ? f.sentBody : f.fallbackBody}</p>}
            <div className="flex flex-col gap-2">
              {contact.phone && (
                <a className="rounded-lg bg-brand px-4 py-3 text-center font-semibold text-white hover:bg-brand-dark" href={smsHref(contact.phone, summary)}>
                  {f.textIt}
                </a>
              )}
              {contact.email && (
                <a className="rounded-lg border border-brand px-4 py-3 text-center font-semibold text-brand-dark hover:bg-brand-soft" href={mailHref(contact.email, subject, summary)}>
                  {f.emailIt}
                </a>
              )}
              <button type="button" onClick={editRequest} className="rounded-lg px-4 py-2 text-center text-sm font-semibold text-brand-dark underline hover:bg-brand-soft">
                {L.edit}
              </button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-muted">{summary}</pre>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <H className="text-lg font-bold">{f.title}</H>
            <p className="text-sm text-muted">{f.intro}</p>
            {!canDeliver && <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-red-700">{L.notConfigured}</p>}
            {/* disabled when no endpoint, phone or email is configured: nothing typed here could be sent */}
            <fieldset disabled={!canDeliver} className={`min-w-0 space-y-3 ${canDeliver ? '' : 'opacity-60'}`}>
              <input ref={nameRef} className={inputCls} placeholder={f.name} aria-label={f.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-invalid={invalid(name)} aria-describedby={invalid(name) && messageId} />
              <input ref={phoneRef} className={inputCls} placeholder={f.phone} aria-label={f.phone} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required aria-invalid={invalid(phone)} aria-describedby={invalid(phone) && messageId} />
              <input className={inputCls} placeholder={f.email} aria-label={f.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" type="email" />
              <input ref={addressRef} className={inputCls} placeholder={f.address} aria-label={f.address} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" required aria-invalid={invalid(address)} aria-describedby={invalid(address) && messageId} />
              <input className={inputCls} placeholder={f.dates} aria-label={f.dates} value={dates} onChange={(e) => setDates(e.target.value)} />
              <textarea className={inputCls} rows={2} placeholder={f.notes} aria-label={f.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                <span>{consentText}</span>
              </label>
              <p className="text-xs text-muted">
                {f.privacyAgree}{' '}
                <a className="underline" href={lang === 'ko' ? '/ko/privacy/' : '/privacy/'}>
                  {f.privacy}
                </a>
                .
              </p>
              {useTurnstile && <div ref={turnstileRef} />}
              {useTurnstile && turnstileFailed && !token && <p className="text-sm text-muted">{L.turnstileHint}</p>}
              {message && (
                <p id={messageId} role="alert" className="text-sm text-red-700">
                  {message}
                </p>
              )}
              <button
                type="submit"
                disabled={!canDeliver || status === 'sending' || (useTurnstile && !token && !turnstileFailed)}
                className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {status === 'sending' ? f.sending : f.submit}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  )
}
