import type { FaqItem } from './types'
import type { SnowBook } from '../config/prices'
import { business, priceBook } from '../config/business'

// Website FAQ (build item 13 in business/research/decision-memo.md, section 10).
//
// Rules for editing:
// - Numbers are read from config (config/prices.ts via config/business.ts), never typed here,
//   so the FAQ always matches the quote calculator and the price sheet.
// - Every rule or law stated below carries its source in a comment (memo fact number + link).
// - Items with `service` show only when that service is switched on in config/business.ts.
//   Items with `when` show only for the matching `business.insured` value.
// - Keep each answer at or under 70 words per language.
// - Korean is a courtesy translation; where a legal point differs, the English text governs.

const cleaning = priceBook.cleaning
const onOntario = business.tax.province === 'ON'

// ---------------------------------------------------------------------------
// Text that depends on config
// ---------------------------------------------------------------------------

// Small-supplier rule: no GST/HST is charged until registered (ETA s.148, memo F7:
// https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml).
const TAX_LINE = business.salesTaxRegistered
  ? { en: 'Sales tax (GST/HST) is added to the price.', ko: '판매세(GST/HST)는 별도로 붙어요.' }
  : {
      en: "We're not registered for GST/HST yet, so no sales tax is added.",
      ko: '아직 GST/HST 등록 사업자가 아니라서 세금은 따로 붙지 않아요.',
    }

// Only mention snow billing when snow is actually offered.
const SNOW_PAY_NOTE = business.services.snow
  ? { en: ' Seasonal snow contracts are billed in monthly instalments instead.', ko: ' 시즌 제설 계약은 매달 나눠서 청구해요.' }
  : { en: '', ko: '' }

// Snow instalments are billed Dec 1 – Mar 1 (memo section 0 item 2 and section 6).
const INSTALMENT_DATES = [
  { en: 'Dec 1', ko: '12월 1일' },
  { en: 'Jan 1', ko: '1월 1일' },
  { en: 'Feb 1', ko: '2월 1일' },
  { en: 'Mar 1', ko: '3월 1일' },
]

function instalmentLine(snow: SnowBook) {
  const n = snow.instalments
  if (n >= 1 && n <= INSTALMENT_DATES.length) {
    const dates = INSTALMENT_DATES.slice(0, n)
    const en =
      dates.length > 1
        ? `${dates.slice(0, -1).map((d) => d.en).join(', ')} and ${dates[dates.length - 1].en}`
        : dates[0].en
    return {
      en: `Your season price is split into ${n} equal payments: ${en}.`,
      ko: `시즌 요금은 ${dates.map((d) => d.ko).join(', ')}, 이렇게 ${n}번에 나눠 같은 금액으로 내시면 돼요.`,
    }
  }
  return {
    en: `Your season price is split into ${n} equal monthly payments, starting Dec 1.`,
    ko: `시즌 요금은 12월 1일부터 매달 ${n}번에 나눠 같은 금액으로 내시면 돼요.`,
  }
}

// No snow onto the road. Ontario: Highway Traffic Act s.181 (memo F34,
// https://defendcharges.ca/EN/provincial-offences2/municipal-bylaw-offences/deposit-of-snow-on-roadway, snippet).
// Toronto: Municipal Code 743-9 covers roadways and sidewalks (memo F34; evidence corpus S029,
// https://www.toronto.ca/legdocs/municode/1184_743.pdf, snippet). Calgary: bylaw fines exist
// (memo section 6, https://www.calgary.ca/bylaws/snow-ice.html, snippet).
function roadLawLine() {
  if (business.city === 'gta') {
    return {
      en: 'Pushing snow onto the road is illegal in Ontario (Highway Traffic Act, s.181). In Toronto, the Municipal Code (743-9) also bans pushing it onto roads or sidewalks. Fines apply.',
      ko: '도로에 눈을 밀어내는 것은 온타리오주 도로교통법(Highway Traffic Act) 제181조 위반이에요. 토론토에서는 시 조례(Municipal Code 743-9)로 도로나 인도에 눈을 밀어내는 것도 금지돼요. 벌금이 부과될 수 있어요.',
    }
  }
  if (onOntario) {
    return {
      en: 'Pushing snow onto the road is illegal in Ontario (Highway Traffic Act, s.181), and fines apply.',
      ko: '도로에 눈을 밀어내는 것은 온타리오주 도로교통법(Highway Traffic Act) 제181조 위반이며 벌금이 부과될 수 있어요.',
    }
  }
  return {
    en: 'Pushing snow onto the road is unsafe and can bring bylaw fines.',
    ko: '도로에 눈을 밀어내는 것은 위험하고 시 조례에 따라 벌금이 부과될 수 있어요.',
  }
}

