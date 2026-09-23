import type { Metadata } from 'next'
import { business, missingSetup, priceBook } from '@/config/business'
import type { Source } from '@/config/prices'
import { money } from '@/lib/i18n'

// Owner-only reference page (not linked, not indexed): every price with its source and status.

export const metadata: Metadata = { title: 'Price book & settings', robots: { index: false, follow: false } }

const STATUS: Record<Source['status'], string> = {
  snippet: 'search snippet — verify',
  'owner-choice': 'owner choice',
  'not-found': 'not found',
}

function Sources({ list }: { list: Source[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
      {list.map((s, i) => (
        <li key={i}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{STATUS[s.status]}</span>{' '}
          {s.url ? (
            <a className="underline" href={s.url} rel="noreferrer">
              {s.label}
            </a>
          ) : (
            s.label
          )}{' '}
          — <span className="text-muted">{s.note}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Page() {
  const b = priceBook
  const missing = missingSetup()
  const gates = [
    ['City', `${business.cityName.en} (${business.city})`],
    ['Cleaning', 'on'],
    ['Gutters (Track B, needs Gate G1)', business.services.gutters ? 'ON' : 'off'],
    ['Snow (needs Gate S: written snow insurance)', business.services.snow ? 'ON' : 'off'],
    ['Insured line shown on site', business.insured ? 'YES' : 'no'],
    ['GST/HST registered (adds tax to estimates)', business.salesTaxRegistered ? `YES — ${business.tax.label}` : 'no'],
    ['Tax rule for this city', `${business.tax.label} (${business.tax.status})`],
    ['Lead endpoint', business.leadEndpoint ? 'set' : 'not set (SMS/email fallback only)'],
    ['Turnstile', business.turnstileSiteKey ? 'set' : 'not set'],
    ['Missing settings', missing.length ? missing.join(', ') : 'none'],
  ]
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Price book &amp; settings</h1>
      <p className="mt-2 text-muted">
        Owner reference. Every default price is inside a published market range (search snippet, page not opened) or an owner choice. Check 5–10 live competitor prices in your area before printing. Edit prices in <code>config/prices.ts</code>.
      </p>

      <h2 className="mt-8 text-xl font-bold">Settings &amp; gates</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {gates.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <td className="py-1 pr-4 font-medium">{k}</td>
              <td className="py-1">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8 text-xl font-bold">Cleaning</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th>Bedrooms</th>
            <th>Baths incl.</th>
            <th>Standard</th>
            <th>Deep</th>
            <th>Move-in/out</th>
          </tr>
        </thead>
        <tbody>
          {b.cleaning.tiers.map((t) => (
            <tr key={t.bedrooms} className="border-b border-line">
              <td>{t.bedrooms}</td>
              <td>{t.includedBaths}</td>
              <td>{money(t.standard)}</td>
              <td>{money(t.deep)}</td>
              <td>{money(t.moveOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm">
        Extra bathroom {money(b.cleaning.extraBathroom)} · Add-ons: {b.cleaning.addOns.map((a) => `${a.en} ${money(a.price)}`).join(', ')} · Rush +{b.cleaning.rushPremiumPct}% · Range upper end +{b.rangeUpliftPct}%
      </p>
      <Sources list={b.cleaning.sources} />

      <h2 className="mt-8 text-xl font-bold">Gutters</h2>
      {b.gutters ? (
        <>
          <p className="mt-2 text-sm">
            1 storey {money(b.gutters.byStoreys[1])} · 2 storeys {money(b.gutters.byStoreys[2])} · 3 storeys {money(b.gutters.byStoreys[3])} · downspout flush {money(b.gutters.downspoutFlush)}
          </p>
          <Sources list={b.gutters.sources} />
        </>
      ) : (
        <p className="mt-2 text-sm">Not offered in this city.</p>
      )}

      <h2 className="mt-8 text-xl font-bold">Snow</h2>
      {b.snow ? (
        <>
          <p className="mt-2 text-sm">
            Mode: {b.snow.mode} · single {money(b.snow.driveway.single)} · double {money(b.snow.driveway.double)} · large {money(b.snow.driveway.large)} · walkway {money(b.snow.walkwayAndSteps)} · salting {money(b.snow.salting)} · per visit {money(b.snow.perVisit)} · {b.snow.instalments} instalments
          </p>
          <Sources list={b.snow.sources} />
        </>
      ) : (
        <p className="mt-2 text-sm">Not offered in this city.</p>
      )}

      {b.cityNotes.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">City notes</h2>
          <Sources list={b.cityNotes} />
        </>
      )}
    </main>
  )
}
