import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_MAX_AGE, makeToken, checkPassword, lockConfigured } from '@/lib/siteAuth';
import { getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

const fails = new Map<string, { n: number; reset: number }>();
const MAX_FAILS = 5;
const WINDOW = 60_000;
// Backstop for when the client IP cannot be told apart behind the proxy:
// at most 20 wrong passwords per minute across all clients.
let globalFails = { n: 0, reset: 0 };
const GLOBAL_MAX = 20;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || getClientIp(req);
  const now = Date.now();
  const f = fails.get(ip);
  if (now > globalFails.reset) globalFails = { n: 0, reset: now + WINDOW };
  if ((f && now < f.reset && f.n >= MAX_FAILS) || globalFails.n >= GLOBAL_MAX) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(((f?.reset ?? globalFails.reset) - now) / 1000)) } });
  }
  let password = '';
  let next = '/';
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const b = await req.json();
      password = String(b.password || '');
      next = String(b.next || '/');
    } else {
      const fd = await req.formData();
      password = String(fd.get('password') || '');
      next = String(fd.get('next') || '/');
    }
  } catch { /* empty */ }
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  const secret = process.env.SITE_AUTH_SECRET;
  if (!secret || !lockConfigured()) {
    return NextResponse.json({ error: 'Site lock is not configured.' }, { status: 503 });
  }
  if (!(await checkPassword(password))) {
    const cur = f && now < f.reset ? f : { n: 0, reset: now + WINDOW };
    cur.n++;
    globalFails.n++;
    fails.set(ip, cur);
    if (fails.size > 5000) fails.clear();
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(AUTH_COOKIE, await makeToken(secret), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: AUTH_MAX_AGE,
  });
  return res;
}