// ---------------------------------------------------------------------------
// General questions (cleaning is always on; `when` items depend on business.insured)
// ---------------------------------------------------------------------------

const GENERAL: FaqItem[] = [
  {
    // Service types: memo section 2, Track A. Add-ons (oven, fridge, cabinets) and flat prices by
    // bedrooms/bathrooms: config/prices.ts. Scope wording is the owner's to approve.
    id: 'cleaning-types',
    service: 'cleaning',
    q: {
      en: "What's included in each type of cleaning?",
      ko: '청소 종류별로 무엇이 포함되나요?',
    },
    a: {
      en: 'Standard: kitchen and bathroom surfaces, dusting within reach, vacuuming and mopping floors, emptying bins.\n\nDeep: everything in a standard clean, plus baseboards, doors, switches and built-up grime.\n\nMove-in/move-out: a deep clean of an empty home.\n\nInside the oven, fridge or cabinets is an add-on for any clean. After your first clean, you can book regular biweekly cleaning.',
      ko: '일반 청소: 주방·욕실 표면, 손 닿는 곳 먼지 제거, 바닥 청소기와 물걸레, 쓰레기 비우기.\n\n딥클린: 일반 청소에 걸레받이, 문, 스위치, 묵은 때 청소가 더해져요.\n\n입주·이사 청소: 비어 있는 집을 딥클린 수준으로 청소해요.\n\n오븐·냉장고·수납장 내부는 모든 청소에 추가 옵션으로 선택하실 수 있어요. 첫 청소 후에는 격주 정기 청소도 예약하실 수 있어요.',
    },
  },
  {
    // Supplies: owner brings a standard kit (memo section 9, "portable supply kit"). Supply costs: not found.
    id: 'supplies',
    service: 'cleaning',
    q: {
      en: 'Do you bring your own cleaning supplies?',
      ko: '청소 용품은 직접 가져오시나요?',
    },
    a: {
      en: "Yes, we bring our standard cleaning supplies and tools. If you'd like particular products used, for example for natural stone, hardwood or allergies, tell us when you book or leave them out for us.",
      ko: '네, 기본 청소 용품과 도구는 저희가 가져가요. 천연석, 원목 마루, 알레르기 등으로 원하시는 제품이 있으면 예약할 때 말씀해 주시거나 꺼내 두세요.',
    },
  },
  {
    // No key custody; client present or client-managed lockbox (memo section 2 Track A, section 6 Operations).
    id: 'home-access',
    service: 'cleaning',
    q: {
      en: 'Do I need to be home?',
      ko: '작업할 때 집에 있어야 하나요?',
    },
    a: {
      en: "Yes, someone needs to let us in, or you can use your own lockbox. You set up and manage the lockbox and its code. We don't keep keys or copies of keys.",
      ko: '네, 집에 계시면서 문을 열어 주시거나, 고객님이 직접 관리하시는 열쇠 보관함(락박스)을 이용하시면 돼요. 락박스와 비밀번호는 고객님이 관리하시고, 저희는 열쇠나 복사본을 보관하지 않아요.',
    },
  },
  {
    // Pets: no policy in the research; the estimate range covers condition (config rangeUpliftPct).
    id: 'pets',
    service: 'cleaning',
    q: {
      en: 'I have pets. Is that OK?',
      ko: '반려동물이 있어도 괜찮나요?',
    },
    a: {
      en: 'Of course. Please tell us about your pets when you book. While we work, we ask that they stay in another room or a crate, for their safety and ours. Heavy pet hair can put the price toward the top of your estimate range.',
      ko: '물론이에요. 예약하실 때 반려동물이 있다고 알려 주세요. 작업하는 동안에는 서로의 안전을 위해 다른 방이나 이동장(켄넬)에 있게 해 주세요. 털이 많이 쌓여 있으면 가격이 예상 견적 범위의 윗부분이 될 수 있어요.',
    },
  },
  {
    // Estimate range "confirmed on site": memo section 10 item 3. Rush/weekend/holiday premium:
    // config/prices.ts rushPremiumPct (inside the 10–20% band, memo F18,
    // https://tidyuphandycrew.ca/2026/02/23/what-affects-move-out-cleaning-cost-in-toronto/, snippet).
    id: 'pricing',
    q: {
      en: 'How does your pricing work?',
      ko: '가격은 어떻게 정해지나요?',
    },
    a: {
      en: `Our online calculator shows an estimate range based on your home and the options you pick. We confirm the final price on site before any work starts. If it's not what you expected, you can say no.\n\nA clean booked less than 24 hours ahead, or on a weekend or statutory holiday, costs ${cleaning.rushPremiumPct}% more. ${TAX_LINE.en}`,
      ko: `온라인 계산기에서 집 정보와 선택하신 옵션에 따라 예상 견적 범위를 보여 드려요. 최종 금액은 작업을 시작하기 전에 현장에서 확인하고, 생각과 다르면 거절하셔도 돼요.\n\n24시간 이내 예약, 주말, 공휴일 청소는 ${cleaning.rushPremiumPct}%가 추가돼요. ${TAX_LINE.ko}`,
    },
  },
  {
    // Payment on completion; bank-set e-Transfer limits, split large amounts (memo F36 and section 8;
    // https://github.com/nifabulous/Relay/blob/885bdf20a690d77dd2b93e46a52a597382039c6e/app/data/payment_schemes.py, secondary).
    id: 'payment',
    q: {
      en: 'How do I pay?',
      ko: '결제는 어떻게 하나요?',
    },
    a: {
      en: `Pay by Interac e-Transfer or cash when the job is done. Each bank sets its own e-Transfer limit, so if your total is over your limit, you can split it into two or more transfers.${SNOW_PAY_NOTE.en}`,
      ko: `작업이 끝난 뒤 인터랙 이트랜스퍼(e-Transfer)나 현금으로 결제하시면 돼요. 이트랜스퍼 한도는 은행마다 달라서, 금액이 한도를 넘으면 두 번 이상 나눠 보내셔도 괜찮아요.${SNOW_PAY_NOTE.ko}`,
    },
  },
  {
    // Cancellation and lockout terms live in the service agreement (memo section 10 item 5); no fee
    // amounts were researched, so none are stated here. KO term matches the agreement: 출입 불가 수수료.
    id: 'cancel-reschedule',
    q: {
      en: 'How do I cancel or reschedule?',
      ko: '예약을 취소하거나 변경하려면 어떻게 하나요?',
    },
    a: {
      en: "Call or text us as early as you can, and we'll find a new time. If we arrive at the booked time and can't get in, a lockout fee may apply. The exact cancellation and lockout terms are in our service agreement, and we go over them with you before you book.",
      ko: '가능한 한 빨리 전화나 문자로 알려 주시면 다른 시간으로 잡아 드려요. 약속한 시간에 도착했는데 들어갈 수 없으면 출입 불가 수수료가 청구될 수 있어요. 정확한 취소 및 출입 불가 수수료 조건은 서비스 계약서에 있고, 예약 전에 함께 확인해 드려요.',
    },
  },
  {
    // Damage claims within 24 h with photos (memo section 10 item 5, cleaning agreement).
    id: 'damage',
    q: {
      en: 'What if something gets damaged?',
      ko: '작업 중 물건이 파손되면 어떻게 하나요?',
    },
    a: {
      en: "If we notice we've damaged something, we'll tell you before we leave. If you find damage later, please tell us within 24 hours of the job and send photos. We'll look into it with you and explain the next steps. The full process is in our service agreement.",
      ko: '저희가 파손한 것을 알게 되면 떠나기 전에 바로 말씀드려요. 나중에 발견하시면 작업 후 24시간 안에 사진과 함께 알려 주세요. 함께 확인하고 다음 절차를 안내해 드릴게요. 자세한 절차는 서비스 계약서에 나와 있어요.',
    },
  },
  {
    // Shown only when business.insured is true (set it only after the CGL policy is bound, memo section 6).
    id: 'insurance',
    when: 'insured',
    q: {
      en: 'Are you insured?',
      ko: '보험에 가입되어 있나요?',
    },
    a: {
      en: 'Yes. We carry commercial general liability insurance. We can show you our certificate of insurance on request.',
      ko: '네. 영업배상책임보험(CGL)에 가입되어 있어요. 요청하시면 보험 증명서를 보여 드려요.',
    },
  },
  {
    // Shown while business.insured is false. Makes no claim either way.
    id: 'insurance-status',
    when: 'notInsured',
    q: {
      en: 'Are you insured?',
      ko: '보험에 가입되어 있나요?',
    },
    a: {
      en: "Please ask us about our current insurance status before you book. We'll give you a straight answer.",
      ko: '예약하시기 전에 현재 보험 가입 상태를 꼭 저희에게 물어봐 주세요. 있는 그대로 말씀드릴게요.',
    },
  },
  {
    // Marketing use of home photos only with a separate written opt-in; before/after photo protocol
    // (memo section 6 Consumer contracts, section 10 items 5 and 14). PIPEDA governs personal information.
    id: 'photos',
    q: {
      en: 'Do you take photos of my home?',
      ko: '집 사진을 찍나요?',
    },
    a: {
      en: "We may take before-and-after photos to record the work and help answer any questions later. We use photos of your home in ads or online only if you agree separately, in writing. Saying no doesn't affect your service.",
      ko: '작업 기록과 이후 문의 확인을 위해 작업 전후 사진을 찍을 수 있어요. 고객님 집 사진을 광고나 온라인에 쓰는 것은 따로 서면으로 동의해 주신 경우에만 해요. 동의하지 않으셔도 서비스에는 아무 영향이 없어요.',
    },
  },
  {
    // Separate unticked marketing opt-in (lib/lead.ts marketingOptIn; CASL, memo F11) and a privacy
    // notice on every form (memo section 6 Privacy).
    id: 'privacy',
    q: {
      en: 'How do you use my information?',
      ko: '제 개인정보는 어떻게 사용되나요?',
    },
    a: {
      en: "We use your name, contact details and address to answer your request, prepare your estimate and do the job. We send marketing messages only if you tick the separate opt-in box, and you can unsubscribe at any time. We don't sell your information.\n\nFull details: /privacy",
      ko: '이름, 연락처, 주소는 문의 답변, 견적 준비, 작업 진행을 위해 사용해요. 홍보 메시지는 별도 수신 동의란에 체크하신 경우에만 보내고, 언제든 수신 거부하실 수 있어요. 개인정보를 판매하지 않아요.\n\n자세한 내용: /ko/privacy',
    },
  },
]

