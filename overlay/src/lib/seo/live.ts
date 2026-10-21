/* /live/[topic] snapshots — commercially-fine sources only, cached hourly. */
import { cached, getJson } from '@/lib/rvx/util';
import { HANDLERS } from '@/lib/rvx/feeds';
import { countryList } from '@/lib/seo/data';

const HOUR = 3600_000;
export type Row = Record<string, string | number | null>;
export type Snapshot = {
  headline: string; stat: string | null; statLabel: string; rows: Row[]; cols: [string, string][];
  points: [number, number][]; bbox: [number, number, number, number]; source: string; sourceUrl: string; fetched: string; note?: string;
};
export type Topic = { slug: string; title: string; h1: string; desc: string; kind: 'adsb-mil-eu' | 'adsb-taiwan' | 'aurora' | 'chokepoints' | 'uap' | 'unrest' | 'outages' | 'quakes' | 'choke' | 'sitrooms'; demoLayers: string; choke?: string; group?: string };

export const TOPICS: Topic[] = [
  { slug: 'conflict-and-unrest-today', title: 'Conflict and unrest today: live world map', h1: 'Conflict and unrest, today', desc: 'Conflict-related events, protests and unrest reported around the world in the last day, from the GDELT 2.0 event database, by country. Updated hourly.', kind: 'unrest', demoLayers: '', group: 'Conflict' },
  { slug: 'situation-rooms', title: 'Situation rooms: Ukraine, Gaza, Taiwan, Red Sea and Sudan, live', h1: 'Situation rooms', desc: 'Live watch-views for the world’s hot spots: reported conflict and unrest, GPS jamming and anomaly signals for Ukraine, Gaza, Taiwan, the Red Sea and Sudan. Updated hourly.', kind: 'sitrooms', demoLayers: '', group: 'Conflict' },
  { slug: 'internet-outages-today', title: 'Internet outages today: live country map', h1: 'Internet outages, today', desc: 'Countries with internet outage alerts in the last 24 hours, from IODA (Georgia Tech) BGP, active probing and telescope signals. Updated hourly.', kind: 'outages', demoLayers: '', group: 'Infrastructure' },
  { slug: 'red-sea-shipping', title: 'Red Sea and Bab el-Mandeb shipping today', h1: 'Red Sea shipping, live', desc: 'Ships transiting the Bab el-Mandeb strait at the mouth of the Red Sea, with the share moving slowly or waiting, from live AIS. Updated hourly.', kind: 'choke', choke: 'bab', demoLayers: '', group: 'Shipping' },
  { slug: 'suez-canal-shipping', title: 'Suez Canal shipping today: live traffic', h1: 'Suez Canal shipping, live', desc: 'Vessels in and around the Suez Canal right now, with tanker counts and the share moving slowly, from live AIS. Updated hourly.', kind: 'choke', choke: 'suez', demoLayers: '', group: 'Shipping' },
  { slug: 'strait-of-hormuz-shipping', title: 'Strait of Hormuz shipping today: live tankers', h1: 'Strait of Hormuz shipping, live', desc: 'Tankers and other vessels in the Strait of Hormuz right now, from live AIS. Updated hourly.', kind: 'choke', choke: 'hormuz', demoLayers: '', group: 'Shipping' },
  { slug: 'panama-canal-shipping', title: 'Panama Canal shipping today: live traffic', h1: 'Panama Canal shipping, live', desc: 'Vessels at the Panama Canal approaches right now, with the share waiting, from live AIS. Updated hourly.', kind: 'choke', choke: 'panama', demoLayers: '', group: 'Shipping' },
  { slug: 'strait-of-malacca-shipping', title: 'Strait of Malacca shipping today: live traffic', h1: 'Strait of Malacca shipping, live', desc: 'Vessels transiting the Strait of Malacca right now, from live AIS. Updated hourly.', kind: 'choke', choke: 'malacca', demoLayers: '', group: 'Shipping' },
  { slug: 'busiest-shipping-chokepoints', title: 'The world’s busiest shipping chokepoints — map', h1: 'The world’s shipping chokepoints', desc: 'The maritime chokepoints that most global seaborne trade passes through, mapped. Live vessel tracking is in the full app.', kind: 'chokepoints', demoLayers: 'flights' },
  { slug: 'earthquakes-today', title: 'Earthquakes today: live world map (M4.5+)', h1: 'Earthquakes today', desc: 'Every magnitude 4.5+ earthquake in the last 24 hours from the USGS real-time feed, mapped. Updated hourly.', kind: 'quakes', demoLayers: '', group: 'Disasters' },
  { slug: 'aurora-forecast', title: 'Aurora forecast tonight — live Kp index', h1: 'Aurora forecast, live', desc: 'Planetary Kp index and the 30-minute OVATION aurora forecast from NOAA’s Space Weather Prediction Center. Updated hourly.', kind: 'aurora', demoLayers: 'day_night' },
  { slug: 'military-aircraft-over-europe', title: 'Military aircraft over Europe — live map', h1: 'Military aircraft over Europe, live', desc: 'Military and government aircraft currently broadcasting ADS-B over Europe, from the open adsb.lol network. Updated hourly.', kind: 'adsb-mil-eu', demoLayers: 'flights,military' },
  { slug: 'flights-over-taiwan', title: 'Flights over Taiwan — live air traffic', h1: 'Flights over Taiwan, live', desc: 'Aircraft currently broadcasting ADS-B within ~250 nautical miles of Taiwan, from the open adsb.lol network. Updated hourly.', kind: 'adsb-taiwan', demoLayers: 'flights,military' },
];
export const topicBySlug = (s: string) => TOPICS.find((t) => t.slug === s) || null;

