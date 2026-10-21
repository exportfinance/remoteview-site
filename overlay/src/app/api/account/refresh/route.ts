import { NextResponse } from 'next/server';
import { currentUser, setSession, clearSession, isSecure } from '@/lib/billing/session';
import { entitled } from '@/lib/accounts';
export const dynamic = 'force-dynamic';
/** Re-checks the subscription in Postgres, re-issues the session, and sends the user on (or to /pricing). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const next = (u.searchParams.get('next') || '/').replace(/[^\w\-/?=&.,%]/g, '');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const cur = await currentUser();
  if (!cur) return clearSession(NextResponse.redirect(new URL('/account?signin=1', req.url)));
  const ok = entitled(cur.user);
  const res = NextResponse.redirect(new URL(ok ? safeNext : '/pricing?need=plan', req.url));
  return setSession(res, cur.user, isSecure(req), cur.loginExp);
}
