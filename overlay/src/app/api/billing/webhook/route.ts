import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/billing/stripe';
import { claimEvent, releaseEvent, markPaymentFailed } from '@/lib/accounts';
import { syncSubscription } from '@/lib/billing/sync';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text(); // raw body: required for signature verification
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(raw, sig || '', secret, 300); }
  catch { return NextResponse.json({ error: 'Bad signature' }, { status: 400 }); }

  // Idempotency: Stripe may deliver an event more than once.
  if (!(await claimEvent(event.id, event.type))) return NextResponse.json({ received: true, duplicate: true });
  try {
    const s = stripe();
    switch (event.type) {
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.mode === 'subscription' && cs.subscription) {
          const subId = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription.id;
          await syncSubscription(await s.subscriptions.retrieve(subId), cs.client_reference_id || (cs.metadata?.rv_user as string) || null);
        }
        break;
      }
      case 'customer.subscription.updated': {
        // Re-fetch so out-of-order deliveries still land on the latest state.
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(await s.subscriptions.retrieve(sub.id));
        break;
      }
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const cus = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (cus) await markPaymentFailed(cus); // access follows the subscription status Stripe sends next
        break;
      }
      default: break; // not subscribed to anything else; acknowledge
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    await releaseEvent(event.id).catch(() => {}); // let Stripe retry
    console.error('[webhook]', event.type, (e as Error).message);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
