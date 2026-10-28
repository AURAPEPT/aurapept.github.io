const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEFAULTS = { v: "5", vu: "mg", w: "2", d: "250", du: "mcg", s: "1", h: false, n: "" };
const state = { vialUnit: "mg", doseUnit: "mcg", syringe: "1" };
const SYR = { x0: 70, w: 388 }; // zone graduée de la seringue, en unités du viewBox

const fmt = (n, d = 2) => Number.isFinite(n)
  ? n.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—";
const MAX_INPUT = 1e6;
// Nombre décimal simple uniquement (virgule ou point) : refuse 0x10, 1e3, Infinity…
// Renvoie NaN pour un champ vide et -1 pour une saisie invalide.
const parseNum = (s) => {
  const t = String(s).replace(/\s/g, "");
  if (t === "") return NaN;
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return -1;
  const n = Number(t.replace(",", "."));
  return n <= MAX_INPUT ? n : -1;
};
const fmtU = (u) => (u > 0 && u < 0.01 ? "< 0,01" : fmt(u, 2));
const toMcg = (v, u) => (u === "mg" ? v * 1000 : v);
const mass = (mcg) => (mcg >= 1000 ? `${fmt(mcg / 1000, 3)} mg` : `${fmt(mcg, 2)} mcg`);
const frDate = (iso) => {
  const [y, m, d] = (iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};

function setGroup(key, value) {
  state[key] = value;
  document.querySelectorAll(`[data-group="${key}"] [data-v]`).forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.v === value)));
}

