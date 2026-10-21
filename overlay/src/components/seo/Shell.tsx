import { HUD_CSS } from './hud';
export function Brand() {
  return <a className="hud-brand" href="/"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#2DD4BF" strokeWidth="1.6" /><circle cx="12" cy="12" r="3.2" fill="#2DD4BF" /></svg>REMOTEVIEW</a>;
}
export default function SeoShell({ children, jsonLd }: { children: React.ReactNode; jsonLd?: object | object[] }) {
  return (
    <div className="hud" data-rv-landing="">
      <style dangerouslySetInnerHTML={{ __html: HUD_CSS }} />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <div className="hud-w">
        <nav className="hud-nav"><Brand /><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><a className="hud-navx" href="/country" style={{ color: '#8ba3bd', textDecoration: 'none', fontSize: 14 }}>Countries</a><a className="hud-navx" href="/live" style={{ color: '#8ba3bd', textDecoration: 'none', fontSize: 14 }}>Live</a><a className="hud-btn" style={{ padding: '8px 14px', fontSize: 14 }} href="/pricing"><span className="hud-long">Start free trial</span><span className="hud-short">Free trial</span></a></div></nav>
        {children}
        <footer className="hud-foot"><span>© RemoteView</span><a href="/">Home</a><a href="/demo">Live demo</a><a href="/country">Countries</a><a href="/live">Live maps</a><a href="/credits">Data credits</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:remoteview@mail.grokbot.com">remoteview@mail.grokbot.com</a></footer>
      </div>
    </div>
  );
}
export function Cta({ title = 'Critical world events, as they happen', sub = 'Conflict signals, internet outages, shipping chokepoints, country risk and breaking disasters on one live map.' }: { title?: string; sub?: string }) {
  return <div className="hud-cta"><div><div className="hud-mono" style={{ fontSize: 11, letterSpacing: '.25em', color: '#5eead4' }}>// NEXT STEP</div><div style={{ fontSize: 22, margin: '6px 0' }}>{title}</div><div className="hud-lbl">{sub}</div></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><a className="hud-ghost" href="/demo">Open live demo</a><a className="hud-btn" href="/pricing">Start 7-day free trial</a></div></div>;
}
