var CACHE_NAME = 'dpec-ue-v2';
var TILES_CACHE = 'dpec-ue-tiles';   // mapa guardado: no se borra al actualizar la app
var MAX_TILES = 2500;
var FILES_TO_CACHE = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(FILES_TO_CACHE); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME && k !== TILES_CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

function recortarTiles(cache) {
  return cache.keys().then(function (keys) {
    if (keys.length <= MAX_TILES) return;
    var borrar = keys.slice(0, keys.length - MAX_TILES);
    return Promise.all(borrar.map(function (k) { return cache.delete(k); }));
  });
}

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Mapa: las partes del mapa que se miran quedan guardadas para verlas sin Internet
  if (url.hostname === 'tile.openstreetmap.org') {
    if (event.request.method !== 'GET') return;
    event.respondWith(
      caches.open(TILES_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (hit) {
          if (hit) return hit;
          return fetch(event.request).then(function (resp) {
            if (resp && (resp.status === 200 || resp.type === 'opaque')) {
              cache.put(event.request, resp.clone()).then(function () { if (Math.random() < 0.02) recortarTiles(cache); });
            }
            return resp;
          });
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('estado.json') !== -1) return;   // el interruptor siempre va a la red
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        return caches.open(CACHE_NAME).then(function (cache) {
          if (event.request.method === 'GET' && response.status === 200) cache.put(event.request, response.clone());
          return response;
        });
      }).catch(function () { return cached; });
    })
  );
});
