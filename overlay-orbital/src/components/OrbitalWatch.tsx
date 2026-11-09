'use client';
/* Orbital Watch (paid add-on for Personal and Pro): watch areas, free-satellite change passes,
   FIRMS fire hits and alerts. Never available on the free tier: free users see a locked panel. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Orbit, X, RefreshCw, Trash2, Bell, Lock, Flame, Plane, Eye } from 'lucide-react';
import type { DrawnShape } from '@/lib/draw';

type Me = { signedIn: boolean; label: string | null; plan: string; planEntitled: boolean; addon: boolean; limits: { maxSites: number; maxKm2: number }; price: { month: number; year: number; currency: string }; billing: string; vapid: string | null };
type SiteRow = { id: string; name: string; geom: GeoJSON.Polygon; bbox: number[]; area_km2: number; status: string | null; status_detail: string | null; last_checked: string | null; next_due: string; passes: number; alerts: number; fires_7d: number; newest_scene: string | null };
type Pass = { id: string; source: string; scene_id: string; scene_time: string; baseline_from: string | null; baseline_to: string | null; valid_pct: number; changed_km2: number; changed_pct: number; classes: Record<string, number>; significant: boolean; confidence: string; summary: string; summary_by: string; before_img: string; after_img: string; overlay_img: string; extra: any };
type Alert = Partial<Pass> & { id: string; kind: string; title: string; body: string; created_at: string; site_id: string; site_name: string };
type Fire = { lat: number; lon: number; acq: string; frp: number; satellite: string };

const SRC: Record<string, string> = { s2: 'Sentinel-2 optical (10 m)', ls: 'Landsat 8/9 optical (30 m)', s1: 'Sentinel-1 radar (10 m, sees through cloud)' };
const CLS: Record<string, string> = { vegetation_loss: 'Vegetation loss', burn_scar: 'Burn scar', new_water_or_flooding: 'New water / flooding', water_to_land: 'Water to land', new_construction_or_ground: 'New construction / bare ground', radar_brighter: 'Radar brighter', radar_darker: 'Radar darker' };
const getMap = (): any => (typeof window !== 'undefined' ? (window as any).__rvMap : null);
const img = (p?: string | null) => (p ? '/api/orbital/img?p=' + encodeURIComponent(p) : '');
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'never');
const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '');
function inRing(x: number, y: number, ring: number[][]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
async function j(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || 'HTTP ' + r.status), { status: r.status, body });
  return body;
}
const b64ToU8 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

function BeforeAfter({ p }: { p: Pass }) {
  const [x, setX] = useState(50); const [overlay, setOverlay] = useState(false);
  return (
    <div className="space-y-1">
      <div className="relative w-full overflow-hidden rounded border border-white/10 bg-black select-none" style={{ aspectRatio: '4 / 3' }}>
        <img src={img(overlay ? p.overlay_img : p.after_img)} alt="After" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${x}%` }}>
          <img src={img(p.before_img)} alt="Before" className="absolute inset-0 h-full object-cover" style={{ width: `${10000 / Math.max(x, 1)}%`, maxWidth: 'none' }} />
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-amber-300/90" style={{ left: `${x}%` }} />
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">Before {day(p.baseline_from)}–{day(p.baseline_to)}</span>
        <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">{overlay ? 'Change' : 'After'} {day(p.scene_time)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} className="flex-1 accent-amber-400" aria-label="Before/after slider" />
        <button onClick={() => setOverlay((o) => !o)} className={`rounded px-1.5 py-0.5 text-[10px] ${overlay ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-white/70'}`}>Change mask</button>
      </div>
    </div>
  );
}

function PassCard({ p }: { p: Pass }) {
  const cls = Object.entries(p.classes || {}).filter(([, v]) => v > 0);
  const ex = p.extra || {};
  return (
    <div className={`rounded-lg border p-2 space-y-1.5 ${p.significant ? 'border-amber-400/50 bg-amber-400/5' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white">{SRC[p.source] || p.source}</span>
        <span className="text-white/50">{day(p.scene_time)}</span>
      </div>
      <BeforeAfter p={p} />
      <div className="text-[11px] text-white/80">
        <b className={p.significant ? 'text-amber-300' : 'text-white'}>{p.changed_km2.toFixed(2)} km² changed</b> ({p.changed_pct.toFixed(1)}% of compared area) · {Math.round(p.valid_pct)}% clear · confidence {p.confidence}
        {ex.ships_comparable && <> · vessels {ex.ships_baseline}→{ex.ships_now}</>}
      </div>
      {cls.length > 0 && <div className="flex flex-wrap gap-1">{cls.map(([k, v]) => <span key={k} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80">{CLS[k] || k}: {v.toFixed(2)} km²</span>)}</div>}
      <p className="text-[11px] leading-snug text-white/70">{p.summary}</p>
      <p className="text-[9px] text-white/40">Summary: {p.summary_by?.startsWith('xAI') ? `AI-written (${p.summary_by}) from the measured numbers and both images` : 'template from the measured numbers'} · Scene {p.scene_id}</p>
    </div>
  );
}

export default function OrbitalWatch({ shapes, flights }: { shapes: DrawnShape[]; flights?: { lat?: number; lng?: number }[] }) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'sites' | 'alerts'>('sites');
  const [passes, setPasses] = useState<Pass[]>([]);
  const [fires, setFires] = useState<Fire[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [shapeId, setShapeId] = useState('');
  const [push, setPush] = useState<'off' | 'on' | 'unsupported' | 'denied'>('off');
  const areas = useMemo(() => shapes.filter((s) => s.geojson?.geometry?.type === 'Polygon'), [shapes]);

  const loadMe = useCallback(async () => { try { setMe(await j('/api/orbital/me')); } catch { setMe(null); } }, []);
  const loadSites = useCallback(async () => { try { setSites((await j('/api/orbital/sites')).sites); } catch { /* locked */ } }, []);
  const loadAlerts = useCallback(async () => { try { setAlerts((await j('/api/orbital/alerts')).alerts); } catch { /* locked */ } }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('orbital')) { setOpen(true); setSel(q.get('orbital')); }
  }, []);
  useEffect(() => { if (open) loadMe(); }, [open, loadMe]);
  useEffect(() => {
    if (!open || !me?.addon) return;
    loadSites(); loadAlerts();
    const t = setInterval(() => { loadSites(); loadAlerts(); }, 20000);
    return () => clearInterval(t);
  }, [open, me?.addon, loadSites, loadAlerts]);
  useEffect(() => {
    if (!sel || !me?.addon) { setPasses([]); setFires([]); return; }
    let alive = true;
    const go = () => j('/api/orbital/passes?site=' + sel).then((r) => { if (alive) { setPasses(r.passes); setFires(r.fires); } }).catch(() => {});
    go(); const t = setInterval(go, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [sel, me?.addon]);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPush('unsupported'); return; }
    if (Notification.permission === 'denied') setPush('denied');
    navigator.serviceWorker.getRegistration('/orbital-sw/').then((r) => r?.pushManager.getSubscription()).then((s) => { if (s) setPush('on'); }).catch(() => {});
  }, []);

  /* Site outlines and FIRMS points on the main map. */
  useEffect(() => {
    const map = getMap(); if (!map || !map.getStyle?.()) return;
    const fc = { type: 'FeatureCollection', features: (open && me?.addon ? sites : []).map((s) => ({ type: 'Feature', properties: { id: s.id, name: s.name, sel: s.id === sel ? 1 : 0 }, geometry: s.geom })) };
    const fp = { type: 'FeatureCollection', features: (open ? fires : []).map((f) => ({ type: 'Feature', properties: { frp: f.frp }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })) };
    try {
      if (map.getSource('ow-sites')) map.getSource('ow-sites').setData(fc);
      else {
        map.addSource('ow-sites', { type: 'geojson', data: fc });
        map.addLayer({ id: 'ow-sites-fill', type: 'fill', source: 'ow-sites', paint: { 'fill-color': '#fbbf24', 'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.12, 0.04] } });
        map.addLayer({ id: 'ow-sites-line', type: 'line', source: 'ow-sites', paint: { 'line-color': '#fbbf24', 'line-width': ['case', ['==', ['get', 'sel'], 1], 2.5, 1.2] } });
      }
      if (map.getSource('ow-fires')) map.getSource('ow-fires').setData(fp);
      else {
        map.addSource('ow-fires', { type: 'geojson', data: fp });
        map.addLayer({ id: 'ow-fires-pt', type: 'circle', source: 'ow-fires', paint: { 'circle-color': '#ef4444', 'circle-radius': 3.5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.6 } });
      }
    } catch { /* style reloading */ }
  }, [sites, fires, sel, open, me?.addon]);

  const flyTo = (s: SiteRow) => { const m = getMap(); if (m) m.fitBounds([[s.bbox[0], s.bbox[1]], [s.bbox[2], s.bbox[3]]], { padding: 80, duration: 1200 }); };
  const selected = sites.find((s) => s.id === sel) || null;
  const flightsInside = useMemo(() => {
    if (!selected || !flights) return null;
    const ring = selected.geom.coordinates[0] as number[][];
    return flights.filter((f) => typeof f.lat === 'number' && typeof f.lng === 'number' && inRing(f.lng!, f.lat!, ring)).length;
  }, [selected, flights]);
  const newestBySource = useMemo(() => {
    const seen = new Set<string>(); return passes.filter((p) => (seen.has(p.source) ? false : (seen.add(p.source), true)));
  }, [passes]);

  async function addSite(geom: GeoJSON.Polygon, label: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await j('/api/orbital/sites', { method: 'POST', body: JSON.stringify({ name: label, geom }) });
      setMsg(`Watching "${r.site.name}" (${Number(r.site.area_km2).toFixed(1)} km²). The first check starts within a minute.`);
      setName(''); await loadSites(); setSel(r.site.id);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  function watchShape() {
    const s = areas.find((a) => a.id === shapeId); if (!s) { setMsg('Draw an area with the drawing tools first, then pick it here.'); return; }
    addSite(s.geojson.geometry as GeoJSON.Polygon, name || s.name);
  }
  function watchView() {
    const m = getMap(); if (!m) return;
    const b = m.getBounds(); const [w, s, e, n] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    addSite({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }, name || 'Current view');
  }
  async function del(id: string) { if (!confirm('Stop watching this area and delete its history?')) return; await j('/api/orbital/sites?id=' + id, { method: 'DELETE' }).catch(() => {}); if (sel === id) setSel(null); loadSites(); }
  async function runNow(id: string) { try { const r = await j(`/api/orbital/sites/${id}/run`, { method: 'POST' }); setMsg(r.note); loadSites(); } catch (e: any) { setMsg(e.message); } }
  async function activate() { setBusy(true); try { await j('/api/orbital/activate', { method: 'POST' }); await loadMe(); setMsg('Add-on activated (test mode, no charge).'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }
  async function enablePush() {
    if (!me?.vapid) { setMsg('Push is not configured on this server.'); return; }
    try {
      const reg = await navigator.serviceWorker.register('/orbital-sw.js', { scope: '/orbital-sw/' });
      await navigator.serviceWorker.ready.catch(() => {});
      const perm = await Notification.requestPermission(); if (perm !== 'granted') { setPush('denied'); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(me.vapid) });
      const r = await j('/api/orbital/push/subscribe', { method: 'POST', body: JSON.stringify({ sub: sub.toJSON() }) });
      (reg.active || reg.waiting || reg.installing)?.postMessage({ owSubId: r.id });
      setPush('on'); setMsg('Browser alerts are on for this device.');
    } catch (e: any) { setMsg('Could not turn on browser alerts: ' + e.message); }
  }

  return (
    <>
      <button data-hud onClick={() => setOpen((o) => !o)} title="Orbital Watch: satellite change alerts for your areas"
        className="fixed left-3 bottom-[150px] z-[450] flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-black/80 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur hover:bg-black">
        <Orbit size={14} /> Orbital Watch {me && !me.addon && <Lock size={11} className="opacity-70" />}
      </button>
      {open && (
        <div data-hud className="fixed left-3 top-16 z-[460] flex max-h-[calc(100vh-240px)] w-[390px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0f14]/95 text-white shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2"><Orbit size={16} className="text-amber-300" /><span className="text-sm font-bold">Orbital Watch</span><span className="rounded bg-amber-400/20 px-1.5 text-[9px] font-semibold uppercase text-amber-200">Paid add-on</span></div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/60 hover:text-white"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {!me && <p className="text-white/60">Loading…</p>}
            {me && !me.addon && (
              <div className="space-y-3" data-ow-locked>
                <div className="flex items-center gap-2 text-sm font-semibold"><Lock size={14} className="text-amber-300" /> Locked</div>
                <p className="text-white/75 leading-relaxed">Draw an area and get an alert when satellites see it change: new construction, flooding, burn scars, vegetation loss, vessels at anchor, plus NASA FIRMS fire detections. Uses free Sentinel-1 radar, Sentinel-2 and Landsat imagery, checked every few hours.</p>
                <p className="text-white/75">Orbital Watch is an add-on for <b>Personal</b> and <b>Pro</b> plans: ${me.price.month}/month or ${me.price.year}/year (USD). It is not part of the free tier.</p>
                {!me.signedIn && <a href="/account?signin=1" className="inline-block rounded bg-amber-400 px-3 py-1.5 font-semibold text-black">Sign in</a>}
                {me.signedIn && !me.planEntitled && <a href="/pricing" className="inline-block rounded bg-amber-400 px-3 py-1.5 font-semibold text-black">See Personal and Pro plans</a>}
                {me.signedIn && me.planEntitled && (me.billing === 'stub-test'
                  ? <button disabled={busy} onClick={activate} className="rounded bg-amber-400 px-3 py-1.5 font-semibold text-black disabled:opacity-50">Activate add-on (staging test, no charge)</button>
                  : <p className="text-white/60">Add-on checkout is coming soon.</p>)}
                <p className="text-[10px] text-white/40">Signed in as: {me.label || 'nobody'} · plan: {me.plan}</p>
              </div>
            )}
            {me?.addon && (
              <>
                <div className="flex gap-1">
                  {(['sites', 'alerts'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded px-2 py-1 font-semibold ${tab === t ? 'bg-white/15' : 'bg-white/5 text-white/60'}`}>{t === 'sites' ? `Areas (${sites.length}/${me.limits.maxSites})` : `Alerts (${alerts.length})`}</button>)}
                </div>
                <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
                  <span className="flex items-center gap-1 text-white/70"><Bell size={12} /> Browser alerts: {push === 'on' ? 'on' : push === 'unsupported' ? 'not supported here' : push === 'denied' ? 'blocked in browser settings' : 'off'}</span>
                  {push === 'off' && <button onClick={enablePush} className="rounded bg-amber-400/90 px-2 py-0.5 text-[11px] font-semibold text-black">Turn on</button>}
                </div>
                {msg && <p className="rounded bg-cyan-500/10 px-2 py-1.5 text-cyan-100">{msg}</p>}
                {tab === 'sites' && (
                  <>
                    <div className="space-y-1.5 rounded-lg border border-white/10 p-2">
                      <div className="font-semibold">Watch a new area</div>
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" maxLength={80} className="w-full rounded bg-white/10 px-2 py-1 outline-none" />
                      <div className="flex gap-1">
                        <select value={shapeId} onChange={(e) => setShapeId(e.target.value)} className="min-w-0 flex-1 rounded bg-white/10 px-1 py-1">
                          <option value="">{areas.length ? 'Pick a drawn area…' : 'No drawn areas yet'}</option>
                          {areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.areaKm2.toFixed(1)} km²)</option>)}
                        </select>
                        <button disabled={busy || !shapeId} onClick={watchShape} className="rounded bg-amber-400 px-2 font-semibold text-black disabled:opacity-40">Watch</button>
                      </div>
                      <button disabled={busy} onClick={watchView} className="w-full rounded bg-white/10 py-1 hover:bg-white/15 disabled:opacity-40">Watch the current map view</button>
                      <p className="text-[10px] text-white/40">Up to {me.limits.maxKm2} km² per area. Use the drawing tools (pen icon) to draw an exact outline.</p>
                    </div>
                    {sites.map((s) => (
                      <div key={s.id} className={`rounded-lg border p-2 ${s.id === sel ? 'border-amber-300/60 bg-amber-300/5' : 'border-white/10'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <button className="min-w-0 flex-1 text-left" onClick={() => { setSel(s.id === sel ? null : s.id); flyTo(s); }}>
                            <div className="truncate font-semibold">{s.name}</div>
                            <div className="text-[10px] text-white/50">{s.area_km2.toFixed(1)} km² · {s.status === 'checking' ? 'checking now…' : s.status === 'queued' ? 'queued' : 'checked ' + fmt(s.last_checked)} · {s.passes} passes · {s.alerts} alerts{s.fires_7d ? ` · ${s.fires_7d} fires (14d)` : ''}</div>
                          </button>
                          <button onClick={() => flyTo(s)} title="Show on map" className="text-white/50 hover:text-white"><Eye size={13} /></button>
                          <button onClick={() => runNow(s.id)} title="Check now" className="text-white/50 hover:text-white"><RefreshCw size={13} /></button>
                          <button onClick={() => del(s.id)} title="Delete" className="text-white/50 hover:text-red-400"><Trash2 size={13} /></button>
                        </div>
                        {s.id === sel && (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
                              <span className="flex items-center gap-1"><Flame size={11} className="text-red-400" /> {fires.length} FIRMS fire detections in the last 14 days</span>
                              {flightsInside !== null && <span className="flex items-center gap-1"><Plane size={11} /> {flightsInside} live flights over the area now</span>}
                            </div>
                            {s.status_detail && <p className="text-[10px] text-white/40">Last run: {s.status_detail}</p>}
                            {newestBySource.length === 0 && <p className="text-white/50">No compared passes yet. The first check fetches recent scenes and builds a baseline; it can take a few minutes.</p>}
                            {newestBySource.map((p) => <PassCard key={p.id} p={p} />)}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {tab === 'alerts' && (
                  <div className="space-y-2">
                    {alerts.length === 0 && <p className="text-white/50">No alerts yet. You get one when a pass shows a significant change or FIRMS reports a fire inside an area.</p>}
                    {alerts.map((a) => (
                      <button key={a.id} onClick={() => { setTab('sites'); setSel(a.site_id); const s = sites.find((x) => x.id === a.site_id); if (s) flyTo(s); }} className="block w-full rounded-lg border border-white/10 p-2 text-left hover:bg-white/5">
                        <div className="flex items-center gap-1 font-semibold">{a.kind === 'fire' ? <Flame size={12} className="text-red-400" /> : <Orbit size={12} className="text-amber-300" />}{a.title}</div>
                        <div className="text-[10px] text-white/45">{fmt(a.created_at)}</div>
                        <p className="mt-1 line-clamp-3 text-[11px] text-white/70">{a.summary || a.body}</p>
                        {a.overlay_img && <img src={img(a.overlay_img)} alt="" className="mt-1 h-20 w-full rounded object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-white/10 px-3 py-1.5 text-[9px] text-white/35">Imagery: Copernicus Sentinel (ESA, via Element 84 Earth Search and Microsoft Planetary Computer), USGS Landsat, NASA FIRMS. Detects changes larger than about 10–30 m.</div>
        </div>
      )}
    </>
  );
}
