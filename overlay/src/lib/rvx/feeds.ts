/* RemoteView extras: data handlers for /api/rvx/<feed>. Free, keyless public sources
   unless noted. Each returns JSON (usually GeoJSON) plus a `meta` provenance block. */
import * as sat from 'satellite.js';
import { cached, getJson, getText, fc, pt, selfJson, ai, aiConfigured } from './util';
import { S, ensureLightning, ensureAis, ensureHistory } from './live';

type Q = URLSearchParams;
const meta = (source: string, extra: Record<string, unknown> = {}) => ({ source, fetched: new Date().toISOString(), ...extra });
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clampLat = (v: number) => Math.max(-90, Math.min(90, v));

/* ── 1/35/36 Ships (AISStream) ─────────────────────────────── */
export function shipKind(t?: number): string {
  if (!t) return 'unknown';
  if (t >= 80 && t <= 89) return 'tanker';
  if (t >= 70 && t <= 79) return 'cargo';
  if (t >= 60 && t <= 69) return 'passenger';
  if (t === 30) return 'fishing';
  if (t === 35) return 'military';
  return 'other';
}
async function ships() {
  const on = ensureAis();
  if (!on) return { ...fc([]), meta: meta('aisstream.io', { needsKey: 'AISSTREAM_API_KEY', status: S.aisErr }) };
  const cut = Date.now() - 30 * 60_000; const out: any[] = [];
  for (const v of S.ships.values()) {
    if (!v.t || v.t < cut || typeof v.lat !== 'number') continue;
    const lng = v.lng; const lat = v.lat;
    const kind = /\bLNG\b/i.test(v.name || '') ? 'lng' : shipKind(v.type);
    out.push(pt(lng, lat, { mmsi: v.mmsi, name: v.name, sog: v.sog, cog: v.cog, kind, dest: v.dest, age_s: Math.round((Date.now() - v.t) / 1000) }));
    if (out.length >= 15000) break;
  }
  return { ...fc(out), meta: meta('aisstream.io', { connected: S.aisUp, tracked: S.ships.size }) };
}
const CHOKE = [
  { id: 'suez', name: 'Suez Canal', bbox: [32.2, 29.8, 32.7, 31.4] },
  { id: 'hormuz', name: 'Strait of Hormuz', bbox: [55.8, 25.8, 57.2, 27.0] },
  { id: 'panama', name: 'Panama Canal', bbox: [-80.1, 8.8, -79.4, 9.5] },
  { id: 'malacca', name: 'Strait of Malacca', bbox: [98.5, 1.0, 104.0, 6.0] },
  { id: 'bab', name: 'Bab-el-Mandeb', bbox: [42.8, 12.2, 43.8, 13.2] },
];
async function chokepoints() {
  const on = ensureAis();
  const now = Date.now();
  const rows = CHOKE.map((c) => {
    let total = 0, slow = 0, tankers = 0;
    if (on) for (const v of S.ships.values()) {
      if (!v.t || now - v.t > 30 * 60_000 || typeof v.lat !== 'number') continue;
      const [a, b, cc, d] = c.bbox;
      if (v.lng >= a && v.lng <= cc && v.lat >= b && v.lat <= d) { total++; if ((v.sog ?? 0) < 1) slow++; if (shipKind(v.type) === 'tanker') tankers++; }
    }
    return { ...c, total, waiting_or_slow: slow, tankers, delay_index: total ? Math.round((slow / total) * 100) : null };
  });
  return { chokepoints: rows, meta: meta('aisstream.io (derived)', on ? { note: 'waiting_or_slow = ships under 1 kn; delay_index = share of slow ships' } : { needsKey: 'AISSTREAM_API_KEY' }) };
}

/* ── 3 Lightning (Blitzortung public websocket) ───────────── */
async function lightning() {
  ensureLightning();
  const cut = Date.now() - 15 * 60_000;
  const f = S.strikes.filter((s: number[]) => s[2] >= cut).map((s: number[]) => pt(s[0], s[1], { t: s[2], age_s: Math.round((Date.now() - s[2]) / 1000) }));
  return { ...fc(f), meta: meta('blitzortung.org (community network, live websocket)', { connected: S.lightningUp, window_min: 15, err: S.lightningUp ? undefined : S.lightningErr }) };
}

/* ── 4 Launches (Launch Library 2) ─────────────────────────── */
async function launches() {
  return cached('launches', 30 * 60_000, async () => {
    const d = await getJson('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&mode=normal', { timeout: 20000 });
    const f = (d.results || []).filter((l: any) => l.pad?.latitude).map((l: any) => pt(Number(l.pad.longitude), Number(l.pad.latitude), {
      id: l.id, name: l.name, net: l.net, status: l.status?.abbrev, provider: l.launch_service_provider?.name, pad: l.pad?.name, location: l.pad?.location?.name,
      mission: l.mission?.name, image: l.image, url: l.url,
    }));
    return { ...fc(f), meta: meta('Launch Library 2 (thespacedevs.com)') };
  });
}

