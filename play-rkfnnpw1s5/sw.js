'use strict';
// Service worker: cache-first, precache do jogo inteiro.
// VERSION e gerada por tools/release.py (hash do conteudo de web/, sem dev/ e sem este arquivo):
// qualquer mudanca em js/css/html/icone muda os bytes deste arquivo, e o navegador reinstala.
// Nao edite a linha a mao; rode python3 tools/release.py (o build_single.py tambem roda).
const VERSION = 'g-2a343a9fdf45';
const CACHE = 'cruzamento-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'js/config.js',
  'js/difficulty.js',
  'js/sim.js',
  'js/game.js',
  'js/audio.js',
  'js/render.js',
  'js/ui.js',
  'js/tutorial.js',
  'js/menu.js',
  'js/main.js'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' passa por cima do cache HTTP do navegador: o precache nunca pega arquivo velho
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cruzamento-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
