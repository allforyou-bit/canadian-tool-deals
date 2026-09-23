// Service agreements as typed content (decision memo §10, build item 5).
//
// - Three templates: cleaning, gutters, snow. The web page and the print/PDF view render these
//   objects. The gutter and snow agreements are published on the site (and printed as PDFs) only
//   when that service is switched on in config/business.ts.
// - {BRAND}, {MAILING_ADDRESS}, {PHONE} and {EMAIL} are placeholders. Fill them from
//   config/business.ts with fillAgreement() (see AGREEMENT_PLACEHOLDERS). Blanks written as
//   ______ are filled in by hand on the printed copy.
// - No price is written into a clause: every price is a blank. AGREEMENT_NOTES gives the GTA
//   defaults, read from config/prices.ts so they cannot drift from the price book.
// - AGREEMENT_NOTES is for the owner and the reviewing lawyer or insurer, not for the customer copy.
// - Not legal advice. The English text governs; the Korean text is a courtesy translation.

import { PRICE_BOOKS } from '../config/prices'
import type { Agreement, AgreementSection, Bilingual, ServiceKey } from './types'

const t = (en: string, ko: string): Bilingual => ({ en, ko })

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

export type AgreementPlaceholder = '{BRAND}' | '{MAILING_ADDRESS}' | '{PHONE}' | '{EMAIL}'

/** where each placeholder's value comes from */
export const AGREEMENT_PLACEHOLDERS: Record<AgreementPlaceholder, string> = {
  '{BRAND}': 'business.brand.en (English text) / business.brand.ko (Korean text) in config/business.ts',
  '{MAILING_ADDRESS}': 'business.contact.mailingAddress (NEXT_PUBLIC_MAILING_ADDRESS)',
  '{PHONE}': 'formatPhone(business.contact.phone) (NEXT_PUBLIC_PHONE)',
  '{EMAIL}': 'business.contact.email (NEXT_PUBLIC_EMAIL)',
}

export interface AgreementValues {
  brand: Bilingual
  mailingAddress: string
  phone: string
  email: string
}

/** printed in place of a placeholder whose setting is still empty, so it can be written in by hand */
const WRITE_IN = '______________________'

/** Returns a copy of the agreement with the placeholders replaced. */
export function fillAgreement(agreement: Agreement, v: AgreementValues): Agreement {
  const fill = (s: string, lang: 'en' | 'ko'): string =>
    s.replace(/\{(BRAND|MAILING_ADDRESS|PHONE|EMAIL)\}/g, (_match: string, key: string) => {
      const value =
        key === 'BRAND' ? v.brand[lang] : key === 'MAILING_ADDRESS' ? v.mailingAddress : key === 'PHONE' ? v.phone : v.email
      return value.trim() || WRITE_IN
    })
  const bi = (x: Bilingual): Bilingual => ({ en: fill(x.en, 'en'), ko: fill(x.ko, 'ko') })
  return {
    service: agreement.service,
    title: bi(agreement.title),
    notice: bi(agreement.notice),
    sections: agreement.sections.map((s) => ({ heading: bi(s.heading), clauses: s.clauses.map(bi) })),
    signatureFields: agreement.signatureFields.map(bi),
  }
}

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------

const NOTICE = t(
  'Template — not legal advice. Have it reviewed by a lawyer or your insurer before use. Not for use in Quebec without adapting to the OPC rules. The English version governs; the Korean text is a courtesy translation.',
  '계약서 양식(템플릿)이며 법률 자문이 아닙니다. 사용하기 전에 변호사나 보험사의 검토를 받으세요. 퀘벡에서는 OPC(퀘벡 소비자보호청) 규정에 맞게 고치기 전에는 사용할 수 없습니다. 영문본이 우선하며, 한국어본은 이해를 돕기 위한 참고 번역입니다.',
)

const PARTIES: AgreementSection = {
  heading: t('Parties and service address', '계약 당사자 및 서비스 주소'),
  clauses: [
    t(
      'Service provider: {BRAND}, operated by ______________________ (sole proprietor). Mailing address: {MAILING_ADDRESS}. Phone: {PHONE}. Email: {EMAIL}.',
      '서비스 제공자: {BRAND}, 운영자 ______________________ (개인사업자). 우편 주소: {MAILING_ADDRESS}. 전화: {PHONE}. 이메일: {EMAIL}.',
    ),
    t(
      'Client: ______________________. Phone: ______________. Email: ______________________.',
      '고객: ______________________. 전화: ______________. 이메일: ______________________.',
    ),
    t(
      'Service address: ________________________________________________.',
      '서비스 주소: ________________________________________________.',
    ),
    t(
      'Liability insurance (filled in only if a policy is in force): insurer ______________, policy number ______________.',
      '배상책임보험(보험이 유효한 경우에만 기재): 보험사 ______________, 증권번호 ______________.',
    ),
    t(
      'Sales tax: GST/HST is added only if a GST/HST registration number is written here: ______________. If this line is blank, no GST/HST is charged.',
      '판매세: 여기에 GST/HST 등록번호가 적혀 있는 경우에만 GST/HST가 추가됩니다: ______________. 이 칸이 비어 있으면 GST/HST를 받지 않습니다.',
    ),
  ],
}

const PAYMENT_ON_COMPLETION: AgreementSection = {
  heading: t('Payment', '결제'),
  clauses: [
    t(
      'Payment is due when the work is finished, by Interac e-Transfer (to ______________________) or in cash. No deposit is required.',
      '요금은 작업이 끝났을 때 인터랙 e-Transfer(받는 이메일: ______________________) 또는 현금으로 내시면 됩니다. 선금(계약금)은 받지 않습니다.',
    ),
    t(
      "If the total is more than your bank's e-Transfer limit, you can split it into two or more transfers or pay part in cash. We give a receipt for every payment.",
      '금액이 고객님 은행의 e-Transfer 한도를 넘으면 두 번 이상 나누어 보내시거나 일부를 현금으로 내셔도 됩니다. 결제하실 때마다 영수증을 드립니다.',
    ),
  ],
}

// Ontario direct agreements (memo F32; ontario.ca, search summary). Sources in AGREEMENT_NOTES.
const ONTARIO_CANCELLATION: AgreementSection = {
  heading: t('Your right to cancel (Ontario)', '계약 취소 권리(온타리오)'),
  clauses: [
    t(
      "If you signed this agreement in person anywhere other than our place of business (for example, at your home), it is a direct agreement under Ontario's Consumer Protection Act. You may cancel it for any reason within 10 days after you receive a copy of the signed agreement. To cancel, tell us in a way that leaves a record: email {EMAIL}, text {PHONE}, or write to {MAILING_ADDRESS}. We must refund everything you paid within 15 days after we receive your cancellation.",
      '이 계약서를 저희 사업장이 아닌 곳(예: 고객님 댁)에서 직접 만나 서명하셨다면, 이 계약은 온타리오 소비자보호법(Consumer Protection Act)상 방문 계약(direct agreement)에 해당합니다. 고객님은 서명된 계약서 사본을 받으신 다음 날부터 10일 안에 이유와 관계없이 계약을 취소하실 수 있습니다. 취소하실 때는 기록이 남는 방법으로 알려 주세요. 이메일 {EMAIL}, 문자 {PHONE}, 또는 우편 {MAILING_ADDRESS}로 보내시면 됩니다. 저희는 취소 통지를 받은 다음 날부터 15일 안에 고객님이 내신 금액 전부를 환불해 드려야 합니다.',
    ),
  ],
}

const PHOTOS: AgreementSection = {
  heading: t('Photos', '사진'),
  clauses: [
    t(
      'We take photos of the work areas before and after the job to check our work and to handle any damage claim. These photos are not published, and we keep them only as long as they are needed for those purposes.',
      '저희는 작업 확인과 파손 문의 처리를 위해 작업 전후로 작업 구역의 사진을 찍습니다. 이 사진은 공개하지 않으며, 그 목적에 필요한 기간 동안만 보관합니다.',
    ),
    t(
      'Separate, optional consent for marketing photos: ☐ Yes ☐ No. We may use before/after photos of the work areas on our website, in ads and on social media only if you tick Yes and initial the photo line below. We will not show people, pets, house numbers, the street, vehicles or licence plates, mail, documents, family photos or other items that identify you, but someone who knows your home may still recognise it. Saying No does not change your price or service. You can withdraw this consent at any time by contacting us; we will then stop using the photos in anything new and remove them from our website and social media accounts within ___ days. Printed materials already handed out cannot be recalled.',
      '마케팅용 사진 사용에 대한 별도 선택 동의: ☐ 예 ☐ 아니요. ‘예’에 표시하고 아래 사진 동의란에 이니셜을 적어 주신 경우에만 저희가 작업 전후 사진을 웹사이트, 광고, 소셜미디어에 쓸 수 있습니다. 사람, 반려동물, 집 번지수, 거리 모습, 차량이나 번호판, 우편물, 서류, 가족사진 등 고객님을 알아볼 수 있는 것은 보이지 않게 하겠습니다. 다만 고객님 댁을 아는 사람은 사진만 보고도 알아볼 수 있습니다. ‘아니요’를 선택하셔도 요금이나 서비스는 달라지지 않습니다. 이 동의는 언제든지 연락 주시면 철회할 수 있으며, 그 뒤로는 새로 사진을 쓰지 않고 웹사이트와 소셜미디어 계정에서 ___일 이내에 삭제합니다. 이미 나누어 드린 인쇄물은 회수할 수 없습니다.',
    ),
  ],
}

