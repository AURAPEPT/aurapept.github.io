const $ = (id) => document.getElementById(id);
// Langue de la page (fr, en ou ar) : t("texte français", "English text", "النص العربي")
const LANG = document.documentElement.lang;
const EN = LANG === "en", AR = LANG === "ar";
const t = (fr, en, ar) => (AR ? ar : EN ? en : fr);
// En arabe, chiffres occidentaux : ce sont ceux imprimés sur les seringues et les flacons
const LOCALE = AR ? "ar-u-nu-latn" : EN ? "en-US" : "fr-FR";
// En arabe, « 5 mg » doit rester dans cet ordre au milieu du texte de droite à gauche (isolat Unicode LRI…PDI),
// et un mot arabe au milieu d'un calcul écrit de gauche à droite est isolé de la même façon (RLI…PDI)
const ltr = (s) => (AR ? `\u2066${s}\u2069` : s);
const rtl = (s) => (AR ? `\u2067${s}\u2069` : s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEFAULTS = { v: "5", vu: "mg", w: "2", d: "250", du: "mcg", s: "1", h: false, n: "" };
const state = { vialUnit: "mg", doseUnit: "mcg", syringe: "1" };
const SYR = { x0: 70, w: 388 }; // zone graduée de la seringue, en unités du viewBox

const fmt = (n, d = 2) => Number.isFinite(n)
  ? n.toLocaleString(LOCALE, { maximumFractionDigits: d }) : "—";
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
const fmtU = (u) => (u > 0 && u < 0.01 ? `< ${fmt(0.01)}` : fmt(u, 2));
const toMcg = (v, u) => (u === "mg" ? v * 1000 : v);
const mass = (mcg) => (mcg >= 1000 ? `${fmt(mcg / 1000, 3)} mg` : `${fmt(mcg, 2)} mcg`);
const fmtDate = (iso) => {
  const [y, m, d] = (iso || "").split("-");
  if (!(y && m && d)) return "";
  // En anglais et en arabe, mois en lettres (28 Oct 2026) : 10/28 et 28/10 se lisent différemment selon les pays
  const opts = { day: "numeric", month: AR ? "long" : "short", year: "numeric", timeZone: "UTC" };
  return EN || AR ? new Date(Date.UTC(+y, m - 1, +d)).toLocaleDateString(AR ? LOCALE : "en-GB", opts) : `${d}/${m}/${y}`;
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
  $("ml").textContent = valid ? ltr(`${fmt(ml, 3)} mL`) : "—";
  $("capText").textContent = ltr(`${fmt(cap)} mL`);
  $("conc").textContent = valid ? ltr(`${mass(conc)}/mL`) : "—";
  $("perUnit").textContent = valid ? ltr(mass(conc / 100)) : "—";
  $("count").textContent = valid ? fmt(Math.floor(vial / dose + 1e-9), 0) : "—";
  $("fillPct").textContent = !valid ? "—" : ltr(over ? "> 100 %" : `${fmt((units / total) * 100, 0)} %`);

  const status = $("status");
  const [tone, label] = !valid ? ["idle", t("En attente", "Waiting", "في الانتظار")]
    : over ? ["alert", t("Dépasse la seringue", "Exceeds the syringe", "تتجاوز الحقنة")]
    : tooSmall ? ["alert", t("Trop petit à mesurer", "Too small to measure", "صغيرة جدًا للقياس")]
    : !exact ? ["warn", t("Entre deux traits", "Between two marks", "بين علامتين")]
    : ["ok", t("Graduation exacte", "Exact mark", "علامة دقيقة")];
  status.dataset.tone = tone;
  status.textContent = label;

  const notes = [];
  if (!valid) notes.push(["idle", t("Renseigne les trois quantités avec des nombres positifs, par exemple 2,5. Les écritures comme 1e3 ne sont pas acceptées.",
    "Enter all three amounts as positive numbers, for example 2.5. Notations like 1e3 are not accepted.",
    "أدخل الكميات الثلاث بأرقام موجبة، مثل 2.5. الكتابات مثل 1e3 غير مقبولة.")]);
  if (over) notes.push(["alert", t(`Il faut ${fmt(units, 2)} unités, mais cette seringue s'arrête à ${total}. Choisis une seringue plus grande ou répartis en plusieurs prélèvements.`,
    `You need ${fmt(units, 2)} units, but this syringe stops at ${total}. Choose a bigger syringe or split it into several draws.`,
    `تحتاج إلى ${fmt(units, 2)} وحدة، لكن هذه الحقنة تتوقف عند ${total}. اختر حقنة أكبر أو قسّم الكمية على عدة سحبات.`)]);
  if (tooSmall) notes.push(["alert", t(`Il faut ${fmtU(units)} unité, moins que la moitié d'un trait de cette seringue : impossible à mesurer précisément.`,
    `You need ${fmtU(units)} unit, less than half a mark on this syringe: impossible to measure accurately.`,
    `تحتاج إلى ${fmtU(units)} وحدة، أي أقل من نصف علامة في هذه الحقنة: لا يمكن قياسها بدقة.`)]);
  if (valid && !over && !tooSmall && !exact) notes.push(["warn", t(`Aucun trait exact à ${fmt(units, 2)} u. Le plus proche est ${fmt(nearest, 1)} u (graduations de ${fmt(step)} unité).`,
    `No exact mark at ${fmt(units, 2)} u. The closest is ${fmt(nearest, 1)} u (${fmt(step)}-unit marks).`,
    `لا توجد علامة دقيقة عند ${fmt(units, 2)} وحدة. الأقرب هي ${fmt(nearest, 1)} وحدة (علامات كل ${fmt(step)} وحدة).`)]);
  if (valid && dose > vial) notes.push(["alert", t("La quantité par prise dépasse le contenu total du flacon.", "The dose is larger than the whole vial.", "الكمية لكل جرعة أكبر من محتوى القارورة كله.")]);
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
    $("m1").innerHTML = `${rtl(t("Flacon", "Vial", "القارورة"))} ${conv(raw.v, state.vialUnit, vial)} · ${rtl(t("prise", "dose", "الجرعة"))} ${conv(raw.d, state.doseUnit, dose)}`;
    $("m2").innerHTML = `${fmt(vial, 2)} mcg ÷ ${fmt(water, 3)} mL = <strong>${fmt(conc, 2)} mcg/mL</strong>`;
    $("m3").innerHTML = `${fmt(dose, 2)} mcg ÷ ${fmt(conc, 2)} mcg/mL = <strong>${fmt(ml, 4)} mL</strong>`;
    $("m4").innerHTML = `${fmt(ml, 4)} mL × 100 = <strong>${fmtU(units)} ${rtl(t("unités", "units", "وحدة"))}</strong>`;
  } else {
    ["m1", "m2", "m3", "m4"].forEach((id) => ($(id).textContent = t("En attente de valeurs valides", "Waiting for valid values", "في انتظار قيم صحيحة")));
  }

  // Étiquette
  const name = $("labelName").value.trim();
  $("lName").textContent = name;
  $("lName").hidden = !name;
  $("lVial").textContent = Number.isFinite(raw.v) ? ltr(`${fmt(raw.v, 3)} ${state.vialUnit}`) : "—";
  $("lWater").textContent = Number.isFinite(raw.w) ? ltr(`${fmt(raw.w, 3)} mL`) : "—";
  $("lConc").textContent = $("conc").textContent;
  $("lDraw").textContent = valid ? ltr(`${fmt(raw.d, 3)} ${state.doseUnit} = ${fmtU(units)} u`) : "—";
  $("lDate").textContent = fmtDate($("date").value) || t("__/__/____", "__ ___ ____", "__/__/____");

  // Barre mobile
  $("dockUnits").textContent = valid ? ltr(`${fmtU(units)} u`) : "—";
  $("dockMl").textContent = valid ? ltr(`${fmt(ml, 3)} mL`) : "";

  // Lecteurs d'écran : une seule annonce, une fois la saisie terminée
  if (booted) {
    clearTimeout(srTimer);
    const msg = valid ? t(`Prélever ${fmtU(units)} unités, soit ${fmt(ml, 3)} mL. ${label}.`, `Draw ${fmtU(units)} units, i.e. ${fmt(ml, 3)} mL. ${label}.`, `اسحب ${fmtU(units)} وحدة، أي ${ltr(`${fmt(ml, 3)} mL`)}. ${label}.`) : `${label}.`;
    srTimer = setTimeout(() => ($("srResult").textContent = msg), 700);
  }

  try { history.replaceState(null, "", "?" + params().toString() + location.hash); } catch (e) {}
  document.querySelectorAll(".lang-list a").forEach((a) => (a.search = params().toString())); // les autres langues gardent les mêmes réglages
}

