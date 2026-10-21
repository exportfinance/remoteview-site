/* "What's happening in X now" for SEO country pages: IODA outages, GDELT unrest, USGS quakes. Commercially-fine sources only. */
import { HANDLERS } from '@/lib/rvx/feeds';
import { cached, getJson } from '@/lib/rvx/util';
import type { CountryRow } from '@/lib/seo/data';

const q = () => new URLSearchParams();
async function quakes() { return cached('seo-quakes-day', 30 * 60_000, () => getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { timeout: 15000 })); }

export type Now = {
  outage: { critical: number; warning: number; last: string } | null;
  unrest: number | null; protests: number | null; topUnrest: { name: string; url?: string }[];
  quakes: { mag: number; place: string; time: string }[]; fetched: string;
};
export async function countryNow(c: CountryRow): Promise<Now> {
  const [io, pr, qk] = await Promise.allSettled([HANDLERS.ioda(q()), HANDLERS.protests(q()), quakes()]);
  const o = io.status === 'fulfilled' ? (io.value.countries || []).find((x: any) => String(x.code).toUpperCase() === c.iso2.toUpperCase()) : null;
  let unrest: number | null = null, protests: number | null = null; const top: { name: string; url?: string }[] = [];
  if (pr.status === 'fulfilled') {
    const f = (pr.value.features || []).filter((e: any) => e.properties?.country && e.properties.country === c.fips);
    unrest = f.length; protests = f.filter((e: any) => e.properties.kind === 'protest').length;
    for (const e of f.sort((a: any, b: any) => (b.properties.articles || 0) - (a.properties.articles || 0)).slice(0, 5)) top.push({ name: String(e.properties.name || 'Unnamed location'), url: e.properties.url });
  }
  const nm = c.name.toLowerCase();
  const quakesIn = qk.status === 'fulfilled' ? (qk.value.features || []).filter((e: any) => String(e.properties?.place || '').toLowerCase().endsWith(nm)).slice(0, 8)
    .map((e: any) => ({ mag: Number(e.properties.mag), place: String(e.properties.place), time: new Date(e.properties.time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' })) : [];
  return { outage: o ? { critical: o.critical, warning: o.warning, last: String(o.last).slice(0, 16).replace('T', ' ') + ' UTC' } : null, unrest, protests, topUnrest: top, quakes: quakesIn, fetched: new Date().toISOString() };
}

/** A data-driven summary paragraph (≥150 words with the static context), different for every country. */
export function nowSummary(name: string, n: Now, risk: { score: number; band: string } | null, adv: { state?: number | null; fcdo?: string | null }): string[] {
  const t = n.fetched.slice(0, 16).replace('T', ' ');
  const p: string[] = [];
  p.push(`As of ${t} UTC, RemoteView's live feeds show ${n.unrest == null ? 'no conflict or unrest reporting available' : n.unrest === 0 ? 'no conflict-related or unrest events geolocated to ' + name + ' in the latest GDELT news window' : `${n.unrest} conflict-related or unrest event${n.unrest === 1 ? '' : 's'} geolocated to ${name} in the latest GDELT news window${n.protests ? `, ${n.protests} of them protests` : ''}`}. GDELT codes news reports automatically, so this count is an estimate of reported activity rather than a list of verified incidents.`);
  p.push(n.outage ? `Internet measurement from IODA (Georgia Tech) has flagged ${n.outage.critical} critical and ${n.outage.warning} warning-level connectivity alert${n.outage.critical + n.outage.warning === 1 ? '' : 's'} for ${name} in the last 24 hours, most recently at ${n.outage.last}. An alert means one or more signals (BGP routing, active probing or network telescope traffic) dropped below normal; it can be a regional or partial outage.` : `IODA (Georgia Tech) shows no internet outage alerts for ${name} in the last 24 hours, meaning BGP routing, active probing and telescope signals have stayed within their normal range.`);
  p.push(n.quakes.length ? `The USGS recorded ${n.quakes.length} earthquake${n.quakes.length === 1 ? '' : 's'} of magnitude 2.5 or more in or near ${name} in the past day, the largest M${Math.max(...n.quakes.map((x) => x.mag)).toFixed(1)}.` : `The USGS has recorded no magnitude 2.5+ earthquakes attributed to ${name} in the past day.`);
  p.push(risk ? `RemoteView's composite country risk estimate for ${name} is ${risk.score} out of 100 (${risk.band.toLowerCase()}), built from the OECD country risk category, the US State Department advisory level${adv.state != null ? ` (currently level ${adv.state})` : ''} and UK FCDO travel advice${adv.fcdo ? ` (${adv.fcdo})` : ''}. It is an estimate for orientation, not a credit rating or travel advice.` : `${name} is not covered by all three source lists behind RemoteView's composite risk estimate, so no score is shown; the individual advisories below still apply.`);
  return p;
}