const PRIVACY: AgreementSection = {
  heading: t('Your personal information', '개인정보'),
  clauses: [
    t(
      'We collect your name, address, phone number, email, access instructions and job notes only to quote, schedule, do and bill the work, to handle claims, and to keep the records that tax law requires. We do not sell your information. We share it only when needed for those purposes (for example, with our insurer if there is a claim) or when the law requires it.',
      '저희는 고객님의 이름, 주소, 전화번호, 이메일, 출입 안내, 작업 메모를 견적, 일정 잡기, 작업, 청구, 파손 문의 처리, 그리고 세법상 필요한 기록 보관을 위해서만 수집합니다. 고객님의 정보를 판매하지 않습니다. 이 목적에 꼭 필요한 경우(예: 파손 문의가 생겨 보험사에 알려야 할 때)나 법이 요구하는 경우에만 제공합니다.',
    ),
    t(
      'We send marketing emails or texts only if you agree to them separately, and every such message tells you how to unsubscribe.',
      '마케팅 이메일이나 문자는 고객님이 따로 동의하신 경우에만 보내며, 모든 메시지에 수신 거부 방법을 안내합니다.',
    ),
    t(
      'In Ontario, the federal Personal Information Protection and Electronic Documents Act (PIPEDA) governs how we handle your information; in BC and Alberta, the provincial Personal Information Protection Act (PIPA) applies instead. To see or correct the information we hold about you, or to ask about it, contact us at {EMAIL} or {PHONE}.',
      '온타리오에서는 연방 개인정보보호법(PIPEDA)이 고객님 정보의 취급에 적용되며, BC주와 앨버타주에서는 각 주의 개인정보보호법(PIPA)이 대신 적용됩니다. 저희가 가진 고객님 정보를 확인하거나 고치고 싶으시거나 궁금한 점이 있으시면 {EMAIL} 또는 {PHONE}으로 연락해 주세요.',
    ),
  ],
}

const GENERAL: AgreementSection = {
  heading: t('General', '일반 조건'),
  clauses: [
    t(
      'We may stop or refuse any task we judge unsafe. We will tell you why, and you are not charged for work we do not do.',
      '저희가 위험하다고 판단하는 작업은 중단하거나 거절할 수 있습니다. 그 이유를 알려 드리며, 하지 않은 작업에 대해서는 요금을 받지 않습니다.',
    ),
    t(
      'Changes to this agreement count only if both of us agree in writing; email or text is fine.',
      '이 계약의 변경은 양측이 서면으로 합의한 경우에만 효력이 있습니다. 이메일이나 문자도 서면으로 인정합니다.',
    ),
    t(
      'This agreement is written in English and Korean. If the two versions differ, the English version governs; the Korean text is a courtesy translation.',
      '이 계약서는 영어와 한국어로 작성되었습니다. 두 내용이 다를 경우 영문본이 우선하며, 한국어본은 이해를 돕기 위한 참고 번역입니다.',
    ),
    t(
      'This agreement is governed by the laws of the province where the service address is located. Each of us keeps a signed copy.',
      '이 계약에는 서비스 주소가 있는 주의 법이 적용됩니다. 양측은 서명된 계약서를 한 부씩 보관합니다.',
    ),
  ],
}

const SIGNATURES: Bilingual[] = [
  t('Client name (print)', '고객 성명(정자)'),
  t('Client signature', '고객 서명'),
  t('Date signed', '서명 날짜'),
  t('Where signed (address)', '서명 장소(주소)'),
  t('Date the client received a signed copy', '고객이 서명된 사본을 받은 날짜'),
  t('Provider name (print), for {BRAND}', '사업자 성명(정자), {BRAND}'),
  t('Provider signature', '사업자 서명'),
  t('Marketing-photo consent: client initials (only if Yes was ticked)', '마케팅 사진 동의: 고객 이니셜(‘예’를 선택한 경우에만)'),
]

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

const CLEANING: Agreement = {
  service: 'cleaning',
  title: t('{BRAND} — Residential Cleaning Service Agreement', '{BRAND} — 주거 청소 서비스 계약서'),
  notice: NOTICE,
  sections: [
    PARTIES,
    {
      heading: t('Service, schedule and price', '서비스, 일정 및 요금'),
      clauses: [
        t(
          'Service type (tick one): ☐ Standard clean ☐ Deep clean ☐ Move-in / move-out clean ☐ Recurring standard clean every two weeks, starting ______________.',
          '서비스 종류(하나 선택): ☐ 일반 청소 ☐ 딥클린(대청소) ☐ 입주·이사 청소 ☐ 2주마다 정기 일반 청소(시작일 ______________).',
        ),
        t(
          'Home size: ___ bedrooms and ___ bathrooms. Add-ons, done only if ticked: ☐ inside oven ☐ inside fridge ☐ inside empty cabinets.',
          '집 크기: 침실 ___개, 욕실 ___개. 추가 서비스(표시한 항목만 진행): ☐ 오븐 내부 ☐ 냉장고 내부 ☐ 빈 수납장 내부.',
        ),
        t(
          'Date and arrival window: ______________, arriving between ______ and ______.',
          '날짜 및 도착 시간대: ______________, ______부터 ______ 사이 도착.',
        ),
        t(
          'Price: $______ per visit, agreed before work starts. If a premium for jobs within 24 hours, on weekends or on statutory holidays applies, it is included in this price. Extra work is done only after you agree to a new price.',
          '요금: 방문 1회당 $______ (작업 시작 전에 합의). 24시간 이내·주말·법정 공휴일 작업 할증이 있다면 이 금액에 포함되어 있습니다. 추가 작업은 새 요금에 동의하신 뒤에만 합니다.',
        ),
      ],
    },
    {
      heading: t('What each service includes', '서비스별 포함 사항'),
      clauses: [
        t(
          'Standard clean: dusting of surfaces we can reach from the floor or a step stool; kitchen counters, sink, stovetop and the outside of appliances; bathrooms (toilet, sink, tub or shower, mirrors); vacuuming and mopping floors; and emptying garbage into your bins.',
          '일반 청소: 바닥이나 발판에서 손이 닿는 곳의 먼지 제거, 주방 조리대·싱크대·쿡탑과 가전제품 겉면, 욕실(변기·세면대·욕조 또는 샤워부스·거울), 바닥 청소기와 물걸레질, 쓰레기를 고객님 쓰레기통에 비우기.',
        ),
        t(
          'Deep clean: everything in a standard clean, plus baseboards, doors and door frames, light switches and handles, cabinet fronts, inside the microwave, inside window sills and tracks, and extra scrubbing of built-up grime in the kitchen and bathrooms.',
          '딥클린: 일반 청소의 모든 항목에 더해 걸레받이, 문과 문틀, 전등 스위치와 손잡이, 수납장 문 겉면, 전자레인지 내부, 실내 창틀과 창문 레일, 주방과 욕실의 찌든 때 집중 청소.',
        ),
        t(
          'Move-in / move-out clean: a deep clean of an empty home, including inside closets and the floors where furniture stood. If furniture or belongings are still in the home, we clean around them.',
          '입주·이사 청소: 비어 있는 집의 딥클린으로, 붙박이장(옷장) 내부와 가구가 있던 자리의 바닥까지 포함합니다. 집에 가구나 짐이 남아 있으면 그 주변을 청소합니다.',
        ),
        t(
          'Inside the oven, inside the fridge and inside empty cabinets are add-ons for every service type. They are done only if ticked above.',
          '오븐 내부, 냉장고 내부, 빈 수납장 내부는 모든 서비스에서 추가 항목이며, 위에 표시하신 경우에만 합니다.',
        ),
        t(
          'The price covers the number of bedrooms and bathrooms written above. If we find heavy build-up that was not visible when we quoted (for example, heavy grease, pet hair or odours), we will tell you and agree a price before doing the extra work.',
          '요금은 위에 적힌 침실·욕실 수를 기준으로 합니다. 견적 때 보이지 않던 심한 오염(예: 심한 기름때, 반려동물 털, 냄새)이 있으면 먼저 말씀드리고, 추가 작업 전에 요금을 합의합니다.',
        ),
        t(
          'We bring our own cleaning supplies and equipment. If a surface needs a special product (for example, for natural stone or hardwood), please leave it out and tell us.',
          '청소 용품과 장비는 저희가 가져갑니다. 천연석이나 원목 마루처럼 전용 제품이 필요한 곳이 있으면 그 제품을 꺼내 두시고 알려 주세요.',
        ),
      ],
    },
    {
      heading: t('Not included', '포함되지 않는 작업'),
      clauses: [
        t(
          'We do not handle biohazards: blood or other bodily fluids, human or animal waste, needles or other sharps, or pest droppings.',
          '생물학적 위험물은 다루지 않습니다: 혈액이나 기타 체액, 사람이나 동물의 배설물, 주삿바늘 등 날카로운 물건, 해충 배설물.',
        ),
        t(
          'Also not included: mould remediation; exterior windows; lifting or moving heavy furniture or appliances (anything one person cannot safely move alone); work above step-stool height; carpet or upholstery shampooing; removing furniture, junk or large amounts of garbage; and anything that needs a licensed trade, such as plumbing, electrical, gas, pest control or appliance repair.',
          '다음도 포함되지 않습니다: 곰팡이 제거 작업(전문 처리), 외부 유리창, 무거운 가구나 가전 들기·옮기기(한 사람이 혼자 안전하게 옮길 수 없는 것), 발판 높이보다 높은 곳 작업, 카펫·소파 샴푸 세탁, 가구·폐기물·많은 양의 쓰레기 처리, 그리고 배관·전기·가스·해충 방제·가전 수리처럼 면허가 필요한 작업.',
        ),
        t(
          'If we find any of these on the day, we skip that item, clean everything else and tell you what we skipped and why. If this leaves a large part of the job undone, we agree a fair price with you before continuing.',
          '당일에 이런 항목이 있으면 해당 부분은 건너뛰고 나머지를 청소한 뒤, 무엇을 왜 건너뛰었는지 알려 드립니다. 이 때문에 작업의 상당 부분을 못 하게 되면, 계속하기 전에 고객님과 적정한 요금을 다시 합의합니다.',
        ),
      ],
    },
    {
      heading: t('Access, keys and lockouts', '출입, 열쇠 및 출입 불가'),
      clauses: [
        t(
          'We do not keep or hold keys, fobs or garage remotes. For each visit, either you (or an adult you name) are home to let us in, or you leave a key in a lockbox that you own, set up and are responsible for. When we leave, we lock the door and put the key back in the lockbox.',
          '저희는 열쇠, 출입 카드(fob), 차고 리모컨을 맡거나 보관하지 않습니다. 방문할 때마다 고객님(또는 고객님이 지정한 성인)이 집에 계시면서 문을 열어 주시거나, 고객님이 직접 소유·설치·관리하시는 열쇠 보관함(락박스)에 열쇠를 넣어 두셔야 합니다. 작업을 마치면 문을 잠그고 열쇠를 보관함에 다시 넣어 둡니다.',
        ),
        t(
          'Lockbox and door codes are used only for your job and are deleted when the service ends. You may change them after any visit.',
          '락박스와 현관 비밀번호는 고객님 작업에만 사용하며, 서비스가 끝나면 삭제합니다. 방문 뒤에 언제든 비밀번호를 바꾸셔도 됩니다.',
        ),
        t(
          'Electricity, hot water and lights must be working. For condos and apartments, you arrange building access, elevator booking and visitor parking where needed. Parking fees, if any: ☐ paid by you ☐ included in the price.',
          '전기, 온수, 조명이 작동해야 합니다. 콘도나 아파트는 필요한 경우 건물 출입, 엘리베이터 예약, 방문자 주차를 고객님이 준비해 주세요. 주차비가 있다면: ☐ 고객님 부담 ☐ 요금에 포함.',
        ),
        t(
          'Lockout: if we arrive within the arrival window and cannot start (no one home, wrong code, no key, the building will not let us in, or no power or water) and we cannot reach you within ___ minutes, we may leave and charge a lockout fee of $______.',
          '출입 불가: 약속한 도착 시간대에 도착했는데 작업을 시작할 수 없고(집에 아무도 없음, 비밀번호 오류, 열쇠 없음, 건물 출입 거부, 전기나 물이 안 나옴) ___분 안에 고객님과 연락이 닿지 않으면, 저희는 돌아가고 출입 불가 수수료 $______를 청구할 수 있습니다.',
        ),
      ],
    },
    {
      heading: t('Pets and valuables', '반려동물 및 귀중품'),
      clauses: [
        t(
          'Please tell us about pets before the visit. Keep any pet that may bite, run out or get stressed in a closed room or crate, or out of the home. We do not feed, walk or look after pets, and we are not responsible for a pet that gets out through a door we need to use if it was not secured as asked.',
          '방문 전에 반려동물이 있는지 알려 주세요. 물거나, 밖으로 뛰쳐나가거나, 스트레스를 받을 수 있는 반려동물은 닫힌 방이나 켄넬에 두시거나 집 밖에 있게 해 주세요. 저희는 반려동물에게 밥을 주거나 산책시키거나 돌보지 않습니다. 요청드린 대로 분리해 두지 않아 저희가 드나들어야 하는 문으로 반려동물이 나간 경우에는 책임지지 않습니다.',
        ),
        t(
          'Before we arrive, please put away cash, jewellery, small valuables and anything fragile, antique, sentimental or irreplaceable, or point it out to us. We will not clean or move anything you ask us to leave alone. To the extent the law allows, we are not responsible for breakage of an item of unusual value that was left out and not pointed out to us.',
          '저희가 도착하기 전에 현금, 보석, 작은 귀중품, 그리고 깨지기 쉽거나 오래되었거나 추억이 담겼거나 다시 구할 수 없는 물건은 치워 두시거나 저희에게 알려 주세요. 손대지 말라고 하신 물건은 청소하거나 옮기지 않습니다. 법이 허용하는 범위에서, 밖에 두시고 알려 주지 않으신 특별히 값비싼 물건의 파손에 대해서는 책임지지 않습니다.',
        ),
      ],
    },
    {
      heading: t('Damage, missed areas and re-cleans', '파손, 빠뜨린 부분 및 재청소'),
      clauses: [
        t(
          'Damage: if you think we damaged something, tell us within 24 hours after the visit ends, by text to {PHONE} or email to {EMAIL}, with photos of the damage. We will reply within ___ business days, may ask to see it, and will compare it with our before photos. If we caused it, we will repair it, replace it, pay the reasonable repair cost, or refer the claim to our liability insurer. We are not responsible for normal wear, damage that was already there, or items that were loose, broken or not properly installed before we cleaned.',
          '파손: 저희가 무언가를 파손했다고 생각되시면 방문이 끝난 뒤 24시간 이내에 파손 부위 사진과 함께 문자({PHONE})나 이메일({EMAIL})로 알려 주세요. 영업일 기준 ___일 이내에 답변드리고, 직접 확인을 요청할 수 있으며, 작업 전 사진과 비교합니다. 저희 잘못으로 생긴 파손이면 수리하거나, 교체하거나, 합리적인 수리 비용을 드리거나, 저희 배상책임보험사에 청구를 넘깁니다. 일반적인 마모, 원래 있던 손상, 청소 전부터 헐겁거나 망가졌거나 제대로 설치되지 않은 물건에 대해서는 책임지지 않습니다.',
        ),
        t(
          'Missed areas: if we missed an area that is part of your service, tell us within 24 hours after the visit, with photos, and we will come back and re-clean that area at no charge, at a time that suits us both. We offer no other guarantee.',
          '빠뜨린 부분: 서비스에 포함된 곳을 저희가 빠뜨렸다면 방문 뒤 24시간 이내에 사진과 함께 알려 주세요. 서로 편한 시간에 다시 와서 그 부분을 무료로 다시 청소해 드립니다. 이 재청소 외에는 별도의 보증을 하지 않습니다.',
        ),
      ],
    },
    {
      heading: t('Cancelling or rescheduling a visit', '방문 취소 및 일정 변경'),
      clauses: [
        t(
          "Please give at least ___ hours' notice to cancel or reschedule a visit. If you cancel with less notice, we may charge $______.",
          '방문을 취소하거나 일정을 바꾸시려면 최소 ___시간 전에 알려 주세요. 그보다 늦게 취소하시면 $______를 청구할 수 있습니다.',
        ),
        t(
          'We may reschedule because of illness, unsafe conditions or severe weather. We will tell you as early as we can, and there is no charge to you.',
          '저희가 아프거나, 작업이 위험하거나, 날씨가 매우 나쁠 때는 일정을 바꿀 수 있습니다. 최대한 빨리 알려 드리며, 고객님께 비용은 없습니다.',
        ),
        t(
          "Recurring cleaning: each visit is booked and paid on its own. Either of us may stop recurring visits by giving ___ days' notice.",
          '정기 청소: 방문마다 따로 예약하고 결제합니다. 양측 모두 ___일 전에 알리면 정기 방문을 그만둘 수 있습니다.',
        ),
      ],
    },
    PAYMENT_ON_COMPLETION,
    ONTARIO_CANCELLATION,
    PHOTOS,
    PRIVACY,
    GENERAL,
  ],
  signatureFields: SIGNATURES,
}

