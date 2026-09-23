'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bedrooms, DrivewaySize, PriceBook } from '@/config/prices'
import { DICT, money, SNOW_MINIMUM_DEADLINE, type Lang } from '@/lib/i18n'
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
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string
    }
  }
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
  const [payload, setPayload] = useState<LeadPayload | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.turnstileSiteKey || !turnstileRef.current) return
    const el = turnstileRef.current
    const render = () => {
      if (window.turnstile && el.childElementCount === 0) {
        window.turnstile.render(el, { sitekey: props.turnstileSiteKey, callback: setToken })
      }
    }
    if (window.turnstile) {
      render()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [props.turnstileSiteKey])

  const toggleAddOn = (id: string) =>
    setAddOns((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setMessage(f.required)
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
      marketingConsentText: optIn ? f.marketing : '',
      turnstileToken: token,
      website,
    }
    setPayload(p)
    if (!props.leadEndpoint) {
      setStatus('fallback')
      return
    }
    setStatus('sending')
    try {
      // Apps Script web apps do not send CORS headers; "no-cors" + text/plain delivers the body anyway.
      await fetch(props.leadEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(p),
      })
      setStatus('sent')
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
        {status === 'sent' || status === 'fallback' || status === 'error' ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">{status === 'sent' ? f.sentTitle : f.fallbackTitle}</h3>
            {status === 'error' && <p className="text-sm text-red-700">{f.error}</p>}
            <p className="text-sm text-muted">{status === 'sent' ? f.sentBody : f.fallbackBody}</p>
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
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-muted">{summary}</pre>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <h3 className="text-lg font-bold">{f.title}</h3>
            <p className="text-sm text-muted">{f.intro}</p>
            <input className={inputCls} placeholder={f.name} aria-label={f.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            <input className={inputCls} placeholder={f.phone} aria-label={f.phone} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required />
            <input className={inputCls} placeholder={f.email} aria-label={f.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" type="email" />
            <input className={inputCls} placeholder={f.address} aria-label={f.address} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" required />
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
              <span>{f.marketing}</span>
            </label>
            <p className="text-xs text-muted">
              {f.privacyAgree}{' '}
              <a className="underline" href={lang === 'ko' ? '/ko/privacy/' : '/privacy/'}>
                {f.privacy}
              </a>
              .
            </p>
            {props.turnstileSiteKey && <div ref={turnstileRef} />}
            {message && <p className="text-sm text-red-700">{message}</p>}
            <button
              type="submit"
              disabled={status === 'sending' || (Boolean(props.turnstileSiteKey) && !token)}
              className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {status === 'sending' ? f.sending : f.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
