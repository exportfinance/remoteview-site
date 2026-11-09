import { NextResponse } from 'next/server';
import { db } from '@/lib/orbital/server';
export const dynamic = 'force-dynamic';
/* Called by /orbital-sw.js on a (payload-less) push. The random subscription id is the capability;
   only the oldest pending alert's title and short text are returned, then it is removed from the queue. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[0-9a-f]{32}$/.test(id)) return NextResponse.json({ alert: null });
  const pool = await db();
  const r = await pool.query(`UPDATE ow_push SET pending = pending[2:] WHERE id = $1 RETURNING (SELECT pending[1] FROM ow_push WHERE id = $1) AS aid`, [id]);
  const aid = r.rows[0]?.aid;
  if (!aid) return NextResponse.json({ alert: null });
  const a = await pool.query(`SELECT a.id::text, a.title, a.body, a.site_id::text FROM ow_alerts a JOIN ow_sites s ON s.id = a.site_id
                              JOIN ow_push p ON p.user_key = s.user_id WHERE a.id = $1 AND p.id = $2`, [aid, id]);
  const x = a.rows[0]; if (!x) return NextResponse.json({ alert: null });
  return NextResponse.json({ alert: { title: x.title, body: x.body.slice(0, 220), url: `/app?orbital=${x.site_id}&alert=${x.id}`, tag: 'ow-' + x.id } });
}