/* ── 5 Volcanoes + tsunami ─────────────────────────────────── */
async function volcanoes() {
  return cached('volc', 20 * 60_000, async () => {
    const [elev, all] = await Promise.all([
      getJson('https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes'),
      cached('volc-list', 24 * 3600_000, () => getJson('https://volcanoes.usgs.gov/hans-public/api/volcano/getUSVolcanoes')).catch(() => []),
    ]);
    const loc = new Map<string, any>((all as any[]).map((v: any) => [String(v.vnum), v]));
    const f = (elev as any[]).map((v: any) => {
      const l = loc.get(String(v.vnum)) || {};
      const lat = Number(l.latitude ?? l.lat), lng = Number(l.longitude ?? l.long ?? l.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return pt(lng, lat, { name: v.volcano_name, alert: v.alert_level, color: v.color_code, observatory: v.obs_abbr?.toUpperCase(), sent: v.sent_utc, url: v.notice_url });
    }).filter(Boolean);
    return { ...fc(f), meta: meta('USGS Volcano Hazards Program (HANS)', { note: 'Smithsonian GVP weekly feed was unavailable when built; USGS elevated-alert volcanoes shown' }) };
  });
}
async function tsunami() {
  return cached('tsu', 5 * 60_000, async () => {
    const feeds = ['https://www.tsunami.gov/events/xml/PAAQAtom.xml', 'https://www.tsunami.gov/events/xml/PHEBAtom.xml'];
    const out: any[] = [];
    for (const u of feeds) {
      const x = await getText(u).catch(() => '');
      for (const e of x.split('<entry>').slice(1)) {
        const title = (e.match(/<title>([^<]*)/) || [])[1] || '';
        const updated = (e.match(/<updated>([^<]*)/) || [])[1] || '';
        const lat = Number((e.match(/<geo:lat>([^<]*)/) || [])[1]);
        const lng = Number((e.match(/<geo:long>([^<]*)/) || [])[1]);
        const link = (e.match(/<link[^>]*href="([^"]*)"/) || [])[1];
        const summary = ((e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').trim().slice(0, 400);
        if (Number.isFinite(lat) && Number.isFinite(lng)) out.push(pt(lng, lat, { title, updated, link, summary, center: u.includes('PAAQ') ? 'NTWC' : 'PTWC', level: /warning/i.test(title) ? 'warning' : /advisory/i.test(title) ? 'advisory' : /watch/i.test(title) ? 'watch' : 'info' }));
      }
    }
    return { ...fc(out), meta: meta('NOAA tsunami.gov (NTWC + PTWC Atom)') };
  });
}

/* ── 6 ISS ─────────────────────────────────────────────────── */
async function iss() {
  return cached('iss', 4000, async () => {
    const now = await getJson('https://api.wheretheiss.at/v1/satellites/25544');
    const track = await cached('iss-track', 5 * 60_000, async () => {
      const t0 = Math.floor(Date.now() / 1000);
      const ts = Array.from({ length: 10 }, (_, i) => t0 - 2700 + i * 600); // -45 min .. +45 min
      const p = await getJson(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${ts.join(',')}&units=kilometers`);
      return (p as any[]).map((x) => [x.longitude, x.latitude, x.timestamp]);
    }).catch(() => []);
    return { position: { lat: now.latitude, lng: now.longitude, alt_km: now.altitude, vel_kmh: now.velocity, visibility: now.visibility, t: now.timestamp }, track, meta: meta('wheretheiss.at') };
  });
}

/* ── 7 IODA internet outages ───────────────────────────────── */
async function ioda() {
  return cached('ioda', 10 * 60_000, async () => {
    const until = Math.floor(Date.now() / 1000), from = until - 24 * 3600;
    const d = await getJson(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${from}&until=${until}&entityType=country&limit=2000`, { timeout: 25000 });
    const by = new Map<string, any>();
    for (const a of d.data || []) {
      if (a.level === 'normal') continue;
      const c = a.entity?.code; if (!c) continue;
      const cur = by.get(c) || { code: c, name: a.entity.name, alerts: 0, critical: 0, warning: 0, sources: new Set<string>(), last: 0 };
      cur.alerts++; if (a.level === 'critical') cur.critical++; else cur.warning++;
      cur.sources.add(a.datasource); cur.last = Math.max(cur.last, a.time);
      by.set(c, cur);
    }
    const countries = [...by.values()].map((c) => ({ ...c, sources: [...c.sources], last: new Date(c.last * 1000).toISOString() })).sort((a, b) => b.critical - a.critical || b.alerts - a.alerts);
    return { countries, meta: meta('IODA (Georgia Tech) — non-normal alerts, last 24h') };
  });
}

/* ── 11 Smoke + air quality ────────────────────────────────── */
async function smoke() {
  return cached('smoke', 60 * 60_000, async () => {
    let kml = ''; let day = '';
    for (let back = 0; back < 3 && !kml; back++) {
      const d = new Date(Date.now() - back * 86400_000);
      const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
      day = `${y}-${m}-${dd}`;
      kml = await getText(`https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/${y}/${m}/hms_smoke${y}${m}${dd}.kml`, 20000).catch(() => '');
    }
    const feats: any[] = [];
    for (const pm of kml.split('<Placemark>').slice(1)) {
      const style = (pm.match(/<styleUrl>#?([^<]*)/) || [])[1] || '';
      const density = /heavy/i.test(style) ? 'heavy' : /medium/i.test(style) ? 'medium' : 'light';
      for (const ring of pm.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)) {
        const coords = ring[1].trim().split(/\s+/).map((c) => c.split(',').slice(0, 2).map((n) => +Number(n).toFixed(3)));
        if (coords.length >= 4) feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { density } });
      }
    }
    return { ...fc(feats), meta: meta('NOAA NESDIS Hazard Mapping System smoke polygons', { day }) };
  });
}

/* ── 12 Storms (GDACS global incl. JTWC-sourced, + NHC cones) ─ */
async function storms() {
  return cached('storms', 20 * 60_000, async () => {
    const [nhc, gd] = await Promise.all([
      getJson('https://www.nhc.noaa.gov/CurrentStorms.json').catch(() => ({ activeStorms: [] })),
      getJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=green;orange;red').catch(() => ({ features: [] })),
    ]);
    const feats: any[] = [];
    const recent = (gd.features || []).filter((f: any) => {
      const to = Date.parse(f.properties?.todate || ''); return !to || Date.now() - to < 3 * 86400_000;
    }).slice(0, 8);
    for (const e of recent) {
      const p = e.properties;
      feats.push(pt(e.geometry.coordinates[0], e.geometry.coordinates[1], { kind: 'storm', name: p.eventname || p.name, alert: p.alertlevel, country: p.country, from: p.fromdate, to: p.todate, url: p.url?.report, source: 'GDACS' }));
      try {
        const g = await getJson(`https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${p.eventid}&episodeid=${p.episodeid}`, { timeout: 15000 });
        for (const f of g.features || []) {
          const cls = String(f.properties?.Class || f.properties?.class || '');
          const t = f.geometry?.type;
          if (t === 'LineString' || t === 'MultiLineString') feats.push({ ...f, properties: { kind: 'track', name: p.eventname } });
          else if ((t === 'Polygon' || t === 'MultiPolygon') && /cone|uncertain|Poly_Cones/i.test(cls + JSON.stringify(f.properties))) feats.push({ ...f, properties: { kind: 'cone', name: p.eventname } });
          else if (t === 'Point' && /Point_Polygon_Point|forecast|track/i.test(cls)) feats.push({ ...f, properties: { kind: 'fix', name: p.eventname, time: f.properties?.trackdate || f.properties?.polygondate } });
        }
      } catch { /* geometry optional */ }
    }
    for (const s of nhc.activeStorms || []) {
      feats.push(pt(Number(s.longitudeNumeric), Number(s.latitudeNumeric), { kind: 'storm', name: s.name, alert: s.classification, intensity_kt: s.intensity, source: 'NHC' }));
    }
    return { ...fc(feats), meta: meta('GDACS tropical cyclones (global) + NOAA NHC CurrentStorms', { nhc_active: (nhc.activeStorms || []).length, note: 'JTWC has no free machine-readable feed; GDACS ingests JTWC/regional centres for the West Pacific & Indian Ocean' }) };
  });
}

/* ── 13 GPS jamming (from /api/flights nac_p) ─────────────── */
async function jamming() {
  return cached('jam', 60_000, async () => {
    const d = await selfJson('/api/flights');
    const cells = new Map<string, { lat: number; lng: number; n: number; bad: number }>();
    const SZ = 1;
    for (const k of ['commercial_flights', 'private_flights', 'private_jets', 'military_flights']) {
      for (const f of d[k] || []) {
        if (f.grounded || typeof f.nac_p !== 'number') continue;
        const la = Math.floor(f.lat / SZ) * SZ, lo = Math.floor(f.lng / SZ) * SZ, key = la + ',' + lo;
        const c = cells.get(key) || { lat: la, lng: lo, n: 0, bad: 0 };
        c.n++; if (f.nac_p <= 4) c.bad++;
        cells.set(key, c);
      }
    }
    const feats = [...cells.values()].filter((c) => c.n >= 3 && c.bad / c.n >= 0.1).map((c) => ({
      type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[c.lng, c.lat], [c.lng + SZ, c.lat], [c.lng + SZ, c.lat + SZ], [c.lng, c.lat + SZ], [c.lng, c.lat]]] },
      properties: { aircraft: c.n, degraded: c.bad, pct: Math.round((c.bad / c.n) * 100) },
    }));
    return { ...fc(feats), meta: meta('Derived from live ADS-B NACp in /api/flights', { cells_considered: cells.size, rule: '1° cells, ≥3 aircraft, ≥10% with NACp ≤ 4' }) };
  });
}

/* ── 14 Power outages (Cal OES county layer; US-wide EAGLE-I needs a token) ─ */
async function power() {
  return cached('power', 15 * 60_000, async () => {
    const d = await getJson('https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/Power_Outages_(View)/FeatureServer/2/query?f=geojson&where=Number_Impacted_Customers%3E0&outFields=NAME,Number_Impacted_Customers,Number_Incidents&outSR=4326&geometryPrecision=3&maxAllowableOffset=0.01', { timeout: 25000 });
    return { ...d, meta: meta('Cal OES Power Outages by County (California only)', { note: 'US-wide county data (DOE EAGLE-I via FEMA) requires a token; poweroutage.us has no free API' }) };
  });
}

/* ── 15 Protests/unrest from GDELT ────────────────────────── */
async function protests() {
  return cached('protests', 10 * 60_000, async () => {
    const d = await selfJson('/api/gdelt-events?limit=2000');
    const f = (d.events || []).filter((e: any) => ['14', '18', '19', '20', '17', '13', '15'].includes(String(e.root_code))).map((e: any) => pt(e.lng, e.lat, {
      kind: String(e.root_code) === '14' ? 'protest' : 'unrest', code: e.event_code, name: e.name, country: e.country, articles: e.articles, tone: e.tone, url: e.url, date: e.date,
    }));
    return { ...fc(f), meta: meta('GDELT 2.0 events (CAMEO 13-15,17-20 unrest; 14 protest)') };
  });
}

/* ── 16 History (24h rolling) ─────────────────────────────── */
async function history(q: Q) {
  ensureHistory();
  const at = q.get('t');
  if (!at) return { snapshots: S.history.map((s: any) => ({ t: s.t, flights: s.flights.length, quakes: s.quakes.length, events: s.events.length })), meta: meta('RemoteView 15-min snapshots (max 24h)') };
  const t = Number(at);
  let best = S.history[0];
  for (const s of S.history) if (Math.abs(s.t - t) < Math.abs((best?.t ?? 0) - t)) best = s;
  return { snapshot: best || null, meta: meta('RemoteView 15-min snapshots') };
}

/* ── 17 Webcams (Windy, key needed) ───────────────────────── */
async function webcams(q: Q) {
  const key = process.env.WINDY_WEBCAMS_KEY;
  if (!key) return { webcams: [], meta: meta('Windy Webcams API', { needsKey: 'WINDY_WEBCAMS_KEY (free tier at api.windy.com/keys)' }) };
  const lat = clampLat(num(q.get('lat'), 0)), lng = num(q.get('lng'), 0);
  const d = await getJson(`https://api.windy.com/webcams/api/v3/webcams?nearby=${lat},${lng},50&limit=20&include=images,location,player`, { headers: { 'x-windy-api-key': key } });
  return { webcams: (d.webcams || []).map((w: any) => ({ id: w.webcamId, title: w.title, lat: w.location?.latitude, lng: w.location?.longitude, thumb: w.images?.current?.preview, player: w.player?.day })), meta: meta('Windy Webcams API') };
}

/* ── 18 Quake shake rings ─────────────────────────────────── */
async function shake() {
  return cached('shake', 10 * 60_000, async () => {
    const d = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
    const top = (d.features || []).sort((a: any, b: any) => b.properties.mag - a.properties.mag).slice(0, 12);
    const out = top.map((f: any) => {
      const m = f.properties.mag;
      // felt radius (km) — empirical approximation: log10(R) ≈ 0.43*M - 0.8 (labelled as estimate)
      const felt_km = Math.round(Math.pow(10, 0.43 * m - 0.8) * 10);
      return { id: f.id, mag: m, place: f.properties.place, time: f.properties.time, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], mmi: f.properties.mmi, cdi: f.properties.cdi, felt_reports: f.properties.felt, alert: f.properties.alert, felt_km_est: felt_km, url: f.properties.url };
    });
    return { quakes: out, meta: meta('USGS 4.5+ past week; ring radius is an estimate from magnitude, MMI/CDI from USGS where available') };
  });
}

