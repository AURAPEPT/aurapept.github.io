import { createBody, ZONES } from "./body.js";

/* Langue : les pages /en/peptides/ et /ar/peptides/ ont lang="en" ou lang="ar" et chargent data-en.js ou data-ar.js */
const LANG = document.documentElement.lang;
const EN = LANG === "en", AR = LANG === "ar";
const t = (fr, en, ar) => (AR ? ar : EN ? en : fr);
const { CATEGORIES, PEPTIDES, ZONE_LABELS } = await import(AR ? "./data-ar.js" : EN ? "./data-en.js" : "./data.js");
if (ZONE_LABELS) Object.entries(ZONE_LABELS).forEach(([id, label]) => { if (ZONES[id]) ZONES[id].label = label; });
const LOADING = {
  fr: { os: "Chargement du squelette…", muscles: "Chargement des muscles…", tendons: "Chargement des tendons…" },
  en: { os: "Loading the skeleton…", muscles: "Loading the muscles…", tendons: "Loading the tendons…" },
  ar: { os: "جارٍ تحميل الهيكل العظمي…", muscles: "جارٍ تحميل العضلات…", tendons: "جارٍ تحميل الأوتار…" },
}[LANG] || {};

const $ = (id) => document.getElementById(id);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const zoneLabel = (id) => ZONES[id]?.label ?? id;

const state = { open: null, zone: null, query: "", cat: null };
const peptides = PEPTIDES;
const byId = new Map(peptides.map((p) => [p.id, p]));

/* Corps 3D */
function noBody() {
  $("fallback").hidden = false;
  $("stageTools").hidden = true;
  $("hint").hidden = true;
  $("loading").hidden = true;
}
const body = createBody($("body3d"), $("labels"), {
  onPick: (zone) => setZone(zone && zone === state.zone ? null : zone),
  onReady: (ok) => { $("loading").hidden = true; if (!ok) noBody(); },
  onLoading: (part) => { $("loading").textContent = part ? LOADING[part] || t("Chargement du modèle…", "Loading the model…", "جارٍ تحميل النموذج…") : ""; $("loading").hidden = !part; },
});
if (!body) noBody();
$("body3d").addEventListener("pointerdown", () => $("hint").classList.add("is-gone"), { once: true });
$("zoomIn").addEventListener("click", () => body?.zoomBy(1.2));
$("zoomOut").addEventListener("click", () => body?.zoomBy(1 / 1.2));
$("resetView").addEventListener("click", () => body?.resetView());

/* Explorer par zone : seulement les zones utilisées par la liste */
const usedZones = new Set(peptides.flatMap((p) => p.zones));
const zoneIds = Object.keys(ZONES).filter((id) => !peptides.length || usedZones.has(id));
$("zoneChips").replaceChildren(...zoneIds.map((id) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "zchip" + (ZONES[id].tone === "fat" ? " zchip-fat" : "");
  b.dataset.zone = id;
  b.textContent = zoneLabel(id);
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => setZone(state.zone === id ? null : id));
  return b;
}));

/* Liste en accordéon, groupée par catégorie */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function itemFor(p) {
  const li = el("li", "pep");
  li.dataset.id = p.id;

  const btn = el("button", "pep-btn");
  btn.type = "button";
  btn.id = `pep-${p.id}-btn`;
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", `pep-${p.id}-body`);
  const chev = el("span", "chev");
  chev.setAttribute("aria-hidden", "true");
  btn.append(el("span", "pep-name", p.nom), el("span", "pep-zones", p.zones.map(zoneLabel).join(" · ")), chev);
  btn.addEventListener("click", () => toggle(p.id));

  const panel = el("div", "pep-body");
  panel.id = `pep-${p.id}-body`;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", btn.id);
  panel.hidden = true;

  const line = (k, v) => { const e = el("p", "pep-line"); e.append(el("span", "pep-k", k), document.createTextNode(v)); return e; };
  panel.append(line(t("Agit sur", "Acts on", "يعمل على"), p.action), line(t("But", "Goal", "الهدف"), p.but));
  if (p.mix?.length) {
    const mix = el("p", "pep-line pep-mix");
    mix.append(el("span", "pep-k", t("Contient", "Contains", "يحتوي على")));
    p.mix.forEach((id) => {
      const c = byId.get(id);
      if (!c) return;
      const a = el("button", "pep-mixlink", c.nom);
      a.type = "button";
      a.title = t(`Ouvrir la fiche ${c.nom}`, `Open the ${c.nom} entry`, `فتح بطاقة ${c.nom}`);
      a.addEventListener("click", () => { setZone(null); toggle(id); items.get(id).scrollIntoView({ block: "nearest" }); });
      mix.append(a);
    });
    panel.append(mix);
  }
  const chips = el("div", "pep-zchips");
  chips.setAttribute("aria-label", t("Zones ciblées", "Target areas", "المناطق المستهدفة"));
  p.zones.forEach((z) => {
    const c = el("button", "pep-zchip" + (ZONES[z]?.tone === "fat" ? " is-fat" : ""), zoneLabel(z));
    c.type = "button";
    c.title = t(`Voir les peptides qui ciblent : ${zoneLabel(z)}`, `See the peptides that target: ${zoneLabel(z)}`, `عرض الببتيدات التي تستهدف: ${zoneLabel(z)}`);
    c.addEventListener("click", () => setZone(z));
    chips.append(c);
  });
  panel.append(chips);
  const meta = el("p", "pep-meta");
  if (p.source?.url) {
    const a = el("a", null, p.source.label || "Source");
    a.href = p.source.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const src = el("span", "pep-src");
    src.append(t("Source : ", "Source: ", "المصدر: "), a);
    meta.append(src);
  }
  panel.append(meta);
  li.append(btn, panel);
  return li;
}

