// Minimal service worker so browsers treat the planner as an installable app.
// It does not cache anything: every request goes straight to the network, so a new version
// is always picked up right away. Offline data is handled by Firebase's own on-device cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