/* Gros chiffre animé */
let shownUnits = null, rafId = 0;
function showUnits(target) {
  const el = $("units");
  cancelAnimationFrame(rafId);
  if (!Number.isFinite(target)) { shownUnits = null; el.textContent = "—"; return; }
  if (reduceMotion || shownUnits === null) { shownUnits = target; el.textContent = fmtU(target); return; }
  const from = shownUnits, start = performance.now(), dur = 420;
  const tick = (t) => {
    const k = Math.min((t - start) / dur, 1);
    const v = from + (target - from) * (1 - Math.pow(1 - k, 3));
    shownUnits = k < 1 ? v : target;
    el.textContent = k < 1 ? fmt(shownUnits, 1) : fmtU(target);
    if (k < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/* Seringue */
let scaleKey = "";
function buildScale(total, half) {
  const key = `${total}|${half}`;
  if (key === scaleKey) return;
  scaleKey = key;
  const minor = total === 100 ? (half ? 1 : 2) : (half ? 0.5 : 1);
  const major = total === 100 ? 10 : 5;
  const isMultiple = (u, m) => Math.abs(u / m - Math.round(u / m)) < 1e-9;
  let out = "";
  for (let i = 0; i <= Math.round(total / minor); i++) {
    const u = i * minor;
    const x = (SYR.x0 + (u / total) * SYR.w).toFixed(2);
    const isMajor = isMultiple(u, major);
    const len = isMajor ? 18 : isMultiple(u, major / 2) ? 12 : 7;
    out += `<line x1="${x}" y1="44" x2="${x}" y2="${44 + len}" class="${isMajor ? "tk tk-major" : "tk"}"/>`;
    if (isMajor) out += `<text x="${x}" y="116" class="tk-label">${u}</text>`;
  }
  $("scale").innerHTML = out;
}

function updateSyringe(units, total, valid, over) {
  const ratio = valid ? Math.min(units / total, 1) : 0;
  const px = ratio * SYR.w;
  $("liquid").style.transform = `scaleX(${Math.max(ratio, 0.0001)})`;
  $("plunger").style.transform = `translateX(${px}px)`;
  $("pointer").style.transform = `translateX(${px}px)`;
  const text = !valid ? "—" : over ? `> ${total} u` : `${fmtU(units)} u`;
  const tagW = 24 + text.length * 9;
  const cx = Math.min(Math.max(SYR.x0 + px, tagW / 2 + 2), 558 - tagW / 2);
  $("markerBox").setAttribute("x", -tagW / 2);
  $("markerBox").setAttribute("width", tagW);
  $("markerText").textContent = text;
  $("marker").style.transform = `translateX(${cx}px)`;
  $("syr").classList.toggle("over", over);
}

/* Calcul principal */
let booted = false, srTimer = 0;
function calc() {
  const raw = { v: parseNum($("vial").value), w: parseNum($("water").value), d: parseNum($("dose").value) };
  for (const [id, val] of [["vial", raw.v], ["water", raw.w], ["dose", raw.d]]) {
    const bad = $(id).value.trim() !== "" && !(val > 0);
    $(id).closest(".field").classList.toggle("is-invalid", bad);
    $(id).setAttribute("aria-invalid", String(bad));
  }

  const vial = toMcg(raw.v, state.vialUnit);
  const water = raw.w;
  const dose = toMcg(raw.d, state.doseUnit);
  const cap = parseFloat(state.syringe);
  const total = Math.round(cap * 100);
  const half = $("half").checked;

  const valid = vial > 0 && water > 0 && dose > 0;
  const conc = vial / water;        // mcg par mL
  const ml = dose / conc;
  const units = ml * 100;
  const step = half ? 0.5 : 1;
  const nearest = Math.round(units / step) * step;
  const over = valid && units > total + 1e-9;
  const tooSmall = valid && !over && nearest === 0;
  const exact = valid && !tooSmall && Math.abs(units - nearest) < 1e-6;

  showUnits(valid ? units : NaN);
  $("ml").textContent = valid ? `${fmt(ml, 3)} mL` : "—";
  $("capText").textContent = `${fmt(cap)} mL`;
  $("conc").textContent = valid ? `${mass(conc)}/mL` : "—";
  $("perUnit").textContent = valid ? mass(conc / 100) : "—";
  $("count").textContent = valid ? fmt(Math.floor(vial / dose + 1e-9), 0) : "—";
  $("fillPct").textContent = !valid ? "—" : over ? "> 100 %" : `${fmt((units / total) * 100, 0)} %`;

  const status = $("status");
  const [tone, label] = !valid ? ["idle", "En attente"]
    : over ? ["alert", "Dépasse la seringue"]
    : tooSmall ? ["alert", "Trop petit à mesurer"]
    : !exact ? ["warn", "Entre deux traits"]
    : ["ok", "Graduation exacte"];
  status.dataset.tone = tone;
  status.textContent = label;

  const notes = [];
  if (!valid) notes.push(["idle", "Renseigne les trois quantités avec des nombres positifs, par exemple 2,5. Les écritures comme 1e3 ne sont pas acceptées."]);
  if (over) notes.push(["alert", `Il faut ${fmt(units, 2)} unités, mais cette seringue s'arrête à ${total}. Choisis une seringue plus grande ou répartis en plusieurs prélèvements.`]);
  if (tooSmall) notes.push(["alert", `Il faut ${fmtU(units)} unité, moins que la moitié d'un trait de cette seringue : impossible à mesurer précisément.`]);
  if (valid && !over && !tooSmall && !exact) notes.push(["warn", `Aucun trait exact à ${fmt(units, 2)} u. Le plus proche est ${fmt(nearest, 1)} u (graduations de ${half ? "0,5" : "1"} unité).`]);
  if (valid && dose > vial) notes.push(["alert", "La quantité par prise dépasse le contenu total du flacon."]);
  const list = $("notes");
  list.replaceChildren(...notes.map(([t, msg]) => {
    const li = document.createElement("li");
    li.dataset.tone = t;
    li.textContent = msg;
    return li;
  }));
  list.hidden = notes.length === 0;

  buildScale(total, half);
  updateSyringe(units, total, valid, over);

  document.querySelectorAll("[data-preset]").forEach((c) => {
    const on = c.dataset.preset === "vial"
      ? raw.v === Number(c.dataset.value) && state.vialUnit === c.dataset.unit
      : raw.w === Number(c.dataset.value);
    c.setAttribute("aria-pressed", String(on));
  });

  // Méthode détaillée avec les valeurs en cours
  if (valid) {
    const conv = (v, u, mcg) => (u === "mg" ? `${fmt(v, 3)} mg = ${fmt(mcg, 2)} mcg` : `${fmt(mcg, 2)} mcg`);
    $("m1").innerHTML = `Flacon ${conv(raw.v, state.vialUnit, vial)} · prise ${conv(raw.d, state.doseUnit, dose)}`;
    $("m2").innerHTML = `${fmt(vial, 2)} mcg ÷ ${fmt(water, 3)} mL = <strong>${fmt(conc, 2)} mcg/mL</strong>`;
    $("m3").innerHTML = `${fmt(dose, 2)} mcg ÷ ${fmt(conc, 2)} mcg/mL = <strong>${fmt(ml, 4)} mL</strong>`;
    $("m4").innerHTML = `${fmt(ml, 4)} mL × 100 = <strong>${fmtU(units)} unités</strong>`;
  } else {
    ["m1", "m2", "m3", "m4"].forEach((id) => ($(id).textContent = "En attente de valeurs valides"));
  }

  // Étiquette
  const name = $("labelName").value.trim();
  $("lName").textContent = name;
  $("lName").hidden = !name;
  $("lVial").textContent = Number.isFinite(raw.v) ? `${fmt(raw.v, 3)} ${state.vialUnit}` : "—";
  $("lWater").textContent = Number.isFinite(raw.w) ? `${fmt(raw.w, 3)} mL` : "—";
  $("lConc").textContent = $("conc").textContent;
  $("lDraw").textContent = valid ? `${fmt(raw.d, 3)} ${state.doseUnit} = ${fmtU(units)} u` : "—";
  $("lDate").textContent = frDate($("date").value) || "__/__/____";

  // Barre mobile
  $("dockUnits").textContent = valid ? `${fmtU(units)} u` : "—";
  $("dockMl").textContent = valid ? `${fmt(ml, 3)} mL` : "";

  // Lecteurs d'écran : une seule annonce, une fois la saisie terminée
  if (booted) {
    clearTimeout(srTimer);
    const msg = valid ? `Prélever ${fmtU(units)} unités, soit ${fmt(ml, 3)} mL. ${label}.` : `${label}.`;
    srTimer = setTimeout(() => ($("srResult").textContent = msg), 700);
  }

  try { history.replaceState(null, "", "?" + params().toString() + location.hash); } catch (e) {}
}

function summary() {
  const date = frDate($("date").value);
  const name = $("labelName").value.trim();
  return [
    "AURAPEPT · Calcul de reconstitution",
    name ? `Nom : ${name}` : "",
    `Flacon : ${$("vial").value} ${state.vialUnit}`,
    `Eau ajoutée : ${$("water").value} mL`,
    `Concentration : ${$("conc").textContent}`,
    `Quantité par prise : ${$("dose").value} ${state.doseUnit}`,
    `Prélever : ${$("units").textContent} unités (${$("ml").textContent}) sur seringue U-100 de ${$("capText").textContent}`,
    `Prises par flacon : ${$("count").textContent}`,
    date ? `Reconstitué le : ${date}` : "",
  ].filter(Boolean).join("\n");
}

function params() {
  const p = new URLSearchParams({
    v: $("vial").value, vu: state.vialUnit, w: $("water").value,
    d: $("dose").value, du: state.doseUnit, s: state.syringe, h: $("half").checked ? 1 : 0,
  });
  const n = $("labelName").value.trim();
  if (n) p.set("n", n);
  return p;
}

function apply(values) {
  $("vial").value = values.v;
  $("water").value = values.w;
  $("dose").value = values.d;
  setGroup("vialUnit", values.vu);
  setGroup("doseUnit", values.du);
  setGroup("syringe", values.s);
  $("half").checked = !!values.h;
  $("labelName").value = values.n || "";
}

function loadParams() {
  const p = new URLSearchParams(location.search);
  const pick = (k, ok) => (p.has(k) && (!ok || ok.includes(p.get(k))) ? p.get(k).slice(0, k === "n" ? 40 : 12) : DEFAULTS[k]);
  apply({
    v: pick("v"), w: pick("w"), d: pick("d"),
    vu: pick("vu", ["mg", "mcg"]), du: pick("du", ["mg", "mcg"]), s: pick("s", ["0.3", "0.5", "1"]),
    h: p.get("h") === "1", n: pick("n"),
  });
}

/* Copie + notification */
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), msg.length > 45 ? 5000 : 1800);
}
function copy(text, done) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    toast(ok ? done : "Copie impossible sur ce navigateur");
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(done), fallback);
  } else fallback();
}