// Ontario direct agreements: cancel within 10 days of receiving the signed copy; refund within
// 15 days (memo F32, https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract,
// snippet S037). Shown only in Ontario cities.
const ONTARIO_CANCELLATION: FaqItem = {
  id: 'ontario-cancellation',
  q: {
    en: 'Can I cancel an agreement I signed at home?',
    ko: '집에서 서명한 계약도 취소할 수 있나요?',
  },
  a: {
    en: "Yes. In Ontario, if you sign an agreement with us at your home (for example, when we knock on your door), you can cancel it within 10 days after you receive your signed copy. We'll refund any payment within 15 days after you cancel. Please cancel in writing (text, email or letter) so you have a record.\n\nSummary only, not legal advice: ontario.ca/page/your-rights-when-signing-or-cancelling-contract",
    ko: '네. 온타리오주에서는 저희가 댁을 방문했을 때처럼 고객님 댁에서 계약서에 서명하신 경우, 서명된 계약서 사본을 받으신 다음 날부터 10일 안에 취소하실 수 있고, 취소 통지를 받은 다음 날부터 15일 안에 내신 금액을 환불해 드려요. 기록이 남도록 문자, 이메일, 편지 등 서면으로 알려 주세요.\n\n요약 안내이며 법률 자문이 아니에요: ontario.ca/page/your-rights-when-signing-or-cancelling-contract',
  },
}

