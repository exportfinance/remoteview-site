import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { USER_COOKIE, USER_HINT, makeUserToken, readUserToken, cookieOpts } from '@/lib/userSession';
import { userById, entitled, type User } from '@/lib/accounts';
const secret = () => process.env.SITE_AUTH_SECRET || '';
export const isSecure = (req: Request) => new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
export async function setSession(res: NextResponse, u: User, secure: boolean, loginExp?: number) {
  res.cookies.set(USER_COOKIE, await makeUserToken(secret(), u.id, entitled(u), loginExp), cookieOpts(secure, loginExp ? Math.max(60, loginExp - Math.floor(Date.now() / 1000)) : undefined));
  res.cookies.set(USER_HINT, '1', { ...cookieOpts(secure), httpOnly: false });
  return res;
}
export function clearSession(res: NextResponse) {
  res.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 }); res.cookies.set(USER_HINT, '', { path: '/', maxAge: 0 }); return res;
}
/** The signed-in customer (fresh from Postgres), or null. */
export async function currentUser(): Promise<{ user: User; loginExp: number } | null> {
  const tok = await readUserToken(secret(), (await cookies()).get(USER_COOKIE)?.value);
  if (!tok) return null;
  const user = await userById(tok.uid).catch(() => null);
  return user ? { user, loginExp: tok.loginExp } : null;
}
/** Same-origin check for state-changing POSTs (CSRF defence on top of SameSite=Lax). */
export function sameOrigin(req: Request) {
  const o = req.headers.get('origin'); if (!o) return true;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try { return new URL(o).host === host; } catch { return false; }
}
