/* Orbital Watch (paid add-on): watch areas, satellite change passes and alerts.
   Tables are shared with the Python worker (worker/ow_worker.py creates the same ones). */
import { cookies } from 'next/headers';
import { pool } from '@/lib/waitlist';
import { AUTH_COOKIE, verifyToken } from '@/lib/siteAuth';
import { currentUser } from '@/lib/billing/session';
import { entitled } from '@/lib/accounts';

const SCHEMA = `CREATE TABLE IF NOT EXISTS ow_sites (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
  geom JSONB NOT NULL, bbox DOUBLE PRECISION[] NOT NULL, area_km2 DOUBLE PRECISION NOT NULL,
  presets TEXT[] NOT NULL DEFAULT '{all}', active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_checked TIMESTAMPTZ, next_due TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT, status_detail TEXT);
CREATE TABLE IF NOT EXISTS ow_passes (
  id BIGSERIAL PRIMARY KEY, site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  source TEXT NOT NULL, scene_id TEXT NOT NULL, scene_time TIMESTAMPTZ NOT NULL,
  baseline_ids TEXT[], baseline_from TIMESTAMPTZ, baseline_to TIMESTAMPTZ,
  valid_pct DOUBLE PRECISION, changed_km2 DOUBLE PRECISION, changed_pct DOUBLE PRECISION,
  classes JSONB, significant BOOLEAN NOT NULL DEFAULT false, confidence TEXT,
  summary TEXT, summary_by TEXT, before_img TEXT, after_img TEXT, overlay_img TEXT,
  extra JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(site_id, source, scene_id));
CREATE TABLE IF NOT EXISTS ow_scenes_seen (site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  source TEXT NOT NULL, scene_id TEXT NOT NULL, scene_time TIMESTAMPTZ NOT NULL, usable BOOLEAN NOT NULL, note TEXT,
  PRIMARY KEY (site_id, source, scene_id));
CREATE TABLE IF NOT EXISTS ow_fires (site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL, lon DOUBLE PRECISION NOT NULL, acq TIMESTAMPTZ NOT NULL, frp DOUBLE PRECISION,
  satellite TEXT, confidence TEXT, seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (site_id, lat, lon, acq, satellite));
CREATE TABLE IF NOT EXISTS ow_alerts (id BIGSERIAL PRIMARY KEY, site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  pass_id BIGINT REFERENCES ow_passes(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), pushed BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS ow_addon (user_key TEXT PRIMARY KEY, active BOOLEAN NOT NULL DEFAULT true, plan TEXT,
  source TEXT NOT NULL, activated_at TIMESTAMPTZ NOT NULL DEFAULT now(), stripe_subscription_item TEXT);
CREATE TABLE IF NOT EXISTS ow_push (id TEXT PRIMARY KEY, user_key TEXT NOT NULL, sub JSONB NOT NULL,
  pending BIGINT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;
const g = globalThis as any;
export async function db() {
  if (!g.__owReady) { await pool().query(SCHEMA); g.__owReady = true; }
  return pool();
}

/** Limits for v1 (kept in one place so pricing tiers can change them). */
export const LIMITS = { maxSites: Number(process.env.OW_MAX_SITES || 5), maxKm2: Number(process.env.OW_MAX_KM2 || 150), minKm2: 0.05 };
export const billingStub = () => process.env.OW_BILLING_STUB === '1';
export const ADDON_PRICE = { month: 19, year: 190, currency: 'USD' };

export type Viewer = {
  key: string | null;          // 'owner' | 'u:<id>' | null (anonymous)
  label: string;
  plan: 'owner' | 'personal' | 'pro' | 'free' | 'anon';
  planEntitled: boolean;       // Personal/Pro (or owner): may buy the add-on
  addon: boolean;              // add-on active: may use Orbital Watch
};

/** Who is asking, and whether they have the paid plan + the Orbital Watch add-on. Never true for free users. */
export async function viewer(): Promise<Viewer> {
  const jar = await cookies();
  if (await verifyToken(process.env.SITE_AUTH_SECRET, jar.get(AUTH_COOKIE)?.value)) {
    return { key: 'owner', label: 'Site owner', plan: 'owner', planEntitled: true, addon: true };
  }
  const cu = await currentUser().catch(() => null);
  if (!cu) return { key: null, label: 'Not signed in', plan: 'anon', planEntitled: false, addon: false };
  const u = cu.user;
  const ent = entitled(u);
  const plan = ent ? ((u.plan === 'pro' ? 'pro' : 'personal') as 'pro' | 'personal') : 'free';
  const key = 'u:' + u.id;
  let addon = false;
  if (ent) {
    const r = await (await db()).query('SELECT active FROM ow_addon WHERE user_key=$1', [key]);
    addon = !!r.rows[0]?.active;
  }
  return { key, label: u.email, plan, planEntitled: ent, addon };
}

export function bboxOf(ring: number[][]) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}
/** Geodesic-ish polygon area in km² (spherical excess on a 6371 km sphere). */
export function areaKm2(ring: number[][]) {
  const R = 6371, rad = Math.PI / 180; let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    s += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
  }
  return Math.abs(s * R * R / 2);
}
/** Validate a GeoJSON Polygon from the client; returns a closed outer ring or an error. */
export function cleanPolygon(geom: any): { ring: number[][] } | { error: string } {
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates?.[0])) return { error: 'A polygon is required' };
  const ring = (geom.coordinates[0] as any[]).map((p) => [Number(p?.[0]), Number(p?.[1])]);
  if (ring.length < 4 || ring.length > 500) return { error: 'Polygon must have 3 to 500 points' };
  if (ring.some(([x, y]) => !isFinite(x) || !isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 85)) return { error: 'Bad coordinates' };
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) ring.push([...f]);
  return { ring: ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]) };
}
