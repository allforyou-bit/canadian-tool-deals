import type { Lang } from '../shared/api'
import { t } from '../lib/i18n'
import { cls } from './ui'

/**
 * "View receipt": Stripe's hosted receipt for the purchase (MeResponse.latestPurchase.receiptUrl, kept
 * current after refunds). Learners get no email from us (memo §7.2 Z4), so this link is the receipt.
 * `href` must already be checked with safeReceiptUrl (https only).
 */
export function ReceiptLink(props: { href: string; lang: Lang }) {
  return (
    <p>
      <a href={props.href} target="_blank" rel="noopener noreferrer" className={cls.link} data-testid="receipt-link">
        {t(props.lang, 'a.receipt')}
      </a>
    </p>
  )
}