/* ── 19 Satellite passes ──────────────────────────────────── */
async function passes(q: Q) {
  const lat = clampLat(num(q.get('lat'), 51.5)), lng = num(q.get('lng'), 0);
  const tle: string = await cached('tle-visual', 6 * 3600_000, () => getText('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle', 20000));
  const lines = tle.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const obs = { latitude: sat.degreesToRadians(lat), longitude: sat.degreesToRadians(lng), height: 0 };
  const now = Date.now(); const out: any[] = [];
  for (let i = 0; i + 2 < lines.length + 1 && out.length < 400; i += 3) {
    const name = lines[i], l1 = lines[i + 1], l2 = lines[i + 2];
    if (!l1?.startsWith('1 ') || !l2?.startsWith('2 ')) continue;
    let rec: any; try { rec = sat.twoline2satrec(l1, l2); } catch { continue; }
    let inPass = false; let start = 0; let maxEl = 0;
    for (let t = now; t < now + 12 * 3600_000; t += 60_000) {
      const d = new Date(t); const pv: any = sat.propagate(rec, d);
      if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
      const ecf = sat.eciToEcf(pv.position, sat.gstime(d));
      const el = sat.radiansToDegrees(sat.ecfToLookAngles(obs, ecf).elevation);
      if (el > 10 && !inPass) { inPass = true; start = t; maxEl = el; }
      else if (el > 10) maxEl = Math.max(maxEl, el);
      else if (inPass) { out.push({ name, start: new Date(start).toISOString(), end: d.toISOString(), max_el: Math.round(maxEl) }); inPass = false; if (out.length > 400) break; }
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return { lat, lng, passes: out.slice(0, 40), meta: meta('CelesTrak "visual" TLEs + SGP4 (satellite.js); next 12h, elevation >10°') };
}

/* ── 20 Cables ────────────────────────────────────────────── */
async function cables(q: Q) {
  const what = q.get('what') === 'landing' ? 'landing' : 'cable';
  return cached('cables-' + what, 24 * 3600_000, async () => {
    const url = what === 'landing' ? 'https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json' : 'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json';
    const d = await getJson(url, { timeout: 30000 });
    return { type: 'FeatureCollection', features: d.features, meta: meta('TeleGeography submarinecablemap.com (public GeoJSON)') };
  });
}

/* ── 22 Nuclear + Safecast ────────────────────────────────── */
async function nuclear() {
  return cached('nuclear', 24 * 3600_000, async () => {
    const [plants, status] = await Promise.all([
      getJson('https://raw.githubusercontent.com/cristianst85/GeoNuclearData/master/data/json/raw/4-nuclear_power_plants.json', { timeout: 30000 }),
      getJson('https://raw.githubusercontent.com/cristianst85/GeoNuclearData/master/data/json/raw/2-nuclear_power_plant_status_type.json').catch(() => []),
    ]);
    const st = new Map<number, string>((status as any[]).map((s: any) => [s.Id, s.Type]));
    const f = (plants as any[]).filter((p) => p.Latitude && p.Longitude).map((p) => pt(p.Longitude, p.Latitude, {
      name: p.Name, country: p.CountryCode, status: st.get(p.StatusId) || String(p.StatusId), model: p.ReactorModel, capacity_mw: p.Capacity, operational_from: p.OperationalFrom,
    }));
    return { ...fc(f), meta: meta('GeoNuclearData (cristianst85, ODbL)') };
  });
}
async function safecast(q: Q) {
  const lat = clampLat(num(q.get('lat'), 37.42)), lng = num(q.get('lng'), 141.03);
  const key = `sc-${lat.toFixed(1)},${lng.toFixed(1)}`;
  return cached(key, 30 * 60_000, async () => {
    const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
    const d = await getJson(`https://api.safecast.org/measurements.json?distance=50000&latitude=${lat}&longitude=${lng}&captured_after=${since}&per_page=200`, { timeout: 25000 });
    const f = (d as any[]).map((m) => pt(m.longitude, m.latitude, { value: m.value, unit: m.unit, captured: m.captured_at, usvh: m.unit === 'cpm' ? +(m.value / 334).toFixed(3) : m.value }));
    return { ...fc(f), meta: meta('Safecast API (CC0)', { radius_km: 50, note: 'µSv/h ≈ cpm/334 for bGeigie (approximate)' }) };
  });
}

/* ── 26 Anomalies ─────────────────────────────────────────── */
async function anomalies() {
  return cached('anom', 2 * 60_000, async () => {
    const out: any[] = [];
    const [fl, eq, io] = await Promise.allSettled([selfJson('/api/flights'), selfJson('/api/earthquakes', 20000), ioda()]);
    if (fl.status === 'fulfilled') {
      const cells = new Map<string, any[]>();
      for (const f of fl.value.military_flights || []) {
        if (f.grounded) continue;
        const k = `${Math.floor(f.lat / 2)},${Math.floor(f.lng / 2)}`;
        (cells.get(k) || cells.set(k, []).get(k)!).push(f);
      }
      for (const [, list] of cells) if (list.length >= 8) {
        const lat = list.reduce((s, f) => s + f.lat, 0) / list.length, lng = list.reduce((s, f) => s + f.lng, 0) / list.length;
        out.push({ type: 'military_cluster', severity: list.length >= 15 ? 'high' : 'medium', lat, lng, title: `${list.length} military aircraft within ~200 km`, detail: list.slice(0, 6).map((f) => f.callsign).join(', '), source: 'ADS-B (/api/flights)' });
      }
    }
    if (eq.status === 'fulfilled') {
      const qs = (eq.value.earthquakes || []).filter((q: any) => Date.now() - q.time < 24 * 3600_000);
      const cells = new Map<string, any[]>();
      for (const q of qs) { const k = `${Math.floor(q.lat)},${Math.floor(q.lng)}`; (cells.get(k) || cells.set(k, []).get(k)!).push(q); }
      for (const [, list] of cells) if (list.length >= 5) {
        out.push({ type: 'quake_swarm', severity: list.length >= 10 ? 'high' : 'medium', lat: list[0].lat, lng: list[0].lng, title: `Earthquake swarm: ${list.length} quakes in 24h`, detail: list[0].place, source: 'USGS' });
      }
    }
    if (io.status === 'fulfilled') {
      for (const c of io.value.countries.filter((c: any) => c.critical >= 2).slice(0, 10)) {
        out.push({ type: 'outage_spike', severity: c.critical >= 5 ? 'high' : 'medium', country: c.code, title: `Internet outage signals: ${c.name}`, detail: `${c.critical} critical / ${c.alerts} alerts in 24h (${c.sources.join(', ')})`, source: 'IODA' });
      }
    }
    if (ensureAis()) {
      const now = Date.now(); let dark = 0;
      for (const v of S.ships.values()) {
        if (v.t && now - v.t > 20 * 60_000 && now - v.t < 45 * 60_000 && (v.sog ?? 0) > 3) {
          dark++;
          if (dark <= 15) out.push({ type: 'ais_dark', severity: 'low', lat: v.lat, lng: v.lng, title: `AIS went quiet: ${v.name || v.mmsi}`, detail: `last seen ${Math.round((now - v.t) / 60000)} min ago at ${v.sog} kn`, source: 'AISStream' });
        }
      }
    }
    return { anomalies: out, meta: meta('Rule-based on live feeds', { rules: ['≥8 military aircraft in a 2° cell', '≥5 quakes in a 1° cell in 24h', '≥2 critical IODA alerts per country in 24h', 'AIS silent 20-45 min after moving >3 kn'] }) };
  });
}

/* ── 27 Dark ships (GFW SAR — token needed) ───────────────── */
async function darkships() {
  const tok = process.env.GFW_API_TOKEN;
  if (!tok) return { ...fc([]), meta: meta('Global Fishing Watch SAR vessel detections', { needsKey: 'GFW_API_TOKEN (free for non-commercial use at globalfishingwatch.org/our-apis)' }) };
  return cached('gfw', 6 * 3600_000, async () => {
    const end = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10), start = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);
    const d = await getJson(`https://gateway.api.globalfishingwatch.org/v3/4wings/report?spatial-resolution=LOW&temporal-resolution=ENTIRE&group-by=MATCHED&datasets[0]=public-global-sar-presence:latest&date-range=${start},${end}&format=JSON&spatial-aggregation=false`, { headers: { Authorization: `Bearer ${tok}` }, timeout: 40000 });
    const rows = d?.entries?.[0]?.['public-global-sar-presence:latest'] || [];
    const f = rows.slice(0, 5000).map((r: any) => pt(r.lon, r.lat, { detections: r.detections, matched: r.matched }));
    return { ...fc(f), meta: meta('Global Fishing Watch SAR presence', { range: `${start}..${end}` }) };
  });
}

