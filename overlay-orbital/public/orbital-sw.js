/* Orbital Watch push service worker (push only; scope /orbital-sw/ so it never controls pages). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
  if (e.data && e.data.owSubId) e.waitUntil(caches.open('ow-push').then((c) => c.put('/orbital-sw/id', new Response(e.data.owSubId))));
});
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let a = null;
    try {
      const c = await caches.open('ow-push'); const r = await c.match('/orbital-sw/id'); const id = r ? await r.text() : '';
      a = (await (await fetch('/api/orbital/push/pending?id=' + encodeURIComponent(id), { cache: 'no-store' })).json()).alert;
    } catch (err) {}
    a = a || { title: 'Orbital Watch', body: 'New satellite change alert. Tap to open.', url: '/app', tag: 'ow' };
    await self.registration.showNotification(a.title, { body: a.body, tag: a.tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: a.url } });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || '/app'));
});
