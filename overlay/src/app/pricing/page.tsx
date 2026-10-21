import type { Metadata } from 'next';
import SeoShell from '@/components/seo/Shell';
import PricingGrid from '@/components/billing/PricingGrid';
import { PLANS, TRIAL_DAYS, FOUNDER_LIMIT, FOUNDER_PERCENT, TEAMS_MAILTO, billingEnabled, founderCoupon } from '@/lib/billing/config';
import { founderUsed } from '@/lib/accounts';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing', description: `Personal and Pro plans with a ${TRIAL_DAYS}-day free trial. Founder pricing: ${FOUNDER_PERCENT}% off for life for the first ${FOUNDER_LIMIT} members.`, robots: { index: true, follow: true }, alternates: { canonical: PUBLIC_URL + '/pricing' } };
const g = globalThis as any;
async function founderLeft(): Promise<number | null> {
  if (!founderCoupon()) return null;
  const c = g.__rvFounderLeft; if (c && Date.now() - c.t < 30_000) return c.n;
  try { const n = Math.max(0, FOUNDER_LIMIT - (await founderUsed())); g.__rvFounderLeft = { n, t: Date.now() }; return n; } catch { return null; }
}
export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const enabled = billingEnabled();
  const left = enabled ? await founderLeft() : null;
  const founder = enabled ? (left ?? 0) > 0 : true; // founder offer shown when billing is off
  const plans = [
    { id: 'personal', ...PLANS.personal, features: ['Live flights, satellites, quakes, weather', 'Country risk and travel advisories', 'Hazards, imagery and 40+ layers', 'Share snapshots'] },
    { id: 'pro', ...PLANS.pro, featured: true, features: ['Everything in Personal', 'AI briefings (when enabled)', 'PDF reports and case files', 'Link graphs and sanctions search'] },
  ];
  return (
    <SeoShell jsonLd={{ '@context': 'https://schema.org', '@type': 'Product', name: 'RemoteView', offers: [
      { '@type': 'Offer', name: 'Personal monthly', price: PLANS.personal.month, priceCurrency: 'USD' }, { '@type': 'Offer', name: 'Pro monthly', price: PLANS.pro.month, priceCurrency: 'USD' }] }}>
      <div className="hud-kick">// PLANS</div>
      <h1>Pricing</h1>
      <p className="hud-sub">Every plan starts with a {TRIAL_DAYS}-day free trial. Your card is taken up front and nothing is charged until the trial ends. Cancel any time before then and you pay nothing.</p>
      {q.need === 'plan' && <p className="hud-card" data-file="NOTICE" style={{ color: '#fde68a' }}>Your account has no active plan. Pick one to open the full app.</p>}
      {q.checkout === 'cancelled' && <p className="hud-lbl">Checkout cancelled. Nothing was charged.</p>}
      {founder && <div className="hud-cta" style={{ margin: '0 0 20px' }}><div><div className="hud-mono" style={{ fontSize: 11, letterSpacing: '.25em', color: '#5eead4' }}>// FOUNDER PRICING</div><div style={{ fontSize: 20, marginTop: 6 }}>First {FOUNDER_LIMIT} members: {FOUNDER_PERCENT}% off for life, applied automatically.</div>{left != null && left <= 100 && <div className="hud-lbl">{left} founder places left.</div>}</div></div>}
      {!enabled && <p className="hud-lbl" style={{ marginBottom: 14 }}>Every plan starts with a 7-day free trial.</p>}
      <PricingGrid plans={plans} enabled={enabled} founder={founder} founderPct={FOUNDER_PERCENT} trialDays={TRIAL_DAYS} teamsHref={TEAMS_MAILTO} />
      <p className="hud-src" style={{ marginTop: 22 }}>Prices in US dollars. Taxes may apply where required. Payments are handled by Stripe; we never see your full card number. See the <a href="/terms#subscriptions">subscription, cancellation and refund terms</a>.</p>
    </SeoShell>
  );
}