function summary() {
  const date = fmtDate($("date").value);
  const name = $("labelName").value.trim();
  const units = `${$("units").textContent} ${t("unités", "units", "وحدة")} (${$("ml").textContent})`;
  return (AR ? [
    "AURAPEPT · حساب إعادة التكوين",
    name ? `الاسم: ${name}` : "",
    `القارورة: ${ltr(`${$("vial").value} ${state.vialUnit}`)}`,
    `الماء المضاف: ${ltr(`${$("water").value} mL`)}`,
    `التركيز: ${$("conc").textContent}`,
    `الكمية لكل جرعة: ${ltr(`${$("dose").value} ${state.doseUnit}`)}`,
    `اسحب: ${units} على حقنة U-100 سعتها ${$("capText").textContent}`,
    `عدد الجرعات في القارورة: ${$("count").textContent}`,
    date ? `تاريخ التحضير: ${date}` : "",
  ] : EN ? [
    "AURAPEPT · Reconstitution calculation",
    name ? `Name: ${name}` : "",
    `Vial: ${$("vial").value} ${state.vialUnit}`,
    `Water added: ${$("water").value} mL`,
    `Concentration: ${$("conc").textContent}`,
    `Dose: ${$("dose").value} ${state.doseUnit}`,
    `Draw: ${units} on a ${$("capText").textContent} U-100 syringe`,
    `Doses per vial: ${$("count").textContent}`,
    date ? `Reconstituted on: ${date}` : "",
  ] : [
    "AURAPEPT · Calcul de reconstitution",
    name ? `Nom : ${name}` : "",
    `Flacon : ${$("vial").value} ${state.vialUnit}`,
    `Eau ajoutée : ${$("water").value} mL`,
    `Concentration : ${$("conc").textContent}`,
    `Quantité par prise : ${$("dose").value} ${state.doseUnit}`,
    `Prélever : ${units} sur seringue U-100 de ${$("capText").textContent}`,
    `Prises par flacon : ${$("count").textContent}`,
    date ? `Reconstitué le : ${date}` : "",
  ]).filter(Boolean).join("\n");
}