// ---------------------------------------------------------------------------
// Gutters (Track B — use only after Gate G1 passes)
// ---------------------------------------------------------------------------

const GUTTERS: Agreement = {
  service: 'gutters',
  title: t('{BRAND} — Gutter (Eavestrough) Cleaning Agreement', '{BRAND} — 홈통(처마 물받이) 청소 계약서'),
  notice: NOTICE,
  sections: [
    PARTIES,
    {
      heading: t('Service, schedule and price', '서비스, 일정 및 요금'),
      clauses: [
        t(
          'House: ☐ bungalow / 1 storey ☐ 2 storeys ☐ 3 storeys (only when a second person is on site). Areas included: ☐ main house ☐ attached garage ☐ porch or other lower roofs ☐ other: ______________.',
          '주택: ☐ 단층(방갈로) ☐ 2층 ☐ 3층(작업자가 한 명 더 현장에 있을 때만). 포함 구역: ☐ 본채 ☐ 붙어 있는 차고 ☐ 현관 지붕 등 낮은 지붕 ☐ 기타: ______________.',
        ),
        t('Add-on, done only if ticked: ☐ downspout flush.', '추가 서비스(표시한 경우에만 진행): ☐ 배수관(다운스파우트) 청소.'),
        t(
          'Planned date: ______________, weather permitting. Price: $______ in total, agreed before work starts.',
          '작업 예정일: ______________ (날씨에 따라 바뀔 수 있음). 요금: 총 $______ (작업 시작 전에 합의).',
        ),
        t(
          'Cancelling or changing the date: please tell us at least ___ hours before the planned date. If you cancel with less notice, we may charge $______.',
          '취소 또는 날짜 변경: 작업 예정일 최소 ___시간 전에 알려 주세요. 그보다 늦게 취소하시면 $______를 청구할 수 있습니다.',
        ),
      ],
    },
    {
      heading: t('What is included', '포함 사항'),
      clauses: [
        t(
          'By hand and scoop, working from a ladder, we remove leaves and debris from the eavestroughs on the areas ticked above and check that the top openings of the downspouts are clear. The price is for the storey count ticked above and covers every section of those eavestroughs that we can reach safely from a ladder.',
          '사다리 위에서 손과 스쿱으로, 위에 표시한 구역의 홈통(처마 물받이)에 쌓인 낙엽과 이물질을 치우고, 배수관 윗구멍이 막히지 않았는지 확인합니다. 요금은 위에 표시한 층수를 기준으로 하며, 사다리에서 안전하게 닿을 수 있는 해당 홈통 전 구간을 포함합니다.',
        ),
        t(
          'Downspout flush (add-on): we run water through each downspout we can reach and clear blockages we can reach by hand or with a hand tool. We do not dig up, repair or unclog underground drain pipes.',
          '배수관 청소(추가 서비스): 손이 닿는 배수관마다 물을 흘려보내고, 손이나 수공구로 닿는 곳의 막힘을 뚫습니다. 땅속 배수관은 파내거나 수리하거나 뚫지 않습니다.',
        ),
        t(
          'Not included: gutter repair or re-hanging, sealing leaks, removing or installing screwed-on gutter guards, roof cleaning or moss removal, window cleaning and pressure washing. If we see damage (for example, loose or sagging sections, leaks or rot), we show you photos but do not repair it.',
          '포함되지 않는 작업: 홈통 수리나 다시 달기, 누수 부위 실링, 나사로 고정된 홈통 낙엽 방지망 떼기·설치, 지붕 청소나 이끼 제거, 유리창 청소, 고압 세척. 헐겁거나 처진 부분, 누수, 부식 같은 손상이 보이면 사진으로 보여 드리지만 수리는 하지 않습니다.',
        ),
      ],
    },
    {
      heading: t('Roof and ladder limits', '지붕 및 사다리 작업 제한'),
      clauses: [
        t(
          'We work from a ladder set on firm, level ground. We do not walk on steep roofs, and we do not walk on any roof that is wet, icy, snow-covered or mossy. We decide on the day whether each section is safe to reach.',
          '사다리는 단단하고 평평한 땅 위에 세워 작업합니다. 경사가 급한 지붕에는 올라가지 않으며, 젖었거나 얼었거나 눈이 쌓였거나 이끼 낀 지붕에도 올라가지 않습니다. 각 구간을 안전하게 작업할 수 있는지는 당일에 판단합니다.',
        ),
        t(
          'We do not set a ladder near overhead power lines, against glass or skylights, or on soft or uneven ground. If a section cannot be reached safely, we leave it, tell you which one, and agree a lower price with you for the part not done.',
          '머리 위 전선 가까이, 유리나 천창에 기대어, 또는 무르거나 고르지 않은 땅 위에는 사다리를 세우지 않습니다. 안전하게 닿을 수 없는 구간은 작업하지 않고 어느 곳인지 알려 드리며, 하지 못한 부분만큼 요금을 낮추어 합의합니다.',
        ),
        t(
          'Before we arrive, please move cars, furniture, planters and other items away from the walls where the ladder will go, unlock the gates, and keep children and pets inside while we work. You do not need to be home.',
          '도착 전에 사다리를 세울 벽 주변의 차량, 가구, 화분 등을 치워 주시고, 대문을 열어 두시고, 작업하는 동안 아이와 반려동물은 실내에 있게 해 주세요. 고객님이 집에 계시지 않아도 됩니다.',
        ),
      ],
    },
    {
      heading: t('Weather', '날씨'),
      clauses: [
        t(
          'We do not work in rain, freezing rain, snow or high wind, or when the ground under the ladder or the roof edge is wet or icy. If the weather is unsafe, we postpone and agree a new date with you. There is no charge for postponing, and you may cancel at no charge if the new date does not suit you.',
          '비, 어는 비, 눈, 강풍이 있거나 사다리를 세울 땅이나 처마 끝이 젖었거나 얼어 있으면 작업하지 않습니다. 날씨 때문에 위험하면 작업을 미루고 새 날짜를 함께 정합니다. 연기에 따른 비용은 없으며, 새 날짜가 맞지 않으면 비용 없이 취소하실 수 있습니다.',
        ),
        t(
          'If lasting snow or freezing weather arrives before a new date can be found, either of us may cancel this agreement at no charge.',
          '새 날짜를 잡기 전에 눈이 쌓이거나 추위가 계속되면, 양측 모두 비용 없이 이 계약을 취소할 수 있습니다.',
        ),
      ],
    },
    {
      heading: t('Before-work photos, damage and debris', '작업 전 사진, 손상 및 이물질 처리'),
      clauses: [
        t(
          'Before we start, we walk around the house and photograph the eavestroughs, downspouts, roof edge, siding, windows and plants near where the ladder will go, and note any visible damage. You may ask for copies. To the extent the law allows, we are not responsible for damage that was already there, or for sections that were loose, rotten or badly installed and fail during normal cleaning.',
          '작업 전에 집 주위를 돌며 홈통, 배수관, 처마 끝, 외벽, 창문, 사다리를 세울 자리 근처의 식물을 사진으로 찍고 눈에 보이는 손상을 기록합니다. 사진 사본을 요청하실 수 있습니다. 법이 허용하는 범위에서, 원래 있던 손상이나, 이미 헐겁거나 부식되었거나 잘못 설치되어 일반적인 청소 중에 떨어지거나 망가진 부분에 대해서는 책임지지 않습니다.',
        ),
        t(
          'Damage: if you think we caused damage, tell us within ___ hours after the work, by text to {PHONE} or email to {EMAIL}, with photos. We will compare them with our before-work photos and reply within ___ business days. If we caused it, we will repair it, pay the reasonable repair cost, or refer the claim to our liability insurer.',
          '파손: 저희 작업으로 손상이 생겼다고 생각되시면 작업 뒤 ___시간 이내에 사진과 함께 문자({PHONE})나 이메일({EMAIL})로 알려 주세요. 작업 전 사진과 비교해 영업일 기준 ___일 이내에 답변드립니다. 저희 잘못이면 수리하거나, 합리적인 수리 비용을 드리거나, 저희 배상책임보험사에 청구를 넘깁니다.',
        ),
        t(
          "Debris is bagged, and we pick up debris that falls on the lawn, driveway, walkways or garden beds. Disposal (tick one): ☐ we leave the bags at your curb for your municipality's yard-waste collection, following its rules ☐ we take the debris away for $______.",
          '치운 이물질은 봉투에 담고, 잔디, 진입로, 보도, 화단에 떨어진 것도 치웁니다. 처리 방법(하나 선택): ☐ 시의 규칙에 따라 정원 폐기물 수거용으로 봉투를 집 앞 연석에 두기 ☐ $______를 받고 저희가 가져가기.',
        ),
      ],
    },
    PAYMENT_ON_COMPLETION,
    ONTARIO_CANCELLATION,
    PHOTOS,
    PRIVACY,
    GENERAL,
  ],
  signatureFields: SIGNATURES,
}

