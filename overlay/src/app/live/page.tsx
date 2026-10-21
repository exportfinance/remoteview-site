import type { Metadata } from 'next';
import SeoShell, { Cta } from '@/components/seo/Shell';
import { TOPICS } from '@/lib/seo/live';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const metadata: Metadata = { title: 'Live maps: aircraft, aurora, shipping chokepoints | RemoteView', description: 'Hourly snapshots of live world data: military aircraft over Europe, flights over Taiwan, the aurora forecast and more.', robots: { index: true, follow: true }, alternates: { canonical: PUBLIC_URL + '/live' } };
export default function LiveIndex() {
  return (
    <SeoShell>
      <div className="hud-kick">// LIVE MAPS</div>
      <h1>Live maps</h1>
      <p className="hud-sub">Hourly snapshots from open, commercially licensed sources. The full picture moves in real time in the app.</p>
      <div className="hud-grid">{TOPICS.map((t, i) => <a key={t.slug} href={`/live/${t.slug}`} className="hud-card" data-file={`LIVE // ${String(i + 1).padStart(2, '0')}`} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontSize: 18, marginBottom: 6 }}>{t.h1}</div><div className="hud-lbl">{t.desc}</div></a>)}</div>
      <Cta />
    </SeoShell>
  );
}
