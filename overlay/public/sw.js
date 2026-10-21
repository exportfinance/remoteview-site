/* RemoteView service worker: makes the app installable and keeps the app shell
   available offline. API/data requests always go to the network (never cached). */
const CACHE = 'rv-shell-v1';
const SHELL = ['/remoteview-icon.png', '/icon-192.png', '/manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/remoteview-icon.png').then(() => new Response('<!doctype html><title>RemoteView</title><body style="background:#06101E;color:#2DD4BF;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh">RemoteView is offline — reconnect to load live data.</body>', { headers: { 'Content-Type': 'text/html' } }))));
  }
});
