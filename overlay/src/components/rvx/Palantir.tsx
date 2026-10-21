'use client';
/* Palantir pack UI: link graph, OpenSanctions graph, timeline scrubber, deck.gl analytics,
   Blueprint-styled panels, case files, threat intel, Aleph probe. Lazy-loads heavy libs. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const TEAL = '#2DD4BF';
const NAVY = 'rgba(6,16,30,0.94)';
const BORDER = '1px solid rgba(45,212,191,0.35)';
const btn: React.CSSProperties = { background: 'transparent', color: TEAL, border: BORDER, borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { background: '#0b1a2e', color: '#e6f1ff', border: BORDER, borderRadius: 5, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

function getMap(): any { return typeof window !== 'undefined' ? (window as any).__rvMap : null; }
async function getJ(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bp4-card bp4-dark rv-bp-card" style={{ marginBottom: 12, padding: 10 }}>
      <div className="bp4-heading" style={{ color: TEAL, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

/* Blueprint Design System dark tokens — CSS only (no @blueprintjs package = no bundle bloat). */
export function BlueprintStyles() {
  useEffect(() => {
    const id = 'rv-blueprint-tokens';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .rv-bp, .rv-bp * { box-sizing: border-box; }
      .rv-bp {
        --bp-dark-gray1: #182026; --bp-dark-gray2: #202B33; --bp-dark-gray3: #293742;
        --bp-dark-gray4: #30404D; --bp-dark-gray5: #394B59;
        --bp-blue3: #2B95D6; --bp-blue4: #48AFF0; --bp-blue5: #99C4FF;
        --bp-font: "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-family: var(--bp-font);
        color: #F5F8FA;
      }
      .rv-bp .bp4-card, .rv-bp-card {
        background: var(--bp-dark-gray2);
        border: 1px solid var(--bp-dark-gray4);
        border-radius: 3px;
        box-shadow: 0 0 0 1px rgba(16,22,26,0.4), 0 1px 1px rgba(16,22,26,0.4);
      }
      .rv-bp .bp4-button, .rv-bp-btn {
        background: var(--bp-dark-gray3);
        color: #F5F8FA;
        border: 1px solid var(--bp-dark-gray5);
        border-radius: 3px;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .rv-bp .bp4-button:hover, .rv-bp-btn:hover { background: var(--bp-dark-gray4); }
      .rv-bp .bp4-button.bp4-intent-primary, .rv-bp-btn-primary {
        background: var(--bp-blue3);
        border-color: var(--bp-blue3);
        color: #fff;
      }
      .rv-bp .bp4-input, .rv-bp-input {
        background: var(--bp-dark-gray1);
        color: #F5F8FA;
        border: 1px solid var(--bp-dark-gray4);
        border-radius: 3px;
        padding: 6px 8px;
        width: 100%;
      }
      .rv-bp .bp4-tag {
        display: inline-block;
        background: var(--bp-dark-gray4);
        color: var(--bp-blue5);
        border-radius: 2px;
        padding: 1px 6px;
        font-size: 10px;
        margin-right: 4px;
      }
      .rv-bp .rv-brand {
        color: ${TEAL};
        font-weight: 600;
        letter-spacing: 0.04em;
      }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export function LinkGraphPanel() {
  const [q, setQ] = useState('gazprom');
  const [type, setType] = useState('auto');
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    try {
      setData(await getJ(`/api/rvx/entity-graph?type=${encodeURIComponent(type)}&id=${encodeURIComponent(q.trim())}`));
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const graph = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: (data.nodes || []).map((n: any) => ({ ...n, name: n.label || n.id })),
      links: (data.links || []).map((l: any) => ({ source: l.source, target: l.target, name: l.label || l.rel })),
    };
  }, [data]);
  return (
    <Section title="LINK GRAPH (Gotham-style · RemoteView data)">
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        <select className="rv-bp-input" style={{ ...input, width: 100 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="auto">auto</option>
          <option value="ship">ship</option>
          <option value="jet">jet</option>
          <option value="company">company</option>
          <option value="person">person</option>
          <option value="country">country</option>
          <option value="sanctioned">sanctioned</option>
        </select>
        <input className="rv-bp-input" style={{ ...input, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="MMSI, hex, name, or ISO2" />
        <button className="rv-bp-btn-primary" style={btn} onClick={run} disabled={busy}>{busy ? '…' : 'Graph'}</button>
      </div>
      {err && <div style={{ color: '#f87171', fontSize: 11 }}>{err}</div>}
      {data && (
        <div style={{ height: 280, background: '#0b1a2e', borderRadius: 4, border: BORDER }}>
          <ForceGraph2D
            graphData={graph}
            nodeLabel="name"
            linkLabel="name"
            nodeAutoColorBy="group"
            width={320}
            height={280}
            backgroundColor="#0b1a2e"
            linkColor={() => 'rgba(45,212,191,0.45)'}
            nodeRelSize={5}
          />
        </div>
      )}
      <div style={{ color: '#4b6a88', fontSize: 10, marginTop: 4 }}>{data?.meta?.source} · {data?.nodes?.length || 0} nodes</div>
    </Section>
  );
}

export function OsGraphPanel() {
  const [q, setQ] = useState('Alexandre Orloff');
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setData(await getJ(`/api/rvx/os-graph?q=${encodeURIComponent(q.trim())}&depth=1`)); }
    catch (e) { setData({ error: (e as Error).message }); }
    setBusy(false);
  };
  const graph = useMemo(() => {
    if (!data?.nodes) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n: any) => ({ ...n, name: n.label || n.id })),
      links: (data.links || []).map((l: any) => ({ source: l.source, target: l.target, name: l.label || l.rel })),
    };
  }, [data]);
  return (
    <Section title="OPENSANCTIONS ENTITY GRAPH (ownership / family / associates)">
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input style={{ ...input, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sanctioned entity name" />
        <button style={btn} onClick={run} disabled={busy}>{busy ? 'Indexing…' : 'Graph'}</button>
      </div>
      {data?.error && <div style={{ color: '#f87171', fontSize: 11 }}>{data.error}</div>}
      {data?.meta?.note && <div style={{ color: '#fbbf24', fontSize: 10, marginBottom: 4 }}>{data.meta.note}</div>}
      {data?.nodes && (
        <div style={{ height: 260, background: '#0b1a2e', borderRadius: 4 }}>
          <ForceGraph2D graphData={graph} nodeLabel="name" linkLabel="name" nodeAutoColorBy="group" width={320} height={260} backgroundColor="#0b1a2e" linkColor={() => 'rgba(248,113,113,0.5)'} />
        </div>
      )}
      {data?.search?.results?.length > 0 && (
        <div style={{ fontSize: 10, marginTop: 4, maxHeight: 80, overflow: 'auto' }}>
          Matches: {data.search.results.slice(0, 5).map((r: any) => (
            <div key={r.id}><a href={r.url} target="_blank" rel="noopener" style={{ color: '#e6f1ff' }}>{r.caption}</a> <span className="bp4-tag">{r.schema}</span></div>
          ))}
        </div>
      )}
      <div style={{ color: '#4b6a88', fontSize: 10 }}>{data?.meta?.source}</div>
    </Section>
  );
}

export function TimelineScrubber() {
  const [list, setList] = useState<any[]>([]);
  const [idx, setIdx] = useState(-1);
  const [snap, setSnap] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    getJ('/api/rvx/history').then((d) => { setList(d.snapshots || []); setIdx((d.snapshots?.length || 1) - 1); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (idx < 0 || !list[idx]) return;
    getJ(`/api/rvx/history?t=${list[idx].t}`).then((d) => {
      setSnap(d.snapshot);
      const m = getMap(); if (!m || !d.snapshot) return;
      const feats = [
        ...(d.snapshot.flights || []).map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f[1], f[2]] }, properties: { k: 'flight', c: f[3], name: f[4] } })),
        ...(d.snapshot.quakes || []).map((q: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q[1], q[2]] }, properties: { k: 'quake', mag: q[3] } })),
        ...(d.snapshot.events || []).map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e[0], e[1]] }, properties: { k: 'event' } })),
        ...(d.snapshot.ships || []).map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s[1], s[2]] }, properties: { k: 'ship', name: s[4] } })),
      ];
      const gj = { type: 'FeatureCollection', features: feats };
      if (m.getSource('rvx-replay')) m.getSource('rvx-replay').setData(gj);
      else {
        m.addSource('rvx-replay', { type: 'geojson', data: gj });
        m.addLayer({
          id: 'rvx-replay', type: 'circle', source: 'rvx-replay',
          paint: {
            'circle-radius': ['match', ['get', 'k'], 'quake', 6, 'event', 3, 'ship', 3, 2],
            'circle-color': ['match', ['get', 'k'], 'quake', '#FB923C', 'event', '#F43F5E', 'ship', '#38BDF8', ['match', ['get', 'c'], 'm', '#EF4444', TEAL]],
            'circle-opacity': 0.85,
          },
        });
      }
    }).catch(() => {});
  }, [idx, list]);

  useEffect(() => {
    if (!playing) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= list.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(timer.current);
  }, [playing, list.length]);

  useEffect(() => () => {
    const m = getMap();
    if (m?.getLayer('rvx-replay')) { m.removeLayer('rvx-replay'); m.removeSource('rvx-replay'); }
  }, []);

  if (!list.length) {
    return <Section title="TIMELINE SCRUBBER (24h)">No snapshots yet — server records every 15 minutes (flights, ships, quakes, events). Check back shortly.</Section>;
  }
  return (
    <Section title="TIMELINE SCRUBBER · LAST 24H">
      <input type="range" min={0} max={list.length - 1} value={Math.max(0, idx)} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} style={{ width: '100%', accentColor: TEAL }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
        <button style={btn} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button style={btn} onClick={() => setIdx(0)}>Start</button>
        <button style={btn} onClick={() => setIdx(list.length - 1)}>Now</button>
      </div>
      <div style={{ fontSize: 11, marginTop: 4 }}>
        {list[idx] && new Date(list[idx].t).toLocaleString()} ·{' '}
        {snap
          ? `${snap.flights?.length || 0} flights, ${(snap.ships || []).length} ships, ${snap.quakes?.length || 0} quakes, ${snap.events?.length || 0} events`
          : '…'}
      </div>
      <div style={{ color: '#4b6a88', fontSize: 10 }}>{list.length} lightweight snapshots (max 96 / 24h)</div>
    </Section>
  );
}

