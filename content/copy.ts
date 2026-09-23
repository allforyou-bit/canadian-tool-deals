import type { ServiceKey } from './types'
import { business, priceBook } from '../config/business'

// Landing-page marketing copy (build item 2 in business/research/decision-memo.md, section 10).
//
// Rules for editing:
// - Only claims that are true for a new, owner-operated local business. No reviews, customer
//   counts, awards, licences, guarantees, "since 20XX" or income claims.
// - Never claim insurance here. The FAQ shows an insurance answer based on `business.insured`.
// - Prices are not written here; the quote calculator and price sheet read config/prices.ts.
// - The page shows only the services switched on in config/business.ts.
// - Korean copy must be approved by the owner before launch (memo section 10, item 2).

export interface StepCopy {
  title: string
  body: string
}

export interface ServiceCopy {
  title: string
  /** 1–2 sentences */
  body: string
  /** exactly 3 short bullets */
  includes: [string, string, string]
}

export interface SiteCopy {
  heroTitle: string
  heroSubtitle: string
  heroCta: string
  secondaryCta: string
  howItWorks: [StepCopy, StepCopy, StepCopy]
  whyUs: [StepCopy, StepCopy, StepCopy]
  servicesIntro: string
  services: Record<ServiceKey, ServiceCopy>
  areaTitle: string
  quoteTitle: string
  quoteIntro: string
  contactTitle: string
  contactBody: string
  footerNote: string
}

// Snow is billed in config-set monthly instalments from Dec 1 (memo section 0 item 2); the count
// comes from config/prices.ts. Snow is never shown where the price book has no snow section.
const snowInstalments = priceBook.snow?.instalments ?? 0