// ---------------------------------------------------------------------------
// Snow (Track B — sign only after Gate S: written snow insurance)
// ---------------------------------------------------------------------------

const SNOW: Agreement = {
  service: 'snow',
  title: t(
    '{BRAND} — Seasonal Snow Clearing Agreement (December 1 – March 31)',
    '{BRAND} — 제설 시즌 계약서 (12월 1일 – 3월 31일)',
  ),
  notice: NOTICE,
  sections: [
    PARTIES,
    {
      heading: t('Season, areas and price', '시즌, 작업 구역 및 요금'),
      clauses: [
        t(
          'Season: December 1 to March 31. We use shovels and/or a walk-behind snowblower only; no truck or plow.',
          '시즌: 12월 1일부터 3월 31일까지. 삽과 손으로 미는 제설기(워크비하인드 스노블로어)만 사용하며, 트럭이나 제설 차량은 쓰지 않습니다.',
        ),
        t(
          'Areas included (tick): ☐ driveway: ☐ single (1–2 cars) ☐ double (3–4 cars) ☐ large (5–6 cars); ☐ front walkway and steps; ☐ salting (ice melt) on the cleared areas. Other areas, only if written here: ______________.',
          '포함 구역(표시): ☐ 진입로: ☐ 1열(차 1–2대) ☐ 2열(차 3–4대) ☐ 대형(차 5–6대); ☐ 현관 보도·계단; ☐ 치운 구역에 제빙제(소금) 뿌리기. 기타 구역(여기에 적은 경우에만): ______________.',
        ),
        t(
          'Season price: $______ in total (driveway $______ + walkway and steps $______ + salting $______). GST/HST is added only as set out under Parties.',
          '시즌 요금: 총 $______ (진입로 $______ + 현관 보도·계단 $______ + 제빙제 $______). GST/HST는 ‘계약 당사자’ 부분에 적힌 경우에만 추가됩니다.',
        ),
        t(
          'Salting, if ticked: on each clearing visit we spread ice melt, which we supply, on the cleared areas. Extra salting visits (for example, after freezing rain or refreezing): ☐ included ☐ $______ per visit.',
          '제빙제를 선택하신 경우: 매 제설 방문 때 치운 구역에 저희가 준비한 제빙제를 뿌립니다. 추가 제빙 방문(예: 어는 비가 오거나 녹았다 다시 얼었을 때): ☐ 포함 ☐ 1회당 $______.',
        ),
        t(
          'The ridge of snow a city plow leaves at the end of the driveway is: ☐ cleared on our regular visits ☐ not included.',
          '시 제설차가 진입로 끝에 밀어 놓고 간 눈 둔덕은: ☐ 정기 방문 때 함께 치움 ☐ 포함하지 않음.',
        ),
      ],
    },
    {
      heading: t('When we come', '출동 기준 및 작업 시간'),
      clauses: [
        t(
          'Trigger depth: we come when a snowfall leaves ___ cm or more on the areas we clear.',
          '출동 기준: 저희가 치우는 구역에 눈이 ___cm 이상 쌓이면 출동합니다.',
        ),
        t(
          'Service window: we clear the listed areas within ___ hours after the snow stops falling. During a long or heavy snowfall, we may clear in more than one visit. Our route order and road conditions affect timing; if we cannot meet the window, we will text you.',
          '작업 시간: 눈이 그친 뒤 ___시간 이내에 계약한 구역을 치웁니다. 눈이 오래 또는 많이 내리면 여러 번에 나누어 치울 수 있습니다. 작업 순서와 도로 사정에 따라 시간이 달라질 수 있으며, 약속한 시간 안에 못 가게 되면 문자로 알려 드립니다.',
        ),
        t(
          'Cars: when you can, please move cars off the driveway before we come. If cars are parked there, we clear around them.',
          '차량: 가능하면 저희가 오기 전에 진입로에서 차를 빼 주세요. 차가 있으면 그 주변만 치웁니다.',
        ),
        t(
          'November snow (before the season): ☐ Yes, clear November snowfalls ☐ No. If Yes, from the day we confirm that this agreement is going ahead (see the November 20 condition) until November 30, we clear each snowfall that reaches the trigger depth at $______ per visit. These visits are billed with the first instalment on December 1; nothing is collected before December 1.',
          '11월 눈(시즌 시작 전): ☐ 예, 11월 눈도 치워 주세요 ☐ 아니요. ‘예’를 선택하시면, 이 계약이 진행된다고 저희가 확인해 드린 날(11월 20일 조건 참고)부터 11월 30일까지 출동 기준 이상 내린 눈을 1회당 $______에 치웁니다. 이 비용은 12월 1일 첫 분할금과 함께 청구하며, 12월 1일 전에는 받지 않습니다.',
        ),
      ],
    },
    {
      heading: t('Not included', '포함되지 않는 작업'),
      clauses: [
        t(
          'Not included, unless written under Other areas: snow or ice on roofs, ice dams and icicles, clearing snow off cars, hauling snow away, breaking up thick ice, decks, patios, back or side paths, and the public sidewalk.',
          '‘기타 구역’에 적은 경우가 아니면 다음은 포함되지 않습니다: 지붕 위 눈이나 얼음, 아이스댐(처마 결빙)과 고드름, 차 위의 눈 치우기, 눈 실어 나르기, 두꺼운 얼음 깨기, 데크, 파티오, 뒷마당이나 옆 통로, 공공 보도.',
        ),
      ],
    },
    {
      heading: t('Where the snow goes', '눈을 쌓는 곳'),
      clauses: [
        t(
          "We pile snow only on your property, in places you agree to: ______________. We never push, throw or blow snow onto the road or the public sidewalk. Ontario's Highway Traffic Act (s.181) prohibits depositing snow on a roadway, and in Toronto, Municipal Code Chapter 743 (s.743-9) prohibits placing snow on a City roadway or sidewalk (source: search-result summaries; the official text has not yet been checked).",
          '눈은 고객님 땅 안, 고객님이 동의한 곳에만 쌓습니다: ______________. 도로나 공공 보도로 눈을 밀거나 던지거나 날려 보내지 않습니다. 온타리오 도로교통법(Highway Traffic Act) 제181조는 도로에 눈을 버리는 것을 금지하며, 토론토에서는 시 조례(Municipal Code) 제743장 743-9조가 시 도로나 보도에 눈을 두는 것을 금지합니다(출처: 검색 결과 요약, 공식 원문은 아직 확인하지 않음).',
        ),
        t(
          'If there is no room left on your property for more snow, we will tell you so that we can agree what to do next.',
          '고객님 땅에 더 이상 눈을 쌓을 자리가 없으면 알려 드리고, 어떻게 할지 함께 정합니다.',
        ),
      ],
    },
    {
      heading: t('Heavy and light winters (options ticked before signing)', '눈이 많은 겨울과 적은 겨울(서명 전에 선택)'),
      clauses: [
        t(
          'Number of visits (tick one): ☐ Unlimited: for the season price, we clear every snowfall that reaches the trigger depth during the season, however many there are. ☐ Capped: the season price covers up to ___ clearing visits; each visit after that costs $______ and is billed with the next instalment or, after March 1, on a final invoice after the season.',
          '방문 횟수(하나 선택): ☐ 무제한: 시즌 요금으로 시즌 동안 출동 기준 이상 내린 눈을 횟수와 관계없이 모두 치웁니다. ☐ 횟수 제한: 시즌 요금에 제설 방문 ___회까지 포함되며, 그 뒤로는 1회당 $______를 다음 분할금과 함께, 3월 1일 이후에는 시즌이 끝난 뒤 최종 청구서로 청구합니다.',
        ),
        t(
          'Low-snow season (tick one): ☐ Option A, no refund: the season price stays the same however little snow falls. ☐ Option B, pro-rated: if we make fewer than ___ clearing visits between December 1 and March 31, we refund $______ for each visit below that number, by ______________ (date).',
          '눈이 적은 시즌(하나 선택): ☐ A안, 환불 없음: 눈이 아무리 적게 와도 시즌 요금은 같습니다. ☐ B안, 비례 환불: 12월 1일부터 3월 31일까지 제설 방문이 ___회보다 적으면, 모자란 방문 1회당 $______를 ______________(날짜)까지 환불합니다.',
        ),
      ],
    },
    {
      heading: t('Payment: 4 instalments, nothing before December 1', '결제: 4회 분할, 12월 1일 전에는 결제 없음'),
      clauses: [
        t(
          'The season price is paid in 4 equal instalments of $______, due December 1, January 1, February 1 and March 1, by Interac e-Transfer (to ______________________) or in cash.',
          '시즌 요금은 4회로 똑같이 나누어 회당 $______씩 12월 1일, 1월 1일, 2월 1일, 3월 1일에 인터랙 e-Transfer(받는 이메일: ______________________) 또는 현금으로 냅니다.',
        ),
        t(
          'We take no payment of any kind before December 1: no deposit, no prepayment and no lump-sum payment for the season.',
          '12월 1일 전에는 어떤 돈도 받지 않습니다. 계약금, 선불, 시즌 요금 일시불 모두 받지 않습니다.',
        ),
        t(
          'If an instalment is more than ___ days late, we may pause service until it is paid, after telling you in writing.',
          '분할금이 ___일 넘게 늦어지면, 서면으로 알려 드린 뒤 납부하실 때까지 서비스를 멈출 수 있습니다.',
        ),
      ],
    },
    {
      heading: t('Minimum-contract condition (November 20)', '최소 계약 수 조건(11월 20일)'),
      clauses: [
        t(
          'This agreement goes ahead only if we have signed at least ___ snow season contracts in total, all areas combined, by November 20. We will tell you by November 21 whether it goes ahead. If we have not reached that minimum, or if you have not heard from us by the end of November 21, this agreement is void: nothing is owed by either of us and no payment will be taken.',
          '이 계약은 11월 20일까지 저희가 체결한 전체 제설 시즌 계약(모든 지역 합산)이 ___건 이상인 경우에만 진행됩니다. 진행 여부는 11월 21일까지 알려 드립니다. 11월 20일까지 전체 제설 계약(모든 지역 합산)이 이 최소 건수에 이르지 않았거나, 11월 21일이 끝날 때까지 저희 연락을 받지 못하셨다면 이 계약은 무효이고 내실 돈은 없습니다. 저희도 고객님께 드릴 돈이 없으며, 어떤 돈도 받지 않습니다.',
        ),
      ],
    },
    {
      heading: t('Damage and hidden objects', '손상 및 눈에 묻힌 물건'),
      clauses: [
        t(
          'Before the first snowfall, please mark the edges of the driveway and walkway, and anything snow could hide (garden edging, curbs, sprinkler heads, landscape lights, rocks, hoses, toys), with stakes or reflective markers. To the extent the law allows, we are not responsible for damage to unmarked objects hidden by snow, for normal scuffing of lawn edges or gravel pushed onto grass, or for surfaces that were already cracked, uneven or loose.',
          '첫눈이 오기 전에 진입로와 보도의 가장자리, 그리고 눈에 가려질 수 있는 물건(화단 경계석, 연석, 스프링클러 헤드, 정원 조명, 돌, 호스, 장난감)을 말뚝이나 반사 표시로 표시해 주세요. 법이 허용하는 범위에서, 표시하지 않아 눈에 묻혀 있던 물건의 손상, 잔디 가장자리의 일반적인 긁힘이나 잔디 위로 밀려난 자갈, 이미 갈라졌거나 울퉁불퉁하거나 들떠 있던 바닥면에 대해서는 책임지지 않습니다.',
        ),
        t(
          'If you think we caused damage, tell us within ___ hours, by text to {PHONE} or email to {EMAIL}, with photos. Damage that shows only after the snow melts (for example, to lawn edges) must be reported by ______________ (date). If we caused it, we will repair it, pay the reasonable repair cost, or refer the claim to our liability insurer.',
          '저희 작업으로 손상이 생겼다고 생각되시면 ___시간 이내에 사진과 함께 문자({PHONE})나 이메일({EMAIL})로 알려 주세요. 눈이 녹은 뒤에야 보이는 손상(예: 잔디 가장자리)은 ______________(날짜)까지 알려 주셔야 합니다. 저희 잘못이면 수리하거나, 합리적인 수리 비용을 드리거나, 저희 배상책임보험사에 청구를 넘깁니다.',
        ),
      ],
    },
    {
      heading: t('Slips and falls (wording to be reviewed by our insurer)', '미끄러짐 및 낙상(보험사 검토가 필요한 문구)'),
      clauses: [
        t(
          '[Have this clause reviewed by the insurer before use.] On each visit we clear the listed areas, and salt them if salting is included. Snow and ice can come back between visits through new snow, drifting, melting and refreezing, or freezing rain. We are responsible for our own work at the time of each visit. Between visits, checking the listed areas, spreading ice melt where needed and asking us for an extra visit are your responsibility.',
          '[사용 전에 이 조항은 보험사 검토를 받으세요.] 저희는 방문할 때마다 계약한 구역을 치우고, 제빙제를 선택하신 경우 제빙제를 뿌립니다. 방문과 방문 사이에 새로 내린 눈, 바람에 날려 온 눈, 녹았다 다시 언 얼음, 어는 비 때문에 눈과 얼음이 다시 생길 수 있습니다. 저희는 각 방문 당시의 저희 작업에 책임을 집니다. 방문과 방문 사이에 계약 구역을 살피고, 필요하면 제빙제를 뿌리고, 추가 방문을 요청하시는 것은 고객님 책임입니다.',
        ),
        t(
          'If anyone falls on an area we clear, please tell us right away so that we can notify our insurer.',
          '저희가 치우는 구역에서 누군가 넘어졌다면, 저희가 보험사에 알릴 수 있도록 바로 연락해 주세요.',
        ),
      ],
    },
    {
      heading: t('Ending the agreement', '계약 해지'),
      clauses: [
        t(
          "Apart from the 10-day cancellation right below (where it applies), you may end this agreement at any time by giving ___ days' written notice. You pay only the instalments for months that began before the end date; later instalments are cancelled.",
          '아래의 10일 취소 권리(해당되는 경우)와 별도로, ___일 전에 서면으로 알리시면 언제든 계약을 끝낼 수 있습니다. 해지일 전에 시작된 달의 분할금만 내시며, 그 뒤 분할금은 취소됩니다.',
        ),
        t(
          "If we stop providing service before March 31 for any reason, you owe nothing for the months after we stop, and we refund the unused part of that month's instalment, pro-rated by days.",
          '어떤 이유로든 저희가 3월 31일 전에 서비스를 중단하면, 중단한 뒤의 달에 대해서는 아무것도 내지 않으시며, 중단한 달의 분할금 중 남은 날짜만큼 일할 계산해 환불합니다.',
        ),
      ],
    },
    ONTARIO_CANCELLATION,
    PHOTOS,
    PRIVACY,
    GENERAL,
  ],
  signatureFields: [
    ...SIGNATURES,
    t(
      'Client initials confirming the visit-number and low-snow options ticked above',
      '위에서 선택한 방문 횟수·눈 적은 시즌 옵션 확인: 고객 이니셜',
    ),
  ],
}