// ---------------------------------------------------------------------------
// Gutters (Track B, shown only after Gate G1 passes and gutters are enabled)
// ---------------------------------------------------------------------------

const GUTTERS: FaqItem[] = [
  {
    // Gutters only, hand and scoop; no windows, no pressure washing (memo section 2 Track B, section 3).
    // Downspout flush add-on: config/prices.ts. Pre-existing damage photos: memo section 10 item 5.
    id: 'gutters-included',
    service: 'gutters',
    q: {
      en: 'What does gutter cleaning include?',
      ko: '홈통 청소에는 무엇이 포함되나요?',
    },
    a: {
      en: "Gutters (eavestroughs) only. We clear leaves and debris by hand and tidy up underneath. Downspout flushing is an optional add-on. Before we start, we photograph any existing damage and show you. We don't clean windows, repair roofs or pressure wash.",
      ko: '홈통(처마 물받이) 청소만 해요. 낙엽과 이물질을 손으로 걷어 내고 아래쪽도 정리해 드려요. 배수관(다운스파우트) 청소는 추가 옵션이에요. 시작 전에 이미 있던 손상은 사진으로 찍어 보여 드려요. 창문 청소, 지붕 수리, 고압 세척은 하지 않아요.',
    },
  },
  {
    // Timing "late fall (after leaves drop, before snow)" (memo F25,
    // https://guttercleaningcalgary.ca/cost-gutter-cleaning-calgary/, snippet). Ladder go/no-go for
    // weather and power lines, roof-access limits in the agreement (memo section 10 items 5 and 14).
    id: 'gutters-ladder-weather',
    service: 'gutters',
    q: {
      en: 'When do you clean gutters, and what about ladders and weather?',
      ko: '홈통 청소는 언제 하나요? 사다리 작업과 날씨는요?',
    },
    a: {
      en: "Late fall is best: after most leaves drop and before snow. We work from a ladder and won't set it up where it isn't safe, such as near power lines or on unstable ground. Any limits on roof access are in your agreement. In rain, strong wind or icy conditions, we reschedule with you.",
      ko: '낙엽이 대부분 떨어진 늦가을, 눈이 오기 전이 가장 좋아요. 사다리로 작업하며, 전선 근처나 바닥이 불안정한 곳처럼 안전하지 않은 곳에는 세우지 않아요. 지붕 출입 제한은 계약서에 적혀 있어요. 비, 강풍, 결빙 등으로 위험하면 일정을 다시 잡아 드려요.',
    },
  },
]