/** Lazy deck.gl hexbin + arcs via CDN (keeps npm bundle lean). */
export function Analytics3D() {
  const [status, setStatus] = useState('Idle');
  const [on, setOn] = useState(false);
  const overlayRef = useRef<any>(null);

  const teardown = useCallback(() => {
    const m = getMap();
    if (overlayRef.current && m) {
      try { m.removeControl(overlayRef.current); } catch { /* */ }
      overlayRef.current = null;
    }
    setOn(false);
  }, []);

  const start = async () => {
    setStatus('Loading analytics data…');
    try {
      const data = await getJ('/api/rvx/analytics');
      setStatus('Loading deck.gl…');
      // Load deck.gl UMD from CDN
      await loadScript('https://unpkg.com/deck.gl@8.9.36/dist.min.js', 'deck');
      const deck = (window as any).deck;
      if (!deck) throw new Error('deck.gl failed to load');
      const m = getMap();
      if (!m) throw new Error('Map not ready');
      teardown();
      const HexagonLayer = deck.HexagonLayer;
      const ArcLayer = deck.ArcLayer;
      const MapboxOverlay = deck.MapboxOverlay || deck.GoogleMapsOverlay;
      // Prefer MapboxOverlay (works with MapLibre)
      let OverlayCtor = deck.MapboxOverlay;
      if (!OverlayCtor) {
        // Older UMD may expose via deck._MapboxOverlay or need separate build — fall back to custom layer-less canvas note
        setStatus('deck.gl loaded but MapboxOverlay missing — drawing hex points as MapLibre heat instead');
        const gj = {
          type: 'FeatureCollection',
          features: (data.flights || []).map((f: any) => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: f.position }, properties: { k: 'f' },
          })),
        };
        if (m.getSource('rvx-hex')) m.getSource('rvx-hex').setData(gj);
        else {
          m.addSource('rvx-hex', { type: 'geojson', data: gj });
          m.addLayer({ id: 'rvx-hex-heat', type: 'heatmap', source: 'rvx-hex', paint: { 'heatmap-radius': 18, 'heatmap-intensity': 0.8, 'heatmap-opacity': 0.75 } });
        }
        setOn(true);
        return;
      }
      const layers = [
        new HexagonLayer({
          id: 'rv-hex-flights',
          data: data.flights || [],
          getPosition: (d: any) => d.position,
          radius: 40000,
          elevationScale: 80,
          extruded: true,
          pickable: true,
          colorRange: [[16, 42, 67], [45, 212, 191], [251, 146, 60], [239, 68, 68]],
          opacity: 0.7,
        }),
        new ArcLayer({
          id: 'rv-arcs',
          data: data.arcs || [],
          getSourcePosition: (d: any) => d.source,
          getTargetPosition: (d: any) => d.target,
          getSourceColor: [45, 212, 191, 160],
          getTargetColor: [248, 113, 113, 160],
          getWidth: 1.5,
        }),
      ];
      const overlay = new OverlayCtor({ interleaved: false, layers });
      m.addControl(overlay);
      overlayRef.current = overlay;
      setOn(true);
      setStatus(`Hexbin ${data.flights?.length || 0} flights · ${data.ships?.length || 0} ships · ${data.arcs?.length || 0} arcs · ${data.meta?.source || ''}`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  useEffect(() => () => teardown(), [teardown]);

  return (
    <Section title="ANALYTICS 3D (deck.gl hexbin + arcs · lazy CDN)">
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} onClick={start} disabled={on}>{on ? 'On map' : 'Load Kepler-style view'}</button>
        {on && <button style={btn} onClick={() => {
          teardown();
          const m = getMap();
          if (m?.getLayer('rvx-hex-heat')) { m.removeLayer('rvx-hex-heat'); m.removeSource('rvx-hex'); }
          setStatus('Cleared');
        }}>Clear</button>}
      </div>
      <div style={{ color: '#7f97b2', fontSize: 10, marginTop: 4 }}>{status}</div>
    </Section>
  );
}