export const AGREEMENTS: Agreement[] = [CLEANING, GUTTERS, SNOW]

export function agreementFor(service: ServiceKey): Agreement {
  const a = AGREEMENTS.find((x) => x.service === service)
  if (!a) throw new Error(`No agreement for ${service}`)
  return a
}

// ---------------------------------------------------------------------------
// Owner and reviewer notes (not part of the customer copy)
// ---------------------------------------------------------------------------

export type AgreementNoteStatus =
  /** default read from config/prices.ts (GTA) */
  | 'price-book'
  /** no source: the owner decides */
  | 'owner-choice'
  /** rule set in business/research/decision-memo.md */
  | 'memo'
  /** statute or regulation text opened in research */
  | 'primary'
  /** third-party document (e.g. GitHub) */
  | 'secondary'
  /** search-result summary only; page not opened */
  | 'snippet'
  /** open question: check before relying on it (확인 필요) */
  | 'not-researched'

export interface AgreementNote {
  /** 'fill' = how to fill a blank; 'source' = where a clause comes from; 'check' = open question */
  kind: 'fill' | 'source' | 'check'
  topic: Bilingual
  note: Bilingual
  status: AgreementNoteStatus
  url?: string
}

const MEMO = 'business/research/decision-memo.md'
const GTA = PRICE_BOOKS.gta
const money = (n: number): string => `$${n}`
const NOT_IN_BOOK = t('not in the GTA price book', 'GTA 가격표에 없음')

