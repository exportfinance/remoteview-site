'use client';
/* RemoteView extras: extra map layers + panels (briefing, alerts, timeline, ask, tools,
   watchlists, replay, situation rooms). Attaches to the main MapLibre map via window.__rvMap. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const TEAL = '#2DD4BF';
const NAVY = 'rgba(6,16,30,0.94)';
const BORDER = '1px solid rgba(45,212,191,0.35)';

type Layer = {
  id: string; label: string; group: string; kind: 'geojson' | 'raster';
  url?: string; tiles?: (date: string) => string; maxzoom?: number; refreshMs?: number;
  style?: 'circle' | 'fill' | 'line' | 'heat' | 'cluster'; color?: string; colorExpr?: any; radius?: any;
};
const yday = () => new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
const gibs = (layer: string, lvl: number, ext: string) => (d: string) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${d}/GoogleMapsCompatible_Level${lvl}/{z}/{y}/{x}.${ext}`;

export const LAYERS: Layer[] = [
  { id: 'gibs', label: 'NASA true colour (daily)', group: 'Imagery', kind: 'raster', tiles: gibs('MODIS_Terra_CorrectedReflectance_TrueColor', 9, 'jpg'), maxzoom: 9 },
  { id: 'sst', label: 'Sea surface temperature', group: 'Imagery', kind: 'raster', tiles: gibs('GHRSST_L4_MUR_Sea_Surface_Temperature', 7, 'png'), maxzoom: 7 },
  { id: 'seaice', label: 'Sea ice (MODIS)', group: 'Imagery', kind: 'raster', tiles: gibs('MODIS_Terra_Sea_Ice', 7, 'png'), maxzoom: 7 },
  { id: 'nightlights', label: 'Night city lights', group: 'Imagery', kind: 'raster', tiles: () => gibs('VIIRS_Black_Marble', 8, 'png')('2016-01-01'), maxzoom: 8 },
  { id: 'lightning', label: 'Live lightning', group: 'Weather', kind: 'geojson', url: '/api/rvx/lightning', refreshMs: 20000, style: 'circle', color: '#FDE047', radius: 2.5 },
  { id: 'storms', label: 'Storms + forecast cones', group: 'Weather', kind: 'geojson', url: '/api/rvx/storms', refreshMs: 900000, style: 'circle', color: '#F472B6', radius: 7 },
  { id: 'smoke', label: 'Wildfire smoke (HMS)', group: 'Weather', kind: 'geojson', url: '/api/rvx/smoke', refreshMs: 3600000, style: 'fill', colorExpr: ['match', ['get', 'density'], 'heavy', '#9CA3AF', 'medium', '#6B7280', '#4B5563'] },
  { id: 'volcanoes', label: 'Volcano alerts', group: 'Hazards', kind: 'geojson', url: '/api/rvx/volcanoes', refreshMs: 1200000, style: 'circle', colorExpr: ['match', ['get', 'color'], 'RED', '#EF4444', 'ORANGE', '#F97316', 'YELLOW', '#EAB308', '#22C55E'], radius: 7 },
  { id: 'tsunami', label: 'Tsunami bulletins', group: 'Hazards', kind: 'geojson', url: '/api/rvx/tsunami', refreshMs: 300000, style: 'circle', colorExpr: ['match', ['get', 'level'], 'warning', '#EF4444', 'advisory', '#F97316', 'watch', '#EAB308', '#38BDF8'], radius: 8 },
  { id: 'shake', label: 'Quake shake rings', group: 'Hazards', kind: 'geojson', url: '/api/rvx/shake', refreshMs: 600000, style: 'circle', color: '#FB923C' },
  { id: 'aurora', label: 'Aurora forecast (OVATION)', group: 'Space', kind: 'geojson', url: '/api/rvx/aurora', refreshMs: 600000, style: 'heat', color: '#4ADE80' },
  { id: 'launches', label: 'Rocket launches', group: 'Space', kind: 'geojson', url: '/api/rvx/launches', refreshMs: 1800000, style: 'circle', color: '#A78BFA', radius: 6 },
  { id: 'iss', label: 'ISS + ground track', group: 'Space', kind: 'geojson', url: '/api/rvx/iss', refreshMs: 5000, style: 'circle', color: TEAL, radius: 7 },
  { id: 'ioda', label: 'Internet outages (IODA)', group: 'Infrastructure', kind: 'geojson', url: '/api/rvx/ioda', refreshMs: 600000, style: 'circle', color: '#F87171' },
  { id: 'cables', label: 'Submarine cables', group: 'Infrastructure', kind: 'geojson', url: '/api/rvx/cables', style: 'line', color: '#38BDF8' },
  { id: 'nuclear', label: 'Nuclear power plants', group: 'Infrastructure', kind: 'geojson', url: '/api/rvx/nuclear', style: 'circle', colorExpr: ['match', ['get', 'status'], 'Operational', '#84CC16', 'Under Construction', '#EAB308', '#64748B'], radius: 4 },
  { id: 'power', label: 'Power outages (California)', group: 'Infrastructure', kind: 'geojson', url: '/api/rvx/power', refreshMs: 900000, style: 'fill', color: '#F59E0B' },
  { id: 'jamming', label: 'GPS jamming (ADS-B)', group: 'Security', kind: 'geojson', url: '/api/rvx/jamming', refreshMs: 120000, style: 'fill', color: '#EF4444' },
  { id: 'protests', label: 'Protests & unrest (GDELT)', group: 'Security', kind: 'geojson', url: '/api/rvx/protests', refreshMs: 600000, style: 'heat', color: '#F43F5E' },
  { id: 'anomalies', label: 'Anomaly pins', group: 'Security', kind: 'geojson', url: '/api/rvx/anomalies', refreshMs: 120000, style: 'circle', color: '#FACC15', radius: 9 },
  { id: 'cover-ukef', label: 'UKEF cover status', group: 'Export credit', kind: 'geojson', url: '/api/rvx/cover-ukef', style: 'fill', colorExpr: ['match', ['get', 'status'], 'on', '#22C55E', 'partial', '#EAB308', 'off', '#EF4444', 'contact', '#60A5FA', 'rgba(0,0,0,0)'] },
  { id: 'cover-exim', label: 'US EXIM cover status', group: 'Export credit', kind: 'geojson', url: '/api/rvx/cover-exim', style: 'fill', colorExpr: ['match', ['get', 'status'], 'on', '#22C55E', 'partial', '#EAB308', 'off', '#EF4444', 'rgba(0,0,0,0)'] },
  { id: 'ufo', label: 'UFO reports (unverified, NUFORC)', group: 'Curiosities', kind: 'geojson', url: '/data/ufo/index.json', style: 'cluster', color: '#C084FC' },
  { id: 'ships', label: 'Live ships (AIS)', group: 'Maritime', kind: 'geojson', url: '/api/rvx/ships', refreshMs: 60000, style: 'circle', colorExpr: ['match', ['get', 'kind'], 'tanker', '#F97316', 'lng', '#22D3EE', 'cargo', '#A3E635', 'passenger', '#E879F9', 'military', '#EF4444', '#94A3B8'], radius: 2.5 },
];

/* Data provenance: how much weight each feed deserves. */
export const CONFIDENCE: Record<string, 'high' | 'medium' | 'low'> = {
  gibs: 'high', sst: 'high', seaice: 'high', nightlights: 'high', storms: 'high', smoke: 'high', volcanoes: 'high', tsunami: 'high', shake: 'medium',
  aurora: 'high', launches: 'high', iss: 'high', ioda: 'medium', cables: 'high', nuclear: 'medium', power: 'high', lightning: 'medium', jamming: 'medium',
  protests: 'low', anomalies: 'low', ships: 'medium', ufo: 'low', 'cover-ukef': 'high', 'cover-exim': 'high',
};
const CONF_COLOR = { high: '#22C55E', medium: '#EAB308', low: '#F97316' };