export const COPY: { en: SiteCopy; ko: SiteCopy } = {
  en: {
    heroTitle: 'Local home cleaning, with prices up front',
    heroSubtitle:
      'Standard, deep and move-in/move-out cleans at flat prices by home size. Check your estimate online, and we confirm it on site before any work starts.',
    heroCta: 'Get my estimate',
    secondaryCta: 'Call or text us',
    howItWorks: [
      {
        title: 'Check your price',
        body: 'Pick a service and your home size to see an estimate range. No obligation.',
      },
      {
        title: 'Book a time',
        body: 'Send the form, call or text. We confirm the details and a time that suits you.',
      },
      {
        title: 'We do the job, then you pay',
        body: 'For one-time jobs, pay by e-Transfer or cash once the work is done.',
      },
    ],
    whyUs: [
      {
        title: 'Local and easy to reach',
        body: 'We focus on one neighbourhood area, so we are close by. Call or text and you reach us directly.',
      },
      {
        title: 'Clear prices up front',
        body: 'You see an estimate range before you book, and we confirm the final price with you before any work starts.',
      },
      {
        title: 'You deal with the owner',
        body: 'The person who answers your message is the person who does the work. No call centre, no middleman.',
      },
    ],
    servicesIntro: 'Flat-rate home cleaning all year, plus seasonal outdoor work when it is available in your area.',
    services: {
      cleaning: {
        title: 'Home cleaning',
        body: 'Standard, deep and move-in/move-out cleans at a flat price by bedrooms and bathrooms. After your first clean, you can switch to regular biweekly visits.',
        includes: [
          'Kitchen, bathrooms, dusting and floors',
          'Deep and move-in/move-out cleans add baseboards, doors and built-up grime',
          'Inside oven, fridge or cabinets as add-ons',
        ],
      },
      gutters: {
        title: 'Gutter cleaning',
        body: 'Eavestrough cleaning in late fall, after the leaves drop and before the snow. Gutters only: no windows and no pressure washing.',
        includes: [
          'Leaves and debris cleared by hand',
          'Downspout flush available as an add-on',
          'Photos of any existing damage before we start',
        ],
      },
      snow: {
        title: 'Seasonal snow clearing',
        body: `Driveway clearing with a walk-behind snowblower or shovel for the Dec 1 – Mar 31 season. Nothing is paid before Dec 1: the season is billed in ${snowInstalments} monthly instalments, and if we have not signed our minimum number of snow contracts (all areas combined) by Nov 20, the contract is void and you owe nothing.`,
        includes: [
          'Visits when snowfall reaches the depth set in your agreement',
          'Walkway, steps and salting as add-ons',
          'Snow piled on your property, never pushed onto the road',
        ],
      },
    },
    areaTitle: 'Where we work',
    quoteTitle: 'Get an instant estimate',
    quoteIntro:
      "Choose a service and tell us about your home to see an estimate range. It's an estimate, not a final price: we confirm it on site before any work starts. No obligation.",
    contactTitle: 'Contact us',
    contactBody: "Call, text or email us, or send the quote form. You'll hear back from the owner directly.",
    footerNote: `${business.brand.en}: owner-operated home services, ${business.cityName.en}. Online prices are estimates in Canadian dollars, confirmed on site before any work starts.`,
  },
  ko: {
    heroTitle: '우리 동네 집 청소, 가격은 미리 확인하세요',
    heroSubtitle:
      '일반 청소, 딥클린, 입주·이사 청소를 집 크기별 정액 요금으로 해 드려요. 온라인에서 예상 견적을 확인하시고, 최종 금액은 작업 전에 현장에서 함께 확인해요.',
    heroCta: '예상 견적 보기',
    secondaryCta: '전화·문자 문의',
    howItWorks: [
      {
        title: '가격 확인',
        body: '서비스와 집 크기를 고르면 예상 견적 범위가 나와요. 부담 없이 확인해 보세요.',
      },
      {
        title: '예약',
        body: '문의 양식, 전화, 문자 중 편한 방법으로 연락 주세요. 세부 내용과 편한 시간을 맞춰 드려요.',
      },
      {
        title: '작업 후 결제',
        body: '1회성 작업은 끝난 뒤 이트랜스퍼(e-Transfer)나 현금으로 결제하시면 돼요.',
      },
    ],
    whyUs: [
      {
        title: '가까운 동네 업체',
        body: '한 동네를 중심으로 일해서 가까이 있어요. 전화나 문자를 주시면 저희와 바로 연결돼요.',
      },
      {
        title: '미리 확인하는 가격',
        body: '예약 전에 예상 견적 범위를 보여 드리고, 최종 금액은 작업 시작 전에 함께 확인해요.',
      },
      {
        title: '대표가 직접',
        body: '문의에 답하는 사람이 직접 작업하는 사람이에요. 콜센터도, 중개인도 없어요.',
      },
    ],
    servicesIntro: '집 청소는 1년 내내, 계절별 야외 서비스는 가능한 시기에 제공해요.',
    services: {
      cleaning: {
        title: '집 청소',
        body: '일반 청소, 딥클린, 입주·이사 청소를 침실·욕실 수에 따른 정액 요금으로 해 드려요. 첫 청소 후에는 격주 정기 청소로 이어 가실 수 있어요.',
        includes: [
          '주방, 욕실, 먼지 제거, 바닥 청소',
          '딥클린·입주·이사 청소는 걸레받이, 문, 묵은 때까지',
          '오븐·냉장고·수납장 내부는 추가 옵션',
        ],
      },
      gutters: {
        title: '홈통(처마 물받이) 청소',
        body: '낙엽이 다 떨어진 늦가을, 눈이 오기 전에 홈통을 청소해 드려요. 홈통 청소만 하며 창문 청소나 고압 세척은 하지 않아요.',
        includes: [
          '낙엽과 이물질을 손으로 제거',
          '배수관(다운스파우트) 청소 추가 가능',
          '작업 전 기존 손상 부위 사진 기록',
        ],
      },
      snow: {
        title: '시즌 제설',
        body: `12월 1일부터 3월 31일까지, 보행식 제설기나 삽으로 진입로 눈을 치워 드려요. 12월 1일 전에는 돈을 받지 않고 시즌 요금은 ${snowInstalments}번에 나눠 매달 청구하며, 11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없어요.`,
        includes: [
          '계약서에 정한 적설량 이상이면 출동',
          '보도·계단, 제빙(소금) 살포는 추가 옵션',
          '눈은 고객님 부지 안에, 도로로 밀어내지 않아요',
        ],
      },
    },
    areaTitle: '서비스 지역',
    quoteTitle: '바로 예상 견적 받기',
    quoteIntro:
      '서비스를 고르고 집 정보를 입력하면 예상 견적 범위를 바로 볼 수 있어요. 최종 금액이 아닌 예상 금액이며, 작업 전에 현장에서 확인해 드려요. 부담 없이 확인해 보세요.',
    contactTitle: '문의하기',
    contactBody: '전화, 문자, 이메일 또는 견적 문의 양식으로 연락 주세요. 대표가 직접 답변드리고, 한국어로 편하게 상담하실 수 있어요.',
    footerNote: `${business.brand.ko}: ${business.cityName.ko}에서 대표가 직접 운영하는 홈서비스. 온라인 가격은 캐나다 달러 기준 예상 금액이며, 최종 금액은 작업 전에 현장에서 확인해요.`,
  },
}
