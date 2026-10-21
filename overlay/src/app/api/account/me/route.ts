import { NextResponse } from 'next/server';
import { currentUser, setSession, isSecure } from '@/lib/billing/session';
import { entitled } from '@/lib/accounts';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const cur = await currentUser();
  if (!cur) return NextResponse.json({ user: null }, { headers: { 'cache-control': 'no-store' } });
  const u = cur.user;
  const res = NextResponse.json({ user: { email: u.email, status: u.sub_status, plan: u.plan, interval: u.billing_interval, trialEnd: u.trial_end, periodEnd: u.current_period_end, cancelAtPeriodEnd: u.cancel_at_period_end, founder: u.founder, entitled: entitled(u) } }, { headers: { 'cache-control': 'no-store' } });
  return setSession(res, u, isSecure(req), cur.loginExp); // keeps the entitlement bit fresh while the app is open
}
