import { NextResponse } from 'next/server';
import { viewer, db, LIMITS, cleanPolygon, areaKm2, bboxOf } from '@/lib/orbital/server';
import { sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
const locked = () => NextResponse.json({ error: 'Orbital Watch is a paid add-on for Personal and Pro plans.', locked: true, upsell: '/pricing' }, { status: 402 });

export async function GET() {
  const v = await viewer(); if (!v.addon || !v.key) return locked();
  const r = await (await db()).query(
    `SELECT s.id::text, s.name, s.geom, s.bbox, s.area_km2, s.active, s.created_at, s.last_checked, s.next_due, s.status, s.status_detail,
       (SELECT count(*)::int FROM ow_passes p WHERE p.site_id = s.id) AS passes,
       (SELECT count(*)::int FROM ow_alerts a WHERE a.site_id = s.id) AS alerts,
       (SELECT count(*)::int FROM ow_fires f WHERE f.site_id = s.id AND f.acq > now() - interval '14 days') AS fires_7d,
       (SELECT max(scene_time) FROM ow_passes p WHERE p.site_id = s.id) AS newest_scene
     FROM ow_sites s WHERE s.user_id = $1 ORDER BY s.created_at`, [v.key]);
  return NextResponse.json({ sites: r.rows, limits: LIMITS }, { headers: { 'cache-control': 'private, no-store' } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer(); if (!v.addon || !v.key) return locked();
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim().slice(0, 80) || 'Watch area';
  const p = cleanPolygon(b?.geom);
  if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 });
  const km2 = areaKm2(p.ring);
  if (km2 > LIMITS.maxKm2) return NextResponse.json({ error: `Area is ${km2.toFixed(0)} km². The limit per watch area is ${LIMITS.maxKm2} km².` }, { status: 400 });
  if (km2 < LIMITS.minKm2) return NextResponse.json({ error: 'Area is too small to watch (minimum 0.05 km²).' }, { status: 400 });
  const pool = await db();
  const n = (await pool.query('SELECT count(*)::int AS n FROM ow_sites WHERE user_id = $1', [v.key])).rows[0].n;
  if (n >= LIMITS.maxSites) return NextResponse.json({ error: `You can watch up to ${LIMITS.maxSites} areas.` }, { status: 400 });
  const r = await pool.query(
    `INSERT INTO ow_sites (user_id, name, geom, bbox, area_km2, status) VALUES ($1,$2,$3,$4,$5,'queued') RETURNING id::text, name, area_km2`,
    [v.key, name, JSON.stringify({ type: 'Polygon', coordinates: [p.ring] }), bboxOf(p.ring), km2]);
  return NextResponse.json({ site: r.rows[0] });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer(); if (!v.addon || !v.key) return locked();
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const r = await (await db()).query('DELETE FROM ow_sites WHERE id = $1 AND user_id = $2', [id, v.key]);
  return NextResponse.json({ ok: (r.rowCount || 0) > 0 });
}
