import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { viewer, db } from '@/lib/orbital/server';
import { sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer(); if (!v.addon || !v.key) return NextResponse.json({ error: 'Paid add-on required', locked: true }, { status: 402 });
  const b = await req.json().catch(() => null);
  const ep = b?.sub?.endpoint;
  if (!ep || typeof ep !== 'string' || !/^https:\/\//.test(ep) || ep.length > 1000) return NextResponse.json({ error: 'bad subscription' }, { status: 400 });
  const pool = await db();
  const ex = await pool.query(`SELECT id FROM ow_push WHERE user_key = $1 AND sub->>'endpoint' = $2`, [v.key, ep]);
  if (ex.rowCount) return NextResponse.json({ id: ex.rows[0].id });
  const id = randomBytes(16).toString('hex');
  await pool.query('INSERT INTO ow_push (id, user_key, sub) VALUES ($1,$2,$3)', [id, v.key, JSON.stringify({ endpoint: ep, keys: b.sub.keys || null })]);
  return NextResponse.json({ id });
}
export async function DELETE(req: Request) {
  const v = await viewer(); const id = new URL(req.url).searchParams.get('id') || '';
  if (v.key && id) await (await db()).query('DELETE FROM ow_push WHERE id = $1 AND user_key = $2', [id, v.key]);
  return NextResponse.json({ ok: true });
}
