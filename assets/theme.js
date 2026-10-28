try {
  const t = localStorage.getItem("aurapept-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}

// Barre du navigateur sur mobile : suit aussi le thème choisi à la main (pas seulement le réglage du téléphone)
(() => {
  const metas = [...document.querySelectorAll('meta[name="theme-color"][media]')];
  metas.forEach((m) => (m.dataset.media = m.media));
  const sync = () => {
    const t = document.documentElement.dataset.theme;
    metas.forEach((m) => (m.media = !t ? m.dataset.media : m.dataset.media.includes(t) ? "all" : "not all"));
  };
  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
