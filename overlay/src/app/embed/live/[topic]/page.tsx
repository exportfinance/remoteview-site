import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TOPICS, topicBySlug, snapshot, dots, dotPath } from '@/lib/seo/live';
import { worldPath } from '@/lib/seo/data';
import { EMBED_CSS, Powered } from '@/components/seo/embed';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: true } };
export default async function EmbedLive({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params; const t = topicBySlug(topic); if (!t) notFound();
  const s = await snapshot(t).catch(() => null);
  const W = 480, H = 220; const land = s ? await worldPath(s.bbox, W, H).catch(() => '') : ''; const pts = s ? dots(s.points, s.bbox, W, H, t.kind === 'aurora' ? 3000 : 400) : [];
  return (
    <div className="rve" data-rv-landing="">
      <style dangerouslySetInnerHTML={{ __html: EMBED_CSS }} />
      <div className="rve-top"><span>LIVE · {t.h1.toUpperCase()}</span>{s?.stat && <span>{s.stat}</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', flex: 1 }} role="img" aria-label={t.h1}>
        <path d={land} fill="#0b2236" stroke="#1d4a66" strokeWidth=".6" />
        {t.kind === 'aurora' ? <path d={dotPath(pts, 1)} fill="#2DD4BF" opacity={.55} /> : pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4} fill="#2DD4BF" />)}
      </svg>
      <div className="rve-lbl" style={{ padding: '4px 12px' }}>{s ? `${s.statLabel ? s.stat + ' ' + s.statLabel + ' · ' : ''}${s.fetched.slice(11, 16)} UTC · ${s.source}` : 'Source unavailable'}</div>
      <Powered href={`${PUBLIC_URL}/live/${t.slug}?utm_source=embed&utm_medium=iframe&utm_campaign=live`} label={`${t.h1} on RemoteView`} />
    </div>
  );
}
