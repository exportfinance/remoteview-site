/* RemoteView extras: country dossier sources — CIA World Factbook (archived mirror),
   UKEF country cover policy (gov.uk, OGL) and EXIM Country Limitation Schedule (exim.gov). */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cached, getJson, getText } from './util';

const DAY = 24 * 3600_000;
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ').trim();
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+|,?\s*the$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ── Countries (Natural Earth 1:110m, public domain) ───────── */
type NE = { name: string; long: string; iso2: string; fips: string; bbox: number[]; geom: any };
export async function countries(): Promise<{ list: NE[]; geo: any }> {
  return cached('ne110', 7 * DAY, async () => {
    const d = await getJson('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson', { timeout: 30000 });
    const list: NE[] = []; const feats: any[] = [];
    for (const f of d.features) {
      const p = f.properties; const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      let a = 180, b = 90, c = -180, e = -90;
      for (const poly of polys) for (const [x, y] of poly[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y); }
      const iso2 = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
      list.push({ name: p.NAME, long: p.NAME_LONG, iso2, fips: p.FIPS_10, bbox: [a, b, c, e], geom: polys });
      feats.push({ type: 'Feature', geometry: g, properties: { name: p.NAME, iso2 } });
    }
    return { list, geo: { type: 'FeatureCollection', features: feats } };
  });
}
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export async function countryAt(lng: number, lat: number) {
  const { list } = await countries();
  for (const c of list) {
    const [a, b, cc, d] = c.bbox; if (lng < a || lng > cc || lat < b || lat > d) continue;
    for (const poly of c.geom) if (inRing(lng, lat, poly[0]) && !poly.slice(1).some((h: number[][]) => inRing(lng, lat, h))) return c;
  }
  return null;
}

/* ── CIA World Factbook (discontinued 4 Feb 2026; public-domain mirror) ── */
const FB_FIX: Record<string, string> = { NO: 'no', IL: 'is', PS: 'we', SS: 'od' };
async function fbIndex(): Promise<{ byCode: Record<string, string>; asOf: string | null }> {
  return cached('fb-index', 7 * DAY, async () => {
    const t = await getJson('https://api.github.com/repos/factbook/factbook.json/git/trees/master?recursive=1', { timeout: 20000 });
    const byCode: Record<string, string> = {};
    for (const n of t.tree || []) { const m = /^([a-z-]+)\/([a-z]{2})\.json$/.exec(n.path); if (m) byCode[m[2]] = n.path; }
    const c = await getJson('https://api.github.com/repos/factbook/factbook.json/commits?path=europe/uk.json&per_page=1').catch(() => null);
    return { byCode, asOf: c?.[0]?.commit?.committer?.date ?? null };
  });
}
const tx = (o: any): string | undefined => (o == null ? undefined : typeof o === 'string' ? o : o.text ? strip(o.text) : undefined);
function pick(sec: any, keys: string[]) {
  const out: Record<string, string> = {};
  if (!sec) return out;
  for (const k of keys) {
    const v = sec[k]; if (!v) continue;
    const t = tx(v) ?? Object.entries(v).filter(([kk]) => kk !== 'note').map(([kk, vv]) => `${kk}: ${tx(vv) ?? ''}`).join('; ');
    if (t) out[k] = t.length > 600 ? t.slice(0, 597) + '…' : t;
  }
  return out;
}
export async function factbook(fips: string, iso2: string) {
  const idx = await fbIndex();
  const code = (FB_FIX[iso2] || fips || '').toLowerCase();
  const p = idx.byCode[code];
  if (!p) return { available: false, reason: 'No Factbook entry matched', asOf: idx.asOf };
  const d = await cached('fb-' + code, 7 * DAY, () => getJson(`https://raw.githubusercontent.com/factbook/factbook.json/master/${p}`, { timeout: 20000 }));
  return {
    available: true, code, asOf: idx.asOf,
    source: 'CIA World Factbook (public domain) — final edition via github.com/factbook/factbook.json; CIA discontinued the Factbook on 4 Feb 2026',
    url: `https://github.com/factbook/factbook.json/blob/master/${p}`,
    flag: iso2 && iso2 !== '-99' ? `https://flagcdn.com/w80/${iso2.toLowerCase()}.png` : null, flag_source: 'flagcdn.com (public-domain flag images)',
    government: pick(d.Government, ['Country name', 'Government type', 'Capital', 'Chief of state', 'Head of government', 'Legislative branch']),
    people: pick(d['People and Society'], ['Population', 'Languages', 'Religions', 'Median age']),
    economy: pick(d.Economy, ['Real GDP (purchasing power parity)', 'GDP (official exchange rate)', 'Real GDP growth rate', 'Real GDP per capita', 'Inflation rate (consumer prices)', 'Industries', 'Exports', 'Exports - commodities', 'Exports - partners']),
    military: pick(d['Military and Security'], ['Military and security forces', 'Military expenditures', 'Military and security service personnel strengths']),
    energy: pick(d.Energy, ['Electricity access', 'Electricity', 'Crude oil', 'Natural gas']),
    transnational: pick(d['Transnational Issues'], ['Refugees and internally displaced persons', 'Illicit drugs', 'Trafficking in persons']),
  };
}

/* ── UKEF country cover policy (gov.uk, Open Government Licence) ── */
export type Ukef = { name: string; slug: string; appetite: string; short: string; mlt: string; notes: string[]; status: 'on' | 'partial' | 'off' | 'contact' | 'unknown' };
export async function ukefAll() {
  return cached('ukef', DAY, async () => {
    const d = await getJson('https://www.gov.uk/api/content/guidance/country-cover-policy-and-indicators', { timeout: 25000 });
    const body: string = d.details?.body || '';
    const parts = body.split(/<h3 id="([^"]+)">([\s\S]*?)<\/h3>/);
    const rows: Ukef[] = []; let unparsed = 0;
    for (let i = 1; i < parts.length; i += 3) {
      const slug = parts[i], name = strip(parts[i + 1]), seg = parts[i + 2];
      const cols = [...seg.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
      const tr = /<th scope="row">Cover policy<\/th>([\s\S]*?)<\/tr>/.exec(seg);
      if (!tr || cols.join('|') !== 'Market risk appetite|Cash or short term cover|Medium or long term cover') { unparsed++; continue; }
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
      if (tds.length !== 3) { unparsed++; continue; }
      const after = seg.split('</table>')[1] || '';
      const notes = [...after.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter(Boolean).slice(0, 6);
      const [appetite, short, mlt] = tds;
      const yes = (s: string) => /^yes/i.test(s), no = (s: string) => /^no/i.test(s);
      const status: Ukef['status'] = /off cover/i.test(appetite) || (no(short) && no(mlt)) ? 'off' : yes(short) && yes(mlt) ? 'on' : yes(short) || yes(mlt) ? 'partial' : /contact/i.test(appetite + short + mlt) ? 'contact' : 'unknown';
      rows.push({ name, slug, appetite, short, mlt, notes, status });
    }
    return { rows, updated: d.public_updated_at, url: 'https://www.gov.uk/guidance/country-cover-policy-and-indicators', unparsed, licence: 'Open Government Licence v3.0',
      note: 'The gov.uk page gives market risk appetite plus short-term and medium/long-term cover only; it does not publish sovereign/public/private splits or OECD risk categories.' };
  });
}

/* ── EXIM Country Limitation Schedule (exim.gov PDF) ───────── */
export type Exim = { name: string; public: { st: boolean; mt: boolean; lt: boolean }; private: { st: boolean; mt: boolean; lt: boolean }; notes: string[]; status: 'on' | 'partial' | 'off' };
function pdftotext(file: string): Promise<string> {
  return new Promise((res, rej) => execFile('pdftotext', ['-layout', file, '-'], { maxBuffer: 8 << 20, timeout: 30000 }, (e, out) => (e ? rej(e) : res(out))));
}
export function parseCls(text: string) {
  const lines = text.split('\n');
  const asOf = (/AS OF ([A-Z]+ \d{1,2}, \d{4})/.exec(text) || /EFFECTIVE ([A-Za-z]+ \d{1,2}, \d{4})/.exec(text) || [])[1] || null;
  const rows: Exim[] = []; let unreliable: string[] = [];
  let cols: number[] | null = null; let notesCol = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/COUNTRY\s+Up to 1\s+1 to 7\s+Over 7/.test(l)) {
      cols = []; let k = -1;
      for (const re of [/Up to 1/g, /1 to 7/g, /Over 7/g]) { re.lastIndex = 0; let m; while ((m = re.exec(l))) cols.push(m.index + m[0].length / 2); k++; }
      cols.sort((a, b) => a - b); notesCol = l.indexOf('NOTE'); i++; continue;
    }
    if (!cols || cols.length !== 6) continue;
    if (/^\s*$/.test(l) || /^\s{20,}/.test(l)) { if (/^\s*-\d+-\s*$/.test(l) || /EXPORT-IMPORT BANK/.test(l)) cols = null; continue; }
    if (/^\s*\*|^\s*Effective Date|^\s*Note:|^NOTES/i.test(l)) { cols = null; continue; }
    const m = /^(\S.*?)(\s{2,}|$)/.exec(l); if (!m) continue;
    const name = m[1].trim(); if (name.length > 45) continue;
    const rest = l.slice(name.length);
    const noteMatch = /([0-9][0-9a-z, ]*)\s*$/.exec(rest);
    const notes = noteMatch && l.length - noteMatch[0].length >= notesCol - 12 ? noteMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    const xs: number[] = []; for (let j = name.length; j < l.length; j++) if (l[j] === 'X' && (l[j - 1] === ' ') && (l[j + 1] === ' ' || l[j + 1] === undefined)) xs.push(j);
    const blocked = [false, false, false, false, false, false]; let bad = false;
    for (const x of xs) { let best = -1, dist = 99; cols.forEach((c, ci) => { const dd = Math.abs(c - x); if (dd < dist) { dist = dd; best = ci; } }); if (dist > 6) bad = true; else blocked[best] = true; }
    if (bad) { unreliable.push(name); continue; }
    const pub = { st: !blocked[0], mt: !blocked[1], lt: !blocked[2] }, pri = { st: !blocked[3], mt: !blocked[4], lt: !blocked[5] };
    const n = blocked.filter(Boolean).length;
    rows.push({ name, public: pub, private: pri, notes, status: n === 0 ? 'on' : n === 6 ? 'off' : 'partial' });
  }
  // footnotes
  const fn: Record<string, string> = {};
  const nt = text.split(/\n(?=\d{1,2}[a-z]?\.\s{2,})/);
  for (const blk of nt.slice(1)) { const mm = /^(\d{1,2}[a-z]?)\.\s+([\s\S]*)/.exec(blk); if (mm) fn[mm[1]] = mm[2].split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 700); }
  return { rows, asOf, footnotes: fn, unreliable };
}
export async function eximAll() {
  return cached('exim', DAY, async () => {
    const page = await getText('https://www.exim.gov/tools-for-exporters/country-limitation-schedule', 25000);
    const pdf = (/href="(https:\/\/img\.exim\.gov\/[^"]*countrylimitationschedule\/cls(?!memo)[^"]*\.pdf)"/i.exec(page) || [])[1];
    if (!pdf) throw new Error('CLS PDF link not found on exim.gov');
    const r = await fetch(pdf, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Mozilla/5.0 RemoteView' } });
    if (!r.ok) throw new Error('CLS PDF HTTP ' + r.status);
    const tmp = path.join(os.tmpdir(), 'rv-cls.pdf'); fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    const text = await pdftotext(tmp);
    const parsed = parseCls(text);
    return { ...parsed, pdf, url: 'https://www.exim.gov/tools-for-exporters/country-limitation-schedule',
      note: 'The CLS splits cover by public vs private sector risk and by term (up to 1 yr / 1-7 yrs / over 7 yrs); "X" = not available. It has no separate sovereign column — sovereign conditions appear in the footnotes.' };
  });
}

/* name matching between Natural Earth, UKEF and EXIM spellings */
const ALIAS: Record<string, string[]> = {
  'united states of america': ['united states'], 'czechia': ['czech republic'], 'myanmar': ['burma'], 'dem rep congo': ['democratic republic of the congo', 'congo democratic republic of', 'congo dem rep', 'democratic republic of congo'],
  'congo': ['congo republic of', 'republic of the congo', 'congo rep'], 'cote d ivoire': ['ivory coast', 'cote divoire'], 'eswatini': ['swaziland', 'eswatini swaziland'],
  'bosnia and herz': ['bosnia and herzegovina', 'bosnia herzegovina'], 'central african rep': ['central african republic'], 'dominican rep': ['dominican republic'],
  's sudan': ['south sudan'], 'eq guinea': ['equatorial guinea'], 'solomon is': ['solomon islands'], 'n cyprus': ['northern cyprus'], 'w sahara': ['western sahara'],
  'south korea': ['korea south', 'korea republic of', 'republic of korea'], 'north korea': ['korea north', 'korea democratic people s republic of'], 'laos': ['lao pdr', 'lao people s democratic republic'],
  'gambia': ['gambia the'], 'bahamas': ['bahamas the'], 'timor leste': ['east timor'], 'macedonia': ['north macedonia'], 'turkey': ['turkiye'], 'palestine': ['west bank and gaza', 'occupied palestinian territories'],
  'falkland is': ['falkland islands'], 'fr s antarctic lands': ['french southern territories'], 'vietnam': ['viet nam'], 'russia': ['russian federation'], 'taiwan': ['taiwan province of china'],
};
export function matchName<T extends { name: string }>(rows: T[], neName: string, neLong: string): T | undefined {
  const keys = new Set([norm(neName), norm(neLong), ...(ALIAS[norm(neName)] || []), ...(ALIAS[norm(neLong)] || [])]);
  return rows.find((r) => keys.has(norm(r.name)));
}

export async function coverLayer(which: 'ukef' | 'exim') {
  const [{ list, geo }, src] = await Promise.all([countries(), which === 'ukef' ? ukefAll() : eximAll()]);
  const rows: any[] = (src as any).rows;
  const features = geo.features.map((f: any, i: number) => {
    const c = list[i]; const r = matchName(rows, c.name, c.long);
    return { ...f, properties: { ...f.properties, status: r?.status || 'nodata' } };
  });
  return { type: 'FeatureCollection', features, meta: { source: which === 'ukef' ? 'UKEF country cover policy (gov.uk, OGL)' : 'EXIM Country Limitation Schedule (exim.gov)', fetched: new Date().toISOString(), updated: which === 'ukef' ? (src as any).updated : (src as any).asOf, matched: features.filter((f: any) => f.properties.status !== 'nodata').length } };
}

export async function dossier(lng: number, lat: number) {
  const c = await countryAt(lng, lat);
  if (!c) return { country: null };
  const [fb, uk, ex] = await Promise.allSettled([factbook(c.fips, c.iso2), ukefAll(), eximAll()]);
  const ukv = uk.status === 'fulfilled' ? uk.value : null; const exv = ex.status === 'fulfilled' ? ex.value : null;
  const exRow = exv ? matchName(exv.rows, c.name, c.long) : undefined;
  return {
    country: { name: c.long || c.name, iso2: c.iso2 },
    factbook: fb.status === 'fulfilled' ? fb.value : { available: false, reason: (fb.reason as Error).message },
    ukef: ukv ? { row: matchName(ukv.rows, c.name, c.long) || null, updated: ukv.updated, url: ukv.url, note: ukv.note } : { error: (uk as PromiseRejectedResult).reason?.message },
    exim: exv ? { row: exRow || null, footnotes: exRow ? Object.fromEntries(exRow.notes.map((n) => [n, exv.footnotes[n] || ''])) : {}, asOf: exv.asOf, url: exv.url, pdf: exv.pdf, note: exv.note } : { error: (ex as PromiseRejectedResult).reason?.message },
  };
}
