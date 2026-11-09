import { NextResponse } from 'next/server';
import { viewer, db } from '@/lib/orbital/server';
import { sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
/** Ask the worker to check this area now (it polls for due sites every minute). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer(); if (!v.addon || !v.key) return NextResponse.json({ error: 'Paid add-on required', locked: true }, { status: 402 });
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const r = await (await db()).query(
    `UPDATE ow_sites SET next_due = now(), status = 'queued' WHERE id = $1 AND user_id = $2 AND (last_checked IS NULL OR last_checked < now() - interval '10 minutes') RETURNING id`, [id, v.key]);
  return NextResponse.json({ ok: (r.rowCount || 0) > 0, note: r.rowCount ? 'Queued' : 'Checked in the last 10 minutes; try again shortly.' });
}
