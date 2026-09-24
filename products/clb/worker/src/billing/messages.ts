// User-facing text for billing: API error messages and transactional emails, in English and Korean.
// Every string must pass shared/content-rules.ts findClaims (tested in worker/test/billing/messages.test.ts).
import type { Lang } from '../../../shared/api'
import { BRAND, REFUND_POLICY, SKUS, type Sku } from '../../../shared/config'

export type Text = Record<Lang, string>

export function pick(lang: Lang, text: Text): string {
  return text[lang]
}

/** Request language, defaulting to English. */
export function langOf(value: unknown): Lang {
  return value === 'ko' ? 'ko' : 'en'
}

export function formatCad(cents: number): string {
  return `C$${(cents / 100).toFixed(2)}`
}

/** 2026-10-24T05:55:33.123Z → "2026-10-24 05:55 UTC" */
export function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

const { withinDays, maxGradedTasksUsed } = REFUND_POLICY

export const ERRORS = {
  signIn: { en: 'Please sign in first.', ko: '먼저 로그인해 주세요.' },
  badRequest: { en: 'Invalid request.', ko: '잘못된 요청입니다.' },
  checkoutClosed: {
    en: 'Checkout is not available right now. Please try again later.',
    ko: '지금은 결제를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  },
  attestation: {
    en: 'Please confirm that you live in Canada, outside Quebec.',
    ko: '퀘벡을 제외한 캐나다 지역에 거주하고 있음을 확인해 주세요.',
  },
  unknownSku: { en: 'Unknown pass.', ko: '알 수 없는 이용권입니다.' },
  region: {
    en: 'Passes are available only in Canada, outside Quebec.',
    ko: '이용권은 퀘벡을 제외한 캐나다 지역에서만 구매할 수 있습니다.',
  },
  checkoutFailed: {
    en: 'Checkout could not be started. Please try again.',
    ko: '결제를 시작하지 못했습니다. 다시 시도해 주세요.',
  },
  noRefundable: {
    en: 'There is no purchase on this account that can be refunded.',
    ko: '이 계정에는 환불할 수 있는 구매 내역이 없습니다.',
  },
  refundWindow: {
    en: `Self-serve refunds are available within ${withinDays} days of purchase.`,
    ko: `셀프 환불은 구매 후 ${withinDays}일 이내에만 가능합니다.`,
  },
  refundUsage: {
    en: `Self-serve refunds are available only if you used ${maxGradedTasksUsed} or fewer graded tasks since purchase.`,
    ko: `셀프 환불은 구매 후 피드백을 받은 과제가 ${maxGradedTasksUsed}개 이하일 때만 가능합니다.`,
  },
  refundOnce: {
    en: 'A self-serve refund was already used for this email address or card. Please contact support.',
    ko: '이 이메일 주소 또는 카드로 이미 셀프 환불을 받으셨습니다. 고객 지원에 문의해 주세요.',
  },
  refundInProgress: {
    en: 'A refund for this purchase is already being processed.',
    ko: '이 구매에 대한 환불이 이미 처리 중입니다.',
  },
  refundFailed: {
    en: 'The refund could not be completed. Please try again or contact support.',
    ko: '환불을 완료하지 못했습니다. 다시 시도하거나 고객 지원에 문의해 주세요.',
  },
} satisfies Record<string, Text>

export interface EmailText {
  subject: string
  text: string
}

const REFUND_ONCE: Text = {
  en: 'Self-serve refunds are available once per person and once per card.',
  ko: '셀프 환불은 한 사람당, 카드 한 장당 한 번만 가능합니다.',
}

const BANK_DELAY: Text = {
  en: 'Your bank may take a few business days to show the refund.',
  ko: '은행에 따라 환불 내역이 표시되기까지 영업일 기준 며칠이 걸릴 수 있습니다.',
}

/** Sent when a pass is granted. */
export function passActiveEmail(lang: Lang, sku: Sku, endsAt: string, site: string): EmailText {
  const until = formatUtc(endsAt)
  if (lang === 'ko') {
    return {
      subject: `${BRAND.ko} 이용권이 시작되었습니다`,
      text: [
        '구매해 주셔서 감사합니다.',
        `${SKUS[sku].ko}은 ${until}까지 이용할 수 있습니다.`,
        `내 계정: ${site}/account/`,
        `구매 후 ${withinDays}일 이내이고 피드백을 받은 과제가 ${maxGradedTasksUsed}개 이하라면 계정 페이지에서 환불을 요청할 수 있습니다. ${REFUND_ONCE.ko}`,
      ].join('\n\n'),
    }
  }
  return {
    subject: `Your ${BRAND.en} pass is active`,
    text: [
      'Thank you for your purchase.',
      `Your ${SKUS[sku].en} is active until ${until}.`,
      `Your account: ${site}/account/`,
      `You can ask for a refund from your account page within ${withinDays} days of purchase if you used ${maxGradedTasksUsed} or fewer graded tasks. ${REFUND_ONCE.en}`,
    ].join('\n\n'),
  }
}

/** Sent when a payment is refunded because it came from outside the sales region. */
export function regionRefundEmail(lang: Lang, amountCents: number, site: string): EmailText {
  const amount = formatCad(amountCents)
  if (lang === 'ko') {
    return {
      subject: `${BRAND.ko}: 결제가 환불되었습니다`,
      text: [
        '이용권은 퀘벡을 제외한 캐나다 지역에 거주하며 캐나다에서 발급된 카드로 결제하는 분만 구매할 수 있습니다.',
        `결제 정보(청구지 주소 또는 카드 발급 국가)가 이 조건에 맞지 않아 결제 금액 ${amount}을 전액 환불했습니다. 계정에 이용권은 추가되지 않았습니다.`,
        BANK_DELAY.ko,
        `착오라고 생각되면 도움말 페이지에서 문의해 주세요: ${site}/help/`,
      ].join('\n\n'),
    }
  }
  return {
    subject: `${BRAND.en}: your payment was refunded`,
    text: [
      'Passes are available only to residents of Canada outside Quebec who pay with a card issued in Canada.',
      `Your payment did not meet these conditions (billing address or card country), so we refunded it in full: ${amount}. No pass was added to your account.`,
      BANK_DELAY.en,
      `If you think this is a mistake, contact us from the help page: ${site}/help/`,
    ].join('\n\n'),
  }
}

/** Sent after a self-serve refund. */
export function selfRefundEmail(lang: Lang, amountCents: number): EmailText {
  const amount = formatCad(amountCents)
  if (lang === 'ko') {
    return {
      subject: `${BRAND.ko}: 환불이 처리되었습니다`,
      text: [`${amount}을 카드로 환불했으며 이용권은 종료되었습니다.`, BANK_DELAY.ko, REFUND_ONCE.ko].join('\n\n'),
    }
  }
  return {
    subject: `${BRAND.en}: your refund is on its way`,
    text: [`We refunded ${amount} to your card, and your pass has ended.`, BANK_DELAY.en, REFUND_ONCE.en].join('\n\n'),
  }
}
