/* Public SEO pages (commercial edition): commercially-fine sources only.
   Natural Earth (public domain) · World Bank WDI + WGI (CC BY 4.0) · OECD country risk ·
   US State Dept advisories (public domain) · UK FCDO (OGL v3) · CIA World Factbook final edition (public domain). */
import { countries, factbook, norm } from '@/lib/rvx/country';
import { cached, getJson } from '@/lib/rvx/util';

const DAY = 24 * 3600_000;
export const slugOf = (name: string) => norm(name).replace(/\s+/g, '-');

export type CountryRow = { slug: string; name: string; long: string; iso2: string; iso3: string; fips: string; bbox: number[]; geom: any };
export async function countryList(): Promise<CountryRow[]> {
  const { list } = await countries();
  const seen = new Set<string>();
  return list.filter((c) => c.name && c.iso3 && c.iso3 !== '-99').map((c) => ({ ...c, slug: slugOf(c.name) }))
    .filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true))).sort((a, b) => a.name.localeCompare(b.name));
}
export async function countryBySlug(slug: string) { return (await countryList()).find((c) => c.slug === slug) || null; }

const WDI = { 'SP.POP.TOTL': 'Population', 'NY.GDP.PCAP.CD': 'GDP per capita (current US$)', 'NY.GDP.MKTP.KD.ZG': 'GDP growth (annual %)' } as const;
const WGI = { 'GOV_WGI_VA.EST': 'Voice and accountability', 'GOV_WGI_PV.EST': 'Political stability / absence of violence', 'GOV_WGI_GE.EST': 'Government effectiveness', 'GOV_WGI_RQ.EST': 'Regulatory quality', 'GOV_WGI_RL.EST': 'Rule of law', 'GOV_WGI_CC.EST': 'Control of corruption' } as const;
type Ind = { code: string; label: string; value: number | null; year: string | null };
async function wb(iso3: string, codes: Record<string, string>, source: number): Promise<Ind[]> {
  return cached(`wb-${source}-${iso3}`, 7 * DAY, async () => Promise.all(Object.entries(codes).map(async ([code, label]) => {
    try {
      const d: any = await getJson(`https://api.worldbank.org/v2/country/${iso3}/indicator/${code}?format=json&source=${source}&mrnev=1`, { timeout: 15000 });
      const r = Array.isArray(d) ? (d[1] || [])[0] : null;
      return { code, label, value: r?.value ?? null, year: r?.date ?? null };
    } catch { return { code, label, value: null, year: null }; }
  })));
}

export async function countryData(c: CountryRow) {
  const { QUEUE } = await import('@/lib/rvx/queue');
  const [risk, wdi, wgi, fb] = await Promise.allSettled([
    QUEUE['risk-score'](new URLSearchParams()),
    wb(c.iso3, WDI as any, 2), wb(c.iso3, WGI as any, 3), factbook(c.fips, c.iso2),
  ]);
  const rf = risk.status === 'fulfilled' ? (risk.value.features || []).find((f: any) => f.properties?.iso2 === c.iso2 || f.properties?.name === c.name) : null;
  const p = rf?.properties || null;
  const f: any = fb.status === 'fulfilled' ? fb.value : null;
  return {
    risk: p && p.score >= 0 ? { score: p.score as number, parts: p.parts || {} } : null,
    riskMeta: risk.status === 'fulfilled' ? risk.value.meta : null,
    wdi: wdi.status === 'fulfilled' ? wdi.value : [],
    wgi: wgi.status === 'fulfilled' ? wgi.value : [],
    factbook: f?.available ? f : null,
    fetched: new Date().toISOString(),
  };
}

/** Country outline as an SVG path (equirectangular, fitted to the bbox). Natural Earth, public domain. */
export function outlinePath(c: CountryRow, w = 320, h = 200, pad = 10) {
  // Fit to the main landmass (largest ring by bbox area) so overseas territories don't shrink it to a dot.
  let best = c.bbox, area = -1;
  for (const poly of c.geom) {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const ar = (x1 - x0) * (y1 - y0); if (ar > area) { area = ar; best = [x0, y0, x1, y1]; }
  }
  let [a, b, cc, d] = best;
  { const mx = (cc - a) * 0.08 + 0.2, my = (d - b) * 0.08 + 0.2; a -= mx; cc += mx; b -= my; d += my; }
  if (cc - a > 180) { a = -180; cc = 180; } // antimeridian countries: show full width
  const sx = (w - 2 * pad) / Math.max(cc - a, 0.01), sy = (h - 2 * pad) / Math.max(d - b, 0.01);
  const s = Math.min(sx, sy), ox = (w - (cc - a) * s) / 2, oy = (h - (d - b) * s) / 2;
  let out = '';
  for (const poly of c.geom) for (const ring of poly) {
    out += ring.map(([x, y]: number[], i: number) => `${i ? 'L' : 'M'}${(ox + (x - a) * s).toFixed(1)} ${(oy + (d - y) * s).toFixed(1)}`).join('') + 'Z';
  }
  return out;
}

export const riskBand = (s: number) => (s >= 70 ? ['Very high', '#ef4444'] : s >= 50 ? ['High', '#f97316'] : s >= 30 ? ['Elevated', '#eab308'] : s >= 15 ? ['Moderate', '#22d3ee'] : ['Low', '#2dd4bf']) as [string, string];
export const fmtNum = (v: number | null, code: string) => v == null ? '—' : code === 'SP.POP.TOTL' ? Math.round(v).toLocaleString('en-US') : code.endsWith('.EST') ? (v > 0 ? '+' : '') + v.toFixed(2) : code === 'NY.GDP.PCAP.CD' ? '$' + Math.round(v).toLocaleString('en-US') : v.toFixed(1) + '%';

/** World land outline for a bbox (Natural Earth 1:110m, public domain), as one SVG path. */
export async function worldPath(bbox: [number, number, number, number], w = 640, h = 320) {
  const { list } = await countries();
  const [a, b, c, d] = bbox; const sx = w / (c - a), sy = h / (d - b);
  let out = '';
  for (const k of list) {
    const [x0, y0, x1, y1] = k.bbox; if (x1 < a || x0 > c || y1 < b || y0 > d) continue;
    for (const poly of k.geom) {
      let last = '', seg = '';
      for (const [x, y] of poly[0]) { const px = Math.round((x - a) * sx), py = Math.round((d - y) * sy), k2 = px + ' ' + py; if (k2 === last) continue; seg += (seg ? 'L' : 'M') + k2; last = k2; }
      out += seg + 'Z';
    }
  }
  return out;
}
