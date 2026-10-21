/* Customer sessions (commercial edition). Web Crypto only, so middleware can verify them.
   Cookie: v1.<uid>.<loginExp>.<ent 0|1>.<entExp>.<sig>. Login lasts 30 days; the entitlement bit is
   re-checked against Postgres at least hourly via /api/account/refresh, so a cancelled plan stops within the hour. */
export const USER_COOKIE = 'rv_user';
export const USER_HINT = 'rv_acct'; // non-httpOnly "has an account" hint for UI only, grants nothing
export const LOGIN_TTL = 30 * 24 * 3600;
export const ENT_TTL = 3600;
const enc = new TextEncoder();
async function sig(secret: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('rv-user:' + msg))), (b) => b.toString(16).padStart(2, '0')).join('');
}
const eq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
export async function makeUserToken(secret: string, uid: string, ent: boolean, loginExp?: number) {
  const now = Math.floor(Date.now() / 1000);
  const body = `v1.${uid}.${loginExp ?? now + LOGIN_TTL}.${ent ? 1 : 0}.${now + ENT_TTL}`;
  return `${body}.${await sig(secret, body)}`;
}
export type UserTok = { uid: string; loginExp: number; ent: boolean; entFresh: boolean };
export async function readUserToken(secret: string | undefined, tok: string | undefined): Promise<UserTok | null> {
  if (!secret || !tok) return null;
  const p = tok.split('.'); if (p.length !== 6 || p[0] !== 'v1' || !/^\d+$/.test(p[1])) return null;
  const body = p.slice(0, 5).join('.');
  if (!eq(p[5], await sig(secret, body))) return null;
  const now = Date.now() / 1000, loginExp = Number(p[2]);
  if (!(loginExp > now)) return null;
  return { uid: p[1], loginExp, ent: p[3] === '1', entFresh: Number(p[4]) > now };
}
export const cookieOpts = (secure: boolean, maxAge = LOGIN_TTL) => ({ httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge });
