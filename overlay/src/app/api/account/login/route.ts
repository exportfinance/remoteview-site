import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { IS_COMMERCIAL } from '@/lib/edition';
import { login } from '@/lib/accounts';
import { setSession, isSecure, sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!IS_COMMERCIAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const email = String(b.email || '').trim().toLowerCase();
  if (isRateLimited('login:' + getClientIp(req), 10, 15 * 60_000) || isRateLimited('login-e:' + email, 10, 15 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  try {
    const u = await login(email, String(b.password || ''));
    if (!u) return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 });
    return setSession(NextResponse.json({ ok: true }), u, isSecure(req));
  } catch (e) { console.error('[login]', (e as Error).message); return NextResponse.json({ error: 'Sign-in unavailable right now.' }, { status: 503 }); }
}
