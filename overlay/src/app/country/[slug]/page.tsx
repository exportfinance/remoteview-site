import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SeoShell, { Cta } from '@/components/seo/Shell';
import { countryBySlug, countryData, countryList, outlinePath, riskBand, fmtNum } from '@/lib/seo/data';
import { PUBLIC_URL } from '@/lib/publicUrl';

/* Rendered on request; the sources behind it are cached in memory (risk 12h, World Bank / Factbook 7d). */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const c = await countryBySlug(slug).catch(() => null);
  if (!c) return { title: 'Country not found · RemoteView', robots: { index: false } };
  const title = `${c.name} risk score, travel advisories & key data | RemoteView`;
  const description = `${c.name}: composite country risk score, US and UK travel advisory levels, World Bank governance indicators, population, GDP and election dates — on one live map.`;
  const url = `${PUBLIC_URL}/country/${c.slug}`;
  return { title, description, robots: { index: true, follow: true }, alternates: { canonical: url }, openGraph: { title, description, url, type: 'article', siteName: 'RemoteView' }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await countryBySlug(slug).catch(() => null);
  if (!c) notFound();
  const [d, all] = await Promise.all([countryData(c), countryList()]);
  const band = d.risk ? riskBand(d.risk.score) : null;
  const p: any = d.risk?.parts || {};
  const fb: any = d.factbook;
  const idx = all.findIndex((x) => x.slug === c.slug);
  const near = [...all.slice(Math.max(0, idx - 4), idx), ...all.slice(idx + 1, idx + 5)];
  const url = `${PUBLIC_URL}/country/${c.slug}`;
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: `${c.name} country risk and key data`, url, dateModified: d.fetched, about: { '@type': 'Country', name: c.long || c.name, identifier: c.iso3 }, isPartOf: { '@type': 'WebSite', name: 'RemoteView', url: PUBLIC_URL } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Countries', item: PUBLIC_URL + '/country' }, { '@type': 'ListItem', position: 2, name: c.name, item: url }] },
    ...(d.risk ? [{ '@context': 'https://schema.org', '@type': 'Dataset', name: `${c.name} composite country risk score`, description: 'Composite 0–100 from OECD country risk category (40%), US State Department advisory level (35%) and UK FCDO advice level (25%). Not a credit rating.', url, creator: { '@type': 'Organization', name: 'RemoteView' }, isAccessibleForFree: true }] : []),
  ];
  return (
    <SeoShell jsonLd={jsonLd}>
      <div className="hud-kick">// COUNTRY DOSSIER · {c.iso3}</div>
      <h1>{c.name}</h1>
      <p className="hud-sub">Risk score, travel advice, governance and the basics for {c.long || c.name}, from official and open sources. Refreshed daily.</p>
      <div className="hud-grid hud-g2">
        <div className="hud-card" data-file="FILE // RISK">
          {d.risk && band ? <>
            <div className="hud-big" style={{ color: band[1] }}>{d.risk.score}<span style={{ fontSize: 18, color: '#8ba3bd' }}>/100</span></div>
            <div className="hud-lbl">{band[0]} composite risk · OECD 40% + US State 35% + UK FCDO 25%. Not a credit rating.</div>
            <table className="hud-t" style={{ marginTop: 14 }}><tbody>
              <tr><td>OECD country risk</td><td>{p.oecd_label || '—'}</td></tr>
              <tr><td>US State Dept advisory</td><td>{p.state != null ? `Level ${p.state}` : '—'}{p.state_label ? ` · ${p.state_label}` : ''}</td></tr>
              <tr><td>UK FCDO advice</td><td>{p.fcdo_label || '—'}</td></tr>
            </tbody></table>
          </> : <p className="hud-lbl">No composite score: this country is not covered by all three source lists.</p>}
        </div>
        <div className="hud-card" data-file="FILE // MAP">
          <svg className="hud-map" viewBox="0 0 320 200" role="img" aria-label={`Outline map of ${c.name}`}><path className="hl hud-tgt" d={outlinePath(c)} /></svg>
          <div className="hud-lbl" style={{ marginTop: 8 }}>Outline: Natural Earth (public domain).</div>
        </div>
      </div>
      <div className="hud-grid" style={{ marginTop: 14 }}>
        <div className="hud-card" data-file="FILE // ECONOMY">
          <table className="hud-t"><tbody>{d.wdi.map((r) => <tr key={r.code}><td>{r.label}</td><td className="hud-mono">{fmtNum(r.value, r.code)}{r.year ? <span className="hud-lbl"> ({r.year})</span> : null}</td></tr>)}</tbody></table>
          {!d.wdi.length && <p className="hud-lbl">World Bank data unavailable right now.</p>}
        </div>
        <div className="hud-card" data-file="FILE // GOVERNANCE">
          <table className="hud-t"><tbody>{d.wgi.map((r) => <tr key={r.code}><td>{r.label}</td><td className="hud-mono">{fmtNum(r.value, r.code)}</td></tr>)}</tbody></table>
          <p className="hud-lbl" style={{ marginTop: 8 }}>World Governance Indicators, roughly −2.5 (weak) to +2.5 (strong){d.wgi[0]?.year ? `, ${d.wgi[0].year}` : ''}.</p>
        </div>
        <div className="hud-card" data-file="FILE // ELECTIONS">
          {fb?.elections && Object.keys(fb.elections).length ? <table className="hud-t"><tbody>
            {fb.elections['most recent election date'] && <tr><td>Most recent</td><td>{fb.elections['most recent election date']}</td></tr>}
            {fb.elections['expected date of next election'] && <tr><td>Next expected</td><td>{fb.elections['expected date of next election']}</td></tr>}
          </tbody></table> : <p className="hud-lbl">No election dates on file.</p>}
          <p className="hud-lbl" style={{ marginTop: 8 }}>From the final CIA World Factbook edition (public domain, discontinued Feb 2026), so dates may be out of date. Check the national electoral authority.</p>
          {fb?.government?.Capital && <p className="hud-lbl">Capital: {fb.government.Capital.split(';')[0].replace(/^name: /, '')}</p>}
        </div>
      </div>
      <Cta title={`Watch ${c.name} live`} sub="Live flights, satellites, quakes, weather and this risk score on the 3D globe." />
      <h2>Embed this card</h2>
      <p className="hud-lbl">Free to embed with the credit link intact:</p>
      <pre className="hud-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, padding: 12, border: '1px solid rgba(45,212,191,.18)', borderRadius: 4, color: '#9fb3c8' }}>{`<iframe src="${PUBLIC_URL}/embed/country/${c.slug}" width="360" height="260" style="border:0" loading="lazy" title="${c.name} risk — RemoteView"></iframe>`}</pre>
      <h2 style={{ marginTop: 30 }}>More countries</h2>
      <div className="hud-links">{near.map((n) => <a key={n.slug} href={`/country/${n.slug}`}>{n.name}</a>)}<a href="/country">All countries →</a></div>
      <p className="hud-src" style={{ marginTop: 26 }}>Sources: OECD Country Risk Classification; US Department of State travel advisories (public domain); UK FCDO foreign travel advice (Open Government Licence v3.0); World Bank World Development Indicators and Worldwide Governance Indicators (CC BY 4.0); CIA World Factbook (public domain); Natural Earth (public domain). Fetched {d.fetched.slice(0, 16).replace('T', ' ')} UTC. Information only, not travel, legal or investment advice.</p>
    </SeoShell>
  );
}
