/* ===========================================================================
   sw.js — service worker para uso offline (cache dos arquivos do app)
   =========================================================================== */
const CACHE = "gerencia-prof-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/letterhead.js",
  "./js/docx.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/drive.js",
  "./js/app.js",
  "./manifest.json",
  "./img/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estratégia: cache primeiro, com atualização em segundo plano.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
