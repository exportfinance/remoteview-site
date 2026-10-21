import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { billingEnabled, priceId, isPlan, isInterval, founderCoupon, FOUNDER_LIMIT, TRIAL_DAYS } from '@/lib/billing/config';
import { stripe } from '@/lib/billing/stripe';
import { currentUser, sameOrigin } from '@/lib/billing/session';
import { entitled, founderUsed, setCustomer } from '@/lib/accounts';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
/* Tags our sessions in the Dashboard; fixed label with an 8-letter random suffix. Set STRIPE_INTEGRATION_ID='' to omit. */
const INTEGRATION_ID = process.env.STRIPE_INTEGRATION_ID ?? 'remoteview_subscribe_qhzmwtpa';

export async function POST(req: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: 'Billing is not open yet.', fallback: '/#waitlist' }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  if (isRateLimited('checkout:' + getClientIp(req), 10, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  const cur = await currentUser();
  if (!cur) return NextResponse.json({ error: 'Sign in first.', signin: true }, { status: 401 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  if (!isPlan(b.plan) || !isInterval(b.interval)) return NextResponse.json({ error: 'Choose a plan.' }, { status: 400 });
  const price = priceId(b.plan, b.interval);
  if (!price) return NextResponse.json({ error: 'That plan is not available yet.' }, { status: 400 });
  const { user } = cur;
  if (entitled(user)) return NextResponse.json({ error: 'You already have a plan.', portal: true }, { status: 409 });
  const s = stripe();
  try {
    let customer = user.stripe_customer_id;
    if (!customer) {
      const c = await s.customers.create({ email: user.email, metadata: { rv_user: user.id } }, { idempotencyKey: `rv-cus-${user.id}-${createHash('sha256').update(String(user.email)).digest('hex').slice(0, 16)}` });
      customer = c.id; await setCustomer(user.id, customer);
    }
    const coupon = founderCoupon();
    const founder = !!coupon && (await founderUsed()) < FOUNDER_LIMIT;
    const base = (PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, '');
    const make = (withFounder: boolean): Stripe.Checkout.SessionCreateParams => ({
      mode: 'subscription',
      customer: customer!,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      payment_method_collection: 'always', // card collected up front, even during the trial
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        metadata: { rv_user: user.id, founder: withFounder ? '1' : '0' },
      },
      ...(withFounder ? { discounts: [{ coupon: coupon! }] } : { allow_promotion_codes: true }),
      metadata: { rv_user: user.id, plan: b.plan, interval: b.interval },
      success_url: `${base}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      ...(INTEGRATION_ID ? { integration_identifier: INTEGRATION_ID } as any : {}),
    });
    let session: Stripe.Checkout.Session;
    try { session = await s.checkout.sessions.create(make(founder)); }
    catch (e: any) {
      // Coupon used up on Stripe's side (max_redemptions) or removed: carry on at full price.
      if (founder && /coupon|discount/i.test(e?.message || '') && e?.type === 'StripeInvalidRequestError') session = await s.checkout.sessions.create(make(false));
      else throw e;
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[checkout]', (e as Error).message);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
