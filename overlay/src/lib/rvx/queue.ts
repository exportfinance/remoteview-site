/* RemoteView extras: features 33–49 (skipping those already covered elsewhere).
   Free public sources only; never invents coordinates or numbers. */
import { cached, getJson, getText, fc, pt, selfJson } from './util';
import { IS_COMMERCIAL } from '@/lib/edition';
import { S, ensureAis } from './live';
import { riskLayer, countries, norm } from './country';
function shipKind(t?: number | string): string {
  const n = Number(t);
  if (!n) return 'unknown';
  if (n >= 80 && n <= 89) return 'tanker';
  if (n >= 70 && n <= 79) return 'cargo';
  if (n >= 60 && n <= 69) return 'passenger';
  if (n === 30) return 'fishing';
  if (n === 35) return 'military';
  return 'other';
}

type Q = URLSearchParams;
const n = (v: string | null, d: number) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const meta = (source: string, extra: Record<string, unknown> = {}) => ({ source, fetched: new Date().toISOString(), ...extra });
const R = 6371;
const distKm = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/* Exchange / market pin locations (approximate city centres). */
const MKT_PIN: Record<string, { lng: number; lat: number; place: string }> = {
  indices: { lng: -74.0, lat: 40.75, place: 'New York' },
  stocks: { lng: -77.04, lat: 38.9, place: 'Washington DC area (defense primes)' },
  oil: { lng: -95.36, lat: 29.76, place: 'Houston' },
  commodities: { lng: -87.63, lat: 41.88, place: 'Chicago' },
  crypto: { lng: -122.42, lat: 37.77, place: 'San Francisco' },
  fx: { lng: -0.12, lat: 51.51, place: 'London' },
};

const JET_TYPES = /\b(GLEX|GLF[456]|G[456]\d{2}|CL60|CL35|CL30|FA7X|FA8X|FA50|C750|C68A|C56X|C25B|E55P|E35L|HDJT|GALX|LJ60|LJ45|PC24|PC12)\b/i;
const NOTABLE_CS = /^(N[0-9]+[A-Z]?|G-[A-Z]{4}|M-[A-Z]{4}|VP-B|VQ-B|P4-|LX-|OE-|D-A)/i;

async function flightsPayload() {
  return selfJson<any>('/api/flights', 45000).catch(() => null);
}

/** 33 — notable private jets from live ADS-B classification. */
async function jets() {
  const d = await flightsPayload();
  const list = d?.private_jets || [];
  const feats = list.filter((f: any) => {
    const t = String(f.type || f.aircraft_type || f.model || '');
    const cs = String(f.callsign || '');
    return JET_TYPES.test(t) || (f.category === 'jet' && NOTABLE_CS.test(cs)) || /GLEX|GLF|G650|G700|Global|Gulfstream|Falcon|Citation X/i.test(t + ' ' + cs);
  }).slice(0, 500).map((f: any) => pt(f.lng, f.lat, {
    name: f.callsign || f.icao24, kind: 'private_jet', hex: f.icao24, type: f.type || f.aircraft_type || '',
    alt: f.alt || f.altitude, speed: f.speed || f.gs, country: f.country || '',
  }));
  return {
    ...fc(feats),
    meta: meta('RemoteView /api/flights private_jets — type/callsign heuristics for bizjets (not ownership claims)', {
      total_private_jets: list.length, notable: feats.length,
    }),
  };
}