const PRICE_BOOK_LINE = t(
  'GTA default from config/prices.ts; the amount you write must match the live price book for your city.',
  'config/prices.ts의 GTA 기본값입니다. 계약서에 적는 금액은 해당 도시의 최신 가격표와 같아야 합니다.',
)

function cleaningRange(key: 'standard' | 'deep' | 'moveOut'): string {
  const values = GTA.cleaning.tiers.map((tier) => tier[key])
  return `${money(Math.min(...values))}–${money(Math.max(...values))}`
}

function cleaningPriceNote(): Bilingual {
  const c = GTA.cleaning
  const beds = c.tiers.map((tier) => tier.bedrooms)
  const bedRange = `${Math.min(...beds)}–${Math.max(...beds)}`
  const addOnsEn = c.addOns.map((a) => `${a.en.toLowerCase()} ${money(a.price)}`).join(', ')
  const addOnsKo = c.addOns.map((a) => `${a.ko} ${money(a.price)}`).join(', ')
  return t(
    `Standard ${cleaningRange('standard')}, deep ${cleaningRange('deep')}, move-in/move-out ${cleaningRange('moveOut')} for ${bedRange} bedrooms; extra bathroom ${money(c.extraBathroom)}; add-ons: ${addOnsEn}; premium for jobs within 24 h, on weekends or on statutory holidays ${c.rushPremiumPct}%. Take the exact figure from the quote calculator. ${PRICE_BOOK_LINE.en}`,
    `일반 청소 ${cleaningRange('standard')}, 딥클린 ${cleaningRange('deep')}, 입주·이사 청소 ${cleaningRange('moveOut')} (침실 ${bedRange}개 기준). 추가 욕실 ${money(c.extraBathroom)}. 추가 서비스: ${addOnsKo}. 24시간 이내·주말·법정 공휴일 할증 ${c.rushPremiumPct}%. 정확한 금액은 견적 계산기로 확인하세요. ${PRICE_BOOK_LINE.ko}`,
  )
}

function gutterPriceNote(): Bilingual {
  const g = GTA.gutters
  if (!g) return NOT_IN_BOOK
  return t(
    `Bungalow / 1 storey ${money(g.byStoreys[1])}, 2 storeys ${money(g.byStoreys[2])}, 3 storeys ${money(g.byStoreys[3])} (the 3-storey figure is a Calgary guide used as a GTA fallback; no GTA 3-storey price was found); downspout flush ${money(g.downspoutFlush)}. 3-storey jobs are declined by default (NEXT_PUBLIC_GUTTER_MAX_STOREYS=2) and taken only with a second person present, so do not quote the 3-storey price otherwise. ${PRICE_BOOK_LINE.en}`,
    `단층 ${money(g.byStoreys[1])}, 2층 ${money(g.byStoreys[2])}, 3층 ${money(g.byStoreys[3])} (3층 금액은 GTA 자료가 없어 캘거리 자료를 대신 쓴 것), 배수관 청소 ${money(g.downspoutFlush)}. 3층 작업은 기본적으로 거절하며(NEXT_PUBLIC_GUTTER_MAX_STOREYS=2), 작업자가 한 명 더 현장에 있을 때만 맡으므로 그 밖에는 3층 요금을 안내하지 마세요. ${PRICE_BOOK_LINE.ko}`,
  )
}

function snowSeasonPriceNote(): Bilingual {
  const s = GTA.snow
  if (!s) return NOT_IN_BOOK
  const unit = s.mode === 'season' ? t('per season', '시즌 기준') : t('per month', '월 기준')
  return t(
    `Driveway ${unit.en}: single ${money(s.driveway.single)}, double ${money(s.driveway.double)}, large ${money(s.driveway.large)}; walkway and steps ${money(s.walkwayAndSteps)}; salting ${money(s.salting)}. Each instalment = season price confirmed on site ÷ ${s.instalments}. Calgary's price book is per month, so adapt the payment clause there; snow is not offered in Metro Vancouver or Montreal. ${PRICE_BOOK_LINE.en}`,
    `진입로(${unit.ko}): 1열 ${money(s.driveway.single)}, 2열 ${money(s.driveway.double)}, 대형 ${money(s.driveway.large)}. 현관 보도·계단 ${money(s.walkwayAndSteps)}, 제빙제 ${money(s.salting)}. 분할금 1회 = 현장에서 확정한 시즌 요금 ÷ ${s.instalments}. 캘거리 가격표는 월 단위이므로 결제 조항을 고쳐 쓰세요. 메트로 밴쿠버와 몬트리올에서는 제설을 하지 않습니다. ${PRICE_BOOK_LINE.ko}`,
  )
}

function snowPerVisitNote(): Bilingual {
  const s = GTA.snow
  if (!s) return NOT_IN_BOOK
  return t(
    `November per-visit rate: ${money(s.perVisit)}, chosen from the GTA $50–150 per-visit band (search summary). ${PRICE_BOOK_LINE.en}`,
    `11월 1회 방문 요금: ${money(s.perVisit)} (GTA 1회 $50–150 범위에서 고른 값, 검색 결과 요약). ${PRICE_BOOK_LINE.ko}`,
  )
}

const SHARED_NOTES: AgreementNote[] = [
  {
    kind: 'source',
    topic: t('Ontario 10-day cancellation and 15-day refund', '온타리오 10일 취소 및 15일 환불'),
    note: t(
      'Direct agreements (made in person away from the supplier’s place of business, e.g. at the home) can be cancelled within 10 days after the customer receives a copy of the signed agreement; the refund is due within 15 days after the cancellation notice (memo F32, corpus S037, search summary). Not legal advice. Keep this section on every form signed at a door.',
      '사업장 밖(예: 고객 집)에서 직접 만나 맺은 방문 계약은 고객이 계약서 사본을 받은 다음 날부터 10일 안에 취소할 수 있고(받은 날은 세지 않음), 환불은 취소 통지를 받은 다음 날부터 15일 안에 해야 합니다(메모 F32, 자료 S037, 검색 결과 요약). 법률 자문이 아닙니다. 문 앞에서 서명받는 모든 계약서에 이 부분을 넣으세요.',
    ),
    status: 'snippet',
    url: 'https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract',
  },
  {
    kind: 'check',
    topic: t('Work done inside the 10 days', '10일 안에 한 작업'),
    note: t(
      'What happens when the service is performed inside the 10-day period was not researched. Until Consumer Protection Ontario confirms, treat money from a door-signed job done within 10 days as refundable (memo §5.3, §6).',
      '10일 취소 기간 안에 작업을 한 경우 어떻게 되는지는 조사하지 못했습니다(확인 필요). 온타리오 소비자보호국(Consumer Protection Ontario)에 확인하기 전까지는, 문 앞에서 계약하고 10일 안에 작업한 돈은 환불될 수 있는 돈으로 보세요(메모 §5.3, §6).',
    ),
    status: 'not-researched',
    url: MEMO,
  },
  {
    kind: 'check',
    topic: t('Required wording and contents', '법정 문구 및 필수 기재 사항'),
    note: t(
      'The search summary says these contracts must list the terms, the cooling-off period, how cancellation is handled and all fees and charges (S037). Any exact wording the Ontario regulations prescribe, and any minimum-amount rule, was not researched. The lawyer should supply it.',
      '검색 결과 요약에 따르면 계약서에 계약 조건, 숙려(취소) 기간, 취소 처리 방법, 모든 요금이 들어가야 합니다(S037). 온타리오 규정이 정한 정확한 문구나 최소 금액 기준은 조사하지 못했습니다(확인 필요). 변호사에게 받아 넣으세요.',
    ),
    status: 'not-researched',
    url: 'https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract',
  },
  {
    kind: 'check',
    topic: t('Quebec and other provinces', '퀘벡 및 다른 주'),
    note: t(
      'Quebec (OPC): 10 days to cancel when solicited at home; the OPC advises no deposit before service starts; a fuel-price surcharge clause is illegal, but a surcharge for the amount of snow is legal (S038, search summary). French is likely required (unverified). BC and Alberta door-to-door rules were not researched. Adapt the template before using it outside Ontario.',
      '퀘벡(OPC): 집으로 찾아와 권유한 계약은 10일 안에 취소 가능, OPC는 서비스 시작 전 계약금을 주지 말라고 권고, 유류비 자동 인상 조항은 불법이지만 적설량에 따른 추가 요금은 합법(S038, 검색 결과 요약). 프랑스어가 필요할 가능성이 큼(확인 안 됨). BC주·앨버타주의 방문 판매 규정은 조사하지 못했습니다. 온타리오 밖에서 쓰려면 양식을 고쳐야 합니다.',
    ),
    status: 'snippet',
    url: 'https://opc.gouv.qc.ca/en/consumer/good-service/housing-renovation/landscaping-exterior/snow-removal/cancelling-contract',
  },
  {
    kind: 'source',
    topic: t('Privacy (PIPEDA / PIPA)', '개인정보(PIPEDA / PIPA)'),
    note: t(
      'PIPEDA applies to personal information collected in commercial activity in Ontario; BC and Alberta organizations fall under provincial PIPA (exemption orders SOR/2004-219, SOR/2004-220). Keep a record of every security breach for 24 months (SOR/2018-64 s.6(1)).',
      '온타리오의 상업 활동에서 수집한 개인정보에는 PIPEDA가 적용되고, BC주·앨버타주 사업자는 각 주의 PIPA가 적용됩니다(면제 명령 SOR/2004-219, SOR/2004-220). 보안 사고는 모두 기록해 24개월 동안 보관하세요(SOR/2018-64 s.6(1)).',
    ),
    status: 'primary',
    url: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/P-8.6.xml',
  },
  {
    kind: 'source',
    topic: t('Marketing photos and marketing messages', '마케팅 사진 및 마케팅 메시지'),
    note: t(
      'Memo §6: before/after photos of a client’s home are used in marketing only with a separate written opt-in, because a home photo without identifiers may still identify the home. Marketing emails and texts need consent and must identify the sender, give the mailing address and a contact, and carry an unsubscribe (CASL s.6; SOR/2012-36 s.2(1)(d)).',
      '메모 §6: 고객 집의 전후 사진은 따로 서면 동의를 받은 경우에만 마케팅에 씁니다. 식별 정보를 지워도 집을 알아볼 수 있기 때문입니다. 마케팅 이메일·문자는 동의가 필요하며, 보내는 사람, 우편 주소, 연락처, 수신 거부 방법을 넣어야 합니다(CASL s.6, SOR/2012-36 s.2(1)(d)).',
    ),
    status: 'primary',
    url: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml',
  },
  {
    kind: 'source',
    topic: t('GST/HST line', 'GST/HST 기재란'),
    note: t(
      'Small-supplier threshold: $30,000 of taxable supplies over four calendar quarters (ETA s.148). Leave the registration number blank until you are registered; while it is blank, do not charge GST/HST.',
      '소규모 사업자 기준: 4개 분기 합계 과세 매출 $30,000 (ETA s.148). 등록하기 전에는 등록번호 칸을 비워 두고, 비어 있는 동안에는 GST/HST를 받지 마세요.',
    ),
    status: 'primary',
    url: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml',
  },
  {
    kind: 'check',
    topic: t('Business name', '상호 등록'),
    note: t(
      'The Ontario business-name registration fee and process were not found. Check with ServiceOntario before printing a brand name on agreements (memo §6).',
      '온타리오 상호 등록 비용과 절차는 찾지 못했습니다(확인 필요). 계약서에 상호를 인쇄하기 전에 ServiceOntario에 확인하세요(메모 §6).',
    ),
    status: 'not-researched',
    url: MEMO,
  },
  {
    kind: 'check',
    topic: t('Liability limits in consumer contracts', '소비자 계약의 책임 제한 문구'),
    note: t(
      'Whether the "to the extent the law allows" limits (valuables, pets, pre-existing damage, hidden objects) hold up in an Ontario consumer contract was not researched. Have the lawyer or insurer review them.',
      '‘법이 허용하는 범위에서’로 시작하는 책임 제한 문구(귀중품, 반려동물, 원래 있던 손상, 눈에 묻힌 물건)가 온타리오 소비자 계약에서 유효한지는 조사하지 못했습니다(확인 필요). 변호사나 보험사의 검토를 받으세요.',
    ),
    status: 'not-researched',
  },
  {
    kind: 'fill',
    topic: t('Insurance line', '보험 기재란'),
    note: t(
      'Fill in the insurer and policy number only when a policy is in force. Never write or say "insured" otherwise (memo §6, §10 item 2).',
      '보험이 실제로 유효할 때만 보험사와 증권번호를 적으세요. 그렇지 않으면 ‘보험 가입’이라고 쓰거나 말하지 마세요(메모 §6, §10 항목 2).',
    ),
    status: 'memo',
    url: MEMO,
  },
  {
    kind: 'source',
    topic: t('e-Transfer limits', 'e-Transfer 한도'),
    note: t(
      'Interac e-Transfer limits are set by each bank, typically $2,000–3,000; an Oakville contractor had a $1,972 balance delayed by a limit (memo F36, secondary source and anecdote). Hence the split-payment line.',
      '인터랙 e-Transfer 한도는 은행마다 다르며 보통 $2,000–3,000입니다. 오크빌의 한 업자는 $1,972 잔금이 한도 때문에 늦게 들어왔습니다(메모 F36, 2차 자료·일화). 그래서 나누어 내는 방법을 넣었습니다.',
    ),
    status: 'secondary',
    url: 'https://github.com/nifabulous/Relay/blob/885bdf20a690d77dd2b93e46a52a597382039c6e/app/data/payment_schemes.py',
  },
]

