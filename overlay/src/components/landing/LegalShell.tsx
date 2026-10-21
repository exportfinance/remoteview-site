import type { ReactNode } from 'react';
export default function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ height: '100vh', overflowY: 'auto', background: '#030912', color: '#c7d6e8', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '28px 18px 64px', lineHeight: 1.65 }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <a href="/" style={{ color: '#2DD4BF', textDecoration: 'none', letterSpacing: '.3em', fontSize: 13 }}>REMOTEVIEW</a>
        <h1 style={{ color: '#fff', fontSize: 32, margin: '18px 0 4px' }}>{title}</h1>
        <p style={{ color: '#7f97b2', fontSize: 13, marginTop: 0 }}>Last updated {updated}</p>
        <div className="rv-legal">{children}</div>
        <p style={{ marginTop: 40, fontSize: 13 }}><a href="/" style={{ color: '#e6f1ff' }}>Home</a> · <a href="/privacy" style={{ color: '#e6f1ff' }}>Privacy</a> · <a href="/terms" style={{ color: '#e6f1ff' }}>Terms</a> · <a href="/credits" style={{ color: '#e6f1ff' }}>Data credits</a> · <a href="mailto:remoteview@mail.grokbot.com" style={{ color: '#e6f1ff' }}>remoteview@mail.grokbot.com</a></p>
      </div>
      <style>{`.rv-legal h2{color:#fff;font-size:19px;margin:28px 0 6px}.rv-legal a{color:#e6f1ff}.rv-legal li{margin:4px 0}`}</style>
    </main>
  );
}
