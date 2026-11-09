import { NextResponse } from 'next/server';
import { viewer, db, billingStub } from '@/lib/orbital/server';
import { sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
/* Staging: Stripe TEST checkout for the add-on is not wired yet (no RemoteView test key on the server),
   so with OW_BILLING_STUB=1 this records a test activation instead. Free accounts can never activate. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer();
  if (!v.key) return NextResponse.json({ error: 'Sign in first', upsell: '/account?signin=1' }, { status: 401 });
  if (!v.planEntitled) return NextResponse.json({ error: 'Orbital Watch is an add-on for Personal and Pro plans. It is not available on the free tier.', upsell: '/pricing' }, { status: 402 });
  if (!billingStub()) return NextResponse.json({ error: 'Add-on checkout is not configured on this server yet.' }, { status: 501 });
  await (await db()).query(
    `INSERT INTO ow_addon (user_key, active, plan, source) VALUES ($1, true, $2, 'stub-test')
     ON CONFLICT (user_key) DO UPDATE SET active = true, plan = EXCLUDED.plan, activated_at = now()`, [v.key, v.plan]);
  return NextResponse.json({ ok: true, addon: true, billing: 'stub-test' });
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const v = await viewer();
  if (!v.key || v.key === 'owner') return NextResponse.json({ error: 'Nothing to cancel' }, { status: 400 });
  await (await db()).query('UPDATE ow_addon SET active = false WHERE user_key = $1', [v.key]);
  return NextResponse.json({ ok: true, addon: false });
}