const CLEANING_NOTES: AgreementNote[] = [
  {
    kind: 'fill',
    topic: t('Price per visit ($______)', '방문 1회 요금($______)'),
    note: cleaningPriceNote(),
    status: 'price-book',
  },
  {
    kind: 'fill',
    topic: t('Lockout fee ($______) and waiting time (___ minutes)', '출입 불가 수수료($______) 및 대기 시간(___분)'),
    note: t(
      'No market figure was found in research (not verified). Owner choice: pick one amount and use it on every agreement, in the FAQ and on the price sheet.',
      '조사에서 시장 가격을 찾지 못했습니다(확인 필요). 사업자가 정하되, 모든 계약서, FAQ, 가격표에 같은 금액을 쓰세요.',
    ),
    status: 'owner-choice',
  },
  {
    kind: 'fill',
    topic: t('Other blanks (notice hours, late-cancellation charge, reply days, photo-removal days)', '기타 빈칸(취소 통보 시간, 늦은 취소 요금, 답변 일수, 사진 삭제 일수)'),
    note: t(
      'No source. Owner choice; keep the same numbers in every document.',
      '근거 자료 없음. 사업자가 정하되, 모든 문서에서 같은 숫자를 쓰세요.',
    ),
    status: 'owner-choice',
  },
  {
    kind: 'source',
    topic: t('No key custody', '열쇠 보관 안 함'),
    note: t(
      'Memo §2 and §6: no key custody in month 1; the client is present or the lockbox is the client’s responsibility. Bonding norms were not researched.',
      '메모 §2, §6: 첫 달에는 열쇠를 보관하지 않습니다. 고객이 집에 있거나, 락박스는 고객이 책임집니다. 신원보증(bonding) 관행은 조사하지 못했습니다.',
    ),
    status: 'memo',
    url: MEMO,
  },
  {
    kind: 'source',
    topic: t('24-hour damage claims with photos; photo opt-in', '24시간 내 사진 첨부 파손 신고, 사진 동의'),
    note: t(
      'Memo §10 item 5: scope, lockout fee, damage claims within 24 h with photos, cancellation, photo-consent opt-in, no key custody.',
      '메모 §10 항목 5: 작업 범위, 출입 불가 수수료, 24시간 내 사진 첨부 파손 신고, 취소, 사진 사용 별도 동의, 열쇠 보관 안 함.',
    ),
    status: 'memo',
    url: MEMO,
  },
  {
    kind: 'check',
    topic: t('Cleaning insurance before direct clients', '직접 고객 전 청소 보험'),
    note: t(
      'Bind cleaning liability insurance (CGL) before the first off-platform job (memo §6). Cleaning insurance "can start at $500 for self-employed cleaners" (search summary, attribution uncertain). Ask the broker about damage, theft allegations and key exclusions.',
      '플랫폼 밖 첫 작업 전에 청소 배상책임보험(CGL)에 가입하세요(메모 §6). 청소 보험은 “자영업 청소원은 $500부터 시작할 수 있다”는 자료가 있습니다(검색 결과 요약, 출처 불확실). 파손, 도난 의심, 열쇠 관련 면책 조항을 보험 중개인에게 물어보세요.',
    ),
    status: 'snippet',
    url: 'https://www.thinkinsure.ca/business-insurance/cleaning-insurance',
  },
  {
    kind: 'source',
    topic: t('Excluded trades', '제외하는 면허 업무'),
    note: t(
      'Memo §3: refuse in-wall electrical, plumbing and gas work; the regulated-trade boundary was not verified.',
      '메모 §3: 벽 속 전기 작업, 배관, 가스 작업은 거절합니다. 면허 업무의 경계는 확인되지 않았습니다.',
    ),
    status: 'memo',
    url: MEMO,
  },
]

const GUTTER_NOTES: AgreementNote[] = [
  {
    kind: 'fill',
    topic: t('Price ($______) and downspout flush', '요금($______) 및 배수관 청소'),
    note: gutterPriceNote(),
    status: 'price-book',
  },
  {
    kind: 'source',
    topic: t('Use only after Gate G1', '관문 G1 통과 후에만 사용'),
    note: t(
      'Memo §2: all five must hold — a vehicle that can carry a 24–28 ft ladder; fit and comfortable on a ladder; a broker’s written confirmation that the liability policy covers ladder/eavestrough work; money for the ladder, insurance and setup; at least 5 gutter jobs booked with dates before the ladder is bought. Hard stop Fri Oct 9, 2026.',
      '메모 §2: 다섯 가지가 모두 맞아야 합니다. 24–28피트 사다리를 실을 차량, 사다리 작업에 맞는 체력과 자신감, 보험이 사다리·홈통 작업을 보장한다는 중개인의 서면 확인, 사다리·보험·장비 비용, 사다리를 사기 전 날짜가 잡힌 홈통 작업 5건 이상. 최종 기한 2026년 10월 9일(금).',
    ),
    status: 'memo',
    url: MEMO,
  },
  {
    kind: 'source',
    topic: t('Timing', '작업 시기'),
    note: t(
      'Gutter demand is "late fall (after leaves drop, before snow)" (search summary). The Oct 15 start is the memo’s assumption.',
      '홈통 청소 수요는 “늦가을(낙엽이 진 뒤, 눈이 오기 전)”입니다(검색 결과 요약). 10월 15일 시작은 메모의 가정입니다.',
    ),
    status: 'snippet',
    url: 'https://guttercleaningcalgary.ca/cost-gutter-cleaning-calgary/',
  },
  {
    kind: 'source',
    topic: t('Why windows and pressure washing are excluded', '유리창·고압 세척을 뺀 이유'),
    note: t(
      'How Ontario Reg. 859 (window cleaning) applies to ladder work was not verified, so exterior windows are out for now. Pressure washing in Toronto appears to need a Building Renovator licence with an exam (search summary) (memo §3).',
      '온타리오 규정 859(유리창 청소)가 사다리 작업에 어떻게 적용되는지 확인되지 않아 외부 유리창은 일단 뺐습니다. 토론토의 고압 세척은 시험이 있는 건물 개보수업(Building Renovator) 면허가 필요한 것으로 보입니다(검색 결과 요약)(메모 §3).',
    ),
    status: 'snippet',
    url: 'https://www.ontario.ca/page/access-and-fall-protection-window-cleaning',
  },
  {
    kind: 'check',
    topic: t('Working at Heights training', '고소 작업(Working at Heights) 교육'),
    note: t(
      'Whether O. Reg. 297/13 applies to self-employed residential gutter work is ambiguous; the training is advisable, cost not found (memo §6).',
      'O. Reg. 297/13이 자영업자의 주택 홈통 작업에 적용되는지는 불분명합니다. 교육을 받는 것이 좋으며, 비용은 찾지 못했습니다(메모 §6).',
    ),
    status: 'snippet',
    url: 'https://www.bronsonjohnson.com/working-at-heights-law-ontario',
  },
  {
    kind: 'check',
    topic: t('Power-line distances and yard-waste rules', '전선과의 거리 및 정원 폐기물 규칙'),
    note: t(
      'Minimum distances from power lines and your municipality’s yard-waste bag and collection rules were not researched. Check them (and ask the insurer) before the first job.',
      '전선과의 최소 거리와 시의 정원 폐기물 봉투·수거 규칙은 조사하지 못했습니다(확인 필요). 첫 작업 전에 확인하고 보험사에도 물어보세요.',
    ),
    status: 'not-researched',
  },
  {
    kind: 'fill',
    topic: t('Other blanks (claim hours, reply days, notice hours, debris removal fee)', '기타 빈칸(신고 시간, 답변 일수, 통보 시간, 이물질 수거 요금)'),
    note: t('No source. Owner choice.', '근거 자료 없음. 사업자가 정합니다.'),
    status: 'owner-choice',
  },
]

