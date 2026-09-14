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

/**
 * "2026-09-14" → "14 September 2026", or "2026년 9월 14일" for a Korean page.
 *
 * Built from the parts rather than through `toLocaleDateString`, because the
 * generator must produce identical output on any machine and Node's ICU data is
 * not identical everywhere.
 */
export function formatDate(iso, lang = 'en') {
  const [y, m, d] = iso.split('-').map(Number)
  if (lang === 'ko') return `${y}년 ${m}월 ${d}일`
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** The language a brief's pages are written in. */
export function langOf(brief) {
  return (brief.meta?.locale ?? 'en-CA').split('-')[0]
}

/**
 * Page copy, per language.
 *
 * The Korean is written, not translated: a page that reads like machine output
 * undermines the one thing the bilingual package is selling. Both versions say
 * the same things, in the way each language actually says them.
 */
const COPY = {
  en: {
    privacyTitle: 'Privacy',
    termsTitle: 'Terms',
    updated: 'Last updated',
    defaultCollects: ['The name, email address and message you type into a contact or enquiry form, if the site has one.'],
    defaultRefund: 'Talk to us before buying if anything is unclear. Once work has been delivered it cannot be returned, so questions are cheaper asked first.',
    defaultDeliverable: 'the products or services described on this site',
  },
  ko: {
    privacyTitle: '개인정보 처리방침',
    termsTitle: '이용약관',
    updated: '최종 수정일',
    defaultCollects: ['문의 양식이 있는 경우, 거기에 입력하신 성함과 이메일 주소, 그리고 문의 내용입니다.'],
    defaultRefund: '궁금한 점이 있으시면 결제 전에 먼저 물어봐 주세요. 작업물이 전달된 뒤에는 되돌릴 수 없으므로, 미리 확인하시는 편이 서로 편합니다.',
    defaultDeliverable: '이 사이트에 안내된 상품 또는 서비스',
  },
}

function privacyBlocks(L, lang) {
  const t = COPY[lang] ?? COPY.en
  const collects = Array.isArray(L.collects) && L.collects.length ? L.collects : t.defaultCollects

  if (lang === 'ko') {
    return [
      { body: [`${L.operator}이(가) 이 웹사이트를 통해 수집하는 개인정보를 어떻게 다루는지 설명합니다. 읽히라고 쓴 글이며, 넘기라고 쓴 글이 아닙니다.`] },
      {
        heading: '짧게 말하면',
        body: ['이 사이트는 정적 파일 몇 개입니다. 쿠키를 심지 않고, 접속 분석을 돌리지 않으며, 광고를 싣지 않고, 외부 스크립트나 웹폰트를 불러오지 않습니다. 사이트 간 추적이 일어나지 않고, 동의를 받을 것이 없으니 동의 배너도 없습니다.'],
      },
      { heading: '무엇을 수집하나요', body: collects },
      {
        heading: '왜 수집하나요',
        body: ['문의에 답변드리고 요청하신 서비스를 제공하기 위해서입니다. 판매하거나, 빌려주거나, 교환하거나, 광고용 프로필을 만드는 데 쓰지 않습니다.'],
      },
      {
        heading: '누가 더 볼 수 있나요',
        body: [
          '이 파일들을 서비스하는 호스팅 사업자는 사이트를 전달하고 오남용을 막는 과정에서 IP 주소를 포함한 접속 요청을 처리하게 됩니다.',
          '법이 요구하는 경우를 제외하면 그 외 누구에게도 제공하지 않습니다.',
        ],
      },
      {
        heading: '얼마나 보관하나요',
        body: ['문의 내용은 처리에 필요한 기간과 통상적인 거래 기록 보관에 필요한 기간 동안만 보관하고, 두 사유가 모두 없어지면 삭제합니다.'],
      },
      {
        heading: '요청하실 수 있는 것',
        body: [
          `보유 중인 본인의 개인정보 확인, 정정, 삭제를 요청하실 수 있습니다. ${L.contactEmail}으로 연락 주시면 답변드립니다.`,
          '답변이 충분하지 않다고 판단되시면 캐나다 연방 개인정보보호위원회(Office of the Privacy Commissioner of Canada)에 문제를 제기하실 수 있습니다.',
        ],
      },
      { heading: '아동', body: ['이 사이트는 아동을 대상으로 하지 않으며, 아동의 개인정보를 의도적으로 수집하지 않습니다.'] },
      { heading: '변경', body: ['이 문서가 바뀌면 상단의 날짜도 함께 바뀝니다.'] },
      { heading: '연락처', body: [`${L.operator} — ${L.contactEmail}`] },
    ]
  }

  return [
    { body: [`This page explains what ${L.operator} does with personal information collected through this website. It is written to be read, not to be skipped.`] },
    {
      heading: 'The short version',
      body: ['This site is a set of static files. It sets no cookies, runs no analytics, embeds no advertising and loads no third-party scripts or fonts. Nothing you do here is tracked across sites, and there is no consent banner because there is nothing to consent to.'],
    },
    { heading: 'What is collected', body: collects },
    {
      heading: 'Why it is collected',
      body: ['Only to answer you and to provide the service you asked about. It is not sold, rented, traded or used to build an advertising profile.'],
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
      body: ['Enquiries are kept for as long as needed to deal with them and to keep ordinary business records, and are deleted when neither reason applies.'],
    },
    {
      heading: 'Your choices',
      body: [
        `You can ask what personal information is held about you, ask for it to be corrected, or ask for it to be deleted. Write to ${L.contactEmail} and you will get an answer.`,
        'If you are not satisfied with the response, you can raise the matter with the Office of the Privacy Commissioner of Canada.',
      ],
    },
    { heading: 'Children', body: ['This site is not directed at children and does not knowingly collect information from them.'] },
    { heading: 'Changes', body: ['If this page changes, the date at the top changes with it.'] },
    { heading: 'Contact', body: [`${L.operator} — ${L.contactEmail}`] },
  ]
}

function termsBlocks(L, lang) {
  const t = COPY[lang] ?? COPY.en
  const deliverable = L.deliverable ?? t.defaultDeliverable
  const refund = L.refund ?? t.defaultRefund

  if (lang === 'ko') {
    return [
      { body: [`이 약관은 본 웹사이트와 ${deliverable}에 적용됩니다. 사이트를 이용하시면 약관에 동의하신 것으로 봅니다.`] },
      { heading: '사업자', body: [`${L.operator}, 연락처 ${L.contactEmail}`] },
      {
        heading: '가격과 통화',
        body: ['이 사이트에 표시된 가격은 별도 표기가 없는 한 캐나다 달러 기준입니다. 표시된 가격이 청구되는 가격이며, 페이지에 명시적으로 안내하고 동의를 받지 않는 한 자동 갱신이나 정기 결제는 없습니다.'],
      },
      {
        heading: '결제',
        body: ['결제는 그때 합의된 방법으로 직접 진행합니다. 이 사이트는 카드번호나 계좌정보를 어떤 시점에도 저장하지 않습니다.'],
      },
      { heading: '환불과 취소', body: [refund] },
      {
        heading: '사이트의 내용',
        body: ['이곳의 내용은 실무상 가능한 범위에서 정확하고 최신으로 유지하며, 정보 제공을 목적으로 합니다. 재고, 일정, 결과에 관한 설명은 성실하게 작성된 안내이며 특정 결과를 보증하는 것은 아닙니다.'],
      },
      {
        heading: '책임의 범위',
        body: ['법이 허용하는 범위에서, 본 웹사이트 또는 그 정보로 인해 발생하는 책임은 해당 건에 대해 지급하신 금액을 한도로 합니다. 법률상 제한할 수 없는 권리는 이 조항으로 제한되지 않습니다.'],
      },
      {
        heading: '외부 링크',
        body: ['다른 사이트로의 링크는 편의를 위한 것입니다. 해당 사이트에서 일어나는 일은 이 약관이 아니라 그 사이트의 약관과 개인정보 처리방침의 적용을 받습니다.'],
      },
      { heading: '준거법', body: [`이 약관은 ${L.jurisdiction}의 법률에 따릅니다.`] },
      { heading: '변경', body: ['이 약관은 변경될 수 있습니다. 효력이 있는 것은 상단에 날짜가 표시된 이 페이지의 내용입니다.'] },
    ]
  }

  return [
    { body: [`These terms apply to this website and to ${deliverable}. Using the site means you accept them.`] },
    { heading: 'Who you are dealing with', body: [`${L.operator}, contactable at ${L.contactEmail}.`] },
    {
      heading: 'Prices and currency',
      body: ['Prices shown on this site are in Canadian dollars unless stated otherwise on the page itself. A price shown is the price charged; there is no automatic renewal and no subscription unless a page says so explicitly and you agree to it.'],
    },
    {
      heading: 'Payment',
      body: ['Payment is arranged directly with us by the method agreed at the time. This site does not store card numbers or banking details at any point.'],
    },
    { heading: 'Refunds and cancellation', body: [refund] },
    {
      heading: 'What is on this site',
      body: ['Content here is kept accurate and current as far as is practical, and is provided for information. Where a page describes availability, timing or a result, that description is a good-faith statement and not a guarantee of a specific outcome.'],
    },
    {
      heading: 'Limits',
      body: ['To the extent the law allows, liability arising from this website or from information on it is limited to the amount you paid for the thing the claim is about. Nothing here limits any right you have that cannot lawfully be limited.'],
    },
    {
      heading: 'Other sites',
      body: ['Links to other sites are provided for convenience. What happens on those sites is governed by their own terms and privacy practices, not by these.'],
    },
    { heading: 'Governing law', body: [`These terms are governed by the laws of ${L.jurisdiction}.`] },
    { heading: 'Changes', body: ['These terms can change. The version in force is the one on this page, dated at the top.'] },
  ]
}

export function renderPrivacy(brief) {
  const lang = langOf(brief)
  const t = COPY[lang] ?? COPY.en
  return renderLegalPage(brief, {
    title: t.privacyTitle,
    slug: 'privacy',
    updatedLabel: t.updated,
    updated: formatDate(brief.legal.effective, lang),
    blocks: privacyBlocks(brief.legal, lang),
  })
}

export function renderTerms(brief) {
  const lang = langOf(brief)
  const t = COPY[lang] ?? COPY.en
  return renderLegalPage(brief, {
    title: t.termsTitle,
    slug: 'terms',
    updatedLabel: t.updated,
    updated: formatDate(brief.legal.effective, lang),
    blocks: termsBlocks(brief.legal, lang),
  })
}
