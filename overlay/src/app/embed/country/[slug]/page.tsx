import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countryBySlug, countryData, outlinePath, riskBand } from '@/lib/seo/data';
import { EMBED_CSS, Powered } from '@/components/seo/embed';
import { PUBLIC_URL } from '@/lib/publicUrl';
/* Rendered on request; the sources behind it are cached in memory (risk 12h, World Bank / Factbook 7d). */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: true } };
export default async function EmbedCountry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const c = await countryBySlug(slug).catch(() => null); if (!c) notFound();
  const d = await countryData(c); const band = d.risk ? riskBand(d.risk.score) : null; const p: any = d.risk?.parts || {};
  return (
    <div className="rve" data-rv-landing="">
      <style dangerouslySetInnerHTML={{ __html: EMBED_CSS }} />
      <div className="rve-top"><span>COUNTRY RISK</span><span>{c.iso3}</span></div>
      <div className="rve-body">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rve-name">{c.name}</div>
          {d.risk && band ? <><div className="rve-big" style={{ color: band[1] }}>{d.risk.score}<small>/100</small></div><div className="rve-lbl">{band[0]} · US L{p.state ?? '—'} · OECD {p.oecd ?? '—'}</div></> : <div className="rve-lbl">No composite score</div>}
        </div>
        <svg viewBox="0 0 320 200" width="120" height="76" aria-hidden="true"><path d={outlinePath(c)} fill="rgba(45,212,191,.25)" stroke="#2DD4BF" strokeWidth="1.5" /></svg>
      </div>
      <Powered href={`${PUBLIC_URL}/country/${c.slug}?utm_source=embed&utm_medium=iframe&utm_campaign=country`} label={`${c.name} risk on RemoteView`} />
    </div>
  );
}
