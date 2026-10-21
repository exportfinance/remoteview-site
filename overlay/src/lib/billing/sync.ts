import type Stripe from 'stripe';
import { planOfPrice } from './config';
import { applySubscription, userByCustomer } from '@/lib/accounts';
/** Copies a Stripe subscription's state onto our user row. Stripe is the source of truth. */
export async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const num = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? v : undefined);
  const userId = num(userIdHint) || num(sub.metadata?.rv_user) || (await userByCustomer(customer))?.id;
  if (!userId) { console.warn('[billing] subscription with no matching user', sub.id); return false; }
  const item: any = sub.items?.data?.[0];
  const p = planOfPrice(item?.price?.id);
  const periodEnd = item?.current_period_end ?? (sub as any).current_period_end ?? null;
  const discounted = Array.isArray((sub as any).discounts) ? (sub as any).discounts.length > 0 : !!(sub as any).discount;
  await applySubscription(userId, {
    id: sub.id, status: sub.status, plan: p?.plan ?? null, interval: p?.interval ?? null, periodEnd, trialEnd: sub.trial_end ?? null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end, customer, founder: sub.metadata?.founder === '1' && discounted,
  });
  return true;
}
