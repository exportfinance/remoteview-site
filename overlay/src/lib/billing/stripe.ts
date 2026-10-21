import Stripe from 'stripe';
/* One StripeClient per process (never the global key pattern). STRIPE_MOCK_URL is honoured only with a
   test key, so local tests can point at stripe-mock; production ignores it. */
const g = globalThis as any;
export function stripe(): Stripe {
  if (g.__rvStripe) return g.__rvStripe;
  const k = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!k) throw new Error('STRIPE_SECRET_KEY not configured');
  const opts: any = { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 20000, appInfo: { name: 'RemoteView' } };
  const mock = process.env.STRIPE_MOCK_URL;
  if (mock && /^(sk|rk)_test_/.test(k)) { const u = new URL(mock); opts.host = u.hostname; opts.port = u.port; opts.protocol = u.protocol.replace(':', ''); }
  g.__rvStripe = new Stripe(k, opts);
  return g.__rvStripe;
}
