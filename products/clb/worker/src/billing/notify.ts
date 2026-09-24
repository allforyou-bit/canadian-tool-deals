// Buyer notifications (pass active, region refund, self-serve refund). They go through sendEmail, which
// decides whether learner email is sent at all (LEARNER_EMAIL, memo §7.2 Z4); the site shows the same
// facts (purchase status and Stripe's receipt link) on /checkout/success/ and /account/. Nothing in
// billing waits on delivery: a skipped or failed send, or even a throw, never changes a payment outcome
// or a response.
import type { Lang } from '../../../shared/api'
import { type EmailMessage, sendEmail } from '../email'
import type { Env } from '../env'
import type { EmailText } from './messages'
import { getContact } from './store'

export type BuyerEmail = Omit<EmailMessage, 'kind'>

/** Sends a transactional email to the buyer; resolves to whether it was sent and never rejects. */
export async function emailBuyer(env: Env, msg: BuyerEmail): Promise<boolean> {
  try {
    return await sendEmail(env, { ...msg, kind: 'transactional' })
  } catch (e) {
    // the error name only: a message could carry the address
    console.error('billing: buyer email failed', e instanceof Error ? e.name : 'unknown')
    return false
  }
}

/**
 * Emails the purchase's buyer in their saved language; false when the account is gone (deleted) or the
 * email was not sent. Never rejects, even when the contact lookup fails.
 */
export async function emailBuyerOf(
  env: Env,
  userId: string,
  compose: (lang: Lang) => EmailText,
  idempotencyKey: string,
): Promise<boolean> {
  try {
    const contact = await getContact(env, userId)
    if (!contact) return false
    return await emailBuyer(env, { to: contact.email, ...compose(contact.lang), idempotencyKey })
  } catch (e) {
    console.error('billing: buyer email failed', e instanceof Error ? e.name : 'unknown')
    return false
  }
}