/* Convert odd API shapes into GeoJSON. */
function toGeo(id: string, d: any): any {
  if (!d) return { type: 'FeatureCollection', features: [] };
  if (id === 'iss' && d.position) return { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [d.position.lng, d.position.lat] }, properties: { name: 'ISS', alt_km: Math.round(d.position.alt_km), speed_kmh: Math.round(d.position.vel_kmh) } },
    ...splitTrack((d.track || []).map((p: number[]) => [p[0], p[1]])).map((c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { name: 'ISS ground track' } })),
  ] };
  if (id === 'ioda') return { type: 'FeatureCollection', features: (d.countries || []).map((c: any) => { const ll = CENTROIDS[c.code]; return ll ? { type: 'Feature', geometry: { type: 'Point', coordinates: ll }, properties: { name: c.name, critical: c.critical, alerts: c.alerts, sources: c.sources.join(', ') } } : null; }).filter(Boolean) };
  if (id === 'shake') return { type: 'FeatureCollection', features: (d.quakes || []).map((q: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lng, q.lat] }, properties: { name: `M${q.mag} ${q.place}`, mag: q.mag, felt_km_est: q.felt_km_est, mmi: q.mmi, url: q.url } })) };
  if (id === 'anomalies') return { type: 'FeatureCollection', features: (d.anomalies || []).filter((a: any) => a.lat != null).map((a: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { name: a.title, detail: a.detail, severity: a.severity, source: a.source } })) };
  return d;
}
function splitTrack(pts: number[][]) {
  const out: number[][][] = []; let cur: number[][] = [];
  for (const p of pts) { if (cur.length && Math.abs(p[0] - cur[cur.length - 1][0]) > 180) { out.push(cur); cur = []; } cur.push(p); }
  if (cur.length > 1) out.push(cur); return out;
}
/* Rough country centroids for IODA pins (ISO2 -> [lng, lat]). */
const CENTROIDS: Record<string, [number, number]> = { AF:[66,33],AL:[20,41],DZ:[3,28],AO:[17.5,-12.5],AR:[-64,-34],AM:[45,40],AU:[134,-25],AT:[14.5,47.5],AZ:[47.5,40.5],BD:[90,24],BY:[28,53],BE:[4.5,50.5],BJ:[2.3,9.5],BO:[-65,-17],BA:[18,44],BR:[-53,-10],BG:[25,43],BF:[-1.5,12.3],BI:[30,-3.4],KH:[105,13],CM:[12,6],CA:[-100,60],CF:[21,7],TD:[19,15],CL:[-71,-30],CN:[104,35],CO:[-73,4],CD:[23,-3],CG:[15,-1],CR:[-84,10],CI:[-5.5,7.5],HR:[16,45.5],CU:[-79,22],CY:[33,35],CZ:[15.5,49.8],DK:[10,56],DO:[-70.5,19],EC:[-78,-1.5],EG:[30,27],SV:[-89,13.8],GQ:[10,1.7],ER:[39,15],EE:[25,59],ET:[39,8],FI:[26,64],FR:[2,46],GA:[11.6,-0.6],GE:[43.5,42],DE:[10,51],GH:[-1,8],GR:[22,39],GT:[-90.3,15.5],GN:[-10,10],HT:[-72.3,19],HN:[-86.5,15],HU:[19.5,47],IN:[79,22],ID:[118,-2],IR:[53,32],IQ:[44,33],IE:[-8,53],IL:[35,31.5],IT:[12.5,42.8],JM:[-77.3,18.1],JP:[138,37],JO:[36,31],KZ:[67,48],KE:[38,0.5],KP:[127,40],KR:[128,36],XK:[21,42.6],KW:[47.7,29.3],KG:[75,41],LA:[103,18],LV:[25,57],LB:[35.8,33.9],LY:[17,27],LT:[24,55.3],MG:[47,-19],MW:[34,-13.5],MY:[102,4],ML:[-2,17],MR:[-10.5,20],MX:[-102,23],MD:[28.5,47],MN:[104,46.8],MA:[-6,32],MZ:[35,-18],MM:[96,21],NA:[17,-22],NP:[84,28],NL:[5.3,52.2],NZ:[172,-41],NI:[-85,12.9],NE:[8,17],NG:[8,9.5],NO:[9,61],OM:[57,21],PK:[69,30],PA:[-80,8.5],PG:[145,-6],PY:[-58,-23],PE:[-75,-10],PH:[122,12],PL:[19,52],PT:[-8,39.5],QA:[51.2,25.3],RO:[25,46],RU:[90,61],RW:[30,-2],SA:[45,24],SN:[-14.5,14.5],RS:[21,44],SL:[-11.8,8.5],SG:[103.8,1.35],SK:[19.5,48.7],SI:[15,46],SO:[46,6],ZA:[24,-29],SS:[30,7.5],ES:[-3.7,40.2],LK:[80.7,7.8],SD:[30,15.5],SE:[15,62],CH:[8.2,46.8],SY:[38.5,35],TW:[121,23.7],TJ:[71,39],TZ:[35,-6],TH:[101,15],TG:[1,8.5],TN:[9.5,34],TR:[35,39],TM:[59.5,39],UG:[32.4,1.3],UA:[31,49],AE:[54,24],GB:[-2,54],US:[-98,39],UY:[-56,-33],UZ:[64,41],VE:[-66,7],VN:[106,16],YE:[48,15.5],ZM:[28,-14],ZW:[30,-19],PS:[35.2,31.9],GM:[-15.4,13.4],GW:[-15,12],LR:[-9.4,6.4],TL:[125.7,-8.8],BT:[90.4,27.5],BW:[24,-22],LS:[28.2,-29.6],SZ:[31.5,-26.5],MU:[57.6,-20.3],FJ:[178,-17.8],BH:[50.5,26],MK:[21.7,41.6],ME:[19.3,42.7],IS:[-18,65],LU:[6.1,49.8],MT:[14.4,35.9],BN:[114.7,4.5],DJ:[42.6,11.8],KM:[43.3,-11.7],CV:[-24,16],ST:[6.6,0.2],SC:[55.5,-4.7],MV:[73.5,3.2],BS:[-77.4,24.2],BB:[-59.5,13.2],TT:[-61.2,10.7],GY:[-59,5],SR:[-56,4],BZ:[-88.5,17.2],PR:[-66.5,18.2] };

const SITROOMS: Record<string, { lng: number; lat: number; zoom: number; layers: string[] }> = {
  Ukraine: { lng: 32, lat: 48.5, zoom: 5, layers: ['protests', 'jamming', 'anomalies', 'ioda'] },
  Gaza: { lng: 34.4, lat: 31.4, zoom: 8.5, layers: ['protests', 'jamming', 'anomalies', 'ioda'] },
  Taiwan: { lng: 121, lat: 23.7, zoom: 6, layers: ['anomalies', 'jamming', 'storms', 'cables'] },
  'Red Sea': { lng: 40, lat: 17, zoom: 5, layers: ['ships', 'anomalies', 'jamming', 'cables'] },
  Sudan: { lng: 30.2, lat: 15.5, zoom: 5, layers: ['protests', 'ioda', 'anomalies'] },
};

type Watch = { id: string; type: 'area' | 'plane' | 'ship' | 'wallet'; label: string; value: string; bbox?: number[]; last?: string };
type Alert = { t: number; text: string; lng?: number; lat?: number };