/* Thème */
const THEMES = ["system", "light", "dark"];
const THEME_UI = {
  system: ["Thème : automatique", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>'],
  light: ["Thème : clair", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'],
  dark: ["Thème : sombre", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'],
};
function setTheme(mode, save) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme; else root.dataset.theme = mode;
  const [label, icon] = THEME_UI[mode];
  $("themeBtn").innerHTML = icon;
  $("themeBtn").setAttribute("aria-label", `${label}. Cliquer pour changer.`);
  $("themeBtn").title = label;
  if (save) { try { localStorage.setItem("aurapept-theme", mode); } catch (e) {} }
}
$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "system";
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  setTheme(next, true);
  toast(THEME_UI[next][0]);
});

/* Événements */
document.querySelectorAll("[data-group]").forEach((g) =>
  g.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (b) { setGroup(g.dataset.group, b.dataset.v); calc(); }
  }));
document.querySelectorAll("[data-preset]").forEach((c) =>
  c.addEventListener("click", () => {
    if (c.dataset.preset === "vial") { $("vial").value = c.dataset.value; setGroup("vialUnit", c.dataset.unit); }
    else $("water").value = c.dataset.value;
    calc();
  }));
["vial", "water", "dose", "half", "date", "labelName"].forEach((id) => $(id).addEventListener("input", calc));
["vial", "water", "dose"].forEach((id) =>
  $(id).addEventListener("focus", (e) => setTimeout(() => e.target.select(), 0)));