function params() {
  const p = new URLSearchParams({
    v: $("vial").value, vu: state.vialUnit, w: $("water").value,
    d: $("dose").value, du: state.doseUnit, s: state.syringe, h: $("half").checked ? 1 : 0,
  });
  const n = $("labelName").value.trim();
  if (n) p.set("n", n);
  if (currentPep()) p.set("p", currentPep());
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
  pepWanted = /^[a-z0-9+-]{1,40}$/.test(values.p || "") ? values.p : "";
  if (PEPS.length) $("pep").value = pepOf(pepWanted) ? pepWanted : pepByName(values.n)?.id || "";
  setVialChoices(false);
}

function loadParams() {
  const p = new URLSearchParams(location.search);
  const pick = (k, ok) => (p.has(k) && (!ok || ok.includes(p.get(k))) ? p.get(k).slice(0, k === "n" ? 40 : 12) : DEFAULTS[k]);
  apply({
    v: pick("v"), w: pick("w"), d: pick("d"),
    vu: pick("vu", ["mg", "mcg"]), du: pick("du", ["mg", "mcg"]), s: pick("s", ["0.3", "0.5", "1"]),
    h: p.get("h") === "1", n: pick("n"), p: p.get("p") || "",
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
    toast(ok ? done : t("Copie impossible sur ce navigateur", "Copying isn't possible in this browser", "النسخ غير ممكن في هذا المتصفح"));
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(done), fallback);
  } else fallback();
}

/* Thème */
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
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  setTheme(next, true);
  toast(THEME_UI[next][0]);
});

/* Peptide (menu de la Liste) et contenu du flacon (menu déroulant + « Autre quantité »).
   Un peptide peut proposer ses propres contenus et son volume d'eau : champ « flacon » de peptides/data.js. */
