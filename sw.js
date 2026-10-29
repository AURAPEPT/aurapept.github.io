// Service worker AURAPEPT : garde le site en mémoire pour qu'il fonctionne hors connexion.
// Pages, styles et scripts : toujours la version en ligne (revérifiée auprès du serveur), la mémoire seulement
// hors connexion. Ainsi une page neuve n'est jamais affichée avec un ancien style (icônes géantes, menu cassé).
// Polices, images, modèle 3D et moteur 3D (lourds, rarement modifiés) : mémoire d'abord, mise à jour en arrière-plan.
const VERSION = "aurapept-2026-10-29e";
const CORE = [
  "/", "/404.html", "/manifest.webmanifest",
  "/assets/style.css", "/assets/app.js", "/assets/theme.js",
  "/assets/favicon-32.png", "/assets/apple-touch-icon.png", "/assets/icon-192.png",
  "/assets/fonts/shippori-mincho-500.woff2", "/assets/fonts/shippori-mincho-700.woff2", "/assets/fonts/shippori-mincho-800.woff2",
  "/assets/fonts/zen-kaku-gothic-new-400.woff2", "/assets/fonts/zen-kaku-gothic-new-500.woff2", "/assets/fonts/zen-kaku-gothic-new-700.woff2",
];
const HEAVY = /\.(woff2|png|bin)$|\/vendor\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "no-cache" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== VERSION);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Mise à jour du site : les pages déjà ouvertes sont rechargées une fois, pour tout prendre dans la nouvelle version
    if (old.length) (await self.clients.matchAll({ type: "window" })).forEach((c) => c.navigate(c.url).catch(() => {}));
  })());
});

const keep = (key, res) => {
  if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
        .then((res) => (res.redirected ? Response.redirect(res.url, 302) : keep(url.pathname, res)))
        .catch(() => caches.match(url.pathname).then((r) => r || caches.match("/404.html")))
    );
    return;
  }

  if (HEAVY.test(url.pathname)) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        const fresh = fetch(req).then((res) => keep(req, res)).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => keep(req, res))
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