/* Familles : « Tous » par défaut, puis une famille à la fois */
function famChip(id, label, count) {
  const b = el("button", "fchip");
  b.type = "button";
  b.dataset.cat = id || "all";
  b.setAttribute("aria-pressed", "false");
  if (id) b.append(el("span", "fdot"));
  b.append(el("span", null, label), el("span", "fcount", String(count)));
  b.addEventListener("click", () => setCat(id));
  return b;
}
$("famChips").replaceChildren(
  famChip(null, t("Tous", "All", "الكل"), peptides.length),
  ...CATEGORIES.filter((c) => peptides.some((p) => p.cat === c.id)).map((c) => famChip(c.id, c.short || c.label, peptides.filter((p) => p.cat === c.id).length)),
);
function setCat(cat) {
  state.cat = cat;
  if (cat && state.open && byId.get(state.open)?.cat !== cat) state.open = null;
  render();
  $("famChips").querySelector(`[data-cat="${cat || "all"}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

const items = new Map();
const groups = [];
const frag = document.createDocumentFragment();
for (const cat of CATEGORIES) {
  const list = peptides.filter((p) => p.cat === cat.id);
  if (!list.length) continue;
  const head = el("li", "pep-cat");
  head.dataset.cat = cat.id;
  head.append(el("span", "pep-cat-dot"), el("span", null, cat.label));
  frag.append(head);
  list.forEach((p) => {
    const li = itemFor(p);
    items.set(p.id, li);
    frag.append(li);
  });
  groups.push({ head, list });
}
$("pepList").replaceChildren(frag);

function toggle(id) {
  state.open = state.open === id ? null : id;
  render();
  try { history.replaceState(null, "", state.open ? `#${id}` : location.pathname); } catch (e) {}
}

function setZone(zone) {
  state.zone = zone;
  if (zone && state.open && !byId.get(state.open)?.zones.includes(zone)) state.open = null;
  render();
}

function render() {
  const q = norm(state.query.trim());
  let shown = 0;
  for (const p of peptides) {
    const li = items.get(p.id);
    const match = (!q || norm([p.nom, ...(p.alias || [])].join(" ")).includes(q))
      && (!state.zone || p.zones.includes(state.zone))
      && (!state.cat || p.cat === state.cat);
    li.hidden = !match;
    if (match) shown++;
    const open = state.open === p.id;
    li.classList.toggle("is-open", open);
    li.querySelector(".pep-btn").setAttribute("aria-expanded", String(open));
    li.querySelector(".pep-body").hidden = !open;
  }
  groups.forEach(({ head, list }) => { head.hidden = !list.some((p) => !items.get(p.id).hidden); });

  const open = byId.get(state.open);
  body?.highlight(open ? open.zones : state.zone ? [state.zone] : []);

  document.querySelectorAll(".zchip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zone === state.zone)));
  document.querySelectorAll(".fchip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === (state.cat || "all"))));
  $("zoneFilter").hidden = !state.zone;
  $("zoneFilterName").textContent = state.zone ? zoneLabel(state.zone) : "";
  $("count").textContent = `${shown} / ${peptides.length}`;
  const empty = $("emptyState");
  empty.hidden = shown > 0;
  empty.textContent = state.zone && !q
    ? t(`Aucun peptide de la liste ne cible : ${zoneLabel(state.zone)}.`, `No peptide in the list targets: ${zoneLabel(state.zone)}.`, `لا يوجد ببتيد في القائمة يستهدف: ${zoneLabel(state.zone)}.`)
    : t("Aucun peptide ne correspond à ta recherche.", "No peptide matches your search.", "لا يوجد ببتيد يطابق بحثك.");
}

$("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
$("clearZone").addEventListener("click", () => setZone(null));

/* Ouverture directe via l'ancre (#nom-du-peptide), gardée quand on change de langue */
const fromHash = decodeURIComponent(location.hash.slice(1));
if (byId.has(fromHash)) state.open = fromHash;
render();
/* Menu des langues : garde la fiche ouverte, se ferme en touchant ailleurs ou avec Échap */
const langMenu = $("langMenu");
if (langMenu) {
  langMenu.querySelectorAll(".lang-list a").forEach((a) => a.addEventListener("click", () => { a.hash = location.hash; }));
  document.addEventListener("click", (e) => { if (!langMenu.contains(e.target)) langMenu.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && langMenu.open) { langMenu.open = false; langMenu.querySelector("summary").focus(); } });
}

/* Thème clair / sombre (même réglage que le calculateur) */
const THEMES = ["system", "light", "dark"];
const THEME_UI = {
  system: [t("Thème : automatique", "Theme: automatic", "المظهر: تلقائي"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>'],
  light: [t("Thème : clair", "Theme: light", "المظهر: فاتح"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'],
  dark: [t("Thème : sombre", "Theme: dark", "المظهر: داكن"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'],
};
function setTheme(mode, save) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme; else root.dataset.theme = mode;
  const [label, icon] = THEME_UI[mode];
  $("themeBtn").innerHTML = icon;
  $("themeBtn").setAttribute("aria-label", `${label}. ${t("Cliquer pour changer.", "Click to change.", "اضغط للتغيير.")}`);
  $("themeBtn").title = label;
  if (save) { try { localStorage.setItem("aurapept-theme", mode); } catch (e) {} }
}
$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "system";
  setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length], true);
});
setTheme(document.documentElement.dataset.theme || "system", false);

/* Appli installable : mise en mémoire hors connexion */
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