$("reset").addEventListener("click", () => { apply(DEFAULTS); calc(); toast("Valeurs réinitialisées"); });
$("copyLink").addEventListener("click", () => copy(location.href.split("#")[0], "Lien copié"));
$("copySum").addEventListener("click", () => copy(summary(), "Résumé copié"));
$("print").addEventListener("click", () => window.print());

/* Mes flacons : enregistrés dans le navigateur (stockage local), jamais envoyés */
const VIAL_KEY = "aurapept-flacons";
const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function readVials() {
  try {
    const v = JSON.parse(localStorage.getItem(VIAL_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  } catch (e) { return []; }
}
function writeVials(list) {
  try { localStorage.setItem(VIAL_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
function since(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
  if (days < 0) return "date à venir";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}
function renderVials() {
  const list = readVials();
  $("vialEmpty").hidden = list.length > 0;
  $("vialList").replaceChildren(...list.map((x) => {
    const li = mk("li", "vial");
    const vial = toMcg(parseNum(x.v), x.vu), water = parseNum(x.w);
    const conc = vial > 0 && water > 0 ? `${mass(vial / water)}/mL` : "—";
    li.append(
      mk("p", "vial-name", x.n || "Flacon sans nom"),
      mk("p", "vial-meta", `${x.v} ${x.vu} dans ${x.w} mL · ${conc} · prise de ${x.d} ${x.du}`),
      mk("p", "vial-date", x.date ? `Reconstitué le ${frDate(x.date)} · ${since(x.date)}` : "Date de reconstitution non renseignée"),
    );
    const actions = mk("div", "vial-actions");
    const load = mk("button", "btn", "Charger");
    load.type = "button";
    load.addEventListener("click", () => {
      apply({ v: x.v, w: x.w, d: x.d, vu: x.vu, du: x.du, s: x.s, h: x.h, n: x.n });
      if (x.date) $("date").value = x.date;
      calc();
      toast("Flacon chargé");
      $("calculateur").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
    const del = mk("button", "btn", "Supprimer");
    del.type = "button";
    let timer = 0;
    del.addEventListener("click", () => {
      if (!del.classList.contains("is-confirm")) {
        del.classList.add("is-confirm");
        del.textContent = "Confirmer ?";
        timer = setTimeout(() => { del.classList.remove("is-confirm"); del.textContent = "Supprimer"; }, 3000);
        return;
      }
      clearTimeout(timer);
      writeVials(readVials().filter((y) => y.id !== x.id));
      renderVials();
      toast("Flacon supprimé");
    });
    actions.append(load, del);
    li.append(actions);
    return li;
  }));
}
$("saveVial").addEventListener("click", () => {
  const v = parseNum($("vial").value), w = parseNum($("water").value), d = parseNum($("dose").value);
  if (!(v > 0 && w > 0 && d > 0)) { toast("Complète d'abord les quantités du calculateur"); return; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test($("date").value) ? $("date").value : "";
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    n: $("labelName").value.trim().slice(0, 40), date,
    v: $("vial").value.trim().slice(0, 12), vu: state.vialUnit, w: $("water").value.trim().slice(0, 12),
    d: $("dose").value.trim().slice(0, 12), du: state.doseUnit, s: state.syringe, h: $("half").checked,
  };
  const list = [entry, ...readVials()].slice(0, 30);
  if (!writeVials(list)) { toast("Enregistrement impossible : le stockage du navigateur est bloqué"); return; }
  renderVials();
  toast("Flacon enregistré");
});
renderVials();

/* Bouton « Installer l'appli » : invite du navigateur si elle existe, sinon la marche à suivre */
let installPrompt = null;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
$("installBtn").hidden = standalone;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Appli installée"); });
$("installBtn").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) {}
    installPrompt = null;
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? "Sur iPhone : touche le bouton Partager, puis « Sur l'écran d'accueil »"
    : "Ouvre le menu du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil »");
});

/* Appli installable : mise en mémoire hors connexion */
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// La barre mobile n'apparaît qu'une fois l'accueil passé, et se cache quand le résultat complet est à l'écran
if ("IntersectionObserver" in window) {
  const seen = { heroCta: true, resultat: false };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (seen[e.target.id] = e.isIntersecting));
    $("dock").classList.toggle("is-hidden", seen.heroCta || seen.resultat);
  }, { threshold: 0.25 });
  io.observe($("heroCta"));
  io.observe($("resultat"));
} else {
  $("dock").classList.remove("is-hidden");
}

/* Démarrage */
(() => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("date").value = now.toISOString().slice(0, 10);
})();
setTheme(document.documentElement.dataset.theme || "system", false);
loadParams();
calc();
booted = true;
