'use client';
import { useEffect, useState } from 'react';
import { isDemoLocation } from '@/lib/demo';

/* Demo-only chrome: top banner, plus an upsell whenever a click asks for a locked feature
   (any API call the demo is not allowed to make, made within 2s of a user click). */
export default function DemoChrome() {
  const [demo, setDemo] = useState(false);
  const [upsell, setUpsell] = useState<string | null>(null);
  useEffect(() => {
    if (!isDemoLocation()) return;
    setDemo(true);
    let lastClick = 0;
    const onDown = () => { lastClick = Date.now(); };
    window.addEventListener('pointerdown', onDown, true);
    const onLocked = (e: Event) => { if (Date.now() - lastClick < 2000) setUpsell((e as CustomEvent).detail || 'This feature'); };
    window.addEventListener('rv-demo-locked', onLocked);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('rv-demo-locked', onLocked); };
  }, []);
  if (!demo) return null;
  const cta: React.CSSProperties = { background: '#2DD4BF', color: '#032024', borderRadius: 8, padding: '7px 12px', fontWeight: 700, textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap' };
  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2147483000, marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(3,9,18,.9)', border: '1px solid rgba(45,212,191,.45)', borderRadius: 999, padding: '6px 8px 6px 14px', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: 13, color: '#e6f1ff', maxWidth: 'calc(100vw - 16px)' }}>
        <style>{'.rvd-long{white-space:nowrap}@media(max-width:700px){.rvd-long{display:none}}'}</style><span style={{ whiteSpace: 'nowrap' }}><b style={{ color: '#2DD4BF', letterSpacing: '.15em' }}>DEMO</b><span className="rvd-long"> · live flights, satellites, quakes, weather and risk</span></span>
        <a href="/#waitlist" style={cta}>Accept the mission</a>
      </div>
      {upsell && (
        <div role="dialog" aria-modal="true" onClick={() => setUpsell(null)} style={{ position: 'fixed', inset: 0, zIndex: 2147483001, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#06101e', border: '1px solid rgba(45,212,191,.5)', borderRadius: 16, padding: 24, maxWidth: 420, color: '#e6f1ff', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
            <div style={{ fontSize: 12, letterSpacing: '.2em', color: '#2DD4BF' }}>FULL VERSION</div>
            <h2 style={{ margin: '8px 0', fontSize: 22 }}>Unlock {upsell}</h2>
            <p style={{ color: '#9fb3c8', lineHeight: 1.55 }}>AI briefings, ships, PDF reports, case files, link graphs, sanctions search and 40+ more layers are in the full app. Every plan starts with a 7-day free trial.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}><a href="/#waitlist" style={cta}>Accept the mission</a><button onClick={() => setUpsell(null)} style={{ background: 'transparent', color: '#9fb3c8', border: '1px solid #1e3a5f', borderRadius: 8, padding: '7px 12px' }}>Keep exploring</button></div>
          </div>
        </div>
      )}
    </>
  );
}
