'use client';
/* "Share" — turns the current map view into a public read-only snapshot page (every share is an ad). */
import { useEffect, useState } from 'react';

const MAP_PATHS = new Set(['/', '/demo']);
function grab(map: any): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => { if (!done) { done = true; resolve(v); } };
    map.once('render', () => {
      try {
        const src: HTMLCanvasElement = map.getCanvas();
        const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d')!; x.fillStyle = '#030912'; x.fillRect(0, 0, W, H);
        const s = Math.max(W / src.width, H / src.height), dw = src.width * s, dh = src.height * s;
        x.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
        // HUD frame + wordmark so the image reads as RemoteView anywhere it is posted.
        x.strokeStyle = 'rgba(45,212,191,.9)'; x.lineWidth = 4; const L = 46;
        for (const [px, py, dx, dy] of [[16, 16, 1, 1], [W - 16, 16, -1, 1], [16, H - 16, 1, -1], [W - 16, H - 16, -1, -1]]) { x.beginPath(); x.moveTo(px, py + dy * L); x.lineTo(px, py); x.lineTo(px + dx * L, py); x.stroke(); }
        x.fillStyle = 'rgba(3,9,18,.72)'; x.fillRect(0, H - 64, W, 64);
        x.fillStyle = '#2DD4BF'; x.font = '600 26px ui-monospace, monospace'; x.fillText('REMOTEVIEW', 40, H - 23);
        x.fillStyle = '#c9d8e8'; x.font = '22px ui-sans-serif, system-ui, sans-serif'; x.fillText('The whole world, live, in one screen', 250, H - 24);
        let q = 0.78, out = c.toDataURL('image/jpeg', q);
        while (out.length > 560_000 && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        finish(out.length > 600_000 ? null : out);
      } catch { finish(null); }
    });
    map.triggerRepaint();
    setTimeout(() => finish(null), 2500);
  });
}

export default function ShareButton() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const p = location.pathname.replace(/\/$/, '') || '/';
    if (!MAP_PATHS.has(p) || document.querySelector('[data-rv-landing]')) return;
    setOn(true);
    // Arriving from a snapshot: ?at=lat,lng,zoom,bearing,pitch
    const at = new URLSearchParams(location.search).get('at');
    if (at) {
      const [lat, lng, zoom, bearing, pitch] = at.split(',').map(Number);
      if ([lat, lng, zoom].every(Number.isFinite)) {
        let tries = 0;
        const t = setInterval(() => {
          const m = (window as any).__rvMap; tries++;
          if (m && m.loaded?.()) { clearInterval(t); setTimeout(() => m.jumpTo({ center: [lng, lat], zoom, bearing: bearing || 0, pitch: pitch || 0 }), 1200); }
          if (tries > 60) clearInterval(t);
        }, 500);
      }
    }
  }, []);
  if (!on) return null;
  async function share() {
    const m = (window as any).__rvMap; if (!m) return;
    setBusy(true); setRes(null);
    try {
      const c = m.getCenter();
      const layers = new URLSearchParams(location.search).get('layers') || '';
      const image = await grab(m);
      const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: c.lat, lng: ((c.lng + 540) % 360) - 180, zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch(), layers, image }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) { setRes({ error: j.error || 'Could not create a link.' }); return; }
      setRes({ url: j.url });
      if ((navigator as any).share && matchMedia('(pointer:coarse)').matches) (navigator as any).share({ title: 'RemoteView live view', url: j.url }).catch(() => {});
    } catch { setRes({ error: 'Network error.' }); } finally { setBusy(false); }
  }
  const btn: React.CSSProperties = { background: 'rgba(3,9,18,.88)', color: '#e6f1ff', border: '1px solid rgba(45,212,191,.5)', borderRadius: 999, padding: '9px 14px', font: '600 13px ui-sans-serif,system-ui,sans-serif', letterSpacing: '.04em', cursor: 'pointer', backdropFilter: 'blur(6px)', boxShadow: '0 8px 24px -10px rgba(0,0,0,.8)' };
  return (
    <>
      <style>{'.rv-share{position:fixed;right:14px;bottom:96px;z-index:2147482000}@media(min-width:900px){.rv-share{bottom:22px;right:22px}}.rv-share button:hover{border-color:#2DD4BF!important}'}</style>
      <div className="rv-share"><button type="button" style={btn} onClick={share} disabled={busy} aria-label="Share this view">{busy ? 'Capturing…' : '⤴ Share view'}</button></div>
      {res && (
        <div role="dialog" aria-modal="true" onClick={() => setRes(null)} style={{ position: 'fixed', inset: 0, zIndex: 2147483001, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#06101e', border: '1px solid rgba(45,212,191,.5)', borderRadius: 8, padding: 22, width: 'min(460px,100%)', color: '#e6f1ff', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
            <div style={{ font: '11px ui-monospace,monospace', letterSpacing: '.25em', color: '#2DD4BF' }}>{res.url ? 'SNAPSHOT READY' : 'SHARE FAILED'}</div>
            {res.url ? <>
              <p style={{ color: '#9fb3c8', margin: '8px 0 12px' }}>Anyone with this link sees a read-only picture of this view, and can open it live.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={res.url} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, background: '#030912', color: '#e6f1ff', border: '1px solid #1e3a5f', borderRadius: 6, padding: '9px 10px', font: '13px ui-monospace,monospace' }} />
                <button type="button" style={{ ...btn, borderRadius: 6, background: '#2DD4BF', color: '#032024' }} onClick={async () => { try { await navigator.clipboard.writeText(res.url!); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><a href={res.url} target="_blank" rel="noopener" style={{ color: '#2DD4BF', fontSize: 14 }}>Open snapshot ↗</a></div>
            </> : <p style={{ color: '#fca5a5' }}>{res.error}</p>}
            <button type="button" onClick={() => setRes(null)} style={{ ...btn, marginTop: 14 }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
