// Interface strings (buttons, labels, notices). Marketing copy lives in content/copy.ts,
// FAQ in content/faq.ts and agreements in content/agreements.ts.

export type Lang = 'en' | 'ko'

export const LANGS: Lang[] = ['en', 'ko']

/** URL prefix for a language: '' for English, '/ko' for Korean */
export const prefix = (lang: Lang) => (lang === 'ko' ? '/ko' : '')

const en = {
  langName: 'English',
  otherLang: '한국어',
  nav: { services: 'Services', quote: 'Instant quote', faq: 'FAQ', contact: 'Contact' },
  setupBanner: 'Setup incomplete — this is a preview. Missing settings:',
  call: 'Call',
  text: 'Text',
  email: 'Email',
  insuredLine: 'Covered by commercial general liability insurance — certificate on request.',
  // Small-supplier rule: no GST/HST until registered (ETA s.148, memo F7). Says only the tax fact —
  // the amounts stay estimates (memo section 10 item 3).
  notRegisteredLine: 'We are not currently registered for GST/HST, so no sales tax is added to these estimates.',
  quote: {
    service: 'Service',
    services: { cleaning: 'Cleaning', gutters: 'Gutter cleaning', snow: 'Snow clearing' },
    cleaningType: 'Type of cleaning',
    bedrooms: 'Bedrooms',
    bedroomsFive: '5+',
    bathrooms: 'Bathrooms',
    addOns: 'Add-ons',
    rush: 'Within 24 hours, weekend or holiday',
    storeys: 'Height of the house',
    storeyOptions: { 1: 'Bungalow / 1 storey', 2: '2 storeys', 3: '3 storeys' },
    downspouts: 'Also flush the downspouts',
    driveway: 'Driveway size',
    walkway: 'Front walkway and steps',
    salting: 'Salting / ice melt',
    estimate: 'Your estimate',
    estimateNote: 'Estimate only — we confirm the final price when we see the home. The upper end covers heavier jobs.',
    plusTax: 'plus',
    // `each` is the LOW estimate ÷ n, the smallest possible instalment (lib/quote.ts Estimate.schedule),
    // so it is shown as "from", never as the exact amount.
    snowSchedule: (n: number, each: string) =>
      `Billed in ${n} monthly instalments on Dec 1, Jan 1, Feb 1 and Mar 1, from ${each} each (season price confirmed on site ÷ ${n}). Nothing is charged before Dec 1.`,
    // November snow: only if ticked in the contract, snowfalls at or above the trigger depth from contract
    // confirmation to Nov 30, billed with the Dec 1 instalment (content/agreements.ts "November snow").
    snowPerVisit: (p: string) =>
      `November snow (optional): ${p} per visit, only if you tick that option in your contract, for snowfalls at or above the trigger depth from contract confirmation to Nov 30. Billed with the Dec 1 instalment; nothing is charged before Dec 1.`,
    // Minimum counted over all snow contracts, not per neighbourhood (content/agreements.ts
    // "Minimum-contract condition"; memo section 0 item 2 "break-even number of contracts").
    snowVoid: (date: string) =>
      `Season contracts go ahead only if we sign our minimum number of snow contracts (all areas combined) by ${date}. If we don't, the contract is void and you owe nothing.`,
    // Shown for every snow city, so the law claim is limited to what was sourced everywhere snow is
    // offered: roadway deposits carry fines in Ontario (HTA s.181, memo F34, snippet) and Calgary
    // (memo section 6, calgary.ca/bylaws/snow-ice.html, snippet). City-specific wording: content/faq.ts roadLawLine().
    snowRoad: 'We never push snow onto the road or sidewalk. It is unsafe, and putting snow on the road can bring fines.',
    perMonth: '/month',
    season: 'season',
  },
  form: {
    title: 'Request this quote',
    intro: 'Send your details and we will confirm a time. No obligation.',
    name: 'Your name',
    phone: 'Phone',
    email: 'Email (optional)',
    address: 'Address or nearest intersection',
    dates: 'Preferred dates and times',
    notes: 'Anything we should know? (pets, parking, access)',
    privacyAgree: 'We use these details only to answer your request. See our',
    privacy: 'privacy notice',
    submit: 'Send request',
    sending: 'Sending…',
    sentTitle: 'Thanks — your request is ready.',
    sentBody: 'To make sure it reaches us right away, also send it by text or email with one tap:',
    fallbackTitle: 'Send your request',
    fallbackBody: 'Tap to send this request by text or email. Nothing is sent until you press send in your app.',
    textIt: 'Text this request',
    emailIt: 'Email this request',
    required: 'Please fill in your name, phone and address.',
    error: 'Something went wrong sending the form. Please use the text or email buttons below.',
  },
  footer: {
    privacy: 'Privacy',
    agreements: 'Service agreements',
    prices: 'Price list',
    rights: 'All prices in Canadian dollars.',
  },
  notFound: { title: 'Page not found', back: 'Back to home' },
}

type Dict = typeof en