const SNOW_NOTES: AgreementNote[] = [
  {
    kind: 'fill',
    topic: t('Season price and instalments ($______)', '시즌 요금 및 분할금($______)'),
    note: snowSeasonPriceNote(),
    status: 'price-book',
  },
  {
    kind: 'fill',
    topic: t('November per-visit rate ($______)', '11월 1회 방문 요금($______)'),
    note: snowPerVisitNote(),
    status: 'price-book',
    url: 'https://www.monsterplow.ca/post/how-much-snow-removal-cost-toronto-2026-pricing-guide',
  },
  {
    kind: 'fill',
    topic: t('Trigger depth (___ cm)', '출동 기준 적설량(___cm)'),
    note: t(
      'Suggested 5 cm. This is an owner choice with no source (ESTIMATE).',
      '5cm를 권장합니다. 근거 자료가 없는 사업자 선택값입니다(추정).',
    ),
    status: 'owner-choice',
  },
  {
    kind: 'fill',
    topic: t('Minimum number of contracts (November 20)', '최소 계약 수(11월 20일)'),
    note: t(
      'The minimum counts all snow contracts, all areas combined (not per area). Memo §5.3 break-even (ESTIMATE): with a snowblower, 6 contracts at base pricing / 12 at conservative pricing; shovel-only, 3 / 6. Recompute with the prices actually signed and your written insurance quote. Car-less shovel-only work is capped at 10 driveways (assumed) until the time per driveway is measured (memo §9).',
      '최소 건수는 지역별이 아니라 전체 제설 계약(모든 지역 합산)으로 셉니다. 메모 §5.3 손익분기(추정): 제설기 사용 시 기본 가격 6건 / 보수적 가격 12건, 삽만 쓸 때 3건 / 6건. 실제 계약 금액과 서면 보험 견적으로 다시 계산하세요. 차 없이 삽만 쓰는 경우 진입로 1곳당 걸리는 시간을 재기 전까지 10곳으로 제한합니다(가정, 메모 §9).',
    ),
    status: 'memo',
    url: MEMO,
  },
  {
    kind: 'fill',
    topic: t('Service window, visit cap, extra-visit price, low-snow option, late days, notice days, lawn-damage date', '작업 시간, 방문 횟수 제한, 추가 방문 요금, 눈 적은 시즌 옵션, 연체 일수, 해지 통보 일수, 잔디 손상 신고일'),
    note: t(
      'No source; owner choices. The 2026–27 winter outlook was not found. One Ottawa contractor guide says "30+ snow events a winter" and that capped contracts "almost always cost more by April" (search summary). Heavy winters make unlimited contracts costly; light winters bring refund pressure (memo §8).',
      '근거 자료 없음, 사업자가 정합니다. 2026–27년 겨울 전망은 찾지 못했습니다. 오타와의 한 업체 안내문은 “겨울에 30번 이상 눈이 온다”, 횟수 제한 계약은 “4월쯤이면 거의 항상 더 비싸진다”고 합니다(검색 결과 요약). 눈이 많으면 무제한 계약이 손해가 되고, 눈이 적으면 환불 요구가 생깁니다(메모 §8).',
    ),
    status: 'owner-choice',
    url: 'https://ottawasnowremovals.ca/average-cost-of-snow-removal/',
  },
  {
    kind: 'source',
    topic: t('Gate S: written snow insurance first', '관문 S: 서면 제설 보험 먼저'),
    note: t(
      'No snow contract is signed before written snow cover, including slip-and-fall, is in place; target Fri Oct 30 (memo §2, §6). One broker says insurers limit or stop new cover by late autumn (single source, unverified).',
      '미끄러짐·낙상을 포함한 서면 제설 보험이 생기기 전에는 제설 계약을 맺지 않습니다. 목표일 10월 30일(금)(메모 §2, §6). 한 중개인은 늦가을이면 보험사가 신규 가입을 제한하거나 중단한다고 합니다(단일 출처, 확인 안 됨).',
    ),
    status: 'memo',
    url: 'https://rates.ca/resources/what-does-snow-removal-business-insurance-canada-really-cover-and-how-much-does-it-cost',
  },
  {
    kind: 'source',
    topic: t('No payment before December 1', '12월 1일 전 결제 없음'),
    note: t(
      'GTA customers who prepaid (one case $1,200) "feel cheated" after a company stopped providing service (CP24, Jan 16 2026, search summary). Quebec’s OPC recommends no deposit before service (memo §3).',
      '선불로 낸 GTA 고객들(한 사례 $1,200)이 업체가 서비스를 멈춘 뒤 “속았다”고 느꼈다는 보도가 있습니다(CP24, 2026년 1월 16일, 검색 결과 요약). 퀘벡 OPC도 서비스 전 계약금을 주지 말라고 권고합니다(메모 §3).',
    ),
    status: 'snippet',
    url: 'https://www.cp24.com/local/toronto/2026/01/16/gta-customers-who-paid-in-advance-for-snow-removal-feel-cheated-after-company-stopped-providing-service/',
  },
  {
    kind: 'source',
    topic: t('No snow onto the road: Ontario HTA s.181', '도로에 눈 금지: 온타리오 HTA 제181조'),
    note: t(
      'Depositing snow on a roadway is prohibited; fine $60–1,000 under s.214(1), plus surcharge and costs (search summary). The official statute page could not be opened, so the exact text and fine are not verified.',
      '도로에 눈을 버리는 것은 금지되며, 제214조(1)에 따라 벌금 $60–1,000에 추가 부과금과 비용이 붙습니다(검색 결과 요약). 공식 법령 페이지를 열지 못해 정확한 문구와 벌금은 확인되지 않았습니다.',
    ),
    status: 'snippet',
    url: 'https://defendcharges.ca/EN/provincial-offences2/municipal-bylaw-offences/deposit-of-snow-on-roadway',
  },
  {
    kind: 'source',
    topic: t('No snow onto the road: Toronto Municipal Code 743-9', '도로에 눈 금지: 토론토 시 조례 743-9'),
    note: t(
      'Chapter 743, s.743-9 prohibits placing debris, including shovelled snow, on a City roadway or sidewalk (City of Toronto 311 page seen in search results). In Calgary, fines are $250/$500/$750 (search summary); adapt the clause for other cities.',
      '제743장 743-9조는 삽으로 치운 눈을 포함한 이물질을 시 도로나 보도에 두는 것을 금지합니다(검색 결과에 나온 토론토 311 페이지). 캘거리 벌금은 $250/$500/$750입니다(검색 결과 요약). 다른 도시에서는 조항을 고쳐 쓰세요.',
    ),
    status: 'snippet',
    url: 'https://www.toronto.ca/home/311-toronto-at-your-service/find-service-information/article/?kb=kA06g000001cvVXCAY',
  },
  {
    kind: 'check',
    topic: t('Slip-and-fall wording', '미끄러짐·낙상 문구'),
    note: t(
      'Ontario occupiers’ liability for snow and ice was seen only in legal-article titles; how it applies to contractors was not verified. The insurer must review this clause before any contract is signed.',
      '눈과 얼음에 대한 온타리오 점유자 책임은 법률 기사 제목으로만 확인했고, 제설 업자에게 어떻게 적용되는지는 확인하지 못했습니다(확인 필요). 계약 전에 반드시 보험사가 이 조항을 검토해야 합니다.',
    ),
    status: 'not-researched',
    url: 'https://www.preszlerlaw.com/faqs/what-is-the-law-in-ontario-for-clearing-snow-and-ice-from-your-premises/',
  },
  {
    kind: 'check',
    topic: t('Sidewalk-clearing bylaws', '보도 제설 조례'),
    note: t(
      'Toronto Municipal Code Chapter 719 covers snow and ice removal from sidewalks; a "12-hour rule" was seen only in an article title (not verified). Check your city before offering public-sidewalk clearing.',
      '토론토 시 조례 제719장은 보도의 눈과 얼음 제거를 다룹니다. ‘12시간 규칙’은 기사 제목으로만 봤습니다(확인 안 됨). 공공 보도 제설을 제공하기 전에 해당 도시 규정을 확인하세요.',
    ),
    status: 'snippet',
    url: 'https://www.toronto.ca/legdocs/municode/1184_719.pdf',
  },
  {
    kind: 'check',
    topic: t('Ottawa licence', '오타와 면허'),
    note: t(
      'Ottawa requires a licence and $2M insurance for plow contractors. Whether shovel or walk-behind snowblower work is exempt is unresolved; confirm with the City before selling (memo F35).',
      '오타와는 제설 차량 업자에게 면허와 $2M 보험을 요구합니다. 삽이나 손으로 미는 제설기 작업이 면제되는지는 확인되지 않았습니다. 판매 전에 시에 확인하세요(메모 F35).',
    ),
    status: 'snippet',
    url: 'https://www.ottawa.ca/en/business/permits-and-licences/business-licences/snow-plow-contractor-and-vehicle-licences',
  },
]

/** Notes per agreement: how to fill each blank, where each clause comes from, and what is still unchecked. */
export const AGREEMENT_NOTES: Record<ServiceKey, AgreementNote[]> = {
  cleaning: [...CLEANING_NOTES, ...SHARED_NOTES],
  gutters: [...GUTTER_NOTES, ...SHARED_NOTES],
  snow: [...SNOW_NOTES, ...SHARED_NOTES],
}