const VIAL_MG = [1, 2, 5, 10, 15, 20, 30, 50, 100, 500];
let PEPS = [], vialList = VIAL_MG, pepWanted = "";
const pepOf = (id) => PEPS.find((p) => p.id === id);
const pepByName = (n) => {
  const k = (n || "").trim().toLowerCase();
  return k ? PEPS.find((p) => [p.nom, ...(p.alias || [])].some((a) => a.toLowerCase() === k)) : undefined;
};
const currentPep = () => (PEPS.length ? $("pep").value : pepWanted);
const vialListed = () => state.vialUnit === "mg" && vialList.includes(parseNum($("vial").value));
function fillVialPick(list) {
  vialList = list;
  const sel = $("vialPick");
  sel.querySelectorAll("option[data-n]").forEach((o) => o.remove());
  list.forEach((n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.dataset.n = "";
    o.textContent = ltr(`${fmt(n)} mg`);
    sel.insertBefore(o, sel.lastElementChild);
  });
}
function syncVialPick() {
  const v = $("vial").value.trim();
  const pick = vialListed() ? String(parseNum(v)) : v ? "other" : "";
  $("vialPick").value = pick;
  $("vialBox").hidden = pick !== "other";
}
// adapt = le peptide vient d'être choisi : un contenu qui n'est plus proposé est retiré et une eau unique est remplie.
// Sinon (lien partagé, flacon rechargé, réinitialisation) rien n'est effacé : une valeur hors liste passe en « Autre quantité ».
function setVialChoices(adapt) {
  const p = pepOf(currentPep()), was = vialListed();
  fillVialPick(p?.flacon?.mg || VIAL_MG);
  if (adapt && was && !vialListed()) $("vial").value = "";
  if (adapt && p?.flacon?.eau?.length === 1) $("water").value = String(p.flacon.eau[0]);
  syncVialPick();
  $("pepLink").hidden = !p;
  if (p) $("pepLink").href = `${$("pepLink").getAttribute("href").split("#")[0]}#${encodeURIComponent(p.id)}`;
}
$("vialPick").addEventListener("change", () => {
  const v = $("vialPick").value;
  if (v === "other") {
    if (vialListed()) $("vial").value = "";
    $("vialBox").hidden = false;
    $("vial").focus();
  } else {
    $("vial").value = v;
    setGroup("vialUnit", "mg");
    $("vialBox").hidden = true;
  }
  calc();
});
$("pep").addEventListener("change", () => {
  const p = pepOf($("pep").value), name = $("labelName").value.trim();
  // Le nom de l'étiquette suit le peptide, sauf s'il a été écrit à la main
  if (!name || pepByName(name)) $("labelName").value = p ? p.nom.slice(0, 40) : "";
  setVialChoices(true);
  calc();
});
// Mêmes données que la page Liste des peptides ; si elles ne se chargent pas, l'étape « Peptide » est masquée
import(`/peptides/${AR ? "data-ar.js" : EN ? "data-en.js" : "data.js"}`).then(({ CATEGORIES, PEPTIDES }) => {
  if (!Array.isArray(PEPTIDES) || !PEPTIDES.length) throw new Error("liste vide");
  PEPS = PEPTIDES;
  CATEGORIES.forEach((c) => {
    const g = document.createElement("optgroup");
    g.label = c.label;
    PEPTIDES.filter((p) => p.cat === c.id).forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.nom;
      g.append(o);
    });
    if (g.children.length) $("pep").append(g);
  });
  $("pep").value = pepOf(pepWanted) ? pepWanted : pepByName($("labelName").value)?.id || "";
  setVialChoices(false);
  if (booted) calc();
}).catch(() => { $("pep").closest(".step").hidden = true; });

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
$("reset").addEventListener("click", () => { apply(DEFAULTS); calc(); toast(t("Valeurs réinitialisées", "Values reset", "تمت إعادة ضبط القيم")); });
$("copyLink").addEventListener("click", () => copy(location.href.split("#")[0], t("Lien copié", "Link copied", "تم نسخ الرابط")));
$("copySum").addEventListener("click", () => copy(summary(), t("Résumé copié", "Summary copied", "تم نسخ الملخص")));
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
  if (days < 0) return t("date à venir", "future date", "تاريخ لاحق");
  if (days === 0) return t("aujourd'hui", "today", "اليوم");
  if (days === 1) return t("hier", "yesterday", "أمس");
  if (AR) return days === 2 ? "منذ يومين" : days <= 10 ? `منذ ${days} أيام` : `منذ ${days} يومًا`;
  return t(`il y a ${days} jours`, `${days} days ago`);
}
function renderVials() {
  const list = readVials();
  $("vialEmpty").hidden = list.length > 0;
  $("vialList").replaceChildren(...list.map((x) => {
    const li = mk("li", "vial");
    const vial = toMcg(parseNum(x.v), x.vu), water = parseNum(x.w);
    const conc = vial > 0 && water > 0 ? ltr(`${mass(vial / water)}/mL`) : "—";
    li.append(
      mk("p", "vial-name", x.n || t("Flacon sans nom", "Unnamed vial", "قارورة بلا اسم")),
      mk("p", "vial-meta", t(`${x.v} ${x.vu} dans ${x.w} mL · ${conc} · prise de ${x.d} ${x.du}`, `${x.v} ${x.vu} in ${x.w} mL · ${conc} · dose of ${x.d} ${x.du}`, `${ltr(`${x.v} ${x.vu}`)} في ${ltr(`${x.w} mL`)} · ${conc} · جرعة ${ltr(`${x.d} ${x.du}`)}`)),
      mk("p", "vial-date", x.date ? `${t("Reconstitué le", "Reconstituted on", "حُضّرت في")} ${fmtDate(x.date)} · ${since(x.date)}` : t("Date de reconstitution non renseignée", "No reconstitution date", "لم يُحدَّد تاريخ التحضير")),
    );
    const actions = mk("div", "vial-actions");
    const load = mk("button", "btn", t("Charger", "Load", "تحميل"));
    load.type = "button";
    load.addEventListener("click", () => {
      apply({ v: x.v, w: x.w, d: x.d, vu: x.vu, du: x.du, s: x.s, h: x.h, n: x.n, p: x.p });
      if (x.date) $("date").value = x.date;
      calc();
      toast(t("Flacon chargé", "Vial loaded", "تم تحميل القارورة"));
      $("calculateur").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
    const del = mk("button", "btn", t("Supprimer", "Delete", "حذف"));
    del.type = "button";
    let timer = 0;
    del.addEventListener("click", () => {
      if (!del.classList.contains("is-confirm")) {
        del.classList.add("is-confirm");
        del.textContent = t("Confirmer ?", "Confirm?", "تأكيد؟");
        timer = setTimeout(() => { del.classList.remove("is-confirm"); del.textContent = t("Supprimer", "Delete", "حذف"); }, 3000);
        return;
      }
      clearTimeout(timer);
      writeVials(readVials().filter((y) => y.id !== x.id));
      renderVials();
      toast(t("Flacon supprimé", "Vial deleted", "تم حذف القارورة"));
    });
    // Ouvre le suivi de fiole pré-rempli avec ce flacon (page suivi/ de la même langue)
    const track = mk("a", "btn", t("Suivre", "Track", "متابعة"));
    const q = new URLSearchParams({ n: x.n || "", p: x.p || "", v: x.v, vu: x.vu, w: x.w, d: x.d, du: x.du, date: x.date || "" });
    track.href = `suivi/?${q}`;
    actions.append(load, track, del);
    li.append(actions);
    return li;
  }));
}
$("saveVial").addEventListener("click", () => {
  const v = parseNum($("vial").value), w = parseNum($("water").value), d = parseNum($("dose").value);
  if (!(v > 0 && w > 0 && d > 0)) { toast(t("Complète d'abord les quantités du calculateur", "Fill in the calculator amounts first", "أكمل كميات الحاسبة أولًا")); return; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test($("date").value) ? $("date").value : "";
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    n: $("labelName").value.trim().slice(0, 40), p: currentPep(), date,
    v: $("vial").value.trim().slice(0, 12), vu: state.vialUnit, w: $("water").value.trim().slice(0, 12),
    d: $("dose").value.trim().slice(0, 12), du: state.doseUnit, s: state.syringe, h: $("half").checked,
  };
  const list = [entry, ...readVials()].slice(0, 30);
  if (!writeVials(list)) { toast(t("Enregistrement impossible : le stockage du navigateur est bloqué", "Can't save: browser storage is blocked", "تعذّر الحفظ: تخزين المتصفح محظور")); return; }
  renderVials();
  toast(t("Flacon enregistré", "Vial saved", "تم حفظ القارورة"));
});
renderVials();

/* Bouton « Installer l'appli » : invite du navigateur si elle existe, sinon la marche à suivre */
let installPrompt = null;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
$("installBtn").hidden = standalone;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast(t("Appli installée", "App installed", "تم تثبيت التطبيق")); });
$("installBtn").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) {}
    installPrompt = null;
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? t("Sur iPhone : touche le bouton Partager, puis « Sur l'écran d'accueil »", "On iPhone: tap the Share button, then “Add to Home Screen”", "على iPhone: اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»")
    : t("Ouvre le menu du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil »", "Open the browser menu, then “Install app” or “Add to Home screen”", "افتح قائمة المتصفح، ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»"));
});

/* Menu des langues : se ferme en touchant ailleurs ou avec Échap */
const langMenu = $("langMenu");
if (langMenu) {
  document.addEventListener("click", (e) => { if (!langMenu.contains(e.target)) langMenu.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && langMenu.open) { langMenu.open = false; langMenu.querySelector("summary").focus(); } });
}

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
