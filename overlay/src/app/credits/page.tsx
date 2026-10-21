import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Data credits & licences', robots: { index: false, follow: false } };

type Row = { name: string; use: string; licence: string; href: string; licenceHref?: string; note?: string };

const OPEN: Row[] = [
  { name: 'OpenStreetMap contributors', use: 'Map data, embassies, bases, borders, POIs (via Overpass API)', licence: 'ODbL 1.0', href: 'https://www.openstreetmap.org/copyright', licenceHref: 'https://opendatacommons.org/licenses/odbl/1-0/', note: 'Derived databases are shared under the same licence.' },
  { name: 'CARTO basemaps', use: 'Map tiles', licence: '© OpenStreetMap contributors, © CARTO', href: 'https://carto.com/attribution/' },
  { name: 'adsb.lol', use: 'Live aircraft positions', licence: 'ODbL 1.0', href: 'https://www.adsb.lol/docs/open-data/api/', licenceHref: 'https://opendatacommons.org/licenses/odbl/1-0/', note: 'Share-alike applies to any database derived from this feed.' },
  { name: 'Wikipedia', use: 'Country and entity summaries', licence: 'CC BY-SA 4.0', href: 'https://en.wikipedia.org/', licenceHref: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'Wikidata', use: 'Entity facts', licence: 'CC0 1.0', href: 'https://www.wikidata.org/' },
  { name: 'World Bank Open Data / Worldwide Governance Indicators', use: 'Country indicators', licence: 'CC BY 4.0', href: 'https://data.worldbank.org/', licenceHref: 'https://creativecommons.org/licenses/by/4.0/' },
  { name: 'Our World in Data (UNHCR-sourced refugee data)', use: 'Refugee populations', licence: 'CC BY 4.0', href: 'https://ourworldindata.org/', licenceHref: 'https://creativecommons.org/licenses/by/4.0/' },
  { name: 'GDELT Project', use: 'Events, protests, news signals', licence: 'Free for any use with attribution', href: 'https://www.gdeltproject.org/' },
  { name: 'MITRE ATT&CK®', use: 'Threat groups', licence: 'MITRE ATT&CK terms of use (royalty-free, attribution)', href: 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/', note: 'ATT&CK® is a registered trademark of The MITRE Corporation.' },
  { name: 'CIRCL MISP OSINT feed', use: 'Threat events', licence: 'CC BY / TLP:CLEAR as published', href: 'https://www.circl.lu/doc/misp/feed-osint/' },
  { name: 'TeleGeography Submarine Cable Map', use: 'Submarine cables', licence: 'CC BY-SA 4.0', href: 'https://www.submarinecablemap.com/', licenceHref: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'CelesTrak', use: 'Satellite orbital elements', licence: 'Free with credit to CelesTrak', href: 'https://celestrak.org/' },
  { name: 'SondeHub', use: 'Weather balloons', licence: 'Community data, attribution', href: 'https://sondehub.org/' },
  { name: 'Safecast', use: 'Radiation readings', licence: 'CC0 1.0', href: 'https://safecast.org/' },
  { name: 'Natural Earth', use: 'Country shapes', licence: 'Public domain', href: 'https://www.naturalearthdata.com/' },
  { name: 'Copernicus Sentinel data (via Element 84 Earth Search)', use: 'Satellite imagery search', licence: 'Copernicus free and open licence', href: 'https://earth-search.aws.element84.com/' },
];

const GOV: Row[] = [
  { name: 'US Treasury OFAC SDN list', use: 'Sanctions search', licence: 'US Government work (public domain)', href: 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists' },
  { name: 'UK Sanctions List (FCDO)', use: 'Sanctions search and map', licence: 'Open Government Licence v3.0', href: 'https://www.gov.uk/government/publications/the-uk-sanctions-list', licenceHref: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' },
  { name: 'EU consolidated financial sanctions list', use: 'Sanctions search and map', licence: '© European Union, reuse authorised (Commission Decision 2011/833/EU)', href: 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions' },
  { name: 'FCDO foreign travel advice, gov.uk', use: 'Travel advice layer', licence: 'Open Government Licence v3.0', href: 'https://www.gov.uk/foreign-travel-advice', licenceHref: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' },
  { name: 'CISA Known Exploited Vulnerabilities', use: 'Threat intel', licence: 'US Government work (public domain)', href: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
  { name: 'NASA (FIRMS, GIBS, EPIC, JPL CNEOS)', use: 'Fires, imagery, fireballs', licence: 'US Government work; credit NASA', href: 'https://www.earthdata.nasa.gov/engage/open-data-services-software-policies' },
  { name: 'NOAA (SWPC, NWS, NHC, Tsunami, NESDIS)', use: 'Space weather, weather, storms, smoke', licence: 'US Government work (public domain)', href: 'https://www.noaa.gov/' },
  { name: 'USGS', use: 'Earthquakes, volcanoes', licence: 'US Government work (public domain)', href: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits' },
  { name: 'US State Department travel advisories, FAA TFRs, NIST NVD', use: 'Advisories, flight restrictions, CVEs', licence: 'US Government work (public domain)', href: 'https://travel.state.gov/' },
  { name: 'CIA World Factbook (factbook.json mirror)', use: 'Country dossiers', licence: 'Public domain', href: 'https://github.com/factbook/factbook.json' },
  { name: 'OECD country risk classifications', use: 'Country risk layer', licence: 'OECD terms, attribution', href: 'https://www.oecd.org/en/topics/sub-issues/country-risk-classification.html' },
  { name: 'IMF data', use: 'Indicators', licence: 'IMF copyright and usage terms, attribution', href: 'https://www.imf.org/en/About/copyright-and-terms' },
  { name: 'GDACS, WHO Disease Outbreak News', use: 'Disasters, outbreaks', licence: 'Attribution', href: 'https://www.gdacs.org/' },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead><tr style={{ textAlign: 'left', color: '#2DD4BF' }}><th style={th}>Source</th><th style={th}>Used for</th><th style={th}>Licence</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} style={{ borderTop: '1px solid #1e3a5f' }}>
            <td style={td}><a href={r.href} target="_blank" rel="noopener noreferrer" style={a}>{r.name}</a></td>
            <td style={td}>{r.use}</td>
            <td style={td}>{r.licenceHref ? <a href={r.licenceHref} target="_blank" rel="noopener noreferrer" style={a}>{r.licence}</a> : r.licence}{r.note && <div style={{ color: '#7f97b2', fontSize: 11 }}>{r.note}</div>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
const th: React.CSSProperties = { padding: '6px 8px' };
const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
const a: React.CSSProperties = { color: '#e6f1ff' };

export default function CreditsPage() {
  return (
    <main style={{ height: '100vh', overflow: 'auto', background: '#06101e', color: '#c7d6e8', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <a href="/" style={{ ...a, fontSize: 12 }}>← Back to map</a>
        <h1 style={{ color: '#fff', fontSize: 24, margin: '12px 0 4px' }}>Data credits &amp; licences</h1>
        <p style={{ fontSize: 13, color: '#9fb3c8' }}>RemoteView combines open and public-sector data. Each source remains the property of its publisher and is used under the licence shown. Inclusion does not imply endorsement. Estimates and simulations in the app are labelled as such.</p>
        <h2 style={{ color: '#fff', fontSize: 16, marginTop: 24 }}>Open licences (CC BY, CC BY-SA, ODbL, CC0)</h2>
        <Table rows={OPEN} />
        <h2 style={{ color: '#fff', fontSize: 16, marginTop: 24 }}>Government and public-sector data</h2>
        <Table rows={GOV} />
        <h2 style={{ color: '#fff', fontSize: 16, marginTop: 24 }}>Software</h2>
        <p style={{ fontSize: 13 }}>RemoteView is built on MIT-licensed source code; the licence notice ships with the code. Maps are rendered with MapLibre GL JS (BSD-3-Clause).</p>
      </div>
    </main>
  );
}
