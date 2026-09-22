/* Service worker: app shell works offline; realtime ETA calls always go to the network. */
const VERSION = 'v4';
const SHELL = 'hk-eta-shell-' + VERSION;
const DATA = 'hk-eta-data-' + VERSION;
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// Reference data that rarely changes (route lists, stop names): serve from cache, refresh in background.
const STATIC_API = [
  /^https:\/\/data\.etabus\.gov\.hk\/v1\/transport\/kmb\/(route|stop)$/,
  /^https:\/\/rt\.data\.gov\.hk\/v2\/transport\/citybus\/(route\/CTB|stop\/[^/?]+)$/,
  /^https:\/\/data\.etagmb\.gov\.hk\/route\/?$/
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(event, cacheName, fallbackUrl) {
  return caches.open(cacheName).then(async cache => {
    const hit = await cache.match(event.request, { ignoreSearch: !!fallbackUrl });
    const network = fetch(event.request)
      .then(res => { if (res && res.ok) cache.put(event.request, res.clone()); return res; })
      .catch(() => null);
    if (hit) { event.waitUntil(network); return hit; }
    const res = await network;
    if (res) return res;
    if (fallbackUrl) { const fb = await cache.match(fallbackUrl); if (fb) return fb; }
    return Response.error();
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, SHELL, './index.html'));
  } else if (STATIC_API.some(re => re.test(req.url))) {
    event.respondWith(staleWhileRevalidate(event, DATA));
  }
  // Anything else (all ETA endpoints) is not intercepted, so it is always live.
});
