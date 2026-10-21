'use client';
import { useRef, useState } from 'react';

const USE_CASES = [
  ['osint-research', 'OSINT / research'],
  ['journalism', 'Journalism'],
  ['security-risk', 'Security / risk'],
  ['aviation-ship-spotting', 'Aviation / ship spotting'],
  ['other', 'Other'],
];

export default function WaitlistForm({ consentText }: { consentText: string }) {
  const t0 = useRef(Date.now());
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy'); setMsg('');
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), name: f.get('name'), useCase: f.get('useCase'), plan: f.get('plan'), consent: f.get('consent') === 'on', website: f.get('website'), t: t0.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState('error'); setMsg(j.error || 'Something went wrong.'); return; }
      setState('done');
    } catch { setState('error'); setMsg('Network error. Please try again.'); }
  }
  if (state === 'done') return (
    <div className="rvl-card" role="status" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>You are on the list.</div>
      <p style={{ color: '#9fb3c8', margin: 0 }}>We will be in touch before launch. No spam, ever.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="rvl-card rvl-form" noValidate={false}>
      <div className="rvl-row">
        <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} /></label>
        <label>Name <span className="rvl-opt">(optional)</span><input name="name" type="text" autoComplete="name" maxLength={100} placeholder="Your name" /></label>
      </div>
      <div className="rvl-row">
        <label>Use case<select name="useCase" required defaultValue=""><option value="" disabled>Choose one</option>{USE_CASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Plan of interest <span className="rvl-opt">(optional)</span><select name="plan" defaultValue="undecided"><option value="undecided">Not sure yet</option><option value="personal">Personal</option><option value="pro">Pro</option><option value="teams">Teams</option></select></label>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="rvl-consent"><input name="consent" type="checkbox" required /> <span>{consentText} See our <a href="/privacy">privacy notice</a>.</span></label>
      <button type="submit" className="rvl-btn" disabled={state === 'busy'}>{state === 'busy' ? 'Transmitting…' : 'Accept the mission'}</button>
      {msg && <p role="alert" style={{ color: '#fca5a5', margin: '8px 0 0' }}>{msg}</p>}
    </form>
  );
}
