import { business } from '@/config/business'
import type { Lang } from '@/lib/i18n'

// Plain-language privacy notice. Ontario businesses fall under PIPEDA; BC and Alberta have their
// own private-sector laws (PIPA). This is a template, not legal advice.
// Accountable person named by title, with address: PIPEDA Sch.1 cl.4.1 and 4.8.2(a)
// (https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/P-8.6.xml, checked 2026-09-23).
// Notice of service providers outside Canada: Alberta PIPA s.13.1 is reported to require it —
// NOT VERIFIED (the Alberta text was not checked in research); it is included here as a precaution.

export default function PrivacyNotice({ lang }: { lang: Lang }) {
  const brand = business.brand[lang]
  const contact = [business.contact.email, business.contact.mailingAddress].filter(Boolean).join(' · ')
  const usesSheet = Boolean(business.leadEndpoint)
  const usesTurnstile = Boolean(business.turnstileSiteKey)

  if (lang === 'ko') {
    return (
      <article className="prose-legal mx-auto max-w-3xl px-4 py-10" lang="ko">
        <h1 className="mb-4 text-3xl font-bold">개인정보 안내</h1>
        <p className="text-sm text-muted">영문본이 우선합니다. 이 안내는 이해를 돕기 위한 번역입니다.</p>
        <h2 className="mt-6 text-xl font-semibold">수집하는 정보</h2>
        <p>견적 요청 시 입력하신 성함, 전화번호, 이메일(선택), 주소, 희망 일정, 요청 내용과 선택하신 서비스 항목입니다.</p>
        <h2 className="mt-6 text-xl font-semibold">사용 목적</h2>
        <p>견적 안내, 방문 일정 조율, 서비스 제공, 청구·영수증 발행, 서비스 관련 문의 응대에만 사용합니다. 정보를 판매하지 않습니다.</p>
        <h2 className="mt-6 text-xl font-semibold">마케팅 메시지</h2>
        <p>양식에서 별도로 동의하신 경우에만 할인·소식을 보냅니다. 모든 메시지에 수신 거부 방법이 있으며, 언제든 거부하실 수 있습니다.</p>
        <h2 className="mt-6 text-xl font-semibold">보관과 제3자</h2>
        <p>
          이 웹사이트는 Cloudflare에서 호스팅됩니다.
          {usesSheet ? ' 견적 요청은 사업자의 Google 계정(Google 스프레드시트·Gmail)에 저장됩니다.' : ' 견적 요청은 고객님이 직접 보내시는 문자·이메일로 전달됩니다.'}{' '}
          {usesTurnstile ? '견적 양식의 스팸 확인에는 Cloudflare Turnstile을 사용합니다. ' : ''}
          {usesSheet ? 'Cloudflare와 Google은' : 'Cloudflare는'} 고객님의 정보를 미국 등 캐나다 밖에서 저장하거나 처리할 수 있으며, 그곳에서는 현지 법에 따라 정보가 열람될 수 있습니다.{' '}
          서비스 제공과 법적 기록 보관에 필요한 기간 동안만 보관합니다.
        </p>
        <h2 className="mt-6 text-xl font-semibold">사진</h2>
        <p>분쟁 예방을 위해 작업 전후 사진을 찍을 수 있으며 비공개로 보관합니다. 광고·홍보에는 별도 서면 동의를 받은 경우에만 사용합니다.</p>
        <h2 className="mt-6 text-xl font-semibold">개인정보 책임자, 열람·정정·동의 철회</h2>
        <p>개인정보 처리에 대한 책임은 {brand} 대표에게 있습니다. 캐나다 밖 서비스 제공업체에 관한 서면 안내 요청을 포함해, 개인정보 관련 문의에는 대표가 직접 답변합니다.</p>
        <p>본인 정보의 열람·정정·삭제, 불만 제기, 동의 철회를 원하시면 대표에게 연락 주세요{contact ? `: ${contact}` : ''}.</p>
        <p className="mt-6 text-sm text-muted">{brand}</p>
      </article>
    )
  }

  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold">Privacy notice</h1>
      <h2 className="mt-6 text-xl font-semibold">What we collect</h2>
      <p>When you request a quote: your name, phone number, email (optional), address, preferred dates, your notes and the service options you chose.</p>
      <h2 className="mt-6 text-xl font-semibold">Why we use it</h2>
      <p>Only to answer your request, schedule and deliver the service, invoice you, and handle questions about the service. We do not sell your information.</p>
      <h2 className="mt-6 text-xl font-semibold">Marketing messages</h2>
      <p>We send offers or news only if you tick the separate opt-in box. Every message tells you how to unsubscribe, and you can withdraw consent at any time.</p>
      <h2 className="mt-6 text-xl font-semibold">Storage and service providers</h2>
      <p>
        This website is hosted by Cloudflare.
        {usesSheet
          ? ' Quote requests are stored in the business owner’s Google account (Google Sheets and Gmail).'
          : ' Quote requests reach us through the text message or email you choose to send.'}{' '}
        {usesTurnstile ? 'The quote form uses Cloudflare Turnstile to check for spam. ' : ''}
        {usesSheet ? 'Cloudflare and Google' : 'Cloudflare'} may store or process your information outside Canada, for example in the United States, where it may be accessible under local law.{' '}
        We keep your information only as long as needed to provide the service and to meet legal record-keeping requirements.
      </p>
      <h2 className="mt-6 text-xl font-semibold">Photos</h2>
      <p>We may take before-and-after photos to document our work; they are kept private. We use photos of your home in marketing only with your separate written consent.</p>
      <h2 className="mt-6 text-xl font-semibold">Privacy contact, access and correction</h2>
      <p>The owner of {brand} is accountable for how we handle personal information and answers privacy questions, including requests for written information about our service providers outside Canada.</p>
      <p>To see, correct or delete your information, to make a complaint, or to withdraw consent, contact the owner{contact ? `: ${contact}` : ''}.</p>
      <p className="mt-6 text-sm text-muted">{brand}</p>
    </article>
  )
}
