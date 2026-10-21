import { NextResponse } from 'next/server';
import { billingEnabled } from '@/lib/billing/config';
import { stripe } from '@/lib/billing/stripe';
import { currentUser, sameOrigin } from '@/lib/billing/session';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: 'Billing is not open yet.' }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const cur = await currentUser();
  if (!cur) return NextResponse.json({ error: 'Sign in first.', signin: true }, { status: 401 });
  if (!cur.user.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet. Choose a plan first.' }, { status: 400 });
  try {
    const base = (PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, '');
    const p = await stripe().billingPortal.sessions.create({ customer: cur.user.stripe_customer_id, return_url: `${base}/account`, ...(process.env.STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION } : {}) });
    return NextResponse.json({ url: p.url });
  } catch (e) { console.error('[portal]', (e as Error).message); return NextResponse.json({ error: 'Could not open billing right now.' }, { status: 502 }); }
}