/* ── 28 Sentinel-2 change (Element84 earth-search, keyless) ─ */
async function change(q: Q) {
  const b = (q.get('bbox') || '').split(',').map(Number);
  if (b.length !== 4 || b.some((x) => !Number.isFinite(x))) return { error: 'bbox=w,s,e,n required' };
  const search = (from: string, to: string) => getJson('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['sentinel-2-l2a'], bbox: b, datetime: `${from}/${to}`, limit: 1, query: { 'eo:cloud_cover': { lt: 30 } }, sortby: [{ field: 'properties.datetime', direction: 'desc' }] }),
    timeout: 25000,
  });
  const iso = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
  const [recent, older] = await Promise.all([search(iso(30), iso(0)), search(iso(400), iso(330))]);
  const pick = (r: any) => { const f = r.features?.[0]; return f ? { id: f.id, datetime: f.properties.datetime, cloud: f.properties['eo:cloud_cover'], preview: f.assets?.thumbnail?.href, visual: f.assets?.visual?.href } : null; };
  return { bbox: b, recent: pick(recent), year_ago: pick(older), meta: meta('Sentinel-2 L2A via Element84 earth-search STAC (keyless; ESA Copernicus data)') };
}

/* ── 29 Story (plane / ship) ──────────────────────────────── */
async function story(q: Q) {
  const hex = (q.get('hex') || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const mmsi = (q.get('mmsi') || '').replace(/\D/g, '');
  ensureHistory();
  const facts: any = {};
  if (hex) {
    facts.kind = 'aircraft';
    facts.registry = await cached('hexdb-' + hex, 24 * 3600_000, () => getJson(`https://hexdb.io/api/v1/aircraft/${hex}`)).catch(() => null);
    facts.track = S.history.map((s: any) => { const f = s.flights.find((x: any) => x[0] === hex); return f ? { t: s.t, lng: f[1], lat: f[2], callsign: f[4] } : null; }).filter(Boolean);
    const owner = facts.registry?.RegisteredOwners;
    if (owner) facts.sanctions = await selfJson(`/api/osint/sanctions?query=${encodeURIComponent(owner)}&limit=5`).catch(() => null);
  } else if (mmsi) {
    facts.kind = 'ship';
    const v = S.ships.get(Number(mmsi)) || S.ships.get(mmsi);
    facts.ais = v || null;
    if (v?.name) facts.sanctions = await selfJson(`/api/osint/sanctions?query=${encodeURIComponent(v.name)}&limit=5`).catch(() => null);
  } else return { error: 'hex or mmsi required' };
  const hitsN = facts.sanctions?.results?.length ?? facts.sanctions?.total ?? 0;
  const plain = facts.kind === 'aircraft'
    ? `${facts.registry?.Registration || hex.toUpperCase()} ${facts.registry?.Type || ''} owned by ${facts.registry?.RegisteredOwners || 'unknown owner'}. ${facts.track.length} positions in the 24h snapshot store. Sanctions matches for owner: ${hitsN}.`
    : `${facts.ais?.name || mmsi} (${shipKind(facts.ais?.type)}), dest ${facts.ais?.dest || 'unknown'}. Sanctions matches: ${hitsN}.`;
  const aiText = await ai('You are an OSINT analyst. Summarise ONLY the supplied facts in 4-6 short sentences: identity, owner/registry, track pattern (note anything unusual), sanctions hits. Never invent data; say "unknown" when missing.', JSON.stringify(facts).slice(0, 8000));
  return { facts, summary: aiText || plain, ai: !!aiText, meta: meta('hexdb.io registry, RemoteView history, OpenSanctions via /api/osint/sanctions' + (aiText ? ', AI summary' : '')) };
}

/* ── 30 Correlation timeline ──────────────────────────────── */
function km(a: number, b: number, c: number, d: number) {
  const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((d - b) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
async function correlate() {
  return cached('corr', 5 * 60_000, async () => {
    const [eq, pr, an] = await Promise.allSettled([selfJson('/api/earthquakes', 20000), protests(), anomalies()]);
    const items: any[] = [];
    if (eq.status === 'fulfilled') for (const q of (eq.value.earthquakes || []).slice(0, 200)) items.push({ feed: 'quake', t: q.time, lat: q.lat, lng: q.lng, title: `M${q.magnitude} ${q.place}` });
    if (pr.status === 'fulfilled') for (const f of pr.value.features.slice(0, 600)) items.push({ feed: f.properties.kind, t: Date.parse(f.properties.date), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], title: f.properties.name });
    if (an.status === 'fulfilled') for (const a of an.value.anomalies) if (a.lat != null) items.push({ feed: a.type, t: Date.now(), lat: a.lat, lng: a.lng, title: a.title });
    const links: any[] = [];
    for (let i = 0; i < items.length && links.length < 60; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      if (A.feed === B.feed) continue;
      if (Math.abs(A.t - B.t) > 12 * 3600_000) continue;
      const d = km(A.lat, A.lng, B.lat, B.lng);
      if (d < 150) links.push({ a: A, b: B, km: Math.round(d), hours: +(Math.abs(A.t - B.t) / 3600_000).toFixed(1) });
    }
    items.sort((a, b) => b.t - a.t);
    return { timeline: items.slice(0, 150), links, meta: meta('Cross-feed: USGS, GDELT, rule anomalies', { rule: 'different feeds within 150 km and 12 h' }) };
  });
}

/* ── 9/87 Briefing ────────────────────────────────────────── */
async function briefing() {
  return cached('brief', 10 * 60_000, async () => {
    const [eq, an, io, st, vo, la] = await Promise.allSettled([selfJson('/api/earthquakes', 20000), anomalies(), ioda(), storms(), volcanoes(), launches()]);
    const events: any[] = [];
    if (eq.status === 'fulfilled') for (const q of (eq.value.earthquakes || []).filter((q: any) => q.magnitude >= 5.5).slice(0, 5)) events.push({ score: q.magnitude * 10 + (q.tsunami ? 20 : 0), title: `M${q.magnitude} earthquake — ${q.place}`, why: q.tsunami ? 'Tsunami flag raised by USGS.' : q.magnitude >= 6.5 ? 'Strong enough to cause damage near populated areas.' : 'Notable quake; watch for aftershocks.', lat: q.lat, lng: q.lng, source: 'USGS' });
    if (an.status === 'fulfilled') for (const a of an.value.anomalies) events.push({ score: a.severity === 'high' ? 60 : a.severity === 'medium' ? 40 : 15, title: a.title, why: a.type === 'military_cluster' ? 'Unusual concentration of military aircraft can signal exercises or operations.' : a.type === 'outage_spike' ? 'Country-level connectivity loss can mean shutdowns, conflict or power failure.' : a.type === 'quake_swarm' ? 'Swarms can precede larger quakes or volcanic activity.' : 'Ships switching off AIS can indicate sanctions evasion.', lat: a.lat, lng: a.lng, source: a.source });
    if (st.status === 'fulfilled') for (const f of st.value.features.filter((f: any) => f.properties.kind === 'storm')) events.push({ score: f.properties.alert === 'Red' ? 70 : f.properties.alert === 'Orange' ? 50 : 30, title: `Tropical cyclone ${f.properties.name}`, why: `GDACS/NHC alert ${f.properties.alert || ''}: possible wind, surge and rain impacts.`, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], source: f.properties.source });
    if (vo.status === 'fulfilled') for (const f of vo.value.features.filter((f: any) => /WARNING|WATCH/.test(f.properties.alert))) events.push({ score: f.properties.alert === 'WARNING' ? 55 : 35, title: `${f.properties.name} volcano at ${f.properties.alert}`, why: 'Elevated alert level; ash can disrupt aviation.', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], source: 'USGS' });
    if (la.status === 'fulfilled') { const n = la.value.features[0]; if (n) events.push({ score: 12, title: `Next launch: ${n.properties.name}`, why: `NET ${n.properties.net} from ${n.properties.location}.`, lat: n.geometry.coordinates[1], lng: n.geometry.coordinates[0], source: 'Launch Library 2' }); }
    events.sort((a, b) => b.score - a.score);
    const top = events.slice(0, 5);
    const narr = await ai('You are a concise intelligence briefer. Using ONLY the provided events, write a 5-bullet morning briefing (one line each, plain English, why it matters). Do not add facts.', JSON.stringify(events.slice(0, 12)), { maxTokens: 500 });
    return { top, all: events.slice(0, 20), narrative: narr, ai: !!narr, provider: aiConfigured(), meta: meta('Rule-ranked from USGS, rule anomalies, IODA, GDACS/NHC, USGS volcanoes, LL2') };
  });
}

