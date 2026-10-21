/* Billing configuration (commercial edition). Everything comes from env vars; nothing is hard-coded.
   With no Stripe keys configured, billingEnabled() is false and the pricing buttons fall back to the waitlist. */
export type PlanId = 'personal' | 'pro';
export type Interval = 'month' | 'year';
export const PLANS: Record<PlanId, { name: string; month: number; year: number; blurb: string }> = {
  personal: { name: 'Personal', month: 19.99, year: 199, blurb: 'For individual researchers, analysts and journalists.' },
  pro: { name: 'Pro', month: 49.5, year: 495, blurb: 'Every layer, AI briefings, PDF reports, case files and link graphs.' },
};
export const TRIAL_DAYS = 7;
export const FOUNDER_LIMIT = 500;
export const FOUNDER_PERCENT = 50;
export const TEAMS_MAILTO = 'mailto:remoteview@mail.grokbot.com?subject=RemoteView%20Teams';

const ENV_KEY: Record<PlanId, Record<Interval, string>> = {
  personal: { month: 'STRIPE_PRICE_PERSONAL_MONTHLY', year: 'STRIPE_PRICE_PERSONAL_YEARLY' },
  pro: { month: 'STRIPE_PRICE_PRO_MONTHLY', year: 'STRIPE_PRICE_PRO_YEARLY' },
};
export function priceId(plan: PlanId, interval: Interval): string | null {
  const v = (process.env[ENV_KEY[plan][interval]] || '').trim();
  return /^price_[A-Za-z0-9]+$/.test(v) ? v : null;
}
/** Reverse lookup: which plan/interval a Stripe price belongs to. */
export function planOfPrice(id: string | null | undefined): { plan: PlanId; interval: Interval } | null {
  if (!id) return null;
  for (const plan of Object.keys(ENV_KEY) as PlanId[]) for (const interval of ['month', 'year'] as Interval[]) if (priceId(plan, interval) === id) return { plan, interval };
  return null;
}
export const founderCoupon = () => { const v = (process.env.STRIPE_FOUNDER_COUPON || '').trim(); return v || null; };
const key = () => (process.env.STRIPE_SECRET_KEY || '').trim();
export function billingEnabled() {
  const k = key();
  return /^(sk|rk)_(test|live)_/.test(k) && !!process.env.STRIPE_WEBHOOK_SECRET && !!priceId('personal', 'month') && !!priceId('pro', 'month');
}
export const isPlan = (p: unknown): p is PlanId => p === 'personal' || p === 'pro';
export const isInterval = (i: unknown): i is Interval => i === 'month' || i === 'year';
/** Subscription statuses that unlock the full app. */
export const ENTITLED = new Set(['trialing', 'active']);
