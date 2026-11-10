/* Service worker · Trombosis por Catéter Neonatal
   - Precarga index.html para uso sin internet.
   - Navegación: red primero con tiempo límite de 3 s; si no responde, versión guardada.
     Así la app nunca se queda "cargando" en el iPhone y se actualiza cuando hay red.
   - Fuentes de Google: se guardan en la primera visita con red (opcionales; hay fuentes de respaldo).
   Para publicar cambios: suba el nuevo index.html y cambie VERSION aquí. */
const VERSION = 'trombo-cat-neo-v1.0.0';
const CORE = ['./', './index.html'];
const FONT_CACHE = 'trombo-cat-fonts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response && response.ok) {
      cache.put('./index.html', response.clone());
      return response;
    }
    throw new Error('bad response');
  } catch (e) {
    return (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('<h1>Sin conexión</h1><p>Abra la app una vez con internet para guardarla.</p>',
             { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetching = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetching;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, VERSION));
  }
});
