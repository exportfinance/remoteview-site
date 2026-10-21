'use client';
import { useEffect, useState } from 'react';
import { startCheckout } from './PlanButton';
type Me = { email: string; status: string | null; plan: string | null; interval: string | null; trialEnd: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean; founder: boolean; entitled: boolean };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const STATUS: Record<string, string> = { trialing: 'Free trial', active: 'Active', past_due: 'Payment overdue', unpaid: 'Unpaid', canceled: 'Cancelled', incomplete: 'Incomplete', incomplete_expired: 'Expired', paused: 'Paused' };
export default function AccountPanel({ billing }: { billing: boolean }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const q = typeof window !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const load = () => fetch('/api/account/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMe(j.user)).catch(() => setMe(null));
  useEffect(() => { if (q.get('signin')) setMode('signin'); load(); }, []);
  // Returning from Checkout: the webhook activates the plan; poll briefly until it lands.
  useEffect(() => {
    if (q.get('checkout') !== 'success' || !me || me.entitled) return;
    let n = 0; const t = setInterval(() => { n++; load(); if (n > 15) clearInterval(t); }, 2000); return () => clearInterval(t);
  }, [me?.entitled]);
  // Once checkout is confirmed, re-issue the session server-side and go straight into the app.
  useEffect(() => {
    if (q.get('checkout') !== 'success' || !me?.entitled) return;
    try { (window as any).goatcounter?.count?.({ path: 'trial-start', title: 'Trial started', event: true }); } catch {}
    const t = setTimeout(() => { location.href = '/api/account/refresh?next=/'; }, 1200); return () => clearTimeout(t);
  }, [me?.entitled]);
  async function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setErr('');
    const r = await fetch(`/api/account/${mode === 'signup' ? 'signup' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.get('email'), password: f.get('password'), terms: f.get('terms') === 'on', website: f.get('website') }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Something went wrong.'); setBusy(false); return; }
    const plan = q.get('plan'), iv = q.get('interval');
    if (plan && iv && billing) { const e2 = await startCheckout(plan, iv); if (e2) { setErr(e2); setBusy(false); load(); } return; }
    setBusy(false); load();
  }
  async function portal() { setBusy(true); const r = await fetch('/api/billing/portal', { method: 'POST' }); const j = await r.json().catch(() => ({})); if (j.url) location.href = j.url; else { setErr(j.error || 'Could not open billing.'); setBusy(false); } }
  async function logout() { await fetch('/api/account/logout', { method: 'POST' }); location.href = '/'; }
  if (me === undefined) return <div className="hud-card" data-file="Account" style={{ minHeight: 220 }}><p className="hud-lbl">Loading…</p></div>;
  if (me) return (
    <div className="hud-card" data-file="Account">
      <div className="hud-lbl">Signed in as</div><div style={{ fontSize: 20, marginBottom: 14 }}>{me.email}</div>
      {q.get('checkout') === 'success' && !me.entitled && <p style={{ color: '#5eead4' }}>Confirming your subscription with Stripe…</p>}
      {q.get('checkout') === 'success' && me.entitled && <p style={{ color: '#5eead4' }}>You&apos;re in. Opening RemoteView…</p>}
      <table className="hud-t"><tbody>
        <tr><td>Plan</td><td>{me.plan ? `${me.plan[0].toUpperCase()}${me.plan.slice(1)} · ${me.interval === 'year' ? 'yearly' : 'monthly'}` : 'None'}{me.founder ? ' · founder price' : ''}</td></tr>
        <tr><td>Status</td><td>{me.status ? STATUS[me.status] || me.status : 'No subscription'}</td></tr>
        {me.status === 'trialing' && <tr><td>Trial ends</td><td>{d(me.trialEnd)} (first charge then unless you cancel)</td></tr>}
        {me.periodEnd && me.status !== 'trialing' && <tr><td>{me.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'}</td><td>{d(me.periodEnd)}</td></tr>}
      </tbody></table>
      {me.status === 'past_due' && <p style={{ color: '#fca5a5' }}>Your last payment failed. Update your card in billing to restore access.</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        {me.entitled && <a className="hud-btn" href="/api/account/refresh?next=/">Open RemoteView</a>}
        {!me.entitled && <a className="hud-btn" href="/pricing">Choose a plan</a>}
        {billing && me.status && <button type="button" className="hud-ghost" style={{ cursor: 'pointer', font: 'inherit', background: 'transparent' }} onClick={portal} disabled={busy}>Manage billing, invoices or cancel</button>}
        <button type="button" className="hud-ghost" style={{ cursor: 'pointer', font: 'inherit', background: 'transparent' }} onClick={logout}>Sign out</button>
      </div>
      {err && <p role="alert" style={{ color: '#fca5a5' }}>{err}</p>}
    </div>);
  return (
    <form onSubmit={auth} className="hud-card" data-file={mode === 'signup' ? 'Create account' : 'Sign in'} style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
      <label className="hud-lbl">Email<input name="email" type="email" required autoComplete="email" maxLength={254} className="hud-in" /></label>
      <label className="hud-lbl">Password {mode === 'signup' && '(10+ characters)'}<input name="password" type="password" required minLength={mode === 'signup' ? 10 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="hud-in" /></label>
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {mode === 'signup' && <label className="hud-lbl" style={{ display: 'flex', gap: 8 }}><input name="terms" type="checkbox" required /> <span>I agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy notice</a>.</span></label>}
      <button type="submit" className="hud-btn" disabled={busy} style={{ border: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700 }}>{busy ? 'Working…' : mode === 'signup' ? (q.get('plan') ? 'Create account and continue to checkout' : 'Create account') : 'Sign in'}</button>
      {err && <p role="alert" style={{ color: '#fca5a5', margin: 0 }}>{err}</p>}
      <p className="hud-lbl" style={{ margin: 0 }}>{mode === 'signup' ? <>Have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signin'); setErr(''); }}>Sign in</a></> : <>New here? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setErr(''); }}>Create an account</a>. Forgot your password? Email <a href="mailto:remoteview@mail.grokbot.com">remoteview@mail.grokbot.com</a>.</>}</p>
    </form>);
}