// ---------------------------------------------------------------------------
// Snow (Track B, shown only after Gate S passes and snow is enabled)
// ---------------------------------------------------------------------------

function snowItems(snow: SnowBook): FaqItem[] {
  const pay = instalmentLine(snow)
  const road = roadLawLine()
  return [
    {
      // Season Dec 1 – Mar 31; walk-behind snowblower or shovel, no truck; trigger depth written in
      // the agreement (no depth was researched, so none is stated); walkway/steps and salting are
      // add-ons (memo section 2 Track B, section 6, F28). November storms at the per-visit rate from
      // config/prices.ts (default chosen from the $50–150 band, memo F28): optional clause of the snow
      // agreement, only from the day the contract is confirmed (Nov 20 condition) to Nov 30, billed
      // with the Dec 1 instalment (content/agreements.ts; memo section 3 "Any snow payment before Dec 1").
      id: 'snow-season',
      service: 'snow',
      q: {
        en: 'What does the snow contract cover?',
        ko: '제설 계약에는 무엇이 포함되나요?',
      },
      a: {
        en: `The season runs Dec 1 to Mar 31. We clear your driveway with a walk-behind snowblower or shovel (no truck) when snowfall reaches the depth written in your agreement. Walkway, steps and salting are add-ons.\n\nNovember snow is optional: tick it in your agreement and we clear it at $${snow.perVisit} per visit once your contract is confirmed, billed with your Dec 1 instalment, not before.`,
        ko: `시즌은 12월 1일부터 3월 31일까지예요. 계약서에 정한 적설량 이상 눈이 오면 트럭 없이 보행식 제설기나 삽으로 진입로를 치워 드려요. 보도·계단과 제빙(소금) 살포는 추가 옵션이에요.\n\n11월 눈은 선택 사항이에요. 계약서에서 선택하시면 계약 진행이 확정된 뒤부터 1회 $${snow.perVisit}에 치워 드리고, 12월 1일 첫 분할금과 함께 청구해요. 그 전에는 받지 않아요.`,
      },
    },
    {
      // Instalments Dec 1 – Mar 1, no payment before Dec 1, void if the break-even count is not signed
      // by Nov 20, counted over all snow contracts, not per area (memo section 0 item 2, section 3
      // "Any snow payment before Dec 1", section 6; content/agreements.ts minimum-contract condition;
      // https://www.cp24.com/local/toronto/2026/01/16/gta-customers-who-paid-in-advance-for-snow-removal-feel-cheated-after-company-stopped-providing-service/).
      id: 'snow-billing',
      service: 'snow',
      q: {
        en: 'When do I pay, and could my contract be cancelled?',
        ko: '요금은 언제 내나요? 계약이 취소될 수도 있나요?',
      },
      a: {
        en: `${pay.en} We take no deposit and no payment for the season before Dec 1.\n\nContracts go ahead only if we sign our minimum number of snow contracts (all areas combined) by Nov 20. If not, every contract is void and you owe nothing. We'll let you know either way.`,
        ko: `${pay.ko} 12월 1일 전에는 계약금을 포함해 시즌 요금을 전혀 받지 않아요.\n\n11월 20일까지 전체 제설 계약이 최소 건수에 이르지 않으면 모든 계약은 무효가 되고, 내실 돈은 없어요. 결과는 어느 쪽이든 알려 드려요.`,
      },
    },
    {
      // See roadLawLine() for sources (memo F34, section 6 Operations).
      id: 'snow-road',
      service: 'snow',
      q: {
        en: 'Where do you put the snow?',
        ko: '치운 눈은 어디에 쌓나요?',
      },
      a: {
        en: `On your property, never on the road or sidewalk. ${road.en} Tell us where you'd like it piled.`,
        ko: `고객님 부지 안에 쌓고, 도로나 인도로는 절대 밀어내지 않아요. ${road.ko} 눈을 쌓아 둘 위치를 알려 주세요.`,
      },
    },
  ]
}

export const FAQ: FaqItem[] = [
  ...GENERAL,
  ...(onOntario ? [ONTARIO_CANCELLATION] : []),
  ...(priceBook.gutters ? GUTTERS : []),
  ...(priceBook.snow ? snowItems(priceBook.snow) : []),
]
