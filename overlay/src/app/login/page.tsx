'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw, next }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { window.location.href = d.next || '/'; return; }
      setErr(d.error || 'Login failed');
    } catch { setErr('Network error'); }
    setBusy(false);
  }
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06101E', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <form onSubmit={submit} style={{ width: 'min(92vw, 360px)', padding: 28, border: '1px solid rgba(45,212,191,0.35)', borderRadius: 10, background: 'rgba(10,25,45,0.9)', boxShadow: '0 0 40px rgba(45,212,191,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/remoteview-icon.png" alt="" width={34} height={34} />
          <div>
            <div style={{ color: '#2DD4BF', fontWeight: 700, letterSpacing: 3, fontSize: 16 }}>REMOTEVIEW</div>
            <div style={{ color: '#7f97b2', fontSize: 11, letterSpacing: 1 }}>PRIVATE ACCESS</div>
          </div>
        </div>
        <label htmlFor="pw" style={{ color: '#9fb3c8', fontSize: 11, letterSpacing: 1 }}>PASSWORD</label>
        <input id="pw" type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)}
          style={{ width: '100%', marginTop: 6, padding: '10px 12px', background: '#0b1a2e', color: '#e6f1ff', border: '1px solid rgba(45,212,191,0.4)', borderRadius: 6, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
        {err && <div role="alert" style={{ color: '#f87171', fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy || !pw}
          style={{ width: '100%', marginTop: 16, padding: '10px 12px', background: '#2DD4BF', color: '#06101E', border: 0, borderRadius: 6, fontWeight: 700, letterSpacing: 2, cursor: 'pointer', opacity: busy || !pw ? 0.6 : 1 }}>
          {busy ? 'CHECKING…' : 'ENTER'}
        </button>
      </form>
    </main>
  );
}
