import type { Metadata } from 'next';
import SeoShell, { Cta } from '@/components/seo/Shell';
import { countryList } from '@/lib/seo/data';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const revalidate = 86400;
export const metadata: Metadata = { title: 'Country risk scores and travel advisories for every country | RemoteView', description: 'Composite risk score, US and UK travel advice, World Bank governance and key data for every country, on one live map.', robots: { index: true, follow: true }, alternates: { canonical: PUBLIC_URL + '/country' } };
export default async function Countries() {
  const all = await countryList().catch(() => []);
  return (
    <SeoShell jsonLd={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Countries', url: PUBLIC_URL + '/country' }}>
      <div className="hud-kick">// COUNTRY INDEX · {all.length} COUNTRIES</div>
      <h1>Every country, one live brief each</h1>
      <p className="hud-sub">Risk score, travel advisories, governance indicators and election dates from official and open sources.</p>
      <div className="hud-links">{all.map((c) => <a key={c.slug} href={`/country/${c.slug}`}>{c.name}</a>)}</div>
      <Cta />
    </SeoShell>
  );
}
