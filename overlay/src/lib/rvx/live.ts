/* RemoteView extras: long-lived background collectors (lightning, AIS, 24h history).
   Everything is bounded so the small Railway instance stays light. */
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { selfJson } from './util';

type Strike = [number, number, number]; // lng, lat, t(ms)
const g = globalThis as any;
g.__rvx ??= { strikes: [] as Strike[], lightningUp: false, lightningErr: '', ships: new Map(), aisUp: false, aisErr: '', history: [] as any[], histTimer: null, risk: null };
export const S = g.__rvx;

function lzw(b: string) {
  const e: Record<number, string> = {}; const d = b.split(''); let c = d[0]; let f = c; const out = [c]; let o = 256;
  for (let i = 1; i < d.length; i++) {
    const code = d[i].charCodeAt(0);
    const a = code < 256 ? d[i] : e[code] ? e[code] : f + c;
    out.push(a); c = a.charAt(0); e[o++] = f + c; f = a;
  }
  return out.join('');
}

let bzWs: WebSocket | null = null; let bzIdx = 1;
export function ensureLightning() {
  if (bzWs) return;
  const url = `wss://ws${bzIdx}.blitzortung.org/`;
  const ws = new WebSocket(url, { headers: { Origin: 'https://map.blitzortung.org' } });
  bzWs = ws;
  ws.on('open', () => { S.lightningUp = true; ws.send('{"a":111}'); });
  ws.on('message', (m) => {
    try {
      const d = JSON.parse(lzw(m.toString()));
      if (typeof d.lat === 'number') {
        S.strikes.push([+d.lon.toFixed(3), +d.lat.toFixed(3), Math.floor(d.time / 1e6)]);
        if (S.strikes.length > 6000) S.strikes.splice(0, S.strikes.length - 5000);
      }
    } catch { /* ignore */ }
  });
  const retry = (why: string) => { S.lightningUp = false; S.lightningErr = why; bzWs = null; bzIdx = (bzIdx % 8) + 1; setTimeout(ensureLightning, 10000); };
  ws.on('error', (e) => { S.lightningErr = String(e.message); });
  ws.on('close', () => retry('closed'));
}

/* AIS (aisstream.io) — only when AISSTREAM_API_KEY is configured. */
let aisWs: WebSocket | null = null;
export function ensureAis(): boolean {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) { S.aisErr = 'AISSTREAM_API_KEY not set'; return false; }
  if (aisWs) return true;
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  aisWs = ws;
  ws.on('open', () => {
    S.aisUp = true;
    ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[-90, -180], [90, 180]]], FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }));
  });
  ws.on('message', (m) => {
    try {
      const d = JSON.parse(m.toString());
      const meta = d.MetaData || {}; const id = meta.MMSI; if (!id) return;
      const cur = S.ships.get(id) || { mmsi: id };
      if (d.MessageType === 'PositionReport') {
        const p = d.Message.PositionReport;
        Object.assign(cur, { lat: p.Latitude, lng: p.Longitude, sog: p.Sog, cog: p.Cog, t: Date.now(), name: (meta.ShipName || cur.name || '').trim() });
      } else if (d.MessageType === 'ShipStaticData') {
        const s = d.Message.ShipStaticData;
        Object.assign(cur, { type: s.Type, name: (s.Name || cur.name || '').trim(), dest: (s.Destination || '').trim(), imo: s.ImoNumber || undefined });
      }
      S.ships.set(id, cur);
      if (S.ships.size > 25000) {
        const cut = Date.now() - 45 * 60_000;
        for (const [k, v] of S.ships) if (!v.t || v.t < cut) S.ships.delete(k);
      }
    } catch { /* ignore */ }
  });
  ws.on('error', (e) => { S.aisErr = String(e.message); });
  ws.on('close', () => { S.aisUp = false; aisWs = null; setTimeout(ensureAis, 15000); });
  return true;
}

/* 24h rolling snapshot store, sampled every 15 minutes, persisted to .cache. */
const HFILE = path.join(process.cwd(), '.cache', 'rvx-history.json');
const MAX_SNAPS = 96;
async function snapshot() {
  const [fl, eq, ev] = await Promise.allSettled([
    selfJson('/api/flights'),
    selfJson('/api/earthquakes', 20000),
    selfJson('/api/gdelt-events?limit=300&quad=3,4'),
  ]);
  const flights: any[] = [];
  if (fl.status === 'fulfilled') {
    const d: any = fl.value;
    for (const k of ['military_flights', 'private_jets', 'commercial_flights', 'private_flights']) {
      for (const f of (d[k] || [])) {
        if (flights.length >= 1500) break;
        if (typeof f.lat === 'number') flights.push([f.icao24, +f.lng.toFixed(3), +f.lat.toFixed(3), k[0], f.callsign || '']);
      }
    }
  }
  const quakes = eq.status === 'fulfilled' ? ((eq.value as any).earthquakes || []).slice(0, 300).map((q: any) => [q.id, q.lng, q.lat, q.magnitude, q.time]) : [];
  const events = ev.status === 'fulfilled' ? ((ev.value as any).events || []).slice(0, 300).map((e: any) => [e.lng, e.lat, e.quad, e.root_code, e.country]) : [];
  S.history.push({ t: Date.now(), flights, quakes, events });
  while (S.history.length > MAX_SNAPS) S.history.shift();
  try { fs.mkdirSync(path.dirname(HFILE), { recursive: true }); fs.writeFileSync(HFILE, JSON.stringify(S.history)); } catch { /* read-only fs */ }
}
export function ensureHistory() {
  if (S.histTimer) return;
  try {
    const old = JSON.parse(fs.readFileSync(HFILE, 'utf8'));
    if (Array.isArray(old)) S.history = old.filter((s: any) => Date.now() - s.t < 24 * 3600_000);
  } catch { /* none */ }
  S.histTimer = setInterval(() => { snapshot().catch(() => {}); }, 15 * 60_000);
  const last = S.history[S.history.length - 1];
  if (!last || Date.now() - last.t > 10 * 60_000) setTimeout(() => snapshot().catch(() => {}), 20_000);
}
