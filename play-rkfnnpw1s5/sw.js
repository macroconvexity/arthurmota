'use strict';
// Service worker: cache-first, precache do jogo inteiro.
// VERSION e gerada por tools/release.py (hash do conteudo de web/, sem dev/ e sem este arquivo):
// qualquer mudanca em js/css/html/icone muda os bytes deste arquivo, e o navegador reinstala.
// Nao edite a linha a mao; rode python3 tools/release.py (o build_single.py tambem roda).
// A pagina (index.html) busca este arquivo com cache:'no-store' ao abrir e ao voltar a aba,
// le a VERSION e compara com a do SW ativo (mensagem 'version'): se mudou, pede update().
// Fluxo completo e testes: dev/ios/REVIEW.md, secao "Atualizacao do app instalado".
const VERSION = 'g-64cba324a872';
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
  // cache: 'reload' passa por cima do cache HTTP do navegador (GitHub Pages manda max-age=600):
  // o precache nunca pega arquivo velho. skipWaiting: o SW novo assume sem esperar fechar abas.
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

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
  else if (d.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // verificacao de versao (sw.js, version.txt) vai sempre a rede e nunca entra no cache
  if (/\/(sw\.js|version\.txt)$/.test(url.pathname)) return;
  // so o cache desta VERSION: nunca mistura arquivo de uma versao com pagina de outra
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) c.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => (req.mode === 'navigate' ? c.match('index.html') : Response.error()));
    }))
  );
});
