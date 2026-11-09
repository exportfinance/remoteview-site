import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/orbital/server';
import { sendPush } from '@/lib/alerts/webpush';
export const dynamic = 'force-dynamic';
function okKey(given: string | null) {
  const want = process.env.OW_INTERNAL_KEY || '';
  if (!want || !given || given.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(want));
}
/** Worker -> app: queue an alert for each of the user's push subscriptions and send a payload-less push. */
export async function POST(req: Request) {
  if (!okKey(req.headers.get('x-ow-internal'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const aid = String(b?.alertId || ''), uid = String(b?.userId || '');
  if (!/^\d+$/.test(aid) || !uid) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const pool = await db();
  const subs = (await pool.query('UPDATE ow_push SET pending = array_append(pending, $2::bigint) WHERE user_key = $1 RETURNING id, sub', [uid, aid])).rows;
  const results: number[] = [];
  for (const s of subs) {
    const st = await sendPush(s.sub);
    results.push(st);
    if (st === 404 || st === 410) await pool.query('DELETE FROM ow_push WHERE id = $1', [s.id]);
  }
  return NextResponse.json({ subs: subs.length, results });
}
