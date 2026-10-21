/* Official government sanctions lists (commercial edition replacement for OpenSanctions).
   - US Treasury OFAC SDN list (public domain):   sanctionslistservice.ofac.treas.gov SDN.CSV
   - UK Sanctions List (FCDO, OGL v3):             sanctionslist.fcdo.gov.uk UK-Sanctions-List.csv
   - EU consolidated financial sanctions list:     webgate.ec.europa.eu FSF csvFullSanctionsList_1_1
   Each is streamed row-by-row and reduced to one entry per designated target. */
import type { SanctionEntry } from './sanctions';

export const OFFICIAL_SOURCES = {
  ofac: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV',
  uk: 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
  eu: 'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
};

/** Streaming CSV parser: calls onRow for each record (handles quotes, embedded newlines). */
async function streamCsv(url: string, delim: string, onRow: (r: string[]) => void, timeoutMs = 90_000) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'RemoteView/1.0' } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${new URL(url).hostname}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder('utf-8');
  let field = '', row: string[] = [], q = false, pendingQuote = false;
  for (;;) {
    const { value, done } = await reader.read();
    const text = done ? '' : dec.decode(value, { stream: true });
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (pendingQuote) { pendingQuote = false; if (c === '"') { field += '"'; continue; } q = false; }
      if (q) { if (c === '"') pendingQuote = true; else field += c; continue; }
      if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); onRow(row); row = []; field = ''; }
      else if (c !== '\r' && c !== '\uFEFF') field += c;
    }
    if (done) break;
  }
  if (field || row.length) { row.push(field); onRow(row); }
}

const clean = (s: string) => (s || '').replace(/^-0-\s*$/, '').trim();

async function loadOfac(): Promise<SanctionEntry[]> {
  const out: SanctionEntry[] = [];
  // ent_num, SDN_Name, SDN_Type, Program, Title, Call_Sign, Vess_type, Tonnage, GRT, Vess_flag, Vess_owner, Remarks
  await streamCsv(OFFICIAL_SOURCES.ofac, ',', (r) => {
    if (r.length < 4 || !/^\d+$/.test(r[0].trim())) return;
    const type = clean(r[2]).toLowerCase();
    const remarks = clean(r[11] || '');
    const aliases = [...remarks.matchAll(/a\.k\.a\.\s*'([^']+)'/gi)].map((m) => m[1]);
    out.push({
      id: 'ofac-' + r[0].trim(), schema: type === 'individual' ? 'Person' : type === 'vessel' ? 'Vessel' : type === 'aircraft' ? 'Airplane' : 'Organization',
      name: clean(r[1]), aliases, countries: [], programs: clean(r[3]).split(/[\]\[;\s]+/).filter(Boolean),
      sanctions: 'US OFAC SDN',
    });
  });
  return out;
}

async function loadUk(): Promise<SanctionEntry[]> {
  const by = new Map<string, SanctionEntry>();
  let h: string[] | null = null;
  let ix: Record<string, number> = {};
  await streamCsv(OFFICIAL_SOURCES.uk, ',', (r) => {
    if (!h) { if (r.includes('Unique ID')) { h = r; r.forEach((k, i) => (ix[k] = i)); } return; }
    const id = r[ix['Unique ID']]; if (!id) return;
    const name = [1, 2, 3, 4, 5, 6].map((n) => r[ix['Name ' + n]] || '').filter(Boolean).join(' ').trim() || r[ix['Name 6']];
    const dtype = (r[ix['Designation Type']] || '').toLowerCase();
    const countries = [r[ix['Nationality(/ies)']], r[ix['Address Country']]].filter(Boolean).flatMap((s) => s.split(/[,;]/)).map((s) => s.trim()).filter(Boolean);
    let e = by.get(id);
    if (!e) {
      e = { id: 'uk-' + id, schema: dtype === 'individual' ? 'Person' : dtype === 'ship' ? 'Vessel' : 'Organization', name, aliases: [], countries: [], programs: [r[ix['Regime Name']] || ''].filter(Boolean), sanctions: 'UK Sanctions List (FCDO)' };
      by.set(id, e);
    }
    const primary = (r[ix['Name type']] || '').toLowerCase().startsWith('primary');
    if (primary && name) e.name = name; else if (name && name !== e.name && !e.aliases.includes(name)) e.aliases.push(name);
    for (const c of countries) if (!e.countries.includes(c)) e.countries.push(c);
  });
  return [...by.values()];
}

async function loadEu(): Promise<SanctionEntry[]> {
  const by = new Map<string, SanctionEntry>();
  let ix: Record<string, number> | null = null;
  await streamCsv(OFFICIAL_SOURCES.eu, ';', (r) => {
    if (!ix) { ix = {}; r.forEach((k, i) => (ix![k.trim()] = i)); return; }
    const id = r[ix['Entity_LogicalId']]; if (!id) return;
    const name = (r[ix['NameAlias_WholeName']] || '').trim();
    let e = by.get(id);
    if (!e) {
      const st = (r[ix['Entity_SubjectType']] || '').toLowerCase();
      e = { id: 'eu-' + id, schema: st === 'person' ? 'Person' : 'Organization', name, aliases: [], countries: [], programs: [r[ix['Entity_Regulation_Programme']] || ''].filter(Boolean), sanctions: 'EU consolidated financial sanctions list' };
      by.set(id, e);
    } else if (name && name !== e.name && !e.aliases.includes(name)) e.aliases.push(name);
    if (!e.name && name) e.name = name;
    for (const k of ['Address_CountryIso2Code', 'Citizenship_CountryIso2Code']) {
      const c = (r[ix[k]] || '').trim().toUpperCase();
      if (c && c !== '00' && !e.countries.includes(c)) e.countries.push(c);
    }
  });
  return [...by.values()].filter((e) => e.name);
}

export async function loadOfficialEntries(): Promise<{ entries: SanctionEntry[]; sources: { id: string; count: number; error?: string; url: string }[] }> {
  const jobs: [string, () => Promise<SanctionEntry[]>][] = [['ofac', loadOfac], ['uk', loadUk], ['eu', loadEu]];
  const results = await Promise.allSettled(jobs.map(([, f]) => f()));
  const entries: SanctionEntry[] = [];
  const sources = results.map((r, i) => {
    const id = jobs[i][0];
    const url = (OFFICIAL_SOURCES as any)[id];
    if (r.status === 'fulfilled') { entries.push(...r.value); return { id, count: r.value.length, url }; }
    return { id, count: 0, error: (r.reason as Error)?.message, url };
  });
  if (!entries.length) throw new Error('All official sanctions lists failed: ' + sources.map((s) => s.error).join('; '));
  return { entries, sources };
}
