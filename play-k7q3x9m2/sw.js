// Chess the Gathering Service Worker (Cache-first offline cache with dynamic content hash)
const CACHE_NAME = "ctg-5f553004";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./js/catalog.js",
  "./js/chess_engine.js",
  "./js/cards.js",
  "./js/game.js",
  "./js/rng.js",
  "./js/policies.js",
  "./js/session.js",
  "./js/stats.js",
  "./js/art.js",
  "./js/three.min.js",
  "./js/pieces3d.js",
  "./art/card-01.svg",
  "./art/card-02.svg",
  "./art/card-03.svg",
  "./art/card-04.svg",
  "./art/card-05.svg",
  "./art/card-06.svg",
  "./art/card-07.svg",
  "./art/card-08.svg",
  "./art/card-09.svg",
  "./art/card-10.svg",
  "./art/card-11.svg",
  "./art/card-12.svg",
  "./art/card-13.svg",
  "./art/card-14.svg",
  "./art/card-15.svg",
  "./art/card-16.svg",
  "./art/card-17.svg",
  "./art/card-18.svg",
  "./art/card-19.svg",
  "./art/card-20.svg",
  "./art/card-21.svg",
  "./art/card-22.svg",
  "./art/card-23.svg",
  "./art/card-24.svg",
  "./art_rich/card-07.webp",
  "./art_rich/card-09.webp",
  "./art_rich/card-10.webp",
  "./art_rich/card-11.webp",
  "./art_rich/card-14.webp",
  "./art_rich/card-19.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, toCache);
        });
        return response;
      });
    })
  );
});
