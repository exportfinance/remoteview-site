import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, verifyToken, internalKey } from '@/lib/siteAuth';

/* RemoteView is private: every page, API route and data file needs a valid
   session cookie. Only the login page/endpoint, Next static chunks, icons,
   the PWA manifest/service worker and robots.txt are public. */
const PUBLIC = new Set([
  '/login', '/api/login', '/robots.txt', '/favicon.ico', '/favicon.svg', '/favicon-32.svg',
  '/favicon-16x16.png', '/favicon-32x32.png', '/apple-touch-icon.png', '/android-chrome-192x192.png',
  '/android-chrome-512x512.png', '/icon-192.png', '/remoteview-icon.png', '/remoteview-wordmark.svg',
  '/manifest.json', '/site.webmanifest', '/sw.js',
]);

function noindex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.has(pathname) || pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/')) {
    return noindex(NextResponse.next());
  }
  const secret = process.env.SITE_AUTH_SECRET;
  const ok =
    (await verifyToken(secret, request.cookies.get(AUTH_COOKIE)?.value)) ||
    (!!secret && request.headers.get('x-rv-internal') === (await internalKey(secret)));
  if (ok) return noindex(NextResponse.next());

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
