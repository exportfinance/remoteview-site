/* /live/[topic] snapshots — commercially-fine sources only, cached hourly. */
import { cached, getJson } from '@/lib/rvx/util';

const HOUR = 3600_000;
export type Row = Record<string, string | number | null>;
export type Snapshot = {
  headline: string; stat: string | null; statLabel: string; rows: Row[]; cols: [string, string][];
  points: [number, number][]; bbox: [number, number, number, number]; source: string; sourceUrl: string; fetched: string; note?: string;
};
export type Topic = { slug: string; title: string; h1: string; desc: string; kind: 'adsb-mil-eu' | 'adsb-taiwan' | 'aurora' | 'chokepoints' | 'uap'; demoLayers: string };

export const TOPICS: Topic[] = [
  { slug: 'military-aircraft-over-europe', title: 'Military aircraft over Europe — live map', h1: 'Military aircraft over Europe, live', desc: 'Military and government aircraft currently broadcasting ADS-B over Europe, from the open adsb.lol network. Updated hourly.', kind: 'adsb-mil-eu', demoLayers: 'flights,military' },
  { slug: 'flights-over-taiwan', title: 'Flights over Taiwan — live air traffic', h1: 'Flights over Taiwan, live', desc: 'Aircraft currently broadcasting ADS-B within ~250 nautical miles of Taiwan, from the open adsb.lol network. Updated hourly.', kind: 'adsb-taiwan', demoLayers: 'flights,military' },
  { slug: 'aurora-forecast', title: 'Aurora forecast tonight — live Kp index', h1: 'Aurora forecast, live', desc: 'Planetary Kp index and the 30-minute OVATION aurora forecast from NOAA’s Space Weather Prediction Center. Updated hourly.', kind: 'aurora', demoLayers: 'day_night' },
  { slug: 'busiest-shipping-chokepoints', title: 'The world’s busiest shipping chokepoints — map', h1: 'The world’s shipping chokepoints', desc: 'The maritime chokepoints that most global seaborne trade passes through, mapped. Live vessel tracking is in the full app.', kind: 'chokepoints', demoLayers: 'flights' },
  { slug: 'ufo-sightings-map', title: 'UFO / UAP sightings map — sources and how to check them', h1: 'UFO and UAP sightings: what you can actually check', desc: 'Where public UAP reports come from, which official sources exist, and how to check a sighting against live aircraft and satellites.', kind: 'uap', demoLayers: 'flights,satellites' },
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
