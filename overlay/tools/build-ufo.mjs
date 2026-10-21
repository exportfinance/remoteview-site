// Build-time: fetch the public NUFORC sighting reports (TidyTuesday 2023-06-20 mirror)
// and write compact per-year JSON files to public/data/ufo/. Failure is non-fatal.
import fs from 'node:fs';
const BASE = 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2023/2023-06-20/';
const OUT = 'public/data/ufo';
function parseCsv(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const unesc = (s) => s.replace(/&#44;?/g, ',').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
try {
  const [u, p] = await Promise.all(['ufo_sightings.csv', 'places.csv'].map((f) => fetch(BASE + f).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); })));
  const pl = new Map(parseCsv(p).map((r) => [`${r.city}|${r.state}|${r.country_code}`, [+(+r.longitude).toFixed(3), +(+r.latitude).toFixed(3)]]));
  const years = {}; let n = 0, miss = 0;
  for (const r of parseCsv(u)) {
    const ll = pl.get(`${r.city}|${r.state}|${r.country_code}`); if (!ll) { miss++; continue; }
    const d = (r.reported_date_time_utc || '').slice(0, 10); const y = d.slice(0, 4); if (!/^\d{4}$/.test(y)) continue;
    let s = unesc(r.summary === 'NA' ? '' : r.summary).trim(); if (s.length > 140) s = s.slice(0, 137) + '…';
    (years[y] ||= []).push([ll[0], ll[1], d, r.shape === 'NA' ? '' : r.shape, `${r.city}, ${r.state}, ${r.country_code}`, r.reported_duration === 'NA' ? '' : r.reported_duration, s]);
    n++;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const idx = {};
  for (const [y, v] of Object.entries(years)) { v.sort((a, b) => a[2].localeCompare(b[2])); fs.writeFileSync(`${OUT}/${y}.json`, JSON.stringify(v)); idx[y] = v.length; }
  fs.writeFileSync(`${OUT}/index.json`, JSON.stringify({ source: 'NUFORC public sighting reports via TidyTuesday 2023-06-20 (github.com/rfordatascience/tidytuesday), geocoded with its places.csv', note: 'Unverified public reports', records: n, unmatched_places: miss, built: new Date().toISOString(), years: idx }));
  console.log(`[ufo] ${n} records, ${Object.keys(idx).length} years`);
} catch (e) { console.warn('[ufo] skipped:', e.message); }
