import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, verifyToken, internalKey } from '@/lib/siteAuth';
import { IS_COMMERCIAL, isBlockedPath } from '@/lib/edition';
import { isDemoApi, DEMO_COOKIE } from '@/lib/demoLists';
import { USER_COOKIE, readUserToken } from '@/lib/userSession';

/* RemoteView is private: every page, API route and data file needs a valid
   session cookie. Only the login page/endpoint, Next static chunks, icons,
   the PWA manifest/service worker and robots.txt are public. */
const PUBLIC = new Set([
  '/login', '/api/login', '/robots.txt', '/favicon.ico', '/favicon.svg', '/favicon-32.svg',
  '/favicon-16x16.png', '/favicon-32x32.png', '/apple-touch-icon.png', '/android-chrome-192x192.png',
  '/android-chrome-512x512.png', '/icon-192.png', '/remoteview-icon.png', '/remoteview-wordmark.svg',
  '/manifest.json', '/site.webmanifest', '/sw.js',
]);

const COMMERCIAL_PUBLIC = new Set(['/welcome', '/legal/privacy', '/terms', '/credits', '/api/waitlist', '/api/waitlist/position', '/sitemap.xml', '/country', '/live', '/pricing', '/account', '/api/billing/webhook', '/api/billing/checkout', '/api/billing/portal']);
/* Public growth pages: SEO country/live pages, embeds and shared snapshots. */
const COMMERCIAL_PUBLIC_PREFIX = ['/landing/', '/country/', '/live/', '/embed/', '/s/', '/api/account/'];

async function demoToken(secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const day = Math.floor(Date.now() / 86_400_000);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('rv-demo:' + day)));
  return day + '.' + Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function demoOk(secret: string | undefined, v: string | undefined) {
  if (!secret || !v) return false;
  const [d] = v.split('.');
  const now = Math.floor(Date.now() / 86_400_000);
  if (Number(d) !== now && Number(d) !== now - 1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('rv-demo:' + d)));
  return v === d + '.' + Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}
/* Hard per-IP limit for demo visitors (in-memory, per instance). */
const demoHits = new Map<string, { n: number; t: number }>();
function demoLimited(ip: string, limit = 90, windowMs = 60_000) {
  const now = Date.now();
  if (demoHits.size > 20_000) demoHits.clear();
  const h = demoHits.get(ip);
  if (!h || now - h.t > windowMs) { demoHits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  return h.n > limit;
}
const clientIp = (r: NextRequest) => (r.headers.get('x-forwarded-for') || '').split(',')[0].trim() || r.headers.get('x-real-ip') || 'unknown';

function noindex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (IS_COMMERCIAL && isBlockedPath(pathname)) {
    return noindex(NextResponse.json({ error: 'Not available in this edition' }, { status: 404 }));
  }
  if (IS_COMMERCIAL) {
    if (pathname === '/robots.txt') {
      const base = (process.env.RV_PUBLIC_URL || request.nextUrl.origin).replace(/\/$/, '');
      return new NextResponse(
        `User-agent: *\nAllow: /$\nAllow: /landing/\nAllow: /privacy\nAllow: /terms\nAllow: /credits\nAllow: /country\nAllow: /live\nAllow: /pricing\nDisallow: /\n\nSitemap: ${base}/sitemap.xml\n`,
        { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } },
      );
    }
    if (pathname === '/privacy') return NextResponse.rewrite(new URL('/legal/privacy', request.url));
    if (COMMERCIAL_PUBLIC.has(pathname) || COMMERCIAL_PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) return NextResponse.next();
  }
  if (PUBLIC.has(pathname) || pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/')) {
    return noindex(NextResponse.next());
  }
  const secret = process.env.SITE_AUTH_SECRET;
  const ok =
    (await verifyToken(secret, request.cookies.get(AUTH_COOKIE)?.value)) ||
    (!!secret && request.headers.get('x-rv-internal') === (await internalKey(secret)));
  if (ok) return noindex(NextResponse.next());
  // Paying customers (commercial): a trialing/active subscription unlocks the full app.
  if (IS_COMMERCIAL) {
    const u = await readUserToken(secret, request.cookies.get(USER_COOKIE)?.value);
    if (u) {
      const isApi = pathname.startsWith('/api/');
      if (u.ent && u.entFresh) return noindex(NextResponse.next());
      if (u.ent && !u.entFresh && !isApi && request.method === 'GET') {
        const r = new URL('/api/account/refresh', request.url); r.searchParams.set('next', pathname + search);
        return NextResponse.redirect(r);
      }
      // Signed in but not (yet) entitled on a stale check, e.g. just after checkout: re-check before showing the landing page.
      if (!u.ent && !u.entFresh && !isApi && request.method === 'GET' && pathname === '/') {
        const r = new URL('/api/account/refresh', request.url); r.searchParams.set('next', '/');
        return NextResponse.redirect(r);
      }
      if (isApi && !(request.cookies.get(DEMO_COOKIE))) return noindex(NextResponse.json({ error: 'An active plan is required', upsell: '/pricing' }, { status: 402 }));
    }
  }
  if (IS_COMMERCIAL && (pathname === '/demo' || pathname === '/demo/')) {
    if (demoLimited('page:' + clientIp(request), 20)) return new NextResponse('Too many requests', { status: 429 });
    const res = NextResponse.rewrite(new URL('/', request.url));
    if (secret) res.cookies.set(DEMO_COOKIE, await demoToken(secret), { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 86_400 });
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  }
  if (IS_COMMERCIAL && await demoOk(secret, request.cookies.get(DEMO_COOKIE)?.value)) {
    const isStatic = !pathname.startsWith('/api/') && /\.[a-z0-9]{2,5}$/i.test(pathname);
    if (isStatic) return noindex(NextResponse.next());
    if (request.method === 'GET' && isDemoApi(pathname)) {
      if (demoLimited(clientIp(request))) return noindex(NextResponse.json({ error: 'Demo rate limit reached. Start a free trial for full access.' }, { status: 429 }));
      const res = NextResponse.next();
      res.headers.set('X-RV-Demo', '1');
      return noindex(res);
    }
    // Demo visitors may create share snapshots (POST only; the route has its own per-IP limit).
    if (request.method === 'POST' && pathname === '/api/share') return noindex(NextResponse.next());
    if (pathname.startsWith('/api/')) return noindex(NextResponse.json({ error: 'Available in the full version', upsell: '/pricing' }, { status: 402 }));
  }
  if (IS_COMMERCIAL && pathname === '/') return NextResponse.rewrite(new URL('/welcome', request.url));

  if (pathname.startsWith('/api/')) {
    return noindex(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname !== '/' || search ? `?next=${encodeURIComponent(pathname + search)}` : '';
  return noindex(NextResponse.redirect(url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
