import { NextResponse } from 'next/server';
import { viewer, db } from '@/lib/orbital/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const v = await viewer(); if (!v.addon || !v.key) return NextResponse.json({ error: 'Paid add-on required', locked: true }, { status: 402 });
  const site = new URL(req.url).searchParams.get('site');
  const r = await (await db()).query(
    `SELECT a.id::text, a.kind, a.title, a.body, a.created_at, s.id::text AS site_id, s.name AS site_name,
       p.source, p.scene_id, p.scene_time, p.baseline_from, p.baseline_to, p.changed_km2, p.changed_pct, p.valid_pct, p.classes,
       p.confidence, p.summary, p.summary_by, p.before_img, p.after_img, p.overlay_img, p.extra
     FROM ow_alerts a JOIN ow_sites s ON s.id = a.site_id LEFT JOIN ow_passes p ON p.id = a.pass_id
     WHERE s.user_id = $1 AND ($2::bigint IS NULL OR s.id = $2::bigint) ORDER BY a.created_at DESC LIMIT 60`, [v.key, site && /^\d+$/.test(site) ? site : null]);
  return NextResponse.json({ alerts: r.rows }, { headers: { 'cache-control': 'private, no-store' } });
}
