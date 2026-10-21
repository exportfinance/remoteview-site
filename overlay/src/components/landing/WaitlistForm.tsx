'use client';
import { useEffect, useRef, useState } from 'react';

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
  const [me, setMe] = useState<{ code?: string; position?: number | null; total?: number | null; link?: string; existing?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<string | undefined>(undefined);
  useEffect(() => {
    try {
      const r = new URLSearchParams(location.search).get('ref');
      if (r && /^[a-z0-9]{6,12}$/.test(r)) { ref.current = r; sessionStorage.setItem('rv_ref', r); } else ref.current = sessionStorage.getItem('rv_ref') || undefined;
      const mine = localStorage.getItem('rv_wl_code');
      if (mine) fetch('/api/waitlist/position?code=' + mine).then((x) => x.ok ? x.json() : null).then((j) => {
        if (j) { setMe({ code: mine, position: j.position, total: j.total, link: location.origin + '/?ref=' + mine }); setState('done'); }
      }).catch(() => {});
    } catch {}
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy'); setMsg('');
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), name: f.get('name'), useCase: f.get('useCase'), plan: f.get('plan'), consent: f.get('consent') === 'on', website: f.get('website'), t: t0.current, ref: ref.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState('error'); setMsg(j.error || 'Something went wrong.'); return; }
      if (j.code) try { localStorage.setItem('rv_wl_code', j.code); } catch {}
      setMe(j); setState('done');
    } catch { setState('error'); setMsg('Network error. Please try again.'); }
  }
  if (state === 'done') {
    const link = me?.link;
    const text = 'I just joined the RemoteView waitlist: the whole world, live, in one screen.';
    const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };
    const native = async () => { if (link && (navigator as any).share) try { await (navigator as any).share({ title: 'RemoteView', text, url: link }); } catch {} };
    return (
      <div className="rvl-card rvl-dossier rvl-nostamp" data-file="MISSION ACCEPTED" role="status" style={{ textAlign: 'center', padding: '52px 28px 30px' }}>
        {me?.position ? <>
          <div className="rvl-mono" style={{ fontSize: 13, letterSpacing: '.25em', color: '#5eead4' }}>QUEUE POSITION</div>
          <div style={{ fontSize: 'clamp(44px,8vw,72px)', fontWeight: 700, lineHeight: 1.05, margin: '6px 0' }}>You’re #{me.position.toLocaleString('en-US')}</div>
          <p style={{ color: '#c9f7f0', margin: '0 0 18px', fontSize: 18 }}>Share to jump the queue: every friend who joins moves you up 5 places.</p>
          {link && <>
            <div style={{ display: 'flex', gap: 8, maxWidth: 520, margin: '0 auto 12px' }}>
              <input readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0 }} className="rvl-mono" />
              <button type="button" className="rvl-btn" onClick={copy} style={{ whiteSpace: 'nowrap' }}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="rvl-ghost" target="_blank" rel="noopener" href={'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link)}>Post on X</a>
              <a className="rvl-ghost" target="_blank" rel="noopener" href={'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link)}>LinkedIn</a>
              <a className="rvl-ghost" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(text + ' ' + link)}>WhatsApp</a>
              <button type="button" className="rvl-ghost" onClick={native} style={{ cursor: 'pointer', font: 'inherit' }}>More…</button>
            </div>
          </>}
        </> : <>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{me?.existing ? 'You’re already on the list.' : 'You are on the list.'}</div>
          <p style={{ color: '#9fb3c8', margin: 0 }}>We will be in touch before launch. No spam, ever.</p>
        </>}
      </div>
    );
  }
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
