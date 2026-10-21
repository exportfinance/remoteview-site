import { ImageResponse } from 'next/og';
import { countryBySlug, countryData, outlinePath, riskBand } from '@/lib/seo/data';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
export const alt = 'Country risk card';
export default async function Og({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await countryBySlug(slug).catch(() => null);
  const d = c ? await countryData(c).catch(() => null) : null;
  const band = d?.risk ? riskBand(d.risk.score) : null;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#030912', color: '#e6f1ff', padding: 64, fontFamily: 'sans-serif', backgroundImage: 'linear-gradient(rgba(45,212,191,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 24, letterSpacing: 8, color: '#2DD4BF' }}>REMOTEVIEW · COUNTRY BRIEF</div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 30, lineHeight: 1 }}>{c?.name || 'Country'}</div>
        {band && d?.risk ? <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 40 }}><div style={{ display: 'flex', fontSize: 150, fontWeight: 700, color: band[1], lineHeight: 1 }}>{d.risk.score}</div><div style={{ display: 'flex', fontSize: 40, color: '#8ba3bd', marginLeft: 12 }}>{`/100 · ${band[0]}`}</div></div> : <div style={{ display: 'flex', fontSize: 36, color: '#8ba3bd', marginTop: 40 }}>Risk, travel advice and key data</div>}
        <div style={{ display: 'flex', fontSize: 26, color: '#8ba3bd', marginTop: 'auto' }}>Composite risk · travel advisories · governance · live map</div>
      </div>
      {c && <svg width="420" height="420" viewBox="0 0 320 200" style={{ marginTop: 60 }}><path d={outlinePath(c)} fill="rgba(45,212,191,.25)" stroke="#2DD4BF" strokeWidth="1.5" /></svg>}
    </div>, size);
}
