import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { positionOf, REF_RE, JUMP_PER_REFERRAL } from '@/lib/waitlist';
import { IS_COMMERCIAL } from '@/lib/edition';
export const dynamic = 'force-dynamic';
/** Position lookup by your own referral code (the code is the secret; it is only shown to the person who signed up). */
export async function GET(req: Request) {
  if (!IS_COMMERCIAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (isRateLimited('wlpos:' + getClientIp(req), 30, 10 * 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const code = new URL(req.url).searchParams.get('code') || '';
  if (!REF_RE.test(code)) return NextResponse.json({ error: 'Bad code' }, { status: 400 });
  try { const p = await positionOf(code); return p ? NextResponse.json({ ...p, jump: JUMP_PER_REFERRAL }, { headers: { 'cache-control': 'no-store' } }) : NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  catch { return NextResponse.json({ error: 'Unavailable' }, { status: 503 }); }
}