const ko: Dict = {
  langName: '한국어',
  otherLang: 'English',
  nav: { services: '서비스', quote: '바로 견적', faq: '자주 묻는 질문', contact: '연락처' },
  setupBanner: '설정 미완료 — 미리보기 화면입니다. 입력되지 않은 설정:',
  call: '전화',
  text: '문자',
  email: '이메일',
  insuredLine: '영업배상책임보험(CGL)에 가입되어 있어요. 요청하시면 증명서를 보내 드려요.',
  notRegisteredLine: '현재 GST/HST 등록 사업자가 아니어서 예상 금액에 세금이 따로 붙지 않아요.',
  quote: {
    service: '서비스',
    services: { cleaning: '청소', gutters: '홈통 청소', snow: '제설' },
    cleaningType: '청소 종류',
    bedrooms: '침실 수',
    bedroomsFive: '5개 이상',
    bathrooms: '욕실 수',
    addOns: '추가 항목',
    rush: '24시간 이내·주말·공휴일',
    storeys: '주택 높이',
    storeyOptions: { 1: '단층(방갈로)', 2: '2층', 3: '3층' },
    downspouts: '배수관(다운스파우트) 청소 추가',
    driveway: '진입로 크기',
    walkway: '현관 보도·계단',
    salting: '제빙(소금) 살포',
    estimate: '예상 견적',
    estimateNote: '예상 금액이에요. 집을 직접 확인한 뒤 최종 금액을 확정해요. 범위의 위쪽은 작업량이 많은 경우예요.',
    // rendered before the tax label ("+ HST 13%"); '별도' would need to come after the label
    plusTax: '+',
    snowSchedule: (n: number, each: string) =>
      `12월 1일, 1월 1일, 2월 1일, 3월 1일, 모두 ${n}번에 나눠 청구해요. 1회 금액은 ${each}부터예요(현장에서 확정한 시즌 요금 ÷ ${n}). 12월 1일 전에는 한 푼도 받지 않아요.`,
    snowPerVisit: (p: string) =>
      `11월 눈(선택): 계약서에서 이 옵션을 선택하신 경우에만, 계약이 확정된 날부터 11월 30일까지 출동 기준 적설량 이상 내린 눈을 1회 ${p}에 치워 드려요. 12월 1일 첫 분할금과 함께 청구하고, 그 전에는 받지 않아요.`,
    snowVoid: (date: string) =>
      `시즌 계약은 ${date}까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르러야 진행돼요. 이르지 않으면 계약은 무효이고 내실 돈은 없어요.`,
    snowRoad: '치운 눈을 도로나 인도로 밀어내지 않아요. 위험하고, 도로에 눈을 밀어내면 벌금이 부과될 수 있어요.',
    perMonth: '/월',
    season: '시즌',
  },
  form: {
    title: '이 견적으로 요청하기',
    intro: '연락처를 남겨 주시면 방문 시간을 확인해 드려요. 부담 없이 문의하세요.',
    name: '성함',
    phone: '전화번호',
    email: '이메일(선택)',
    address: '주소 또는 가까운 교차로',
    dates: '희망 날짜·시간',
    notes: '알아야 할 점(반려동물, 주차, 출입 방법 등)',
    privacyAgree: '입력하신 정보는 이 요청에 답하는 데만 사용해요. 자세한 내용:',
    privacy: '개인정보 안내',
    submit: '요청 보내기',
    sending: '보내는 중…',
    sentTitle: '감사합니다. 요청이 준비됐어요.',
    sentBody: '바로 확인할 수 있도록 아래 버튼으로 문자나 이메일도 한 번 보내 주세요:',
    fallbackTitle: '요청 보내기',
    fallbackBody: '버튼을 누르면 문자·이메일 앱에 내용이 채워져요. 앱에서 보내기를 눌러야 전송돼요.',
    textIt: '문자로 보내기',
    emailIt: '이메일로 보내기',
    required: '성함, 전화번호, 주소를 입력해 주세요.',
    error: '양식을 보내는 중에 문제가 생겼어요. 아래 문자·이메일 버튼을 이용해 주세요.',
  },
  footer: {
    privacy: '개인정보 안내',
    agreements: '서비스 계약서',
    prices: '가격표',
    rights: '모든 가격은 캐나다 달러 기준이에요.',
  },
  notFound: { title: '페이지를 찾을 수 없습니다', back: '홈으로' },
}

export const DICT: Record<Lang, Dict> = { en, ko }

export const t = (lang: Lang) => DICT[lang]

/**
 * CASL express-consent request (SOR/2012-36 s.4, checked in the Justice Canada XML): names the
 * business, gives its mailing address and a phone or email, and says consent can be withdrawn.
 * Show this next to the opt-in box AND store the same string as marketingConsentText, so the
 * record proves what the customer saw (CASL s.13 onus). Used by components/QuoteTool.tsx (the
 * opt-in label is built only here, so no generic wording without these details can be shown).
 * Not legal advice.
 */
export function marketingConsentText(
  lang: Lang,
  who: { brand: string; mailingAddress: string; phone: string; email: string },
): string {
  const contact = [who.phone, who.email].filter(Boolean).join(', ')
  const details = [who.mailingAddress, contact].filter(Boolean).join('; ')
  const name = details ? `${who.brand} (${details})` : who.brand
  return lang === 'ko'
    ? `${name}의 할인·소식을 이메일이나 문자로 받겠습니다. 언제든 동의를 철회(수신 거부)할 수 있습니다.`
    : `Yes, ${name} may send me occasional offers by email or text. I can withdraw my consent (unsubscribe) at any time.`
}

export function money(n: number, opts: { cents?: boolean } = {}): string {
  const hasCents = opts.cents ?? !Number.isInteger(n)
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 })}`
}

/** the snow-contract minimum deadline shown to customers */
export const SNOW_MINIMUM_DEADLINE: Record<Lang, string> = { en: 'November 20', ko: '11월 20일' }
