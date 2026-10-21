'use client';
import { useState } from 'react';
/** Starts Stripe Checkout for a plan; signs the visitor in first if needed. Falls back to account sign-up when billing is off. */
export async function startCheckout(plan: string, interval: string): Promise<string | null> {
  const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, interval }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.url) { location.href = j.url; return null; }
  if (j.signin) { location.href = `/account?plan=${plan}&interval=${interval}`; return null; }
  if (j.portal) { location.href = '/account'; return null; }
  if (j.fallback) { location.href = j.fallback; return null; }
  return j.error || 'Could not start checkout.';
}
export default function PlanButton({ plan, interval, enabled, label, className = 'hud-btn' }: { plan: string; interval: string; enabled: boolean; label: string; className?: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!enabled) return <a className={className} href="/account">Start 7-day free trial</a>;
  return <>
    <button type="button" className={className} disabled={busy} style={{ border: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, width: '100%' }}
      onClick={async () => { setBusy(true); setErr(''); const e = await startCheckout(plan, interval); if (e) { setErr(e); setBusy(false); } }}>{busy ? 'Opening secure checkout…' : label}</button>
    {err && <p role="alert" style={{ color: '#fca5a5', fontSize: 13, margin: '6px 0 0' }}>{err}</p>}
  </>;
}
