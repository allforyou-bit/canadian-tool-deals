// POST /api/checkout (memo B6): signed-in buyers in Canada outside Quebec get a Stripe Checkout Session
// (one-time card payment, billing address required). The buy button shows "By buying you agree to the
// Terms of use and Refund policy" and sends the TERMS_VERSION it showed; that version must be the current
// one and is stored on the purchase and in the Stripe metadata. The pass is granted later, by the webhook,
// only after the payment method, billing address and card country are checked.
import type { CheckoutRequest, CheckoutResponse } from '../../../shared/api'
import { BRAND, SKUS, TERMS_VERSION } from '../../../shared/config'
import type { Ctx } from '../env'
import { getFlags } from '../lib/flags'
import { error, json, readJson } from '../lib/http'
import { ERRORS, langOf, pick } from './messages'
import { inSalesRegion } from './region'
import { CURRENCY, EVENT_PATHS, eventStatement, insertPurchase, isSku, siteUrl } from './store'
import { type CheckoutSession, describeError, stripeFetch } from './stripe'

export async function checkout(req: Request, ctx: Ctx): Promise<Response> {
  const { env, user, now } = ctx
  if (!user) return error('unauthorized', ERRORS.signIn.en)
  const flags = await getFlags(env)
  if (!flags.checkout_enabled) return error('checkout_unavailable', ERRORS.checkoutClosed.en)

  const body = await readJson<CheckoutRequest>(req)
  if (!body || typeof body !== 'object') return error('bad_request', ERRORS.badRequest.en)
  const lang = langOf(body.lang)
  if (body.residentAttestation !== true) return error('bad_request', pick(lang, ERRORS.attestation))
  if (!isSku(body.sku)) return error('bad_request', pick(lang, ERRORS.unknownSku))
  if (body.termsVersion !== TERMS_VERSION) return error('bad_request', pick(lang, ERRORS.termsOutdated))
  // request.cf country/regionCode (set by the router); an unknown country is refused too
  if (!inSalesRegion(ctx.country, ctx.region)) return error('region_not_supported', pick(lang, ERRORS.region))

  const sku = SKUS[body.sku]
  const site = siteUrl(env)
  const meta = { user_id: user.id, sku: sku.sku, terms_version: TERMS_VERSION }
  let session: CheckoutSession
  try {
    session = await stripeFetch<CheckoutSession>(env, 'POST', '/v1/checkout/sessions', {
      params: {
        mode: 'payment',
        // Cards only: the region rule needs the card's issuing country (Link, BNPL and bank payments have
        // none). `payment_method_types` is the parameter in the pinned STRIPE_API_VERSION (see stripe.ts).
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: CURRENCY,
              unit_amount: sku.priceCents,
              product_data: { name: `${BRAND.en} — ${sku.en}` },
            },
            quantity: 1,
          },
        ],
        billing_address_collection: 'required',
        customer_email: user.email,
        client_reference_id: user.id,
        metadata: meta,
        payment_intent_data: { metadata: meta },
        locale: lang,
        // Stripe replaces {CHECKOUT_SESSION_ID} in success_url with the session id
        success_url: `${site}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/checkout/cancel/`,
      },
    })
  } catch (e) {
    console.error('checkout: session create failed', describeError(e))
    return error('internal', pick(lang, ERRORS.checkoutFailed))
  }
  if (!session.id || !session.url) {
    console.error('checkout: session without id or url')
    return error('internal', pick(lang, ERRORS.checkoutFailed))
  }

  await env.DB.batch([
    insertPurchase(env, {
      id: session.id,
      userId: user.id,
      sku: sku.sku,
      amountCents: sku.priceCents,
      currency: CURRENCY,
      termsVersion: TERMS_VERSION,
      now,
    }),
    eventStatement(env, 'checkout_start', EVENT_PATHS.checkout, now),
  ])
  return json({ url: session.url } satisfies CheckoutResponse)
}