/* ── 25 Ask the map ───────────────────────────────────────── */
const LAYER_IDS = ['ships', 'gibs', 'lightning', 'launches', 'volcanoes', 'tsunami', 'iss', 'ioda', 'smoke', 'storms', 'jamming', 'power', 'protests', 'shake', 'cables', 'seaice', 'sst', 'nuclear', 'safecast', 'nightlights', 'anomalies', 'darkships'];
const PLACES: Record<string, [number, number, number]> = {
  ukraine: [31.2, 48.4, 5], gaza: [34.4, 31.4, 9], israel: [34.9, 31.5, 7], taiwan: [121, 23.7, 6], 'red sea': [39, 18, 5], sudan: [30.2, 15.5, 5], iran: [53.7, 32.4, 5], london: [-0.12, 51.5, 9], uk: [-2, 54, 5], 'united states': [-98, 39, 3.5], usa: [-98, 39, 3.5], europe: [10, 50, 3.6], japan: [138, 37, 5], china: [104, 35, 3.8], russia: [60, 60, 2.8], 'middle east': [45, 28, 4], africa: [20, 5, 3], california: [-119.5, 37, 5.5], hormuz: [56.4, 26.5, 7], suez: [32.5, 30.5, 7], panama: [-79.7, 9.1, 8], malacca: [101, 3, 6], korea: [127.5, 37, 6], india: [79, 22, 4.2], world: [10, 20, 1.6],
};
function ruleAsk(text: string) {
  const t = text.toLowerCase(); const actions: any[] = [];
  for (const [k, v] of Object.entries(PLACES)) if (t.includes(k)) { actions.push({ type: 'fly', lng: v[0], lat: v[1], zoom: v[2] }); break; }
  const syn: Record<string, string> = { ship: 'ships', vessel: 'ships', lightning: 'lightning', launch: 'launches', rocket: 'launches', volcano: 'volcanoes', tsunami: 'tsunami', iss: 'iss', 'space station': 'iss', outage: 'ioda', internet: 'ioda', smoke: 'smoke', storm: 'storms', hurricane: 'storms', typhoon: 'storms', cyclone: 'storms', jam: 'jamming', gps: 'jamming', power: 'power', protest: 'protests', unrest: 'protests', shake: 'shake', cable: 'cables', 'sea ice': 'seaice', 'sea surface': 'sst', sst: 'sst', nuclear: 'nuclear', radiation: 'safecast', 'night': 'nightlights', 'city lights': 'nightlights', anomal: 'anomalies', satellite: 'gibs', imagery: 'gibs' };
  const off = /\b(hide|turn off|remove|disable)\b/.test(t);
  for (const [k, v] of Object.entries(syn)) if (t.includes(k)) actions.push({ type: off ? 'layerOff' : 'layerOn', layer: v });
  if (/globe|3d/.test(t)) actions.push({ type: 'projection', value: 'globe' });
  if (/flat|mercator|2d/.test(t)) actions.push({ type: 'projection', value: 'mercator' });
  return actions;
}
async function ask(q: Q, body: any) {
  const text = String(body?.text || q.get('text') || '').slice(0, 500);
  if (!text) return { error: 'text required' };
  const sys = `You control a world map app. Reply ONLY with JSON {"actions":[...],"explain":"..."}.
Action types: {"type":"fly","lng":num,"lat":num,"zoom":num(1-12)}, {"type":"layerOn","layer":id}, {"type":"layerOff","layer":id}, {"type":"projection","value":"globe"|"mercator"}.
Valid layer ids: ${LAYER_IDS.join(', ')}.
"explain" = 1-3 sentences on what the user will see and which free data source it comes from. If the request is a question you cannot answer from the map, say so briefly. Never invent live numbers.`;
  const out = await ai(sys, text, { json: true, maxTokens: 400 });
  if (out) {
    try {
      const j = JSON.parse(out.replace(/^```json|```$/g, ''));
      const actions = (j.actions || []).filter((a: any) => ['fly', 'layerOn', 'layerOff', 'projection'].includes(a.type) && (a.type !== 'layerOn' && a.type !== 'layerOff' || LAYER_IDS.includes(a.layer)));
      return { actions, explain: String(j.explain || ''), ai: true, provider: aiConfigured() };
    } catch { /* fall through */ }
  }
  const actions = ruleAsk(text);
  return { actions, explain: actions.length ? 'Applied by keyword matching (AI not available).' : 'Try e.g. "show storms near Taiwan" or "turn on lightning".', ai: false, provider: aiConfigured() };
}
async function chat(body: any) {
  const msg = String(body?.text || '').slice(0, 1500);
  if (!msg) return { error: 'text required' };
  const b = await briefing().catch(() => null);
  const ctx = b ? JSON.stringify(b.all).slice(0, 6000) : '[]';
  const out = await ai('You are RemoteView\'s analyst. Answer using the live context provided (from free public feeds) and general knowledge; clearly separate live facts from background. Be brief. Never invent live numbers.', `Live context: ${ctx}\n\nQuestion: ${msg}`, { maxTokens: 600 });
  return { answer: out || 'AI is not configured (set XAI_API_KEY on the server).', ai: !!out, provider: aiConfigured() };
}

