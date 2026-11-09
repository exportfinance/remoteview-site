import { NextResponse } from 'next/server';
import { viewer, LIMITS, billingStub, ADDON_PRICE } from '@/lib/orbital/server';
import { vapidPublic } from '@/lib/alerts/webpush';
export const dynamic = 'force-dynamic';
export async function GET() {
  const v = await viewer();
  return NextResponse.json({
    signedIn: !!v.key, label: v.key ? v.label : null, plan: v.plan, planEntitled: v.planEntitled, addon: v.addon,
    limits: LIMITS, price: ADDON_PRICE, billing: billingStub() ? 'stub-test' : 'stripe-test', vapid: v.addon ? vapidPublic() : null,
  }, { headers: { 'cache-control': 'private, no-store' } });
}