const adsbLol = (path: string) => getJson(`https://api.adsb.lol${path}`, { timeout: 20000, headers: { 'user-agent': 'RemoteView/1.0 (+https://www.remoteview.online)' } });
const acRows = (ac: any[]) => ac.slice(0, 25).map((a) => ({ callsign: (a.flight || '').trim() || a.r || a.hex, type: a.t || a.desc || '—', alt: typeof a.alt_baro === 'number' ? `${Math.round(a.alt_baro).toLocaleString('en-US')} ft` : a.alt_baro === 'ground' ? 'ground' : '—' }));
const AC_COLS: [string, string][] = [['callsign', 'Callsign / reg'], ['type', 'Type'], ['alt', 'Altitude']];

export const CHOKEPOINTS: { name: string; lat: number; lng: number; links: string }[] = [
  { name: 'Strait of Malacca', lat: 2.5, lng: 101.3, links: 'Indian Ocean ↔ South China Sea' },
  { name: 'Strait of Hormuz', lat: 26.6, lng: 56.4, links: 'Persian Gulf ↔ Gulf of Oman' },
  { name: 'Suez Canal', lat: 30.6, lng: 32.3, links: 'Mediterranean ↔ Red Sea' },
  { name: 'Bab el-Mandeb', lat: 12.6, lng: 43.4, links: 'Red Sea ↔ Gulf of Aden' },
  { name: 'Panama Canal', lat: 9.1, lng: -79.7, links: 'Atlantic ↔ Pacific' },
  { name: 'Turkish Straits (Bosphorus)', lat: 41.1, lng: 29.06, links: 'Black Sea ↔ Mediterranean' },
  { name: 'Strait of Gibraltar', lat: 35.95, lng: -5.6, links: 'Atlantic ↔ Mediterranean' },
  { name: 'Danish Straits', lat: 55.6, lng: 11.0, links: 'Baltic ↔ North Sea' },
  { name: 'Dover Strait', lat: 51.0, lng: 1.45, links: 'English Channel ↔ North Sea' },
  { name: 'Cape of Good Hope', lat: -34.36, lng: 18.47, links: 'Atlantic ↔ Indian Ocean (route, not a strait)' },
  { name: 'Taiwan Strait', lat: 24.4, lng: 119.6, links: 'East China Sea ↔ South China Sea' },
  { name: 'Lombok Strait', lat: -8.5, lng: 115.7, links: 'Indian Ocean ↔ Java Sea' },
];