/* ── registry ─────────────────────────────────────────────── */
export const HANDLERS: Record<string, (q: Q, body?: any) => Promise<any>> = {
  ships: () => ships(), chokepoints: () => chokepoints(), lightning: () => lightning(), launches: () => launches(),
  volcanoes: () => volcanoes(), tsunami: () => tsunami(), iss: () => iss(), ioda: () => ioda(), smoke: () => smoke(),
  storms: () => storms(), jamming: () => jamming(), power: () => power(), protests: () => protests(), history: (q) => history(q),
  webcams: (q) => webcams(q), shake: () => shake(), passes: (q) => passes(q), cables: (q) => cables(q), nuclear: () => nuclear(),
  safecast: (q) => safecast(q), anomalies: () => anomalies(), darkships: () => darkships(), change: (q) => change(q),
  story: (q) => story(q), correlate: () => correlate(), briefing: () => briefing(), ask: (q, b) => ask(q, b), chat: (_q, b) => chat(b),
  status: async () => ({ ai: aiConfigured(), ais: !!process.env.AISSTREAM_API_KEY, windy: !!process.env.WINDY_WEBCAMS_KEY, gfw: !!process.env.GFW_API_TOKEN, lightning: S.lightningUp, history: S.history.length }),
};
export const AI_FEEDS = new Set(['ask', 'chat', 'story', 'briefing']);
