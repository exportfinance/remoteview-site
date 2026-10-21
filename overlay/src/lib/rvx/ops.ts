/* RemoteView extras: Bond / radio / "crazier" packs + selected 33-49. Free public sources only. */
import { cached, getJson, getText, fc, pt, selfJson } from './util';
import { IS_COMMERCIAL } from '@/lib/edition';
const officialUrl = (id: string) => String(id).startsWith('uk-') ? 'https://www.gov.uk/government/publications/the-uk-sanctions-list' : String(id).startsWith('eu-') ? 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions' : 'https://sanctionssearch.ofac.treas.gov/';
import { S } from './live';

type Q = URLSearchParams;
const n = (v: string | null, d: number) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const meta = (source: string, extra: Record<string, unknown> = {}) => ({ source, fetched: new Date().toISOString(), ...extra });
function bbox(q: Q) {
  const w = n(q.get('w'), -1), s = n(q.get('s'), 51), e = n(q.get('e'), 1), nn = n(q.get('n'), 52);
  if ((e - w) * (nn - s) > 40) throw new Error('Zoom in further (area too large for OpenStreetMap query)');
  return [s, w, nn, e].map((x) => x.toFixed(3)).join(',');
}
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(ql: string) {
  const q = `[out:json][timeout:25];${ql}`;
  let err: Error | null = null;
  for (const u of OVERPASS) {
    try {
      return await getJson(u, {
        method: 'POST', body: 'data=' + encodeURIComponent(q), timeout: 35000,
        headers: { 'User-Agent': 'RemoteView/1.0 (+https://remoteview.online)', 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (e) { err = e as Error; }
  }
  throw err || new Error('Overpass unavailable');
}
function osmFc(d: any, kind: string) {
  return fc((d.elements || []).map((x: any) => {
    const lat = x.lat ?? x.center?.lat, lon = x.lon ?? x.center?.lon; if (lat == null) return null;
    const t = x.tags || {};
    return pt(lon, lat, {
      kind, name: t.name || t['name:en'] || t.operator || kind,
      country: t.country || t['diplomatic:sending_country'] || '',
      type: t.diplomatic || t.military || t.aeroway || t.barrier || t.tourism || '',
      iata: t.iata || '', osm: `https://www.openstreetmap.org/${x.type}/${x.id}`,
    });
  }).filter(Boolean));
}
const R = 6371;
const dist = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/* Bond 1: short-lived in-memory dead drops (code → note at a pin). */
const drops = new Map<string, { note: string; lat: number; lng: number; exp: number }>();
function code() { return Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8); }

async function tleGroup(group: string) {
  return cached('tle-' + group, 6 * 3600_000, () => getText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, 20000));
}
async function tlePositions(group: string, max = 200) {
  const sat = await import('satellite.js');
  const tle = await tleGroup(group);
  const lines = tle.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const now = new Date(); const feats: any[] = [];
  for (let i = 0; i + 2 < lines.length && feats.length < max; i += 3) {
    const name = lines[i], l1 = lines[i + 1], l2 = lines[i + 2];
    if (!l1?.startsWith('1 ') || !l2?.startsWith('2 ')) continue;
    try {
      const rec = sat.twoline2satrec(l1, l2);
      const pv: any = sat.propagate(rec, now);
      if (!pv?.position || typeof pv.position === 'boolean') continue;
      const gd = sat.eciToGeodetic(pv.position, sat.gstime(now));
      feats.push(pt(sat.degreesLong(gd.longitude), sat.degreesLat(gd.latitude), {
        name, kind: group, alt_km: Math.round(gd.height), norad: l1.slice(2, 7).trim(),
      }));
    } catch { /* skip bad TLE */ }
  }
  return { ...fc(feats), meta: meta(`CelesTrak ${group} TLEs + SGP4 (satellite.js)`) };
}

export const OPS: Record<string, (q: Q, body?: any) => Promise<any>> = {
  /* ── Bond pack ── */
  deaddrop: async (q, body) => {
    const now = Date.now();
    for (const [k, v] of drops) if (v.exp < now) drops.delete(k);
    if (q.get('code')) {
      const d = drops.get(String(q.get('code')).toLowerCase());
      if (!d || d.exp < now) return { found: false, meta: meta('RemoteView in-memory dead drop (expires 24h, lost on restart)') };
      return { found: true, note: d.note, lat: d.lat, lng: d.lng, expires: new Date(d.exp).toISOString(), meta: meta('RemoteView in-memory dead drop') };
    }
    const note = String(body?.note || '').slice(0, 500);
    const lat = n(body?.lat ?? q.get('lat'), NaN), lng = n(body?.lng ?? q.get('lng'), NaN);
    if (!note || !Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'need note, lat, lng' };
    const c = code();
    drops.set(c, { note, lat, lng, exp: now + 24 * 3600_000 });
    if (drops.size > 2000) drops.clear();
    return { code: c, lat, lng, expires: new Date(now + 24 * 3600_000).toISOString(), meta: meta('RemoteView in-memory dead drop (24h, lost on restart)') };
  },
  embassies: async (q) => {
    const b = bbox(q);
    return cached('emb' + b, 6 * 3600_000, async () => ({
      ...osmFc(await overpass(`(nwr["office"="diplomatic"](${b});nwr["amenity"="embassy"](${b}););out center 400;`), 'embassy'),
      meta: meta('OpenStreetMap via Overpass (ODbL)'),
    }));
  },
  bases: async (q) => {
    const b = bbox(q);
    return cached('bases' + b, 6 * 3600_000, async () => ({
      ...osmFc(await overpass(`(nwr["military"~"base|airfield|naval_base"](${b});nwr["landuse"="military"]["name"](${b}););out center 400;`), 'military'),
      meta: meta('OpenStreetMap via Overpass (ODbL)'),
    }));
  },
  borders: async (q) => {
    const b = bbox(q);
    return cached('bord' + b, 6 * 3600_000, async () => ({
      ...osmFc(await overpass(`(node["barrier"="border_control"](${b});nwr["amenity"="customs"](${b}););out center 400;`), 'border'),
      meta: meta('OpenStreetMap via Overpass (ODbL)'),
    }));
  },
  vipjets: async () => {
    const last = S.history[S.history.length - 1];
    const flights = last?.flights || [];
    const feats = flights.filter((f: any) => {
      const cs = String(f.callsign || f.c || '').toUpperCase();
      const cat = String(f.category || f.cat || f.type || '').toLowerCase();
      return /^(AF|RCH|SPAR|EXEC|SAM|NOY|GAF|ASY|DUKE|ASCOT|RRR|CNV|CNVC)/.test(cs) || cat.includes('military') || cat === 'm';
    }).slice(0, 400).map((f: any) => pt(f.lng ?? f[0], f.lat ?? f[1], {
      name: f.callsign || f.c || f.icao24 || 'aircraft', kind: 'vip/mil', hex: f.icao24 || f.h, alt: f.alt || f.a,
    }));
    return { ...fc(feats), meta: meta('RemoteView flight snapshot — callsign heuristics for gov/mil (not definitive)', { snapshot: !!last, count: feats.length }) };
  },
  milsats: () => tlePositions('military', 180),
  safehouses: async (q) => {
    const b = bbox(q);
    return cached('safe' + b, 6 * 3600_000, async () => ({
      ...osmFc(await overpass(`(nwr["tourism"="hotel"]["stars"~"4|5"](${b});nwr["tourism"="hotel"]["stars"="5"](${b}););out center 200;`), 'hotel'),
      meta: meta('OpenStreetMap 4–5★ hotels via Overpass (ODbL) — tongue-in-cheek "safe houses"'),
    }));
  },
  sanctions: async (q) => {
    const name = (q.get('q') || '').trim();
    if (name.length < 2) return { matches: [], meta: meta('OpenSanctions OFAC SDN via /api/osint/sanctions', { hint: 'pass ?q=' }) };
    // Keyed api.opensanctions.org skipped — use the local CC-BY OFAC mirror.
    const d = await selfJson(`/api/osint/sanctions?query=${encodeURIComponent(name)}&limit=10`, 30000).catch(() => ({ results: [] }));
    const matches = (d.matches || d.results || []).map((r: any) => ({
      id: r.id, caption: r.name || r.caption, datasets: r.datasets || ['us_ofac_sdn'], score: r.score,
      countries: r.countries || [], schema: r.schema,
      url: IS_COMMERCIAL ? officialUrl(r.id) : `https://www.opensanctions.org/entities/${r.id}/`,
    }));
    return { matches, meta: meta(IS_COMMERCIAL ? 'Official lists: US OFAC SDN, UK Sanctions List (FCDO), EU consolidated list via /api/osint/sanctions' : 'OpenSanctions us_ofac_sdn via /api/osint/sanctions (CC-BY 4.0; paid API not used)') };
  },
  exfil: async (q) => {
    const lat = n(q.get('lat'), 51.5), lng = n(q.get('lng'), 0); const d = 1.2;
    const b = [lat - d, lng - d, lat + d, lng + d].map((x) => x.toFixed(3)).join(',');
    const osm = await overpass(`(nwr["aeroway"="aerodrome"]["iata"](${b});nwr["harbour"="yes"]["name"](${b});nwr["industrial"="port"](${b});node["barrier"="border_control"](${b}););out center 300;`);
    const items = osmFc(osm, 'x').features.map((f: any) => ({
      ...f.properties,
      kind: f.properties.iata ? 'airport' : f.properties.type === 'border_control' ? 'border crossing' : 'port',
      km: Math.round(dist(lat, lng, f.geometry.coordinates[1], f.geometry.coordinates[0])),
      lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
    }));
    const pick = (k: string) => items.filter((i: any) => i.kind === k).sort((a: any, z: any) => a.km - z.km).slice(0, 4);
    const last = S.history[S.history.length - 1];
    const overhead = (last?.flights || []).filter((f: any) => dist(lat, lng, f[1] ?? f.lat, f[0] ?? f.lng) < 100).length;
    return {
      lat, lng, airports: pick('airport'), ports: pick('port'), borders: pick('border crossing'),
      flightsWithin100km: last ? overhead : null,
      meta: meta('OpenStreetMap via Overpass (ODbL) + RemoteView flight snapshot'),
    };
  },

  /* ── Way crazier ── */
  epic: () => cached('epic', 3600_000, async () => {
    const d: any[] = await getJson('https://epic.gsfc.nasa.gov/api/natural', { timeout: 20000 });
    return {
      images: d.slice(-12).map((x) => {
        const [y, m, dd] = x.date.slice(0, 10).split('-');
        return {
          date: x.date + ' UTC', caption: x.caption, lat: x.centroid_coordinates.lat, lon: x.centroid_coordinates.lon,
          url: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${dd}/jpg/${x.image}.jpg`,
        };
      }),
      meta: meta('NASA EPIC / NOAA DSCOVR (public domain)'),
    };
  }),
  conjunctions: () => cached('conj', 3600_000, async () => {
    const csv = await getText('https://celestrak.org/SOCRATES/sort-minRange.csv', 60000);
    const lines = csv.trim().split(/\r?\n/).slice(1, 80);
    const rows = lines.map((ln) => {
      const p = ln.split(',');
      return {
        a: p[1], b: p[4], tca: p[6], range_km: Number(p[7]), rel_speed: Number(p[8]),
        max_prob: Number(p[9]), dilution: Number(p[10]),
      };
    }).filter((r) => Number.isFinite(r.range_km));
    return { rows, meta: meta('CelesTrak SOCRATES sort-minRange (predicted close approaches; not collision warnings)') };
  }),
  fireballs: () => cached('fireballs', 6 * 3600_000, async () => {
    const d = await getJson('https://ssd-api.jpl.nasa.gov/fireball.api?limit=60', { timeout: 20000 });
    const feats = (d.data || []).filter((r: any[]) => r[3] != null && r[4] != null).map((r: any[]) => pt(Number(r[4]), Number(r[3]), {
      name: `Fireball ${r[0]}`, date: r[0], energy_kt: r[1], impact_e: r[2], lat: r[3], lon: r[4], alt_km: r[5], vel: r[8],
    }));
    return { ...fc(feats), meta: meta('NASA JPL CNEOS fireball API (public)') };
  }),
  spaceweather: () => cached('swpc', 10 * 60_000, async () => {
    const [kp, flares, alerts] = await Promise.all([
      getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 15000 }).catch(() => null),
      getJson('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json', { timeout: 15000 }).catch(() => null),
      getJson('https://services.swpc.noaa.gov/products/alerts.json', { timeout: 15000 }).catch(() => null),
    ]);
    const kRows = Array.isArray(kp) ? kp.slice(1).slice(-8).map((r: any) => ({ t: r[0], kp: Number(r[1]) })) : [];
    return {
      kp: kRows, latestKp: kRows[kRows.length - 1] || null,
      flares: Array.isArray(flares) ? flares.slice(0, 5) : [],
      alerts: Array.isArray(alerts) ? alerts.slice(0, 8).map((a: any) => ({ issue: a.issue_datetime, product: a.product_id, message: String(a.message || '').slice(0, 280) })) : [],
      meta: meta('NOAA SWPC (public domain)'),
    };
  }),

  /* ── Radio pack ── */
  nws: () => cached('nws', 5 * 60_000, async () => {
    const d = await getJson('https://api.weather.gov/alerts/active?status=actual&message_type=alert', {
      timeout: 25000, headers: { 'User-Agent': 'RemoteView (remoteview.online)', Accept: 'application/geo+json' },
    });
    const feats = (d.features || []).filter((f: any) => f.geometry).map((f: any) => ({
      type: 'Feature', geometry: f.geometry,
      properties: { name: f.properties.event, severity: f.properties.severity, area: f.properties.areaDesc, headline: f.properties.headline, expires: f.properties.expires },
    }));
    return { ...fc(feats), meta: meta('US National Weather Service api.weather.gov (public domain)', { total: (d.features || []).length }) };
  }),
  sondes: () => cached('sondes', 60_000, async () => {
    const d: any = await getJson('https://api.v2.sondehub.org/sondes?last=3600', { timeout: 25000 });
    return {
      ...fc(Object.entries(d).map(([id, v]: any) => {
        const lat = v.lat ?? v.latitude, lon = v.lon ?? v.longitude;
        if (lat == null || lon == null) return null;
        return pt(lon, lat, { name: id, kind: 'sonde', alt: v.alt, type: v.type, uploader: v.uploader_callsign, heard: v.time_received });
      }).filter(Boolean)),
      meta: meta('SondeHub API (radiosonde_auto_rx community, last 1h)'),
    };
  }),
  sdr: () => cached('sdr', 3600_000, async () => {
    const html = await getText('https://www.receiverbook.de/map?type=openwebrx', 30000);
    const m = /var receivers = (\[[\s\S]+?\]);/.exec(html);
    if (!m) throw new Error('receiverbook parse failed');
    const list = JSON.parse(m[1]);
    const feats = list.flatMap((site: any) => {
      const [lon, lat] = site.location?.coordinates || [];
      if (lat == null) return [];
      return (site.receivers || []).slice(0, 3).map((r: any) => pt(lon, lat, {
        name: r.label || site.label, kind: 'sdr', type: r.type || 'OpenWebRX', url: r.url, site: site.label,
      }));
    });
    return { ...fc(feats), meta: meta('Receiverbook.de OpenWebRX map (community receivers)') };
  }),
  amsats: () => tlePositions('amateur', 120),
  hf: () => cached('hf', 15 * 60_000, async () => {
    const d = await getJson('https://services.swpc.noaa.gov/json/f107_cm_flux.json', { timeout: 15000 }).catch(() => null);
    const kp = await getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 15000 }).catch(() => null);
    const flux = Array.isArray(d) ? d.slice(-5) : [];
    const kRows = Array.isArray(kp) ? kp.slice(1).slice(-4).map((r: any) => ({ t: r[0], kp: Number(r[1]) })) : [];
    const k = kRows[kRows.length - 1]?.kp;
    let band = 'unknown';
    if (k != null) {
      if (k <= 2) band = 'good (quiet)';
      else if (k <= 4) band = 'fair';
      else band = 'poor (disturbed)';
    }
    return { flux, kp: kRows, hf_conditions: band, meta: meta('NOAA SWPC F10.7 + Kp — rough HF band guide only') };
  }),

};
