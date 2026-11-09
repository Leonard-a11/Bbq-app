// Bewaart de app op de telefoon, zodat hij ook zonder internet opent.
// Bij een nieuwe versie: VERSIE ophogen.
const VERSIE = 'bbq-v1';
const BESTANDEN = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'icoon.svg', 'icoon-192.png', 'icoon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIE).then((c) => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSIE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Eerst internet (altijd de nieuwste versie), anders de bewaarde kopie.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then((r) => { const kopie = r.clone(); caches.open(VERSIE).then((c) => c.put(e.request, kopie)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// Tik op een alarmmelding → app naar voren.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
