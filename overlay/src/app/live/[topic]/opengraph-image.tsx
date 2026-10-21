import { ImageResponse } from 'next/og';
import { topicBySlug, snapshot, TOPICS } from '@/lib/seo/live';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Live map snapshot';
export default async function Og({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params; const t = topicBySlug(topic);
  const s = t ? await snapshot(t).catch(() => null) : null;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#030912', color: '#e6f1ff', padding: 64, fontFamily: 'sans-serif', backgroundImage: 'linear-gradient(rgba(45,212,191,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      <div style={{ display: 'flex', fontSize: 24, letterSpacing: 8, color: '#2DD4BF' }}>REMOTEVIEW · LIVE</div>
      <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, marginTop: 34, lineHeight: 1.05, maxWidth: 1000 }}>{t?.h1 || 'Live map'}</div>
      {s?.stat && <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 40 }}><div style={{ display: 'flex', fontSize: 130, fontWeight: 700, color: '#2DD4BF', lineHeight: 1 }}>{s.stat}</div><div style={{ display: 'flex', fontSize: 36, color: '#8ba3bd', marginLeft: 16 }}>{s.statLabel}</div></div>}
      <div style={{ display: 'flex', fontSize: 26, color: '#8ba3bd', marginTop: 'auto' }}>{s ? `Snapshot ${s.fetched.slice(0, 16).replace('T', ' ')} UTC · ${s.source}` : 'Critical world events, as they happen.'}</div>
    </div>, size);
}
