import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { IS_COMMERCIAL } from '@/lib/edition';
import { createUser } from '@/lib/accounts';
import { setSession, isSecure, sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;
export async function POST(req: Request) {
  if (!IS_COMMERCIAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  if (isRateLimited('signup:' + getClientIp(req), 5, 30 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  if (typeof b.website === 'string' && b.website) return NextResponse.json({ error: 'Bad request' }, { status: 400 }); // honeypot
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (pw.length < 10 || pw.length > 200) return NextResponse.json({ error: 'Use a password of at least 10 characters.' }, { status: 400 });
  if (b.terms !== true) return NextResponse.json({ error: 'Please accept the terms.' }, { status: 400 });
  try {
    const u = await createUser(email, pw);
    if (!u) return NextResponse.json({ error: 'That email already has an account. Sign in instead.' }, { status: 409 });
    return setSession(NextResponse.json({ ok: true }), u, isSecure(req));
  } catch (e) { console.error('[signup]', (e as Error).message); return NextResponse.json({ error: 'Could not create the account right now.' }, { status: 503 }); }
}