export async function snapshot(t: Topic): Promise<Snapshot> {
  return cached('seo-live-' + t.slug, HOUR, async () => {
    const fetched = new Date().toISOString();
    if (t.kind === 'sitrooms') {
      const R: [string, number, number, number, number][] = [['Ukraine', 22, 44, 41, 53], ['Gaza', 34.2, 31.2, 34.6, 31.6], ['Taiwan', 118, 21, 123, 26.5], ['Red Sea', 32, 11, 44, 28], ['Sudan', 21.8, 8.6, 38.6, 22.3]];
      const d: any = await HANDLERS.protests(new URLSearchParams()).catch(() => ({ features: [] }));
      const j: any = await HANDLERS.jamming(new URLSearchParams()).catch(() => ({ features: [] }));
      const inBox = (x: number, y: number, r: any) => x >= r[1] && x <= r[3] && y >= r[2] && y <= r[4];
      const ctr = (g: any): [number, number] | null => { const c = g?.type === 'Point' ? g.coordinates : g?.coordinates?.[0]?.[0]; return Array.isArray(c) && typeof c[0] === 'number' ? [c[0], c[1]] : null; };
      const pts: [number, number][] = [];
      const rows = R.map((r) => {
        const ev = (d.features || []).filter((e: any) => { const c = e.geometry?.coordinates; return c && inBox(c[0], c[1], r); });
        const jm = (j.features || []).filter((e: any) => { const c = ctr(e.geometry); return c && inBox(c[0], c[1], r); });
        pts.push([(r[1] + r[3]) / 2, (r[2] + r[4]) / 2]);
        return { room: r[0], unrest: ev.length, jamming: jm.length };
      });
      return { headline: 'Signals in each situation room now', stat: String(rows.reduce((a, r) => a + r.unrest, 0)), statLabel: 'conflict and unrest events across all rooms (estimate)', rows, cols: [['room', 'Situation room'], ['unrest', 'Unrest events (GDELT)'], ['jamming', 'GPS jamming cells']], points: pts, bbox: [-10, 0, 130, 60], source: 'GDELT Project 2.0; ADS-B position quality (derived)', sourceUrl: 'https://www.gdeltproject.org', fetched, note: 'Counts are estimates from automated news coding and aircraft position-accuracy reports, not verified incidents. Open a room in the app to see every layer live.' };
    }
    if (t.kind === 'unrest') {
      const d: any = await HANDLERS.protests(new URLSearchParams());
      const f = d.features || []; const by = new Map<string, number>();
      const names = new Map((await countryList().catch(() => [])).map((c) => [c.fips, c.name] as [string, string]));
      for (const e of f) { const c = names.get(e.properties?.country) || 'Other / unmatched'; by.set(c, (by.get(c) || 0) + 1); }
      const rows = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([country, n]) => ({ country, events: n }));
      return { headline: 'Reported conflict and unrest events by country', stat: String(f.length), statLabel: 'events in the latest GDELT window', rows, cols: [['country', 'Country'], ['events', 'Events']], points: f.map((e: any) => e.geometry.coordinates), bbox: [-180, -60, 180, 75], source: 'GDELT Project 2.0 (open)', sourceUrl: 'https://www.gdeltproject.org', fetched, note: 'GDELT codes news reports automatically, so counts are an estimate of reported activity, not verified incidents.' };
    }
    if (t.kind === 'outages') {
      const d: any = await HANDLERS.ioda(new URLSearchParams());
      const rows = (d.countries || []).slice(0, 30).map((c: any) => ({ country: c.name, critical: c.critical, warning: c.warning, last: String(c.last).slice(0, 16).replace('T', ' ') + ' UTC' }));
      return { headline: 'Countries with internet outage alerts, last 24h', stat: String((d.countries || []).length), statLabel: 'countries with alerts', rows, cols: [['country', 'Country'], ['critical', 'Critical'], ['warning', 'Warning'], ['last', 'Latest']], points: [], bbox: [-180, -60, 180, 75], source: 'IODA, Georgia Tech (open)', sourceUrl: 'https://ioda.inetintel.cc.gatech.edu', fetched, note: 'An alert means a signal dropped below normal; it can be a partial or local outage.' };
    }
    if (t.kind === 'choke') {
      const d: any = await HANDLERS.chokepoints(new URLSearchParams());
      const c = (d.chokepoints || []).find((x: any) => x.id === t.choke) || null;
      const rows = c ? [{ k: 'Vessels in area (last 30 min)', v: c.total }, { k: 'Moving under 1 knot', v: c.waiting_or_slow }, { k: 'Tankers', v: c.tankers }, { k: 'Slow-ship share (estimate)', v: c.delay_index == null ? '—' : c.delay_index + '%' }] : [];
      const [a, b, cc, dd] = c?.bbox || [0, 0, 1, 1]; const pad = 4;
      return { headline: c ? c.name + ' traffic now' : 'Chokepoint traffic', stat: c ? String(c.total) : null, statLabel: 'vessels seen in the last 30 minutes', rows, cols: [['k', 'Measure'], ['v', 'Now']], points: c ? [[(a + cc) / 2, (b + dd) / 2]] : [], bbox: [a - pad, b - pad, cc + pad, dd + pad], source: 'AIS via aisstream.io (derived)', sourceUrl: 'https://aisstream.io', fetched, note: 'AIS coverage varies and some ships switch transponders off, so counts are estimates. Zero can mean the live feed has only just started.' };
    }
    if (t.kind === 'quakes') {
      const d: any = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', { timeout: 15000 });
      const f = d.features || [];
      const rows = f.slice(0, 30).map((e: any) => ({ mag: 'M' + Number(e.properties.mag).toFixed(1), place: e.properties.place, time: new Date(e.properties.time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' }));
      return { headline: 'M4.5+ earthquakes, last 24 hours', stat: String(f.length), statLabel: 'earthquakes M4.5+ in 24h', rows, cols: [['mag', 'Mag'], ['place', 'Where'], ['time', 'Time']], points: f.map((e: any) => e.geometry.coordinates.slice(0, 2)), bbox: [-180, -60, 180, 75], source: 'USGS Earthquake Hazards Program (public domain)', sourceUrl: 'https://earthquake.usgs.gov', fetched };
    }
    if (t.kind === 'adsb-mil-eu') {
      const d: any = await adsbLol('/v2/mil');
      const ac = (d.ac || []).filter((a: any) => a.lat >= 34 && a.lat <= 72 && a.lon >= -25 && a.lon <= 45);
      return { headline: 'Military aircraft broadcasting over Europe', stat: String(ac.length), statLabel: 'aircraft at snapshot time', rows: acRows(ac), cols: AC_COLS, points: ac.map((a: any) => [a.lon, a.lat]), bbox: [-25, 34, 45, 72], source: 'adsb.lol (ODbL)', sourceUrl: 'https://adsb.lol', fetched, note: 'Only aircraft that choose to broadcast ADS-B appear; many military flights do not.' };
    }
    if (t.kind === 'adsb-taiwan') {
      const d: any = await adsbLol('/v2/point/23.7/121.0/250');
      const ac = d.ac || [];
      return { headline: 'Aircraft within ~250 nm of Taiwan', stat: String(ac.length), statLabel: 'aircraft at snapshot time', rows: acRows(ac), cols: AC_COLS, points: ac.map((a: any) => [a.lon, a.lat]), bbox: [116, 19.5, 126, 28], source: 'adsb.lol (ODbL)', sourceUrl: 'https://adsb.lol', fetched, note: 'Coverage depends on volunteer receivers; aircraft not broadcasting ADS-B are not shown.' };
    }
    if (t.kind === 'aurora') {
      const kp: any[] = await getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 15000 });
      const rows = kp.slice(1).slice(-8).reverse().map((r: any) => ({ time: String(r[0]).slice(0, 16) + ' UTC', kp: Number(r[1]).toFixed(2) }));
      const ov: any = await getJson('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', { timeout: 25000 }).catch(() => null);
      const pts: [number, number][] = (ov?.coordinates || []).filter((c: number[]) => c[2] >= 20).map((c: number[]) => [c[0] > 180 ? c[0] - 360 : c[0], c[1]]);
      return { headline: 'Planetary Kp index (NOAA SWPC)', stat: rows[0]?.kp ?? null, statLabel: 'latest Kp (0–9)', rows, cols: [['time', 'Time'], ['kp', 'Kp']], points: pts, bbox: [-180, -85, 180, 85], source: 'NOAA Space Weather Prediction Center (public domain)', sourceUrl: 'https://www.swpc.noaa.gov', fetched, note: ov ? `Map shows OVATION cells with ≥20% chance of visible aurora, forecast for ${ov['Forecast Time']}.` : undefined };
    }
    if (t.kind === 'chokepoints') {
      return { headline: 'Major maritime chokepoints', stat: String(CHOKEPOINTS.length), statLabel: 'chokepoints mapped', rows: CHOKEPOINTS.map((c) => ({ name: c.name, links: c.links })), cols: [['name', 'Chokepoint'], ['links', 'Connects']], points: CHOKEPOINTS.map((c) => [c.lng, c.lat]), bbox: [-180, -60, 180, 75], source: 'RemoteView reference list (positions approximate)', sourceUrl: '/credits', fetched, note: 'No vessel counts are shown here: live AIS ship tracking is part of the full app.' };
    }
    return { headline: 'UAP reports: no live public map here yet', stat: null, statLabel: '', rows: [
      { source: 'AARO (US DoD)', what: 'Official US government UAP office; publishes case resolutions and reports', url: 'https://www.aaro.mil' },
      { source: 'NASA UAP study', what: 'Independent study team report (2023)', url: 'https://science.nasa.gov/uap/' },
      { source: 'Live aircraft (adsb.lol)', what: 'Check a light in the sky against aircraft broadcasting at that time', url: '/demo' },
      { source: 'Satellites (CelesTrak)', what: 'Check against satellite passes, including Starlink trains', url: '/demo' },
    ], cols: [['source', 'Source'], ['what', 'What it offers']], points: [], bbox: [-180, -60, 180, 75], source: 'Official public sources listed above', sourceUrl: 'https://www.aaro.mil', fetched, note: 'Crowd-sourced sighting databases are not shown: we have not confirmed their licences allow commercial reuse.' };
  });
}

/** Tiny equirectangular dot map path data. */
export function dots(points: [number, number][], bbox: [number, number, number, number], w = 640, h = 320, limit = 400) {
  const [a, b, c, d] = bbox; const sx = w / (c - a), sy = h / (d - b);
  const seen = new Set<string>();
  return points.filter(([x, y]) => x >= a && x <= c && y >= b && y <= d).map(([x, y]) => [Math.round((x - a) * sx), Math.round((d - y) * sy)] as [number, number])
    .filter(([x, y]) => { const k = x + ',' + y; return seen.has(k) ? false : (seen.add(k), true); }).slice(0, limit);
}
/** Many points as one path of small squares (dense layers like aurora). */
export function dotPath(pts: [number, number][], r = 1.2) { const s = (r * 2).toFixed(1); return pts.map(([x, y]) => `M${x - r} ${y - r}h${s}v${s}h-${s}z`).join(''); }
