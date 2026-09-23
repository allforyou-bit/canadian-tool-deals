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
  notRegisteredLine: 'Prices shown are the full price: we are not currently registered for GST/HST.',
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
    snowSchedule: (n: number, each: string) =>
      `Billed in ${n} monthly instalments of ${each}, on Dec 1, Jan 1, Feb 1 and Mar 1. Nothing is charged before Dec 1.`,
    snowPerVisit: (p: string) => `Snow before the season starts (in November): ${p} per visit, only if you ask for it.`,
    snowVoid: (date: string) =>
      `Our season contracts start only if we sign enough homes in your neighbourhood by ${date}. If we don't, the contract is void and you owe nothing.`,
    snowRoad: 'We never push snow onto the road or sidewalk — it is against the law.',
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
    marketing:
      'Yes, you may send me occasional offers by email or text. I can unsubscribe at any time.',
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
  insuredLine: '영업배상책임보험(CGL)에 가입되어 있습니다. 요청하시면 증명서를 보내드립니다.',
  notRegisteredLine: '표시된 금액이 최종 금액입니다. 현재 GST/HST 등록 사업자가 아니어서 세금이 붙지 않습니다.',
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
    downspouts: '배수관(다운스파우트)도 뚫기',
    driveway: '진입로 크기',
    walkway: '현관 보도·계단',
    salting: '제빙(소금) 살포',
    estimate: '예상 견적',
    estimateNote: '예상 금액입니다. 집을 직접 확인한 뒤 최종 금액을 확정합니다. 범위의 위쪽은 작업량이 많은 경우입니다.',
    plusTax: '별도',
    snowSchedule: (n: number, each: string) =>
      `${n}회 분할 청구: 12월 1일, 1월 1일, 2월 1일, 3월 1일에 각 ${each}. 12월 1일 전에는 한 푼도 받지 않습니다.`,
    snowPerVisit: (p: string) => `시즌 시작 전(11월) 눈: 요청하실 때만 1회 ${p}.`,
    snowVoid: (date: string) =>
      `시즌 계약은 ${date}까지 동네에서 최소 가구 수가 모여야 시작됩니다. 모이지 않으면 계약은 무효가 되고 내실 돈은 없습니다.`,
    snowRoad: '치운 눈을 도로나 인도로 밀어내지 않습니다. 법으로 금지되어 있습니다.',
    perMonth: '/월',
    season: '시즌',
  },
  form: {
    title: '이 견적으로 요청하기',
    intro: '연락처를 남겨주시면 방문 시간을 확인해 드립니다. 부담 없이 문의하세요.',
    name: '성함',
    phone: '전화번호',
    email: '이메일(선택)',
    address: '주소 또는 가까운 교차로',
    dates: '희망 날짜·시간',
    notes: '알아야 할 점(반려동물, 주차, 출입 방법 등)',
    marketing: '가끔 할인·소식을 이메일이나 문자로 받겠습니다. 언제든 수신 거부할 수 있습니다.',
    privacyAgree: '입력하신 정보는 이 요청에 답하는 데만 사용합니다. 자세한 내용:',
    privacy: '개인정보 안내',
    submit: '요청 보내기',
    sending: '보내는 중…',
    sentTitle: '감사합니다. 요청이 준비되었습니다.',
    sentBody: '바로 확인할 수 있도록 아래 버튼으로 문자나 이메일도 한 번 보내주세요:',
    fallbackTitle: '요청 보내기',
    fallbackBody: '버튼을 누르면 문자·이메일 앱에 내용이 채워집니다. 앱에서 보내기를 눌러야 전송됩니다.',
    textIt: '문자로 보내기',
    emailIt: '이메일로 보내기',
    required: '성함, 전화번호, 주소를 입력해 주세요.',
    error: '양식 전송 중 문제가 생겼습니다. 아래 문자·이메일 버튼을 이용해 주세요.',
  },
  footer: {
    privacy: '개인정보 안내',
    agreements: '서비스 약관',
    prices: '가격표',
    rights: '모든 가격은 캐나다 달러 기준입니다.',
  },
  notFound: { title: '페이지를 찾을 수 없습니다', back: '홈으로' },
}

export const DICT: Record<Lang, Dict> = { en, ko }

export const t = (lang: Lang) => DICT[lang]

export function money(n: number, opts: { cents?: boolean } = {}): string {
  const hasCents = opts.cents ?? !Number.isInteger(n)
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 })}`
}

/** the snow-contract minimum deadline shown to customers */
export const SNOW_MINIMUM_DEADLINE: Record<Lang, string> = { en: 'November 20', ko: '11월 20일' }
