import { NextResponse } from 'next/server';
import { viewer, db } from '@/lib/orbital/server';
export const dynamic = 'force-dynamic';
/** Every compared pass for one area (significant or not), newest first, plus recent FIRMS detections. */
export async function GET(req: Request) {
  const v = await viewer(); if (!v.addon || !v.key) return NextResponse.json({ error: 'Paid add-on required', locked: true }, { status: 402 });
  const site = new URL(req.url).searchParams.get('site') || '';
  if (!/^\d+$/.test(site)) return NextResponse.json({ error: 'Bad site' }, { status: 400 });
  const pool = await db();
  const own = await pool.query('SELECT id FROM ow_sites WHERE id = $1 AND user_id = $2', [site, v.key]);
  if (!own.rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [p, f] = await Promise.all([
    pool.query(`SELECT id::text, source, scene_id, scene_time, baseline_from, baseline_to, valid_pct, changed_km2, changed_pct, classes, significant,
                  confidence, summary, summary_by, before_img, after_img, overlay_img, extra FROM ow_passes WHERE site_id = $1 ORDER BY scene_time DESC LIMIT 40`, [site]),
    pool.query(`SELECT lat, lon, acq, frp, satellite, confidence FROM ow_fires WHERE site_id = $1 AND acq > now() - interval '14 days' ORDER BY acq DESC LIMIT 500`, [site]),
  ]);
  return NextResponse.json({ passes: p.rows, fires: f.rows }, { headers: { 'cache-control': 'private, no-store' } });
}
