/* RemoteView private-site lock: signed session cookie (HMAC-SHA256 with SITE_AUTH_SECRET).
   Web Crypto only, so it runs in middleware and in route handlers alike. */
export const AUTH_COOKIE = 'rv_session';
export const AUTH_MAX_AGE = 30 * 24 * 3600; // 30 days, seconds

const enc = new TextEncoder();
function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export async function makeToken(secret: string) {
  const exp = String(Math.floor(Date.now() / 1000) + AUTH_MAX_AGE);
  return `${exp}.${await hmac(secret, `rv:${exp}`)}`;
}
export async function verifyToken(secret: string | undefined, token: string | undefined) {
  if (!secret || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEq(sig, await hmac(secret, `rv:${exp}`));
}
/* Server-to-self calls (e.g. history snapshots) present this header instead of a cookie. */
export async function internalKey(secret: string) {
  return hmac(secret, 'rv-internal');
}
export async function checkPassword(given: string, actual: string | undefined) {
  if (!actual) return false;
  // compare digests so length does not leak
  const s = 'rv-pw-compare';
  return safeEq(await hmac(s, given), await hmac(s, actual));
}
