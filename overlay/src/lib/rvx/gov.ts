/* RemoteView extras: official country risk/advice sources.
   OECD Participants' Country Risk Classification (PDF), US State Dept travel advisories (RSS),
   UK FCDO travel advice (gov.uk content API, OGL). */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cached, getJson, getText } from './util';

const DAY = 24 * 3600_000;
function pdftotext(file: string): Promise<string> {
  return new Promise((res, rej) => execFile('pdftotext', ['-layout', file, '-'], { maxBuffer: 8 << 20, timeout: 30000 }, (e, out) => (e ? rej(e) : res(out))));
}
async function pdfText(url: string, name: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Mozilla/5.0 RemoteView' } });
  if (!r.ok) throw new Error(`${name} PDF HTTP ${r.status}`);
  const tmp = path.join(os.tmpdir(), `rv-${name}.pdf`); fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  return pdftotext(tmp);
}

export const OECD_URL = 'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/country-risk-classification/cre-crc-current-english.pdf';
export function parseOecd(text: string) {
  const asOf = (/Valid as of:\s*([0-9]{1,2} [A-Za-z]+ \d{4})/.exec(text) || [])[1] || null;
  const notes: Record<string, string> = {};
  for (const m of text.matchAll(/^\((\d)\)\s+(.+)$/gm)) if (!notes[m[1]]) notes[m[1]] = m[2].trim();
  const rows: { iso3: string; name: string; previous: string; current: string; notes: string[] }[] = [];
  for (const m of text.matchAll(/^\s*\d+\s+([A-Z]{3})\s+(.+?)\s{2,}(\d|-)\s+(\d|-)\s*((?:\(\d\)\s*)*)$/gm)) {
    rows.push({ iso3: m[1], name: m[2].trim(), previous: m[3], current: m[4], notes: [...m[5].matchAll(/\((\d)\)/g)].map((x) => x[1]) });
  }
  return { rows, asOf, notes };
}
export async function oecd() {
  return cached('oecd', DAY, async () => ({ ...parseOecd(await pdfText(OECD_URL, 'oecd')), url: OECD_URL, source: 'OECD — Country Risk Classifications of the Participants to the Arrangement (0 = lowest risk, 7 = highest)' }));
}

export async function stateDept() {
  return cached('state', DAY / 4, async () => {
    const x = await getText('https://travel.state.gov/_res/rss/TAsTWs.xml', 30000);
    const rows: { fips: string; title: string; level: number | null; label: string; date: string; url: string }[] = [];
    for (const it of x.split('<item>').slice(1)) {
      const t = (it.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      const lvl = (it.match(/<category domain="Threat-Level">([^<]*)<\/category>/) || [])[1] || '';
      const tag = (it.match(/<category domain="Country-Tag">([^<]*)<\/category>/) || [])[1] || '';
      const n = /Level (\d)/.exec(lvl);
      rows.push({ fips: tag, title: t, level: n ? Number(n[1]) : null, label: lvl, date: (it.match(/<pubDate>([^<]*)<\/pubDate>/) || [])[1] || '', url: (it.match(/<link>([^<]*)<\/link>/) || [])[1] || '' });
    }
    return { rows, url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html', source: 'US Department of State travel advisories (RSS)' };
  });
}

const LBL: Record<string, string> = {
  avoid_all_travel_to_whole_country: 'Against ALL travel (whole country)',
  avoid_all_but_essential_travel_to_whole_country: 'Against all but essential travel (whole country)',
  avoid_all_travel_to_parts: 'Against all travel to parts',
  avoid_all_but_essential_travel_to_parts: 'Against all but essential travel to parts',
};
export function fcdoLevel(st: string[]) {
  if (st.includes('avoid_all_travel_to_whole_country')) return 4;
  if (st.includes('avoid_all_but_essential_travel_to_whole_country')) return 3;
  if (st.length) return 2;
  return 1;
}
export async function fcdoAll() {
  return cached('fcdo-all', DAY, async () => {
    const idx = await getJson('https://www.gov.uk/api/content/foreign-travel-advice', { timeout: 20000 });
    const kids: any[] = idx.links?.children || [];
    const rows: { name: string; path: string; alerts: string[]; level: number; updated: string }[] = [];
    const conc = 12;
    for (let i = 0; i < kids.length; i += conc) {
      const batch = await Promise.all(kids.slice(i, i + conc).map(async (k) => {
        try {
          const d = await getJson('https://www.gov.uk/api/content' + k.base_path, { timeout: 15000 });
          const st: string[] = d.details?.alert_status || [];
          return { name: k.details?.country?.name || k.title.replace(/ travel advice$/i, ''), path: k.base_path, alerts: st.map((s) => LBL[s] || s), level: fcdoLevel(st), updated: d.public_updated_at };
        } catch { return { name: k.details?.country?.name || k.title.replace(/ travel advice$/i, ''), path: k.base_path, alerts: [], level: 1, updated: k.public_updated_at }; }
      }));
      rows.push(...batch);
    }
    return { rows, url: 'https://www.gov.uk/foreign-travel-advice', source: 'FCDO travel advice (gov.uk content API, OGL)', fetched: new Date().toISOString() };
  });
}
