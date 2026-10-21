#!/usr/bin/env node
/* RemoteView: create (or find) the Stripe products, prices, founder coupon and Customer Portal config.
   Idempotent: safe to run again; existing objects are reused, never duplicated.
   Usage:  STRIPE_SECRET_KEY=sk_test_... node tools/stripe-setup.mjs        (or pass the key as the first argument)
   Prints the env vars to set on the Railway service. Use a test/sandbox key first. Charges nothing. */
import Stripe from 'stripe';

const key = (process.argv[2] || process.env.STRIPE_SECRET_KEY || '').trim();
if (!/^(sk|rk)_(test|live)_/.test(key)) { console.error('Give a Stripe secret or restricted key (sk_/rk_) as STRIPE_SECRET_KEY or the first argument.'); process.exit(1); }
const opts = { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2 };
if (process.env.STRIPE_MOCK_URL && /_test_/.test(key)) { const u = new URL(process.env.STRIPE_MOCK_URL); Object.assign(opts, { host: u.hostname, port: u.port, protocol: u.protocol.replace(':', '') }); }
const stripe = new Stripe(key, opts);
const live = /_live_/.test(key);

const PRODUCTS = [
  { id: 'rv_personal', name: 'RemoteView Personal', prices: [['rv_personal_monthly', 3499, 'month'], ['rv_personal_yearly', 34900, 'year']] },
  { id: 'rv_pro', name: 'RemoteView Pro', prices: [['rv_pro_monthly', 9900, 'month'], ['rv_pro_yearly', 99000, 'year']] },
];
const COUPON = { id: 'rv-founder-50', name: 'Founder: 50% off for life', percent_off: 50, duration: 'forever', max_redemptions: 500 };

async function product(p) {
  try { const x = await stripe.products.retrieve(p.id); if (x.active) return x; return stripe.products.update(p.id, { active: true }); }
  catch (e) { if (e?.statusCode !== 404 && e?.code !== 'resource_missing') throw e; return stripe.products.create({ id: p.id, name: p.name, tax_code: 'txcd_10103001' /* SaaS, business use */ }, { idempotencyKey: `rv-setup-prod-${p.id}` }); }
}
async function price(prod, [lookup, amount, interval]) {
  const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  const ok = found.data.find((x) => x.unit_amount === amount && x.recurring?.interval === interval && x.currency === 'usd');
  if (ok) return ok;
  // A different amount under the same lookup key: create the new price and move the key to it.
  return stripe.prices.create({ product: prod.id, currency: 'usd', unit_amount: amount, recurring: { interval }, lookup_key: lookup, transfer_lookup_key: found.data.length > 0, tax_behavior: 'exclusive' }, { idempotencyKey: `rv-setup-price-${lookup}-${amount}` });
}
async function coupon() {
  try { return await stripe.coupons.retrieve(COUPON.id); }
  catch (e) { if (e?.statusCode !== 404 && e?.code !== 'resource_missing') throw e; return stripe.coupons.create(COUPON, { idempotencyKey: `rv-setup-coupon-${COUPON.id}` }); }
}
async function portal(productPrices) {
  const list = await stripe.billingPortal.configurations.list({ limit: 100 });
  const mine = list.data.find((c) => c.metadata?.rv === 'portal-v1');
  if (mine) return mine;
  return stripe.billingPortal.configurations.create({
    metadata: { rv: 'portal-v1' },
    business_profile: { headline: 'RemoteView: manage your plan' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
      subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations', products: productPrices },
    },
  }, { idempotencyKey: 'rv-setup-portal-v1' });
}

const out = {};
const portalProducts = [];
for (const p of PRODUCTS) {
  const prod = await product(p);
  const ids = [];
  for (const pr of p.prices) { const x = await price(prod, pr); ids.push(x.id); out['STRIPE_PRICE_' + pr[0].replace(/^rv_/, '').toUpperCase()] = x.id; }
  portalProducts.push({ product: prod.id, prices: ids });
}
out.STRIPE_FOUNDER_COUPON = (await coupon()).id;
try { out.STRIPE_PORTAL_CONFIGURATION = (await portal(portalProducts)).id; }
catch (e) { console.warn('Customer Portal config not created (' + (e?.message || e) + '); set it up in the Dashboard instead.'); }

console.log(`\n${live ? 'LIVE' : 'TEST'} mode. Set these on the RemoteView commercial service:\n`);
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
console.log(`\nAlso set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_WEBHOOK_SECRET (from the webhook endpoint
<your domain>/api/billing/webhook subscribed to: checkout.session.completed, customer.subscription.updated,
customer.subscription.deleted, invoice.payment_failed).`);
