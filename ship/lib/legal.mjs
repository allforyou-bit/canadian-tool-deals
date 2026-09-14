/**
 * Privacy and terms pages.
 *
 * Generated from the brief rather than pasted from a generator site, because the
 * two facts that make these pages short are true of every site this tool builds:
 * the output is static, and it sets no cookies and loads no third-party script,
 * so there is no tracking to disclose and no consent banner to show.
 *
 * These are plain-language pages describing what the site actually does. They are
 * not legal advice, and `ship/sales/runbook.md` says so where the operator will
 * read it rather than burying it on a client's page.
 */

import { renderLegalPage } from './render.mjs'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-09-14" → "14 September 2026", without touching the system clock. */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function renderPrivacy(brief) {
  const L = brief.legal
  const collects = Array.isArray(L.collects) && L.collects.length
    ? L.collects
    : ['The name, email address and message you type into a contact or enquiry form, if the site has one.']

  const blocks = [
    {
      body: [
        `This page explains what ${L.operator} does with personal information collected through this website. It is written to be read, not to be skipped.`,
      ],
    },
    {
      heading: 'The short version',
      body: [
        'This site is a set of static files. It sets no cookies, runs no analytics, embeds no advertising and loads no third-party scripts or fonts. Nothing you do here is tracked across sites, and there is no consent banner because there is nothing to consent to.',
      ],
    },
    {
      heading: 'What is collected',
      body: collects,
    },
    {
      heading: 'Why it is collected',
      body: [
        'Only to answer you and to provide the service you asked about. It is not sold, rented, traded or used to build an advertising profile.',
      ],
    },
    {
      heading: 'Who else can see it',
      body: [
        'The hosting provider that serves these files necessarily handles the network requests that reach the site, including IP addresses, as part of delivering it and protecting it from abuse.',
        'Nobody else receives your information unless the law requires it.',
      ],
    },
    {
      heading: 'How long it is kept',
      body: [
        'Enquiries are kept for as long as needed to deal with them and to keep ordinary business records, and are deleted when neither reason applies.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        `You can ask what personal information is held about you, ask for it to be corrected, or ask for it to be deleted. Write to ${L.contactEmail} and you will get an answer.`,
        'If you are not satisfied with the response, you can raise the matter with the Office of the Privacy Commissioner of Canada.',
      ],
    },
    {
      heading: 'Children',
      body: ['This site is not directed at children and does not knowingly collect information from them.'],
    },
    {
      heading: 'Changes',
      body: ['If this page changes, the date at the top changes with it.'],
    },
    {
      heading: 'Contact',
      body: [`${L.operator} — ${L.contactEmail}`],
    },
  ]

  return renderLegalPage(brief, {
    title: 'Privacy',
    slug: 'privacy',
    updated: formatDate(L.effective),
    blocks,
  })
}

export function renderTerms(brief) {
  const L = brief.legal
  const deliverable = L.deliverable ?? 'the products or services described on this site'
  const refund = L.refund ?? 'Talk to us before buying if anything is unclear. Once work has been delivered it cannot be returned, so questions are cheaper asked first.'

  const blocks = [
    {
      body: [`These terms apply to this website and to ${deliverable}. Using the site means you accept them.`],
    },
    {
      heading: 'Who you are dealing with',
      body: [`${L.operator}, contactable at ${L.contactEmail}.`],
    },
    {
      heading: 'Prices and currency',
      body: [
        'Prices shown on this site are in Canadian dollars unless stated otherwise on the page itself. A price shown is the price charged; there is no automatic renewal and no subscription unless a page says so explicitly and you agree to it.',
      ],
    },
    {
      heading: 'Payment',
      body: [
        'Payment is arranged directly with us by the method agreed at the time. This site does not store card numbers or banking details at any point.',
      ],
    },
    {
      heading: 'Refunds and cancellation',
      body: [refund],
    },
    {
      heading: 'What is on this site',
      body: [
        'Content here is kept accurate and current as far as is practical, and is provided for information. Where a page describes availability, timing or a result, that description is a good-faith statement and not a guarantee of a specific outcome.',
      ],
    },
    {
      heading: 'Limits',
      body: [
        'To the extent the law allows, liability arising from this website or from information on it is limited to the amount you paid for the thing the claim is about. Nothing here limits any right you have that cannot lawfully be limited.',
      ],
    },
    {
      heading: 'Other sites',
      body: [
        'Links to other sites are provided for convenience. What happens on those sites is governed by their own terms and privacy practices, not by these.',
      ],
    },
    {
      heading: 'Governing law',
      body: [`These terms are governed by the laws of ${L.jurisdiction}.`],
    },
    {
      heading: 'Changes',
      body: ['These terms can change. The version in force is the one on this page, dated at the top.'],
    },
  ]

  return renderLegalPage(brief, {
    title: 'Terms',
    slug: 'terms',
    updated: formatDate(L.effective),
    blocks,
  })
}