function getMap(): any { return typeof window !== 'undefined' ? (window as any).__rvMap : null; }
async function getJ(url: string, init?: RequestInit) { const r = await fetch(url, init); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; }
const ago = (iso?: string | number) => { if (!iso) return '—'; const s = Math.round((Date.now() - (typeof iso === 'number' ? iso : Date.parse(iso))) / 1000); return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`; };

const btn: React.CSSProperties = { background: 'transparent', color: TEAL, border: BORDER, borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { background: '#0b1a2e', color: '#e6f1ff', border: BORDER, borderRadius: 5, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

export default function RvExtras() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'layers' | 'brief' | 'alerts' | 'timeline' | 'ask' | 'tools' | 'watch' | 'replay'>('layers');
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [meta, setMeta] = useState<Record<string, { source?: string; fetched?: string; count?: number; err?: string; needsKey?: string }>>({});
  const [gibsDate, setGibsDate] = useState(yday());
  const [globe, setGlobe] = useState(false);
  const [ufoFrom, setUfoFrom] = useState('2020-01-01');
  const [ufoTo, setUfoTo] = useState('2023-12-31');
  const [ufoHeat, setUfoHeat] = useState(false);
  const ufoRef = useRef({ from: '2020-01-01', to: '2023-12-31' });
  const [toast, setToast] = useState<string>('');
  const dataRef = useRef<Record<string, any>>({});
  const timers = useRef<Record<string, any>>({});
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { const f = () => setIsMobile(window.innerWidth < 768); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  /* ── URL state (shareable links) ── */
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const l = h.get('rvx'); if (l) setOn(Object.fromEntries(l.split(',').filter(Boolean).map((k) => [k, true])));
    if (h.get('gd')) setGibsDate(h.get('gd')!);
    if (h.get('globe') === '1') setGlobe(true);
    const v = h.get('v');
    if (v) { const [lng, lat, z] = v.split(',').map(Number); let tries = 0; const t = setInterval(() => { const m = getMap(); if (m && m.isStyleLoaded?.()) { tries++; m.jumpTo({ center: [lng, lat], zoom: z }); if (tries >= 3) clearInterval(t); } }, 2500); }
    if (h.get('open') === '1') setOpen(true);
  }, []);
  const shareUrl = useCallback(() => {
    const m = getMap(); const c = m?.getCenter(); const h = new URLSearchParams();
    const layers = Object.keys(on).filter((k) => on[k]); if (layers.length) h.set('rvx', layers.join(','));
    if (c) h.set('v', `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${m.getZoom().toFixed(1)}`);
    if (on.gibs) h.set('gd', gibsDate); if (globe) h.set('globe', '1');
    return `${location.origin}${location.pathname}#${h.toString()}`;
  }, [on, gibsDate, globe]);
  useEffect(() => { const u = shareUrl(); history.replaceState(null, '', u.slice(location.origin.length)); }, [on, gibsDate, globe, shareUrl]);

  /* ── layer plumbing ── */
  const addLayer = useCallback((m: any, L: Layer) => {
    const sid = `rvx-${L.id}`;
    if (m.getSource(sid)) return;
    const before = undefined;
    if (L.kind === 'raster') {
      m.addSource(sid, { type: 'raster', tiles: [L.tiles!(gibsDate)], tileSize: 256, maxzoom: L.maxzoom, attribution: 'NASA GIBS' });
      // put imagery under the vector overlays: insert before the first symbol layer
      const firstSym = (m.getStyle().layers || []).find((x: any) => x.type === 'symbol')?.id;
      m.addLayer({ id: sid, type: 'raster', source: sid, paint: { 'raster-opacity': L.id === 'nightlights' ? 0.9 : 0.85 } }, firstSym);
      return;
    }
    if (L.style === 'cluster') {
      m.addSource(sid, { type: 'geojson', data: toGeo(L.id, dataRef.current[L.id]), cluster: true, clusterRadius: 45, clusterMaxZoom: 9 });
      m.addSource(sid + '-h', { type: 'geojson', data: toGeo(L.id, dataRef.current[L.id]) });
      m.addLayer({ id: sid + '-heat', type: 'heatmap', source: sid + '-h', layout: { visibility: 'none' }, paint: { 'heatmap-radius': 14, 'heatmap-opacity': 0.75, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, 'rgba(192,132,252,0.45)', 0.7, '#C084FC', 1, '#F5F3FF'] } });
      m.addLayer({ id: sid + '-cl', type: 'circle', source: sid, filter: ['has', 'point_count'], paint: { 'circle-color': 'rgba(192,132,252,0.35)', 'circle-stroke-color': '#C084FC', 'circle-stroke-width': 1.5, 'circle-radius': ['step', ['get', 'point_count'], 12, 50, 17, 500, 24, 5000, 32] } });
      m.addLayer({ id: sid + '-ct', type: 'symbol', source: sid, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 }, paint: { 'text-color': '#F5F3FF' } });
      m.addLayer({ id: sid, type: 'circle', source: sid, filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 4.5, 'circle-color': '#C084FC', 'circle-stroke-color': '#06101E', 'circle-stroke-width': 1 } });
      return;
    }
    m.addSource(sid, { type: 'geojson', data: toGeo(L.id, dataRef.current[L.id]) });
    const color = L.colorExpr || L.color || TEAL;
    if (L.style === 'fill') {
      m.addLayer({ id: sid, type: 'fill', source: sid, filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': color, 'fill-opacity': L.id === 'jamming' ? ['interpolate', ['linear'], ['get', 'pct'], 10, 0.25, 60, 0.6] : 0.35, 'fill-outline-color': color } }, before);
    } else if (L.style === 'line') {
      m.addLayer({ id: sid, type: 'line', source: sid, filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: { 'line-color': ['coalesce', ['get', 'color'], color], 'line-width': 1.2, 'line-opacity': 0.75 } }, before);
    } else if (L.style === 'heat') {
      m.addLayer({ id: sid, type: 'heatmap', source: sid, paint: { 'heatmap-radius': 18, 'heatmap-intensity': 0.8, 'heatmap-opacity': 0.75, 'heatmap-weight': L.id === 'aurora' ? ['/', ['get', 'p'], 50] : 1, 'heatmap-color': L.id === 'aurora' ? ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, 'rgba(74,222,128,0.35)', 0.7, '#4ADE80', 1, '#F0ABFC'] : ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, 'rgba(244,63,94,0.4)', 0.7, '#F43F5E', 1, '#FDE68A'] } }, before);
      m.addLayer({ id: sid + '-pt', type: 'circle', source: sid, minzoom: 6, paint: { 'circle-radius': 4, 'circle-color': color, 'circle-stroke-color': '#06101E', 'circle-stroke-width': 1 } });
    } else {
      if (L.id === 'shake') {
        m.addLayer({ id: sid, type: 'circle', source: sid, paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, ['/', ['get', 'felt_km_est'], 80], 10, ['*', ['get', 'felt_km_est'], 12]], 'circle-color': 'rgba(251,146,60,0.12)', 'circle-stroke-color': '#FB923C', 'circle-stroke-width': 1.5 } });
        return;
      }
      if (L.id === 'storms' || L.id === 'iss' || L.id === 'cables') {
        m.addLayer({ id: sid + '-ln', type: 'line', source: sid, filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: { 'line-color': color, 'line-width': 1.5, 'line-dasharray': [2, 2] } });
        m.addLayer({ id: sid + '-fl', type: 'fill', source: sid, filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': color, 'fill-opacity': 0.15 } });
      }
      m.addLayer({ id: sid, type: 'circle', source: sid, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': L.id === 'ioda' ? ['interpolate', ['linear'], ['get', 'alerts'], 1, 5, 30, 14] : (L.radius ?? 5), 'circle-color': color, 'circle-opacity': 0.9, 'circle-stroke-color': '#06101E', 'circle-stroke-width': 1 } });
    }
  }, [gibsDate]);
  const removeLayer = (m: any, id: string) => {
    const sid = `rvx-${id}`;
    for (const suf of ['', '-pt', '-ln', '-fl', '-heat', '-cl', '-ct']) if (m.getLayer(sid + suf)) m.removeLayer(sid + suf);
    if (m.getSource(sid)) m.removeSource(sid);
    if (m.getSource(sid + '-h')) m.removeSource(sid + '-h');
  };
  const load = useCallback(async (L: Layer) => {
    if (!L.url) return;
    try {
      const d = await getJ(L.url);
      let data = d;
      if (L.id === 'ufo') {
        const { from, to } = ufoRef.current;
        const ys = Object.keys(d.years || {}).filter((y) => y >= from.slice(0, 4) && y <= to.slice(0, 4));
        const rows = (await Promise.all(ys.map((y) => getJ(`/data/ufo/${y}.json`).catch(() => [])))).flat().filter((r: any) => r[2] >= from && r[2] <= to);
        data = { type: 'FeatureCollection', meta: { source: d.source + ' — unverified public reports', fetched: d.built, total_records: d.records }, features: rows.map((r: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r[0], r[1]] }, properties: { label: 'Unverified public report', date: r[2], shape: r[3] || 'unknown', location: r[4], duration: r[5], summary: r[6] } })) };
        Object.assign(d, { meta: data.meta });
      }
      if (L.id === 'cables') {
        const lp = await getJ('/api/rvx/cables?what=landing').catch(() => null);
        data = { ...d, features: [...d.features, ...(lp?.features || [])] };
      }
      dataRef.current[L.id] = data;
      const g = toGeo(L.id, data);
      setMeta((s) => ({ ...s, [L.id]: { source: d.meta?.source, fetched: d.meta?.fetched, count: g.features?.length ?? 0, needsKey: d.meta?.needsKey, err: undefined } }));
      getMap()?.getSource(`rvx-${L.id}`)?.setData(g);
      getMap()?.getSource(`rvx-${L.id}-h`)?.setData(g);
    } catch (e) { setMeta((s) => ({ ...s, [L.id]: { ...s[L.id], err: (e as Error).message } })); }
  }, []);

  useEffect(() => {
    const tick = () => {
      const m = getMap(); if (!m || !m.isStyleLoaded?.()) return;
      for (const L of LAYERS) {
        const want = !!on[L.id]; const has = !!m.getSource(`rvx-${L.id}`);
        if (want && !has) { try { addLayer(m, L); } catch (e) { console.warn('rvx add', L.id, e); } }
        if (!want && has) removeLayer(m, L.id);
      }
      try { const p = m.getProjection?.()?.type; const target = globe ? 'globe' : null; if (target && p !== 'globe') m.setProjection({ type: 'globe' }); } catch { /* ignore */ }
    };
    tick(); const t = setInterval(tick, 1500); return () => clearInterval(t);
  }, [on, globe, addLayer]);

  useEffect(() => {
    for (const L of LAYERS) {
      if (on[L.id] && L.kind === 'geojson' && !timers.current[L.id]) {
        load(L);
        if (L.refreshMs) timers.current[L.id] = setInterval(() => load(L), L.refreshMs); else timers.current[L.id] = 'once';
      }
      if (!on[L.id] && timers.current[L.id]) { if (timers.current[L.id] !== 'once') clearInterval(timers.current[L.id]); delete timers.current[L.id]; }
    }
  }, [on, load]);

  useEffect(() => {
    ufoRef.current = { from: ufoFrom, to: ufoTo };
    if (on.ufo) { const L = LAYERS.find((x) => x.id === 'ufo')!; load(L); }
  }, [ufoFrom, ufoTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => {
      const m = getMap(); if (!m?.getLayer('rvx-ufo')) return;
      const vis = (id: string, v: boolean) => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
      vis('rvx-ufo-heat', ufoHeat); vis('rvx-ufo-cl', !ufoHeat); vis('rvx-ufo-ct', !ufoHeat); vis('rvx-ufo', !ufoHeat);
    }, 700);
    return () => clearInterval(t);
  }, [ufoHeat]);
  // GIBS date change: rebuild the raster source
  useEffect(() => { const m = getMap(); if (m && on.gibs) { removeLayer(m, 'gibs'); } }, [gibsDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Popups on click
  useEffect(() => {
    let bound: any = null;
    const t = setInterval(() => {
      const m = getMap(); if (!m || m === bound) return; bound = m;
      m.on('click', (e: any) => {
        const ids = LAYERS.filter((L) => L.kind === 'geojson').flatMap((L) => [`rvx-${L.id}`, `rvx-${L.id}-pt`, `rvx-${L.id}-fl`, `rvx-${L.id}-ln`, `rvx-${L.id}-cl`]).filter((id) => m.getLayer(id));
        if (!ids.length) return;
        const f = m.queryRenderedFeatures(e.point, { layers: ids })[0]; if (!f) return;
        if (f.layer.id.endsWith('-cl')) { m.easeTo({ center: e.lngLat, zoom: m.getZoom() + 2 }); return; }
        const lid = f.layer.id.replace(/^rvx-/, '').replace(/-(pt|fl|ln)$/, '');
        const md = meta[lid];
        const rows = Object.entries(f.properties || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object').slice(0, 10)
          .map(([k, v]) => `<div><span style="color:#7f97b2">${k}</span> ${String(v).startsWith('http') ? `<a href="${v}" target="_blank" rel="noopener" style="color:${TEAL}">link</a>` : String(v).replace(/</g, '&lt;')}</div>`).join('');
        const ml = (window as any).maplibregl;
        const html = `<div style="font:11px ui-monospace,monospace;color:#e6f1ff;max-width:260px">${rows}<div style="margin-top:6px;color:#7f97b2;border-top:1px solid #1e3a5f;padding-top:4px">source: ${md?.source || lid} · ${ago(md?.fetched)} · <span style="color:${CONF_COLOR[CONFIDENCE[lid] || 'medium']}">${CONFIDENCE[lid] || 'medium'} confidence</span></div></div>`;
        if (ml?.Popup) new ml.Popup({ className: 'rvx-popup', maxWidth: '280px' }).setLngLat(e.lngLat).setHTML(html).addTo(m);
        else setToast((f.properties?.name || f.properties?.title || lid) as string);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [meta]);

  const flyTo = (lng: number, lat: number, zoom = 6) => getMap()?.flyTo({ center: [lng, lat], zoom, essential: true });
  const toggle = (id: string, v?: boolean) => setOn((s) => ({ ...s, [id]: v ?? !s[id] }));
  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(''), 6000); };

  if (typeof window !== 'undefined' && window.location.pathname !== '/') return null;

  const groups = [...new Set(LAYERS.map((l) => l.group))];
  return (
    <>
      <button aria-label="Open RemoteView extras" onClick={() => setOpen((o) => !o)}
        style={{ position: 'fixed', zIndex: 60, right: isMobile ? 10 : 16, bottom: isMobile ? 84 : 64, background: NAVY, color: TEAL, border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 11, letterSpacing: 2, fontWeight: 700, fontFamily: 'ui-monospace,monospace', boxShadow: '0 0 18px rgba(45,212,191,0.15)', cursor: 'pointer' }}>
        {open ? '✕ CLOSE' : '◎ EXTRAS'}
      </button>
      {toast && <div role="status" style={{ position: 'fixed', zIndex: 70, left: '50%', transform: 'translateX(-50%)', top: 70, background: NAVY, color: '#e6f1ff', border: BORDER, borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'ui-monospace,monospace', maxWidth: '90vw' }}>{toast}</div>}
      {open && (
        <div data-testid="rvx-panel" style={{ position: 'fixed', zIndex: 59, right: isMobile ? 0 : 16, left: isMobile ? 0 : 'auto', bottom: isMobile ? 128 : 108, width: isMobile ? '100%' : 360, maxHeight: isMobile ? '55vh' : '70vh', overflow: 'auto', background: NAVY, border: BORDER, borderRadius: isMobile ? '10px 10px 0 0' : 10, color: '#cfe3f5', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12, backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, borderBottom: BORDER, position: 'sticky', top: 0, background: NAVY }}>
            {(['layers', 'brief', 'alerts', 'timeline', 'ask', 'tools', 'watch', 'replay'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ ...btn, background: tab === t ? 'rgba(45,212,191,0.18)' : 'transparent', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>{t}</button>
            ))}
          </div>
          <div style={{ padding: 10 }}>
            {tab === 'layers' && (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button style={btn} onClick={() => { navigator.clipboard?.writeText(shareUrl()); notify('Link copied'); }}>⧉ Copy link</button>
                  <button style={btn} onClick={() => { setGlobe((g) => !g); if (globe) try { getMap()?.setProjection({ type: 'mercator' }); } catch {} }}>{globe ? '▭ Flat map' : '◍ 3D globe'}</button>
                  <button style={btn} onClick={() => { setGlobe(true); toggle('nightlights', true); }}>☾ Globe + night lights</button>
                </div>
                <div style={{ marginBottom: 8, color: '#7f97b2', fontSize: 10, letterSpacing: 1 }}>SITUATION ROOMS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {Object.entries(SITROOMS).map(([k, v]) => (
                    <button key={k} style={btn} onClick={() => { flyTo(v.lng, v.lat, v.zoom); setOn((s) => ({ ...s, ...Object.fromEntries(v.layers.map((l) => [l, true])) })); }}>{k}</button>
                  ))}
                </div>
                {groups.map((g) => (
                  <div key={g} style={{ marginBottom: 8 }}>
                    <div style={{ color: '#7f97b2', fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>{g.toUpperCase()}</div>
                    {LAYERS.filter((l) => l.group === g).map((l) => {
                      const md = meta[l.id];
                      return (
                        <label key={l.id} data-layer={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 4px', borderRadius: 5, cursor: 'pointer', background: on[l.id] ? 'rgba(45,212,191,0.07)' : 'transparent' }}>
                          <input type="checkbox" checked={!!on[l.id]} onChange={() => toggle(l.id)} style={{ accentColor: TEAL, marginTop: 2 }} />
                          <span style={{ flex: 1 }}>
                            <span style={{ color: on[l.id] ? TEAL : '#cfe3f5' }}>{l.label}</span>
                            {on[l.id] && l.kind === 'geojson' && (
                              <span style={{ display: 'block', color: md?.err ? '#f87171' : md?.needsKey ? '#fbbf24' : '#7f97b2', fontSize: 10 }}>
                                {md?.err ? `error: ${md.err}` : md?.needsKey ? `needs key: ${md.needsKey}` : md ? `${md.count} items · ${md.source} · ${ago(md.fetched)}` : 'loading…'}
                                {md && !md.err && !md.needsKey && <span style={{ color: CONF_COLOR[CONFIDENCE[l.id] || 'medium'] }}> · {CONFIDENCE[l.id] || 'medium'} confidence</span>}
                              </span>
                            )}
                            {on[l.id] && l.kind === 'raster' && <span style={{ display: 'block', color: '#7f97b2', fontSize: 10 }}>NASA GIBS{l.id === 'gibs' ? ` · ${gibsDate}` : l.id === 'nightlights' ? ' · Black Marble 2016' : ` · ${gibsDate}`}</span>}
                          </span>
                          {(l.id === 'cover-ukef' || l.id === 'cover-exim') && on[l.id] && (
                            <span style={{ fontSize: 10, display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: '#22C55E' }}>■ open</span><span style={{ color: '#EAB308' }}>■ partial</span><span style={{ color: '#EF4444' }}>■ off cover</span>{l.id === 'cover-ukef' && <span style={{ color: '#60A5FA' }}>■ contact UKEF</span>}
                            </span>
                          )}
                          {l.id === 'ufo' && on.ufo && (
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }} onClick={(e) => e.preventDefault()}>
                              <input aria-label="UFO from" type="date" value={ufoFrom} min="1925-01-01" max="2023-12-31" onChange={(e) => setUfoFrom(e.target.value)} style={{ ...input, width: 128, padding: '2px 4px' }} />
                              <input aria-label="UFO to" type="date" value={ufoTo} min="1925-01-01" max="2023-12-31" onChange={(e) => setUfoTo(e.target.value)} style={{ ...input, width: 128, padding: '2px 4px' }} />
                              <button style={{ ...btn, padding: '2px 4px' }} onClick={() => setUfoHeat((h) => !h)}>{ufoHeat ? 'Clusters' : 'Heatmap'}</button>
                            </span>
                          )}
                          {l.id === 'gibs' && on.gibs && <input type="date" value={gibsDate} max={yday()} onChange={(e) => setGibsDate(e.target.value)} style={{ ...input, width: 128, padding: '2px 4px' }} />}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {tab === 'brief' && <Briefing flyTo={flyTo} />}
            {tab === 'alerts' && <Alerts flyTo={flyTo} />}
            {tab === 'timeline' && <Timeline flyTo={flyTo} />}
            {tab === 'ask' && <Ask apply={(acts) => {
              for (const a of acts) {
                if (a.type === 'fly') flyTo(a.lng, a.lat, a.zoom);
                if (a.type === 'layerOn') toggle(a.layer, true);
                if (a.type === 'layerOff') toggle(a.layer, false);
                if (a.type === 'projection') { setGlobe(a.value === 'globe'); if (a.value !== 'globe') try { getMap()?.setProjection({ type: 'mercator' }); } catch {} }
              }
            }} />}
            {tab === 'tools' && <Tools />}
            {tab === 'watch' && <Watchlist notify={notify} />}
            {tab === 'replay' && <Replay />}
          </div>
        </div>
      )}
      <WatchRunner notify={notify} />
      <PwaRegister />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><div style={{ color: TEAL, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>{title}</div>{children}</div>;
}

function Briefing({ flyTo }: { flyTo: (a: number, b: number, z?: number) => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { getJ('/api/rvx/briefing').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <div style={{ color: '#f87171' }}>{err}</div>;
  if (!d) return <div>Building briefing…</div>;
  return (
    <div>
      <Section title={`TOP 5 RIGHT NOW · ${d.ai ? 'AI narrative (xAI Grok)' : 'rule-based'}`}>
        {d.top.map((e: any, i: number) => (
          <div key={i} style={{ marginBottom: 8, cursor: e.lat != null ? 'pointer' : 'default' }} onClick={() => e.lat != null && flyTo(e.lng, e.lat, 6)}>
            <div style={{ color: '#e6f1ff' }}>{i + 1}. {e.title}</div>
            <div style={{ color: '#7f97b2', fontSize: 11 }}>{e.why} <span style={{ color: '#4b6a88' }}>[{e.source}]</span></div>
          </div>
        ))}
      </Section>
      {d.narrative && <Section title="DAILY BRIEFING"><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.narrative}</div></Section>}
      <div style={{ color: '#4b6a88', fontSize: 10 }}>{d.meta?.source} · {ago(d.meta?.fetched)}</div>
    </div>
  );
}

function Notices() {
  const [t, setT] = useState<any>(null); const [w, setW] = useState<any>(null);
  useEffect(() => { getJ('/api/rvx/tfr').then(setT).catch(() => {}); getJ('/api/rvx/outbreaks').then(setW).catch(() => {}); }, []);
  return (
    <>
      <Section title={`WHO DISEASE OUTBREAK NEWS${w ? ` (${w.items.length})` : ''}`}>
        {w?.items.slice(0, 8).map((i: any, k: number) => <div key={k} style={{ fontSize: 11, marginBottom: 3 }}><span style={{ color: '#7f97b2' }}>{String(i.date).slice(0, 10)}</span> <a href={i.url} target="_blank" rel="noopener" style={{ color: '#e6f1ff' }}>{i.title}</a></div>)}
      </Section>
      <Section title={`FAA TEMPORARY FLIGHT RESTRICTIONS${t ? ` (${t.tfrs.length})` : ''}`}>
        {t?.tfrs.slice(0, 12).map((i: any, k: number) => <div key={k} style={{ fontSize: 11, marginBottom: 3 }}><span style={{ color: TEAL }}>{i.type}</span> {i.description} <span style={{ color: '#7f97b2' }}>({i.id})</span></div>)}
      </Section>
    </>
  );
}

function Alerts({ flyTo }: { flyTo: (a: number, b: number, z?: number) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { const f = () => getJ('/api/rvx/anomalies').then(setD).catch(() => {}); f(); const t = setInterval(f, 120000); return () => clearInterval(t); }, []);
  if (!d) return <div>Scanning feeds…</div>;
  return (
    <Section title={`ANOMALIES (${d.anomalies.length})`}>
      {!d.anomalies.length && <div style={{ color: '#7f97b2' }}>No anomalies flagged right now.</div>}
      {d.anomalies.map((a: any, i: number) => (
        <div key={i} onClick={() => a.lat != null && flyTo(a.lng, a.lat, 6)} style={{ marginBottom: 6, cursor: 'pointer', borderLeft: `3px solid ${a.severity === 'high' ? '#ef4444' : a.severity === 'medium' ? '#f59e0b' : '#64748b'}`, paddingLeft: 6 }}>
          <div style={{ color: '#e6f1ff' }}>{a.title}</div><div style={{ color: '#7f97b2', fontSize: 11 }}>{a.detail} · {a.source}</div>
        </div>
      ))}
      <div style={{ color: '#4b6a88', fontSize: 10, marginTop: 6 }}>Rules: {d.meta?.rules?.join('; ')}</div>
      <Notices />
    </Section>
  );
}

function Timeline({ flyTo }: { flyTo: (a: number, b: number, z?: number) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { getJ('/api/rvx/correlate').then(setD).catch(() => {}); }, []);
  if (!d) return <div>Correlating…</div>;
  return (
    <div>
      <Section title={`LINKED EVENTS (${d.links.length}) — ${d.meta?.rule}`}>
        {d.links.slice(0, 20).map((l: any, i: number) => (
          <div key={i} onClick={() => flyTo(l.a.lng, l.a.lat, 7)} style={{ marginBottom: 6, cursor: 'pointer' }}>
            <div style={{ color: '#e6f1ff' }}>{l.a.feed}: {l.a.title}</div>
            <div style={{ color: TEAL, fontSize: 11 }}>↔ {l.b.feed}: {l.b.title} <span style={{ color: '#7f97b2' }}>({l.km} km, {l.hours} h)</span></div>
          </div>
        ))}
      </Section>
      <Section title="TIMELINE">
        {d.timeline.slice(0, 40).map((e: any, i: number) => (
          <div key={i} onClick={() => flyTo(e.lng, e.lat, 6)} style={{ cursor: 'pointer', fontSize: 11, marginBottom: 3 }}><span style={{ color: '#7f97b2' }}>{new Date(e.t).toLocaleTimeString()}</span> <span style={{ color: TEAL }}>{e.feed}</span> {e.title}</div>
        ))}
      </Section>
    </div>
  );
}

function Ask({ apply }: { apply: (a: any[]) => void }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [out, setOut] = useState<any>(null); const [mode, setMode] = useState<'map' | 'chat'>('map');
  const [listening, setListening] = useState(false);
  const go = async (t = text) => {
    if (!t.trim()) return; setBusy(true);
    try {
      const d = await getJ(`/api/rvx/${mode === 'map' ? 'ask' : 'chat'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
      setOut(d); if (d.actions) apply(d.actions);
    } catch (e) { setOut({ explain: (e as Error).message }); }
    setBusy(false);
  };
  const voice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setOut({ explain: 'Voice control is not supported in this browser (try Chrome or Safari).' }); return; }
    const r = new SR(); r.lang = 'en-GB'; r.interimResults = false; setListening(true);
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setText(t); go(t); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false); r.start();
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button style={{ ...btn, background: mode === 'map' ? 'rgba(45,212,191,0.18)' : 'transparent' }} onClick={() => setMode('map')}>Ask the map</button>
        <button style={{ ...btn, background: mode === 'chat' ? 'rgba(45,212,191,0.18)' : 'transparent' }} onClick={() => setMode('chat')}>Analyst chat</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); go(); }} style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Ask" style={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'map' ? 'e.g. show storms and lightning near Taiwan' : 'e.g. what is happening in the Red Sea?'} />
        <button type="button" title="Voice" style={btn} onClick={voice}>{listening ? '●' : '🎙'}</button>
        <button type="submit" style={{ ...btn, background: TEAL, color: '#06101E' }} disabled={busy}>{busy ? '…' : 'Go'}</button>
      </form>
      {out && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {out.explain || out.answer}
        {out.actions?.length ? <div style={{ color: '#7f97b2', fontSize: 10, marginTop: 4 }}>actions: {out.actions.map((a: any) => a.type + (a.layer ? ':' + a.layer : '')).join(', ')}</div> : null}
        <div style={{ color: '#4b6a88', fontSize: 10, marginTop: 4 }}>{out.ai ? `AI: ${out.provider}` : 'keyword fallback'}</div>
      </div>}
    </div>
  );
}

function usePick(): [boolean, () => Promise<{ lng: number; lat: number }>] {
  const [picking, setPicking] = useState(false);
  const pick = () => new Promise<{ lng: number; lat: number }>((res) => {
    const m = getMap(); if (!m) return; setPicking(true);
    m.getCanvas().style.cursor = 'crosshair';
    m.once('click', (e: any) => { m.getCanvas().style.cursor = ''; setPicking(false); res({ lng: e.lngLat.lng, lat: e.lngLat.lat }); });
  });
  return [picking, pick];
}

function Tools() {
  const [picking, pick] = usePick();
  const [passes, setPasses] = useState<any>(null); const [cams, setCams] = useState<any>(null); const [rad, setRad] = useState<any>(null);
  const [chg, setChg] = useState<any>(null); const [story, setStory] = useState<any>(null); const [sid, setSid] = useState(''); const [busy, setBusy] = useState('');
  const run = async (k: string, f: () => Promise<void>) => { setBusy(k); try { await f(); } catch (e) { alert((e as Error).message); } setBusy(''); };
  const [dos, setDos] = useState<any>(null);
  return (
    <div>
      <Section title="COUNTRY DOSSIER (Factbook + export credit cover)">
        <button style={btn} onClick={() => run('dos', async () => { const p = await pick(); setDos(await getJ(`/api/rvx/dossier?lat=${p.lat}&lng=${p.lng}`)); })}>{picking ? 'Click a country…' : busy === 'dos' ? 'Loading…' : 'Pick a country'}</button>
        {dos && <Dossier d={dos} />}
      </Section>
      <Section title="SATELLITE FLYOVERS">
        <button style={btn} onClick={() => run('passes', async () => { const p = await pick(); setPasses(await getJ(`/api/rvx/passes?lat=${p.lat}&lng=${p.lng}`)); })}>{picking ? 'Click the map…' : busy === 'passes' ? 'Computing…' : 'Pick a spot'}</button>
        {passes && <div style={{ marginTop: 6, fontSize: 11 }}>{passes.passes.slice(0, 12).map((p: any, i: number) => <div key={i}>{new Date(p.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <span style={{ color: TEAL }}>{p.name}</span> max {p.max_el}°</div>)}<div style={{ color: '#4b6a88', fontSize: 10 }}>{passes.meta.source}</div></div>}
      </Section>
      <Section title="WEBCAMS NEAR A POINT">
        <button style={btn} onClick={() => run('cams', async () => { const p = await pick(); setCams(await getJ(`/api/rvx/webcams?lat=${p.lat}&lng=${p.lng}`)); })}>Pick a spot</button>
        {cams && (cams.meta?.needsKey ? <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>Needs key: {cams.meta.needsKey}</div> : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>{cams.webcams.map((w: any) => <a key={w.id} href={w.player} target="_blank" rel="noopener"><img src={w.thumb} alt={w.title} style={{ width: '100%' }} /></a>)}</div>)}
      </Section>
      <Section title="RADIATION (SAFECAST)">
        <button style={btn} onClick={() => run('rad', async () => { const p = await pick(); setRad(await getJ(`/api/rvx/safecast?lat=${p.lat}&lng=${p.lng}`)); })}>Pick a spot</button>
        {rad && <div style={{ fontSize: 11, marginTop: 4 }}>{rad.features.length ? `${rad.features.length} readings within 50 km (last year). Median ≈ ${median(rad.features.map((f: any) => f.properties.usvh))} µSv/h` : 'No Safecast readings within 50 km in the last year.'}</div>}
      </Section>
      <Section title="SENTINEL-2 CHANGE (current view)">
        <button style={btn} onClick={() => run('chg', async () => { const b = getMap()?.getBounds(); if (!b) return; setChg(await getJ(`/api/rvx/change?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x: number) => x.toFixed(3)).join(',')}`)); })}>{busy === 'chg' ? 'Searching…' : 'Compare now vs a year ago'}</button>
        {chg && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, fontSize: 10 }}>
          {[['Year ago', chg.year_ago], ['Recent', chg.recent]].map(([l, s]: any) => <div key={l}>{l}: {s ? new Date(s.datetime).toLocaleDateString() : 'no clear scene'}{s?.preview && <img src={s.preview} alt={l} style={{ width: '100%', marginTop: 2 }} />}</div>)}
        </div>}
      </Section>
      <Section title="STORY MODE (plane hex / ship MMSI)">
        <div style={{ display: 'flex', gap: 6 }}><input style={input} value={sid} onChange={(e) => setSid(e.target.value)} placeholder="e.g. a835af or 235012345" />
          <button style={btn} onClick={() => run('story', async () => { const q = /^\d{9}$/.test(sid.trim()) ? `mmsi=${sid.trim()}` : `hex=${sid.trim()}`; setStory(await getJ(`/api/rvx/story?${q}`)); })}>{busy === 'story' ? '…' : 'Tell'}</button></div>
        {story && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{story.summary}<div style={{ color: '#4b6a88', fontSize: 10 }}>{story.meta?.source}</div></div>}
      </Section>
    </div>
  );
}
function KV({ o }: { o: Record<string, string> }) {
  return <>{Object.entries(o || {}).map(([k, v]) => <div key={k} style={{ fontSize: 11, marginBottom: 3 }}><span style={{ color: '#7f97b2' }}>{k}:</span> {v}</div>)}</>;
}
const yn = (b: boolean) => <span style={{ color: b ? '#22C55E' : '#EF4444' }}>{b ? 'yes' : 'no'}</span>;
function Dossier({ d }: { d: any }) {
  if (!d.country) return <div style={{ marginTop: 6 }}>No country at that point (sea or unlisted territory).</div>;
  const fb = d.factbook; const uk = d.ukef; const ex = d.exim;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {fb?.flag && <img src={fb.flag} alt="" style={{ height: 22, border: '1px solid #1e3a5f' }} />}
        <span style={{ color: '#e6f1ff', fontSize: 14 }}>{d.country.name}</span>
      </div>
      <div style={{ color: TEAL, fontSize: 11, margin: '8px 0 4px' }}>EXPORT CREDIT COVER</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ border: BORDER, borderRadius: 6, padding: 6 }}>
          <div style={{ color: '#e6f1ff' }}>UKEF</div>
          {uk?.row ? <><div style={{ fontSize: 11 }}>Market risk appetite: {uk.row.appetite}</div><div style={{ fontSize: 11 }}>Short term: {uk.row.short}</div><div style={{ fontSize: 11 }}>Medium/long term: {uk.row.mlt}</div>{uk.row.notes.map((n: string, i: number) => <div key={i} style={{ fontSize: 10, color: '#9fb3c8', marginTop: 3 }}>{n}</div>)}</> : <div style={{ fontSize: 11 }}>{uk?.error || 'Not listed by UKEF'}</div>}
          <div style={{ fontSize: 10, color: '#4b6a88', marginTop: 4 }}>Updated {uk?.updated?.slice(0, 10)} · <a href={uk?.url} target="_blank" rel="noopener" style={{ color: TEAL }}>gov.uk</a> · OGL</div>
        </div>
        <div style={{ border: BORDER, borderRadius: 6, padding: 6 }}>
          <div style={{ color: '#e6f1ff' }}>US EXIM</div>
          {ex?.row ? <><div style={{ fontSize: 11 }}>Public: ≤1y {yn(ex.row.public.st)} · 1-7y {yn(ex.row.public.mt)} · 7y+ {yn(ex.row.public.lt)}</div><div style={{ fontSize: 11 }}>Private: ≤1y {yn(ex.row.private.st)} · 1-7y {yn(ex.row.private.mt)} · 7y+ {yn(ex.row.private.lt)}</div>{Object.entries(ex.footnotes || {}).map(([k, v]: any) => <div key={k} style={{ fontSize: 10, color: '#9fb3c8', marginTop: 3 }}>Note {k}: {v}</div>)}</> : <div style={{ fontSize: 11 }}>{ex?.error || 'Not listed in the CLS'}</div>}
          <div style={{ fontSize: 10, color: '#4b6a88', marginTop: 4 }}>CLS as of {ex?.asOf} · <a href={ex?.pdf || ex?.url} target="_blank" rel="noopener" style={{ color: TEAL }}>exim.gov</a></div>
        </div>
      </div>
      <div style={{ color: TEAL, fontSize: 11, margin: '10px 0 4px' }}>CIA WORLD FACTBOOK</div>
      {fb?.available ? <>
        <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 4 }}>Final edition — data as of {fb.asOf?.slice(0, 10)}. The CIA discontinued the Factbook on 4 Feb 2026.</div>
        {[['Government', fb.government], ['People', fb.people], ['Economy', fb.economy], ['Military', fb.military], ['Energy', fb.energy], ['Transnational issues', fb.transnational]].map(([t, o]: any) => Object.keys(o || {}).length ? <details key={t} style={{ marginBottom: 4 }}><summary style={{ cursor: 'pointer', color: '#e6f1ff' }}>{t}</summary><KV o={o} /></details> : null)}
        <div style={{ fontSize: 10, color: '#4b6a88' }}><a href={fb.url} target="_blank" rel="noopener" style={{ color: TEAL }}>Source (public domain)</a></div>
      </> : <div style={{ fontSize: 11 }}>{fb?.reason || 'Unavailable'}</div>}
    </div>
  );
}
const median = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)].toFixed(3) : '—'; };

const WKEY = 'rv-watchlist-v1';
const loadW = (): Watch[] => { try { return JSON.parse(localStorage.getItem(WKEY) || '[]'); } catch { return []; } };
const saveW = (w: Watch[]) => localStorage.setItem(WKEY, JSON.stringify(w));
const ALKEY = 'rv-watch-alerts-v1';

function Watchlist({ notify }: { notify: (t: string) => void }) {
  const [w, setW] = useState<Watch[]>([]); const [type, setType] = useState<Watch['type']>('plane'); const [val, setVal] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => { setW(loadW()); setAlerts(JSON.parse(localStorage.getItem(ALKEY) || '[]')); const t = setInterval(() => setAlerts(JSON.parse(localStorage.getItem(ALKEY) || '[]')), 5000); return () => clearInterval(t); }, []);
  const add = () => {
    let item: Watch;
    if (type === 'area') { const b = getMap()?.getBounds(); if (!b) return; item = { id: String(Date.now()), type, label: val || 'Area ' + new Date().toLocaleDateString(), value: '', bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] }; }
    else { if (!val.trim()) return; item = { id: String(Date.now()), type, label: val.trim(), value: val.trim() }; }
    const n = [...w, item]; setW(n); saveW(n); setVal(''); notify(`Watching ${item.label}`);
  };
  return (
    <div>
      <Section title="ADD TO WATCHLIST (saved in this browser)">
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={type} onChange={(e) => setType(e.target.value as any)} style={{ ...input, width: 90 }}><option value="plane">Plane hex</option><option value="ship">Ship MMSI</option><option value="wallet">Wallet</option><option value="area">Current view</option></select>
          <input style={input} value={val} onChange={(e) => setVal(e.target.value)} placeholder={type === 'area' ? 'name (optional)' : type === 'wallet' ? 'BTC/ETH/SOL address' : type === 'ship' ? 'MMSI' : 'ICAO hex'} />
          <button style={btn} onClick={add}>Add</button>
        </div>
      </Section>
      <Section title={`WATCHING (${w.length})`}>
        {w.map((x) => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span><span style={{ color: TEAL }}>{x.type}</span> {x.label} <span style={{ color: '#7f97b2', fontSize: 10 }}>{x.last || ''}</span></span><button style={{ ...btn, padding: '0 6px' }} onClick={() => { const n = w.filter((y) => y.id !== x.id); setW(n); saveW(n); }}>✕</button></div>)}
      </Section>
      <Section title="ALERTS">
        {!alerts.length && <div style={{ color: '#7f97b2' }}>No changes yet. Checked every 2 minutes while the app is open.</div>}
        {alerts.slice(0, 30).map((a, i) => <div key={i} style={{ fontSize: 11, marginBottom: 3 }}><span style={{ color: '#7f97b2' }}>{new Date(a.t).toLocaleTimeString()}</span> {a.text}</div>)}
      </Section>
      <div style={{ color: '#4b6a88', fontSize: 10 }}>Email alerts need an outbound mail sender (e.g. a Resend/SES/SMTP key and a verified from-address) — not configured.</div>
    </div>
  );
}

function WatchRunner({ notify }: { notify: (t: string) => void }) {
  useEffect(() => {
    const check = async () => {
      const w = loadW(); if (!w.length) return;
      const push = (text: string) => { const a: Alert[] = JSON.parse(localStorage.getItem(ALKEY) || '[]'); a.unshift({ t: Date.now(), text }); localStorage.setItem(ALKEY, JSON.stringify(a.slice(0, 100))); notify(text); };
      let flights: any = null; let anom: any = null; let quakes: any = null;
      for (const x of w) {
        try {
          let state = '';
          if (x.type === 'plane') { flights ??= await getJ('/api/flights'); const all = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'].flatMap((k) => flights[k] || []); const f = all.find((f: any) => f.icao24?.toLowerCase() === x.value.toLowerCase()); state = f ? `airborne ${f.callsign || ''} ${f.lat.toFixed(1)},${f.lng.toFixed(1)}`.replace(/ \S+,\S+$/, (m: string) => m) : 'not visible'; state = f ? 'airborne' + (f.callsign ? ' as ' + f.callsign : '') : 'not visible'; }
          if (x.type === 'ship') { const s = await getJ(`/api/rvx/story?mmsi=${x.value}`); state = s.facts?.ais ? `seen (${s.facts.ais.sog ?? '?'} kn)` : 'not seen'; }
          if (x.type === 'wallet') { const d = await getJ(`/api/osint/crypto?address=${encodeURIComponent(x.value)}`); state = `balance ${JSON.stringify(d.balance ?? d.summary?.balance ?? d.data?.balance ?? '?')}`; }
          if (x.type === 'area' && x.bbox) {
            anom ??= await getJ('/api/rvx/anomalies'); quakes ??= await getJ('/api/earthquakes');
            const [a, b, c, d] = x.bbox; const inside = (lng: number, lat: number) => lng >= a && lng <= c && lat >= b && lat <= d;
            const nq = (quakes.earthquakes || []).filter((q: any) => inside(q.lng, q.lat)).length;
            const na = (anom.anomalies || []).filter((q: any) => q.lat != null && inside(q.lng, q.lat)).length;
            state = `${nq} quakes, ${na} anomalies`;
          }
          if (x.last !== undefined && x.last !== state) push(`${x.type} ${x.label}: ${x.last} → ${state}`);
          x.last = state;
        } catch { /* keep going */ }
      }
      saveW(w);
    };
    const t0 = setTimeout(check, 8000); const t = setInterval(check, 120000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [notify]);
  return null;
}

function Replay() {
  const [list, setList] = useState<any[]>([]); const [idx, setIdx] = useState(-1); const [snap, setSnap] = useState<any>(null);
  useEffect(() => { getJ('/api/rvx/history').then((d) => { setList(d.snapshots); setIdx(d.snapshots.length - 1); }).catch(() => {}); }, []);
  useEffect(() => {
    if (idx < 0 || !list[idx]) return;
    getJ(`/api/rvx/history?t=${list[idx].t}`).then((d) => {
      setSnap(d.snapshot); const m = getMap(); if (!m || !d.snapshot) return;
      const feats = [
        ...d.snapshot.flights.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f[1], f[2]] }, properties: { k: 'flight', c: f[3], name: f[4] } })),
        ...d.snapshot.quakes.map((q: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q[1], q[2]] }, properties: { k: 'quake', mag: q[3] } })),
        ...d.snapshot.events.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e[0], e[1]] }, properties: { k: 'event' } })),
      ];
      const gj = { type: 'FeatureCollection', features: feats };
      if (m.getSource('rvx-replay')) m.getSource('rvx-replay').setData(gj);
      else { m.addSource('rvx-replay', { type: 'geojson', data: gj }); m.addLayer({ id: 'rvx-replay', type: 'circle', source: 'rvx-replay', paint: { 'circle-radius': ['match', ['get', 'k'], 'quake', 6, 'event', 3, 2], 'circle-color': ['match', ['get', 'k'], 'quake', '#FB923C', 'event', '#F43F5E', ['match', ['get', 'c'], 'm', '#EF4444', TEAL]], 'circle-opacity': 0.85 } }); }
    }).catch(() => {});
  }, [idx, list]);
  useEffect(() => () => { const m = getMap(); if (m?.getLayer('rvx-replay')) { m.removeLayer('rvx-replay'); m.removeSource('rvx-replay'); } }, []);
  if (!list.length) return <div>No snapshots yet — the server records one every 15 minutes (up to 24 h). Check back shortly.</div>;
  return (
    <Section title="REPLAY LAST 24 H">
      <input type="range" min={0} max={list.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ width: '100%', accentColor: TEAL }} />
      <div>{list[idx] && new Date(list[idx].t).toLocaleString()} · {snap ? `${snap.flights.length} flights (sampled), ${snap.quakes.length} quakes, ${snap.events.length} unrest events` : '…'}</div>
      <div style={{ color: '#4b6a88', fontSize: 10 }}>{list.length} snapshots stored</div>
    </Section>
  );
}

function PwaRegister() {
  useEffect(() => { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  return null;
}