/** 34 — election / coup watch: Wikipedia 2026 elections + GDELT political violence. */
async function elections() {
  return cached('elections', 6 * 3600_000, async () => {
    const j = await getJson('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_elections_in_2026&prop=wikitext&format=json', { timeout: 25000 });
    const wt: string = j.parse?.wikitext?.['*'] || '';
    const titles = [...wt.matchAll(/\[\[(2026 [^\]|]+?(?:election|referendum|selection)[^\]|]*)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]);
    const { list } = await countries();
    const feats: any[] = [];
    const seen = new Set<string>();
    for (const title of titles) {
      if (seen.has(title)) continue; seen.add(title);
      const bare = title.replace(/^2026\s+/, '').replace(/\s+(parliamentary|presidential|general|legislative|federal|state|local|municipal|constitutional)\s+/i, ' ');
      const countryBit = bare.replace(/\s+(election|referendum|selection).*$/i, '').trim();
      const hit = list.find((c) => c.name.toLowerCase() === countryBit.toLowerCase()
        || c.long.toLowerCase() === countryBit.toLowerCase()
        || c.name.toLowerCase().startsWith(countryBit.toLowerCase().split(/\s+/)[0])
        || new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(countryBit)
        || new RegExp(countryBit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(c.long));
      // adjective forms: "Algerian" → Algeria via startswith stem
      let c = hit;
      if (!c) {
        const stem = countryBit.replace(/(ian|an|ese|ish|i|ic)$/i, '');
        c = list.find((x) => x.name.toLowerCase().startsWith(stem.toLowerCase().slice(0, 5))) || undefined;
      }
      if (!c) continue;
      const [a, b, cc, d] = c.bbox;
      feats.push(pt((a + cc) / 2, (b + d) / 2, {
        name: title, kind: /referendum/i.test(title) ? 'referendum' : 'election', country: c.name, iso2: c.iso2,
        url: 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_'),
      }));
    }
    let coups: any[] = [];
    try {
      const g = await selfJson('/api/gdelt-events?limit=1500');
      coups = (g.events || []).filter((e: any) => {
        const code = String(e.event_code || '');
        const root = String(e.root_code || '');
        return root === '18' || root === '19' || code.startsWith('172') || code.startsWith('194') || code.startsWith('182');
      }).slice(0, 80).map((e: any) => pt(e.lng, e.lat, {
        name: e.name || 'Political violence', kind: 'coup_watch', code: e.event_code, country: e.country, url: e.url, date: e.date, articles: e.articles,
      }));
    } catch { /* gdelt optional */ }
    return {
      ...fc([...feats, ...coups]),
      meta: meta('Wikipedia List of elections in 2026 (CC BY-SA) + GDELT 2.0 events (CAMEO 18/19/172*/194* political violence — not confirmed coups)', {
        elections_mapped: feats.length, violence_pins: coups.length, note: 'Election pins are country centroids from Natural Earth; violence pins are GDELT ActionGeo',
      }),
    };
  });
}

/** 35 — chokepoint monitor as map points (API already existed). */
async function chokepointLayer() {
  const d = await selfJson('/api/rvx/chokepoints');
  const feats = (d.chokepoints || []).map((c: any) => {
    const [a, b, cc, dd] = c.bbox;
    return pt((a + cc) / 2, (b + dd) / 2, {
      name: c.name, kind: 'chokepoint', total: c.total, waiting_or_slow: c.waiting_or_slow, tankers: c.tankers, delay_index: c.delay_index, id: c.id,
    });
  });
  return { ...fc(feats), meta: d.meta || meta('aisstream.io (derived chokepoints)') };
}

/** 36 — commodity flows by ship type (AIS aggregates + chokepoint tankers). */
async function commodity() {
  ensureAis();
  const now = Date.now();
  const counts: Record<string, number> = {};
  const samples: any[] = [];
  for (const v of S.ships.values()) {
    if (!v.t || now - v.t > 30 * 60_000 || typeof v.lat !== 'number') continue;
    const k = /\bLNG\b/i.test(v.name || '') ? 'lng' : shipKind(v.type);
    counts[k] = (counts[k] || 0) + 1;
    if ((k === 'tanker' || k === 'lng' || k === 'cargo') && samples.length < 400) {
      samples.push(pt(v.lng, v.lat, { name: v.name || v.mmsi, kind: k, sog: v.sog, mmsi: v.mmsi }));
    }
  }
  const choke = await selfJson('/api/rvx/chokepoints').catch(() => ({ chokepoints: [] }));
  return {
    ...fc(samples),
    by_type: counts,
    chokepoints: choke.chokepoints || [],
    meta: meta('AISStream live ships classified by type (tanker/lng/cargo/…) + chokepoint tanker counts', {
      tracked: S.ships.size, ais: S.aisUp, note: 'Flow arrows are not inferred — counts and sample positions only',
    }),
  };
}

/** 37 — radio scanners: OpenWebRX receivers with embeddable player URLs only. */
async function scanners() {
  const d = await selfJson('/api/rvx/sdr');
  const feats = (d.features || []).filter((f: any) => {
    const u = String(f.properties?.url || '');
    return /^https?:\/\//i.test(u) && !/javascript:/i.test(u);
  }).map((f: any) => ({
    ...f,
    properties: {
      ...f.properties,
      embed_allowed: /^https:\/\//i.test(f.properties.url) ? 'https_only_iframe_candidate' : 'http_link_only',
      caption: `${f.properties.name} (${f.properties.type || 'SDR'})`,
    },
  }));
  return {
    ...fc(feats.map((f: any) => f)),
    meta: meta('Receiverbook.de OpenWebRX — links only; embed https receivers in UI iframe when user opens one', {
      total: feats.length, note: 'No audio is proxied; click-through to the operator’s own receiver',
    }),
  };
}

/** 38 — one-click OSINT PDF report (simple PDF, no inventing). */
function escPdf(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function simplePdf(title: string, lines: string[]): Buffer {
  const content: string[] = ['BT', '/F1 14 Tf', '50 780 Td', `(${escPdf(title)}) Tj`, '/F1 9 Tf', '0 -20 Td'];
  let y = 760;
  for (const line of lines) {
    const chunk = line.slice(0, 110);
    content.push(`(${escPdf(chunk)}) Tj`, '0 -12 Td');
    y -= 12;
    if (y < 60) break;
  }
  content.push('ET');
  const stream = content.join('\n');
  const objs: string[] = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n');
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const o of objs) { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += o; }
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

async function report(q: Q) {
  const lat = n(q.get('lat'), 51.5), lng = n(q.get('lng'), 0);
  const dos = await selfJson(`/api/rvx/dossier?lat=${lat}&lng=${lng}`).catch((e) => ({ error: e.message }));
  const brief = await selfJson('/api/rvx/briefing').catch(() => null);
  const country = dos?.country?.name || 'Unknown location';
  const lines: string[] = [
    `RemoteView OSINT briefing — ${new Date().toISOString()}`,
    `Point: ${lat.toFixed(4)}, ${lng.toFixed(4)} — ${country}`,
    '',
    '— Country —',
  ];
  if (dos?.country) {
    lines.push(`ISO: ${dos.country.iso2}/${dos.country.iso3}`);
    const o = dos.intel?.oecd?.row;
    if (o) lines.push(`OECD risk category: ${o.current} (prev ${o.previous})`);
    const st = dos.intel?.state?.row;
    if (st) lines.push(`US State Dept: ${st.label}`);
    const f = dos.intel?.fcdo;
    if (f?.alerts) lines.push(`FCDO: ${(f.alerts || []).join('; ') || 'no warnings'}`);
    const uk = dos.ukef?.row;
    if (uk) lines.push(`UKEF cover: short=${uk.short} medium/long=${uk.medium}`);
  } else lines.push(String(dos?.error || 'No country matched'));
  lines.push('', '— Top world events (rule-ranked) —');
  for (const e of (brief?.top || []).slice(0, 5)) lines.push(`* ${e.title} — ${e.why}`);
  lines.push('', 'Sources are named in the live dossier/briefing APIs. This PDF only restates fetched fields.');
  lines.push('Unverified or heuristic fields are labelled as such in those APIs.');
  const pdf = simplePdf(`RemoteView — ${country}`, lines);
  return {
    filename: `remoteview-${(dos?.country?.iso2 || 'xx').toLowerCase()}-${Date.now()}.pdf`,
    mime: 'application/pdf',
    base64: pdf.toString('base64'),
    text: lines.join('\n'),
    meta: meta('Assembled from /api/rvx/dossier + /api/rvx/briefing (no new claims)'),
  };
}

/** 39 — weekly country risk score (0–100) from OECD + State + FCDO. */
async function riskScore() {
  return cached('risk-score', 12 * 3600_000, async () => {
    const [oecd, state, fcdo] = await Promise.all([
      riskLayer('oecd'), riskLayer('state'), riskLayer('fcdo'),
    ]);
    const byIso: Record<string, any> = {};
    const add = (gj: any, key: string, map: (v: number) => number) => {
      for (const f of gj.features || []) {
        const iso = f.properties?.iso2 || f.properties?.ISO_A2;
        const id = iso || f.properties?.name;
        if (!id || f.properties.v < 0) continue;
        byIso[id] = byIso[id] || { name: f.properties.name, iso2: iso, parts: {} as any, score: 0 };
        byIso[id].parts[key] = f.properties.v;
        byIso[id].parts[key + '_label'] = f.properties.label;
        byIso[id].parts[key + '_pts'] = map(f.properties.v);
      }
    };
    add(oecd, 'oecd', (v) => (v / 7) * 40); // 0-40
    add(state, 'state', (v) => ((v - 1) / 3) * 35); // L1-4 → 0-35
    add(fcdo, 'fcdo', (v) => ((v - 1) / 3) * 25); // 1-4 → 0-25
    const features = (oecd.features || []).map((f: any) => {
      const iso = f.properties?.iso2;
      const row = byIso[iso] || byIso[f.properties?.name];
      const score = row ? Math.round(Object.keys(row.parts).filter((k) => k.endsWith('_pts')).reduce((s: number, k) => s + row.parts[k], 0)) : -1;
      return { ...f, properties: { ...f.properties, v: score, score, label: score < 0 ? 'n/a' : `score ${score}/100`, parts: row?.parts || {} } };
    });
    return {
      type: 'FeatureCollection', features,
      meta: meta('Composite 0–100 from OECD (40%) + US State Dept level (35%) + FCDO level (25%); not a credit rating', {
        asOf_oecd: oecd.meta?.asOf, formula: 'oecd/7*40 + (state-1)/3*35 + (fcdo-1)/3*25',
      }),
    };
  });
}

/** 40 — traffic cams near a point with captions (wraps /api/cctv). */
async function trafficCams(q: Q) {
  const lat = n(q.get('lat'), 51.5), lng = n(q.get('lng'), -0.1), radius = n(q.get('radius'), 25);
  const d = await selfJson(`/api/cctv?lat=${lat}&lng=${lng}&radius=${radius}`, 60000);
  const cams = (d.cameras || d.items || d || []);
  const list = Array.isArray(cams) ? cams : [];
  const feats = list.filter((c: any) => c.lat != null && c.lng != null).slice(0, 300).map((c: any) => pt(c.lng, c.lat, {
    name: c.name || c.title || c.id || 'camera',
    caption: c.name || c.title || [c.road, c.region, c.source].filter(Boolean).join(' · ') || 'Traffic camera',
    kind: 'traffic_cam', source: c.source, preview: c.preview || c.image || c.url, url: c.url || c.link || c.preview,
  }));
  return {
    ...fc(feats),
    meta: meta('RemoteView /api/cctv public traffic cameras', {
      count: feats.length, note: 'Captions are the operator/source titles — not AI-generated descriptions of the image',
    }),
  };
}

/** 41 — flight path / ETA prediction from route lookup + current speed. */
async function flightEta(q: Q) {
  const hex = (q.get('hex') || '').trim().toLowerCase();
  const callsign = (q.get('callsign') || '').trim().toUpperCase();
  if (!hex && !callsign) return { error: 'pass hex= or callsign=', meta: meta('flight-route + live ADS-B') };
  const [route, flights] = await Promise.all([
    selfJson(`/api/flight-route?${hex ? 'icao24=' + hex : 'callsign=' + encodeURIComponent(callsign)}`).catch((e) => ({ error: e.message })),
    flightsPayload(),
  ]);
  const all = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'].flatMap((k) => flights?.[k] || []);
  const live = all.find((f: any) => (hex && f.icao24?.toLowerCase() === hex) || (callsign && String(f.callsign || '').trim().toUpperCase() === callsign));
  const dest = route?.destination || route?.dest || route?.arrival;
  const origin = route?.origin || route?.departure;
  let eta: any = null;
  if (live && dest?.lat != null) {
    const km = distKm(live.lat, live.lng, dest.lat, dest.lng);
    const kn = live.speed || live.gs || 0;
    const hours = kn > 50 ? km / (kn * 1.852) : null;
    eta = {
      distance_km: Math.round(km),
      ground_speed_kn: kn || null,
      eta_hours: hours != null ? Math.round(hours * 100) / 100 : null,
      eta_utc: hours != null ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
      method: 'great-circle distance / current ground speed (no wind or ATC model)',
    };
  }
  return {
    live: live ? { lat: live.lat, lng: live.lng, callsign: live.callsign, hex: live.icao24, alt: live.alt, speed: live.speed || live.gs } : null,
    origin, destination: dest, eta, route,
    meta: meta('RemoteView /api/flight-route + /api/flights — ETA is a geometric estimate only'),
  };
}

/** 46 — UNHCR / OWID refugee population by country of asylum. */
async function refugees() {
  return cached('refugees', 24 * 3600_000, async () => {
    const csv = await getText('https://ourworldindata.org/grapher/refugee-population-by-country-or-territory-of-asylum.csv', 30000);
    const lines = csv.trim().split(/\r?\n/);
    const latest = new Map<string, { name: string; year: number; n: number }>();
    for (const ln of lines.slice(1)) {
      const m = ln.match(/^(?:|"([^"]+)"|([^,]+)),([A-Z]{3})?,(\d{4}),(\d+)/);
      if (!m) continue;
      const name = m[1] || m[2]; const iso3 = m[3]; const year = Number(m[4]); const n = Number(m[5]);
      if (!iso3 || iso3 === 'OWID') continue;
      const prev = latest.get(iso3);
      if (!prev || year > prev.year) latest.set(iso3, { name, year, n });
    }
    const { list, geo } = await countries();
    const features = geo.features.map((f: any, i: number) => {
      const c = list[i];
      const r = latest.get(c.iso3);
      return { ...f, properties: { ...f.properties, v: r ? r.n : -1, refugees: r?.n ?? null, year: r?.year ?? null, label: r ? `${r.n.toLocaleString()} refugees (${r.year})` : 'no data' } };
    });
    return {
      type: 'FeatureCollection', features,
      meta: meta('Our World in Data — Refugee population by country or territory of asylum (UNHCR-sourced; CC BY)', {
        countries: latest.size, note: 'Choropleth by asylum country; not bilateral flows',
      }),
    };
  });
}

/** Commercial edition: counts from the official UK + EU lists (OFAC SDN CSV carries no country field). */
async function officialSanctionsMap() {
  return cached('sanctions-map-official', 12 * 3600_000, async () => {
    const { allEntries, officialSourceStatus } = await import('@/lib/sanctions');
    const entries = await allEntries();
    const { list, geo } = await countries();
    const byName = new Map<string, string>();
    for (const c of list) { byName.set(norm(c.name), c.iso2); if (c.long) byName.set(norm(c.long), c.iso2); }
    const counts = new Map<string, number>();
    for (const e of entries) {
      const isos = new Set<string>();
      for (const c of e.countries) { const iso = /^[A-Z]{2}$/.test(c) ? c : byName.get(norm(c)); if (iso) isos.add(iso); }
      for (const iso of isos) counts.set(iso, (counts.get(iso) || 0) + 1);
    }
    const features = geo.features.map((f: any, i: number) => {
      const n = counts.get(list[i].iso2);
      return { ...f, properties: { ...f.properties, v: n ?? -1, count: n ?? null, label: n ? `${n} listed targets (UK/EU)` : 'none listed' } };
    });
    return {
      type: 'FeatureCollection', features,
      meta: meta('Official lists: UK Sanctions List (FCDO, OGL v3) + EU consolidated financial sanctions list; OFAC SDN searchable but has no country field', {
        sources: officialSourceStatus, note: 'Counts of targets with a nationality/address in the country — not guilt by nationality',
      }),
    };
  });
}

/** 48 — OpenSanctions map: target counts by country (statistics.json). */
async function sanctionsMap() {
  if (IS_COMMERCIAL) return officialSanctionsMap();
  return cached('sanctions-map', 12 * 3600_000, async () => {
    const head = await fetch('https://data.opensanctions.org/datasets/latest/sanctions/statistics.json', { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const url = head.url;
    const d = await (head.ok ? head.json() : getJson('https://data.opensanctions.org/datasets/latest/sanctions/statistics.json', { timeout: 20000 }));
    const rows: { code: string; count: number; label: string }[] = d.targets?.countries || d.things?.countries || [];
    const { list, geo } = await countries();
    const by = new Map(rows.map((r) => [r.code.toUpperCase(), r]));
    const features = geo.features.map((f: any, i: number) => {
      const c = list[i];
      const r = by.get(c.iso2);
      return { ...f, properties: { ...f.properties, v: r ? r.count : -1, count: r?.count ?? null, label: r ? `${r.count} targets` : 'none listed' } };
    });
    return {
      type: 'FeatureCollection', features,
      meta: meta('OpenSanctions sanctions dataset statistics (targets by country)', {
        url, last_change: d.last_change, target_count: d.target_count, note: 'Counts of sanctioned targets linked to a country — not guilt by nationality',
      }),
    };
  });
}

/** 49 — what changed since yesterday (feed + history diff). */
async function changed() {
  ensureAis();
  const snaps = S.history.filter((s: any) => Date.now() - s.t >= 20 * 3600_000 && Date.now() - s.t <= 28 * 3600_000);
  const old = snaps[0] || S.history[0];
  const cur = S.history[S.history.length - 1];
  const [brief, storms, outbreaks, tfr] = await Promise.all([
    selfJson('/api/rvx/briefing').catch(() => null),
    selfJson('/api/rvx/storms').catch(() => null),
    selfJson('/api/rvx/outbreaks').catch(() => null),
    selfJson('/api/rvx/tfr').catch(() => null),
  ]);
  const delta = (a?: number, b?: number) => (a != null && b != null ? b - a : null);
  const changes: any[] = [];
  if (old && cur) {
    changes.push({ kind: 'flights', from: old.flights?.length, to: cur.flights?.length, delta: delta(old.flights?.length, cur.flights?.length) });
    changes.push({ kind: 'quakes', from: old.quakes?.length, to: cur.quakes?.length, delta: delta(old.quakes?.length, cur.quakes?.length) });
    changes.push({ kind: 'events', from: old.events?.length, to: cur.events?.length, delta: delta(old.events?.length, cur.events?.length) });
  }
  changes.push({ kind: 'ships_tracked', to: S.ships.size, ais_up: S.aisUp });
  changes.push({ kind: 'active_storms', to: storms?.features?.length ?? null });
  changes.push({ kind: 'who_outbreak_items', to: outbreaks?.items?.length ?? null });
  changes.push({ kind: 'faa_tfrs', to: tfr?.tfrs?.length ?? null });
  const top = (brief?.top || []).slice(0, 5).map((e: any) => ({ title: e.title, why: e.why, source: e.source }));
  return {
    window: { old_snapshot: old?.t ? new Date(old.t).toISOString() : null, current_snapshot: cur?.t ? new Date(cur.t).toISOString() : null, history_points: S.history.length },
    changes, top_now: top,
    meta: meta('Diff of RemoteView 15-min snapshots (~24h ago vs now) plus current storm/outbreak/TFR counts', {
      note: S.history.length < 2 ? 'History still warming after restart — flight/quake deltas unavailable until ~24h of snapshots exist' : undefined,
    }),
  };
}

/** 44 — markets overlay pins. */
async function markets() {
  const d = await selfJson('/api/markets', 30000);
  const list: any[] = [];
  for (const g of ['indices', 'stocks', 'oil', 'commodities', 'crypto', 'fx']) {
    const block = d[g];
    if (!block || typeof block !== 'object') continue;
    for (const q of Object.values(block) as any[]) if (q && q.price != null) list.push(q);
  }
  const out = list.map((q: any) => {
    const pin = MKT_PIN[q.group] || MKT_PIN.indices;
    const h = [...String(q.symbol)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return pt(pin.lng + ((h % 20) - 10) * 0.02, pin.lat + ((h % 17) - 8) * 0.015, {
      name: `${q.name}: ${q.price}`, kind: 'market', group: q.group, symbol: q.symbol,
      price: q.price, change_percent: q.change_percent, up: q.up, place: pin.place,
    });
  });
  return { ...fc(out), meta: meta('RemoteView /api/markets (Yahoo Finance v8 chart)', { count: out.length }) };
}

export const QUEUE: Record<string, (q: Q, body?: any) => Promise<any>> = {
  jets: () => jets(),
  elections: () => elections(),
  'chokepoint-map': () => chokepointLayer(),
  commodity: () => commodity(),
  scanners: () => scanners(),
  report: (q) => report(q),
  'risk-score': () => riskScore(),
  'traffic-cams': (q) => trafficCams(q),
  'flight-eta': (q) => flightEta(q),
  refugees: () => refugees(),
  'sanctions-map': () => sanctionsMap(),
  changed: () => changed(),
  markets: () => markets(),
};
