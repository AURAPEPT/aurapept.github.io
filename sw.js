// Service worker AURAPEPT : garde le site en mémoire pour qu'il fonctionne hors connexion.
// Pages : réseau d'abord (contenu à jour), mémoire si pas de connexion.
// Fichiers (styles, scripts, polices, modèle 3D) : mémoire d'abord, mise à jour en arrière-plan.
const VERSION = "aurapept-2026-10-28h";
const CORE = [
  "/", "/404.html", "/manifest.webmanifest",
  "/assets/style.css", "/assets/app.js", "/assets/theme.js",
  "/assets/favicon-32.png", "/assets/apple-touch-icon.png", "/assets/icon-192.png",
  "/assets/fonts/shippori-mincho-500.woff2", "/assets/fonts/shippori-mincho-700.woff2", "/assets/fonts/shippori-mincho-800.woff2",
  "/assets/fonts/zen-kaku-gothic-new-400.woff2", "/assets/fonts/zen-kaku-gothic-new-500.woff2", "/assets/fonts/zen-kaku-gothic-new-700.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((r) => r || caches.match("/404.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