function loadScript(src: string, globalKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalKey]) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('script error')));
      // maybe already loaded
      if ((window as any)[globalKey]) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const CKEY = 'rv-cases-v1';
type CaseEnt = { type: string; id: string; label?: string };
type CaseFile = { id: string; name: string; notes: string; entities: CaseEnt[]; createdAt: number; updatedAt: number };

function loadLocalCases(): CaseFile[] {
  try { return JSON.parse(localStorage.getItem(CKEY) || '[]'); } catch { return []; }
}
function saveLocalCases(c: CaseFile[]) { localStorage.setItem(CKEY, JSON.stringify(c.slice(0, 40))); }

export function CaseFilesPanel() {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [name, setName] = useState('Investigation');
  const [notes, setNotes] = useState('');
  const [entType, setEntType] = useState('company');
  const [entId, setEntId] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [serverNote, setServerNote] = useState('');

  useEffect(() => { setCases(loadLocalCases()); }, []);

  const current = cases.find((c) => c.id === active) || null;

  const upsert = (c: CaseFile) => {
    const n = [...cases.filter((x) => x.id !== c.id), c].sort((a, b) => b.updatedAt - a.updatedAt);
    setCases(n); saveLocalCases(n);
  };

  const create = () => {
    const c: CaseFile = { id: `case-${Date.now()}`, name: name || 'Untitled', notes, entities: [], createdAt: Date.now(), updatedAt: Date.now() };
    upsert(c); setActive(c.id); setNotes('');
  };

  const pin = () => {
    if (!current || !entId.trim()) return;
    const c = {
      ...current,
      entities: [...current.entities, { type: entType, id: entId.trim(), label: entId.trim() }].slice(0, 200),
      updatedAt: Date.now(),
    };
    upsert(c); setEntId('');
  };

  const saveNotes = (t: string) => {
    if (!current) return;
    upsert({ ...current, notes: t, updatedAt: Date.now() });
    setNotes(t);
  };

  const syncServer = async () => {
    if (!current) return;
    try {
      await getJ('/api/rvx/cases?action=save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', case: current }) });
      setServerNote('Saved to server .cache (optional)');
    } catch (e) { setServerNote((e as Error).message); }
  };

  const exportJson = () => {
    if (!current) return;
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${current.id}.json`; a.click();
  };

  const exportPdf = async () => {
    if (!current) return;
    try {
      await getJ('/api/rvx/cases?action=save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', case: current }) });
      const r = await getJ(`/api/rvx/cases?action=export&id=${encodeURIComponent(current.id)}&format=pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export', id: current.id, format: 'pdf' }) });
      const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bin], { type: 'application/pdf' })); a.download = r.filename || 'case.pdf'; a.click();
    } catch {
      // Client-side fallback: print window
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<pre>${(current.notes || '').replace(/</g, '&lt;')}\n\nEntities:\n${current.entities.map((e) => `[${e.type}] ${e.label || e.id}`).join('\n')}</pre>`);
      w.document.close(); w.print();
    }
  };

  return (
    <Section title="CASE FILES (localStorage + optional server)">
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input style={{ ...input, flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Case name" />
        <button style={btn} onClick={create}>New</button>
      </div>
      <div style={{ maxHeight: 80, overflow: 'auto', marginBottom: 6 }}>
        {cases.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <button style={{ ...btn, border: active === c.id ? `1px solid ${TEAL}` : BORDER }} onClick={() => { setActive(c.id); setNotes(c.notes); }}>{c.name}</button>
            <button style={{ ...btn, padding: '0 6px' }} onClick={() => { const n = cases.filter((x) => x.id !== c.id); setCases(n); saveLocalCases(n); if (active === c.id) setActive(null); }}>✕</button>
          </div>
        ))}
      </div>
      {current && (
        <>
          <textarea style={{ ...input, minHeight: 70, marginBottom: 6 }} value={notes || current.notes} onChange={(e) => saveNotes(e.target.value)} placeholder="Investigation notes" />
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <select style={{ ...input, width: 90 }} value={entType} onChange={(e) => setEntType(e.target.value)}>
              <option value="ship">ship</option>
              <option value="jet">jet</option>
              <option value="company">company</option>
              <option value="person">person</option>
              <option value="country">country</option>
              <option value="sanctioned">sanctioned</option>
            </select>
            <input style={{ ...input, flex: 1 }} value={entId} onChange={(e) => setEntId(e.target.value)} placeholder="Pin entity id/name" />
            <button style={btn} onClick={pin}>Pin</button>
          </div>
          <div style={{ fontSize: 10, maxHeight: 70, overflow: 'auto', marginBottom: 6 }}>
            {current.entities.map((e, i) => <div key={i}><span className="bp4-tag">{e.type}</span> {e.label || e.id}</div>)}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button style={btn} onClick={exportJson}>Export JSON</button>
            <button style={btn} onClick={exportPdf}>Export PDF</button>
            <button style={btn} onClick={syncServer}>Sync server</button>
          </div>
          {serverNote && <div style={{ color: '#7f97b2', fontSize: 10, marginTop: 4 }}>{serverNote}</div>}
        </>
      )}
    </Section>
  );
}

export function ThreatIntelPanel() {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setD(await getJ('/api/rvx/threat-intel')); }
    catch (e) { setD({ error: (e as Error).message }); }
    setBusy(false);
  };
  return (
    <Section title="THREAT INTEL FEEDS (keyless public)">
      <button style={btn} onClick={load}>{busy ? 'Loading…' : 'Refresh feeds'}</button>
      {d?.sources && (
        <div style={{ fontSize: 10, margin: '6px 0', color: '#7f97b2' }}>
          {d.sources.map((s: any) => (
            <div key={s.id}>
              <span className="bp4-tag">{s.id}</span>
              {s.label}
              {s.skipped ? <span style={{ color: '#fbbf24' }}> — skipped: {s.reason}</span> : null}
              {s.error ? <span style={{ color: '#f87171' }}> — {s.error}</span> : null}
              {s.count != null ? ` (${s.count})` : ''}
            </div>
          ))}
        </div>
      )}
      {d?.items && (
        <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
          {d.items.slice(0, 50).map((it: any, i: number) => (
            <div key={i} style={{ marginBottom: 4, borderLeft: `2px solid ${TEAL}`, paddingLeft: 6 }}>
              <span className="bp4-tag">{it.sourceLabel || it.source}</span>
              {it.url ? <a href={it.url} target="_blank" rel="noopener" style={{ color: '#e6f1ff' }}>{it.title}</a> : it.title}
              {it.date && <span style={{ color: '#4b6a88' }}> · {String(it.date).slice(0, 10)}</span>}
            </div>
          ))}
        </div>
      )}
      {d?.error && <div style={{ color: '#f87171' }}>{d.error}</div>}
      <div style={{ color: '#4b6a88', fontSize: 10, marginTop: 4 }}>{d?.meta?.source}</div>
    </Section>
  );
}

export function AlephPanel() {
  const [q, setQ] = useState('gazprom');
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setD(await getJ(`/api/rvx/aleph?q=${encodeURIComponent(q.trim())}`)); }
    catch (e) { setD({ error: (e as Error).message }); }
    setBusy(false);
  };
  return (
    <Section title="ALEPH (OCCRP) SEARCH">
      <div style={{ display: 'flex', gap: 4 }}>
        <input style={{ ...input, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Aleph" />
        <button style={btn} onClick={run} disabled={busy}>{busy ? '…' : 'Search'}</button>
      </div>
      {d?.skipped && <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 6 }}>Skipped: {d.meta?.reason || 'requires API key'}</div>}
      {d?.results?.length > 0 && <div style={{ fontSize: 11, marginTop: 6 }}>{d.results.length} results</div>}
      {d?.error && <div style={{ color: '#f87171' }}>{d.error}</div>}
      <div style={{ color: '#4b6a88', fontSize: 10, marginTop: 4 }}>{d?.meta?.source}</div>
    </Section>
  );
}

export function PalantirTab() {
  return (
    <div className="rv-bp">
      <BlueprintStyles />
      <div className="rv-brand" style={{ marginBottom: 8, fontSize: 12 }}>REMOTEVIEW · INVESTIGATIONS</div>
      <p style={{ fontSize: 10, color: '#7f97b2', marginTop: 0 }}>
        Blueprint dark styling (design tokens only — full @blueprintjs package not bundled). Public/legal data only.
      </p>
      <LinkGraphPanel />
      <OsGraphPanel />
      <TimelineScrubber />
      <Analytics3D />
      <CaseFilesPanel />
      <ThreatIntelPanel />
      <AlephPanel />
    </div>
  );
}
