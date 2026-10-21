/* Shareable read-only map snapshots (commercial edition). Postgres, same DB as the waitlist. */
import { randomBytes } from 'node:crypto';
import { pool } from '@/lib/waitlist';
const g = globalThis as any;
async function ensure() {
  if (g.__rvSnapReady) return;
  await pool().query(`CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, zoom REAL NOT NULL,
    bearing REAL NOT NULL DEFAULT 0, pitch REAL NOT NULL DEFAULT 0, layers TEXT NOT NULL DEFAULT '',
    place TEXT, image BYTEA, ip_hash TEXT, views INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  g.__rvSnapReady = true;
}
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const newId = () => { let o = ''; for (const x of randomBytes(9)) o += ALPH[x % ALPH.length]; return o; };
export const SNAP_ID = /^[A-Za-z0-9]{9}$/;
export type Snap = { id: string; lat: number; lng: number; zoom: number; bearing: number; pitch: number; layers: string; place: string | null; hasImage: boolean; created_at: string; views: number };
export async function createSnap(s: Omit<Snap, 'id' | 'hasImage' | 'created_at' | 'views'> & { image: Buffer | null; ipHash: string }) {
  await ensure();
  const id = newId();
  await pool().query(`INSERT INTO snapshots (id, lat, lng, zoom, bearing, pitch, layers, place, image, ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, s.lat, s.lng, s.zoom, s.bearing, s.pitch, s.layers, s.place, s.image, s.ipHash]);
  return id;
}
export async function getSnap(id: string): Promise<Snap | null> {
  if (!SNAP_ID.test(id)) return null;
  await ensure();
  const r = await pool().query(`UPDATE snapshots SET views = views + 1 WHERE id = $1 RETURNING id, lat, lng, zoom, bearing, pitch, layers, place, image IS NOT NULL AS "hasImage", created_at, views`, [id]);
  return r.rows[0] || null;
}
export async function snapImage(id: string): Promise<Buffer | null> {
  if (!SNAP_ID.test(id)) return null;
  await ensure();
  const r = await pool().query(`SELECT image FROM snapshots WHERE id = $1`, [id]);
  return r.rows[0]?.image || null;
}
