// Suivi de fiole AURAPEPT : une fiole reconstituée, ses prises, et ce qu'il reste dedans.
// Tout reste dans le navigateur (stockage local) : rien n'est envoyé.
const $ = (id) => document.getElementById(id);
// Langue de la page (fr, en ou ar) : t("texte français", "English text", "النص العربي")
const LANG = document.documentElement.lang;
const EN = LANG === "en", AR = LANG === "ar";
const t = (fr, en, ar) => (AR ? ar : EN ? en : fr);
const LOCALE = AR ? "ar-u-nu-latn" : EN ? "en-US" : "fr-FR";
// En arabe, « 5 mg » garde cet ordre au milieu du texte de droite à gauche (isolat Unicode LRI…PDI)
const ltr = (s) => (AR ? `⁦${s}⁩` : s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DAY = 86400000;

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString(LOCALE, { maximumFractionDigits: d }) : "—");
// Valeur à remettre dans un champ : sans séparateur de milliers (« 1,500 » serait lu 1,5)
const fmtIn = (n) => n.toLocaleString(LOCALE, { maximumFractionDigits: 3, useGrouping: false });
// Nombre décimal simple uniquement (virgule ou point). NaN si vide, -1 si invalide.
const parseNum = (s) => {
  const v = String(s).replace(/\s/g, "");
  if (v === "") return NaN;
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(v)) return -1;
  const n = Number(v.replace(",", "."));
  return n <= 1e6 ? n : -1;
};
const toMcg = (v, u) => (u === "mg" ? v * 1000 : v);
const massTxt = (mcg) => (mcg >= 1000 ? `${fmt(mcg / 1000, 3)} mg` : `${fmt(mcg, 1)} mcg`);
const mass = (mcg) => ltr(massTxt(mcg));
const vol = (ml) => ltr(`${fmt(ml, ml < 0.1 ? 3 : 2)} mL`);
const unitsTxt = (u) => `${fmt(u, 1)} ${t("unités", "units", "وحدة")}`;
// Pluriels arabes : 1, 2, 3 à 10, 11 et plus
const arCount = (n, [one, two, few, many]) => (n === 1 ? one : n === 2 ? two : n % 100 >= 3 && n % 100 <= 10 ? `${n} ${few}` : `${n} ${many}`);
const doses = (n) => t(n > 1 ? `${n} prises` : `${n} prise`, n === 1 ? "1 dose" : `${n} doses`, arCount(n, ["جرعة واحدة", "جرعتان", "جرعات", "جرعة"]));
const days = (n) => t(n > 1 ? `${n} jours` : `${n} jour`, n === 1 ? "1 day" : `${n} days`, arCount(n, ["يوم واحد", "يومان", "أيام", "يومًا"]));

/* Dates locales : « 2026-10-28 » et « 2026-10-28T14:05 » */
const pad = (n) => String(n).padStart(2, "0");
const parseDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : NaN; };
const parseDT = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ""); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN; };
const dayStart = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const addDays = (ms, n) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
// Jours entiers entre deux dates (insensible aux changements d'heure)
const dayDiff = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
const weekOf = (v, ms) => Math.max(1, Math.floor(dayDiff(parseDay(v.date), ms) / 7) + 1);
const toDT = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fDay = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const fDayYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const fWhen = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayLabel = (ms) => (new Date(ms).getFullYear() === new Date().getFullYear() ? fDay : fDayYear).format(ms);

/* Couleurs des fioles : capsule de la fiole 3D et cartes de l'étagère */
const PALETTE = [
  ["shu", "#c23a22", "Rouge", "Red", "أحمر"], ["ai", "#2f5f9f", "Bleu", "Blue", "أزرق"],
  ["sora", "#25869e", "Turquoise", "Teal", "فيروزي"], ["matcha", "#4f7a3a", "Vert", "Green", "أخضر"],
  ["kin", "#a8770f", "Or", "Gold", "ذهبي"], ["sakura", "#c95b80", "Rose", "Pink", "وردي"],
  ["fuji", "#7a5ca8", "Violet", "Purple", "بنفسجي"], ["sumi", "#4a4a50", "Gris", "Gray", "رمادي"],
];
const colorOf = (id) => PALETTE.find((c) => c[0] === id) || PALETTE[0];
const colorName = (c) => t(c[2], c[3], c[4]);

/* Endroits d'injection : « gauche » = la gauche de la personne. Ventre et cuisses vus de face, bras et fessiers de dos. */
const SITES = [
  { id: "abd-l", fr: "Ventre gauche", en: "Left abdomen", ar: "يسار البطن" },
  { id: "abd-r", fr: "Ventre droit", en: "Right abdomen", ar: "يمين البطن" },
  { id: "thigh-l", fr: "Cuisse gauche", en: "Left thigh", ar: "الفخذ الأيسر" },
  { id: "thigh-r", fr: "Cuisse droite", en: "Right thigh", ar: "الفخذ الأيمن" },
  { id: "arm-l", fr: "Bras gauche", en: "Left arm", ar: "الذراع الأيسر" },
  { id: "arm-r", fr: "Bras droit", en: "Right arm", ar: "الذراع الأيمن" },
  { id: "glute-l", fr: "Fessier gauche", en: "Left glute", ar: "الألية اليسرى" },
  { id: "glute-r", fr: "Fessier droit", en: "Right glute", ar: "الألية اليمنى" },
];
const siteName = (id) => { const x = SITES.find((k) => k.id === id); return x ? t(x.fr, x.en, x.ar) : ""; };

/* Stockage */
const KEY = "aurapept-suivi";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Une fiole venant du stockage local ou d'un fichier importé : on ne garde que des champs connus et valides
const num = (x, max) => (typeof x === "number" && Number.isFinite(x) && x > 0 && x <= max ? x : 0);
function cleanVial(v) {
  if (!v || typeof v !== "object") return null;
  const total = num(v.total, 1e9), water = num(v.water, 100);
  if (!total || !water || typeof v.date !== "string" || !Number.isFinite(parseDay(v.date)) || !Array.isArray(v.logs)) return null;
  const logs = v.logs
    .filter((l) => l && typeof l.t === "string" && Number.isFinite(parseDT(l.t)) && num(l.mcg, 1e9))
    .slice(0, 1000)
    .map((l) => ({
      id: typeof l.id === "string" ? l.id.slice(0, 40) : uid(), t: l.t.slice(0, 16), mcg: l.mcg,
      site: SITES.some((k) => k.id === l.site) ? l.site : "", note: typeof l.note === "string" ? l.note.slice(0, 140) : "",
    }))
    .sort((a, b) => parseDT(a.t) - parseDT(b.t));
  return {
    id: typeof v.id === "string" && v.id ? v.id.slice(0, 40) : uid(),
    name: typeof v.name === "string" ? v.name.slice(0, 40) : "",
    total, water, date: v.date, dose: num(v.dose, 1e9), doseUnit: v.doseUnit === "mg" ? "mg" : "mcg", logs,
    color: PALETTE.some((c) => c[0] === v.color) ? v.color : "shu",
    bud: typeof v.bud === "string" && Number.isFinite(parseDay(v.bud)) ? v.bud : "",
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.vials)) return { current: typeof s.current === "string" ? s.current : null, vials: s.vials.map(cleanVial).filter(Boolean).slice(0, 20) };
  } catch (e) {}
  return { current: null, vials: [] };
}
const store = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) {
    toast(t("Enregistrement impossible : le stockage du navigateur est bloqué", "Can't save: browser storage is blocked", "تعذّر الحفظ: تخزين المتصفح محظور"));
    return false;
  }
}
const current = () => store.vials.find((v) => v.id === store.current) || null;
const startOf = (v) => Math.min(parseDay(v.date), ...v.logs.map((l) => parseDT(l.t)));
// Date où la fiole serait vide, au rythme moyen depuis la reconstitution (au moins 2 prises)
function emptyAt(v) {
  const s = status(v), now = Date.now();
  if (v.logs.length < 2 || !(s.used > 0) || !(s.left > 0)) return null;
  return now + s.left / (s.used / Math.max(DAY, now - parseDay(v.date)));
}
const budPassed = (v) => !!v.bud && dayDiff(parseDay(v.bud), Date.now()) > 0;
function status(v, at = Infinity) {
  const used = v.logs.reduce((s, l) => (parseDT(l.t) <= at ? s + l.mcg : s), 0);
  const left = Math.max(0, v.total - used);
  const conc = v.total / v.water; // mcg par mL
  return { used, left, conc, ml: left / conc, frac: left / v.total };
}

/* Notification */
let toastTimer = 0;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), msg.length > 45 ? 5000 : 1800);
}

/* Boutons à choix (mg / mcg / unités) */
const segValue = (id) => $(id).querySelector('[aria-pressed="true"]')?.dataset.v;
function setSeg(id, value) {
  $(id).querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === value)));
}
document.querySelectorAll(".seg[id]").forEach((g) => g.addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (b) { setSeg(g.id, b.dataset.v); g.dispatchEvent(new Event("change", { bubbles: true })); }
}));

/* ── La fiole en SVG : verre, capsule, liquide qui ondule, bulles, inclinaison au doigt ── */
const OUTER = "M96 74 H164 V92 C164 106 204 108 204 132 V350 Q204 374 180 374 H80 Q56 374 56 350 V132 C56 108 96 106 96 92 Z";
const INNER = "M101 77 H159 V93 C159 109 198.5 112 198.5 134 V346 Q198.5 362 182 362 H78 Q61.5 362 61.5 346 V134 C61.5 112 101 109 101 93 Z";
const Y_BOT = 362, Y_FULL = 172;
const yAt = (f) => Y_BOT - Math.max(0, Math.min(1, f)) * (Y_BOT - Y_FULL);
const svgVial = (() => {
  const svg = $("vialSvg");
  svg.innerHTML = `
    <defs>
      <clipPath id="vInner"><path d="${INNER}"/></clipPath>
      <linearGradient id="vLiq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="lq-top"/><stop offset="1" class="lq-bot"/></linearGradient>
    </defs>
    <ellipse class="v-shadow" cx="130" cy="382" rx="88" ry="9"/>
    <g id="vTilt">
      <path class="v-glass" d="${OUTER}"/>
      <g clip-path="url(#vInner)">
        <g id="vLiqRot"><path id="vLiqPath" class="v-liquid"/><path id="vSurf" class="v-surface"/></g>
        <g id="vBubbles"></g>
      </g>
      <g id="vTicks"></g>
      <path class="v-edge" d="${OUTER}"/>
      <rect class="v-shine" x="67" y="140" width="9" height="200" rx="4.5"/>
      <rect class="v-shine v-shine-2" x="186" y="156" width="4" height="160" rx="2"/>
      <rect class="v-crimp" x="86" y="44" width="88" height="34" rx="5"/>
      <path class="v-crimp-lines" d="M97 50v22M108 50v22M119 50v22M130 50v22M141 50v22M152 50v22M163 50v22"/>
      <rect class="v-cap" x="90" y="20" width="80" height="28" rx="8"/>
      <text class="v-cap-mark" x="130" y="40">オ</text>
    </g>`;
  const tiltG = $("vTilt"), liqRot = $("vLiqRot"), liq = $("vLiqPath"), surf = $("vSurf");
  const NS = "http://www.w3.org/2000/svg";
  const bubbles = Array.from({ length: 6 }, (_, i) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", "v-bubble");
    $("vBubbles").appendChild(c);
    return { c, x: 76 + i * 20, y: Y_BOT - i * 30, r: 1.6 + (i % 3), s: 9 + i * 3 };
  });

  let shown = 0, target = 0, tilt = 0, tiltV = 0, tiltT = 0, energy = 0, phase = 0, last = 0, raf = 0, visible = true;
  function draw() {
    const y = yAt(shown);
    const has = shown > 0.004;
    liq.style.display = surf.style.display = has ? "" : "none";
    const A = reduceMotion ? 0 : 1 + Math.min(7, energy * 5);
    let d = "";
    for (let x = -70; x <= 330; x += 10) {
      const yy = y + A * Math.sin(x * 0.055 + phase) + A * 0.45 * Math.sin(x * 0.12 - phase * 1.4);
      d += `${x === -70 ? "M" : "L"}${x} ${yy.toFixed(2)}`;
    }
    surf.setAttribute("d", d);
    liq.setAttribute("d", `${d}L330 480L-70 480Z`);
    liqRot.setAttribute("transform", `rotate(${(-tilt).toFixed(2)} 130 ${y.toFixed(1)})`);
    tiltG.setAttribute("transform", `rotate(${tilt.toFixed(2)} 130 378)`);
    bubbles.forEach((b) => {
      const on = has && !reduceMotion && b.y > y + 6;
      b.c.setAttribute("r", on ? b.r : 0);
      b.c.setAttribute("cx", (b.x + Math.sin(phase * 1.3 + b.s) * 2).toFixed(1));
      b.c.setAttribute("cy", b.y.toFixed(1));
    });
  }
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    tiltV += (90 * (tiltT - tilt) - 9 * tiltV) * dt; // ressort amorti : la fiole revient droite et le liquide clapote
    tilt += tiltV * dt;
    shown += (target - shown) * (1 - Math.exp(-dt * 4.5));
    energy = energy * Math.exp(-dt * 1.4) + Math.abs(tiltV) * dt * 0.04;
    phase += dt * (2 + energy * 1.5);
    const y = yAt(shown);
    bubbles.forEach((b) => { b.y -= b.s * dt; if (b.y < y + 6) { b.y = Y_BOT - 4 - Math.random() * 10; b.x = 74 + Math.random() * 110; } });
    draw();
    raf = visible ? requestAnimationFrame(frame) : 0;
  }
  function wake() {
    if (reduceMotion) { shown = target; tilt = 0; draw(); return; }
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }
  // Animation seulement quand la fiole est à l'écran
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; if (visible) wake(); }).observe(svg);
  }
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) wake(); });

  // Incliner la fiole en la faisant glisser
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { drag = e.clientX; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => { if (drag === null) return; tiltT = Math.max(-24, Math.min(24, (e.clientX - drag) * 0.25)); wake(); });
  const release = () => { drag = null; tiltT = 0; energy += 0.6; wake(); };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  return {
    set(f, { instant = false, splash = 0 } = {}) {
      target = Math.max(0, Math.min(1, f));
      if (instant) shown = target;
      energy += splash;
      wake();
    },
    color(hex) { svg.querySelector(".v-cap").style.fill = hex; },
    ticks(water) {
      if (!(water > 0)) { $("vTicks").innerHTML = ""; return; }
      const step = water <= 1 ? 0.25 : water <= 3 ? 0.5 : water <= 6 ? 1 : 2;
      const major = water <= 1 ? 0.5 : water <= 6 ? 1 : 2;
      let out = "";
      for (let k = step; k <= water + 1e-9; k += step) {
        const y = yAt(k / water).toFixed(1);
        const isMajor = Math.abs(k / major - Math.round(k / major)) < 1e-9 || Math.abs(k - water) < 1e-9;
        out += `<line class="v-tick${isMajor ? " v-tick-major" : ""}" x1="${isMajor ? 182 : 188}" y1="${y}" x2="198" y2="${y}"/>`;
        if (isMajor) out += `<text class="v-tick-label" x="210" y="${(+y + 4).toFixed(1)}">${fmt(k, 2)} mL</text>`;
      }
      $("vTicks").innerHTML = out;
    },
  };
})();

// Fiole réaliste en 3D (verre, reflets, liquide) : remplace le dessin si WebGL est disponible
let vialImpl = svgVial;
const vialLast = { f: 0, water: 0, color: PALETTE[0][1] };
const vial = {
  set(f, opts) { vialLast.f = f; vialImpl.set(f, opts); },
  color(hex) { vialLast.color = hex; vialImpl.color?.(hex); },
  ticks(w) { vialLast.water = w; vialImpl.ticks(w); },
  // « −250 mcg » qui s'envole au-dessus de la fiole après une prise
  float(text) {
    const el = $("vialFloat");
    el.textContent = text;
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
  },
};
import("/suivi/fiole3d.js").then(({ createVial3D }) => {
  const canvas = $("vial3d");
  canvas.hidden = false;
  const v3 = createVial3D(canvas, { reduceMotion });
  if (!v3) { canvas.hidden = true; return; }
  $("vialSvg").setAttribute("hidden", ""); // (un <svg> n'a pas la propriété .hidden)
  vialImpl = v3;
  v3.set(vialLast.f, { instant: true });
  v3.color(vialLast.color);
  document.querySelector(".vial-hint").textContent = t("Fais glisser pour tourner autour de la fiole", "Drag to turn around the vial", "اسحب للدوران حول القارورة");
}).catch(() => { $("vial3d").hidden = true; });

/* ── Affichage ── */
let viewAt = Infinity; // moment affiché par la frise (Infinity = maintenant)
/* Étagère : une carte par fiole, avec sa couleur, une mini-fiole qui se vide et ce qu'il reste */
function miniVial(hex, frac) {
  const h = (34 * Math.max(0, Math.min(1, frac))).toFixed(1);
  return `<svg class="mini-vial" viewBox="0 0 40 64" aria-hidden="true">
    <path class="mv-glass" d="M14 16h12v3c0 2.5 9 3.5 9 9v28a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V28c0-5.5 9-6.5 9-9z"/>
    <rect class="mv-liquid" x="7" y="${(58 - h).toFixed(1)}" width="26" height="${h}" rx="2.5"/>
    <path class="mv-edge" d="M14 16h12v3c0 2.5 9 3.5 9 9v28a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V28c0-5.5 9-6.5 9-9z"/>
    <rect class="mv-crimp" x="11" y="9" width="18" height="8" rx="1.5"/>
    <rect x="12" y="2" width="16" height="8" rx="2.5" fill="${hex}"/>
  </svg>`;
}
function renderShelf() {
  $("shelf").hidden = !store.vials.length;
  $("shelfCount").textContent = vialsTxt(store.vials.length);
  const cards = store.vials.map((v) => {
    const s = status(v), c = colorOf(v.color), end = emptyAt(v);
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "vcard";
    b.setAttribute("aria-pressed", String(v.id === store.current));
    b.style.setProperty("--vc", c[1]);
    const name = v.name || t("Fiole sans nom", "Unnamed vial", "قارورة بلا اسم");
    const body = document.createElement("span");
    body.className = "vc-body";
    const nm = document.createElement("b"); nm.className = "vc-name"; nm.textContent = name;
    const pct = document.createElement("span"); pct.className = "vc-pct"; pct.textContent = ltr(`${fmt(s.frac * 100, 0)} %`);
    const meta = document.createElement("span"); meta.className = "vc-meta"; meta.textContent = `${mass(s.left)} · ${vol(s.ml)}`;
    const info = document.createElement("span"); info.className = "vc-end";
    if (budPassed(v)) { info.textContent = t("Date limite dépassée", "Use-before date passed", "تجاوزت تاريخ الاستخدام"); info.classList.add("is-alert"); }
    else if (s.left <= 0) info.textContent = t("Fiole vide", "Vial empty", "القارورة فارغة");
    else if (v.bud) info.textContent = t(`À utiliser avant le ${dayLabel(parseDay(v.bud))}`, `Use before ${dayLabel(parseDay(v.bud))}`, `استخدمها قبل ${dayLabel(parseDay(v.bud))}`);
    else if (end) info.textContent = t(`Vide vers le ${dayLabel(end)}`, `Empty around ${dayLabel(end)}`, `تفرغ تقريبًا في ${dayLabel(end)}`);
    else info.textContent = doses(v.logs.length);
    const bar = document.createElement("span"); bar.className = "vc-bar";
    const fill = document.createElement("i"); fill.style.width = `${Math.round(s.frac * 100)}%`; bar.append(fill);
    body.append(nm, pct, meta, info, bar);
    b.innerHTML = miniVial(c[1], s.frac);
    b.append(body);
    b.setAttribute("aria-label", `${name}, ${colorName(c)}, ${t("reste", "left", "المتبقي")} ${fmt(s.frac * 100, 0)} %`);
    b.addEventListener("click", () => {
      if (v.id === store.current) return;
      store.current = v.id; save(); viewAt = Infinity; endEdit(); showForm(false); renderAll(true);
    });
    li.append(b);
    return li;
  });
  const li = document.createElement("li");
  const add = document.createElement("button");
  add.type = "button";
  add.className = "vcard vcard-new";
  add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  add.append(t("Nouvelle fiole", "New vial", "قارورة جديدة"));
  add.addEventListener("click", () => $("newVialBtn").click());
  li.append(add);
  $("shelfList").replaceChildren(...cards, li);
}

function renderStage(instant) {
  const v = current();
  const svg = $("vialView");
  $("vialSvg").classList.toggle("is-empty", !v);
  document.querySelector(".readout").classList.toggle("is-empty", !v);
  if (!v) {
    vial.ticks(0);
    vial.set(0, { instant: true });
    $("roName").textContent = t("Aucune fiole", "No vial yet", "لا توجد قارورة");
    $("roPct").textContent = "—";
    $("roMass").textContent = t("Ajoute ta fiole pour commencer", "Add your vial to start", "أضف قارورتك للبدء");
    $("roMl").textContent = $("roConc").textContent = "";
    svg.setAttribute("aria-label", t("Fiole vide : aucune fiole enregistrée.", "Empty vial: no vial saved.", "قارورة فارغة: لا توجد قارورة محفوظة."));
    $("timeline").hidden = $("stageFoot").hidden = true;
    return;
  }
  const s = status(v, viewAt);
  vial.color(colorOf(v.color)[1]);
  vial.ticks(v.water);
  vial.set(s.frac, { instant });
  $("roName").textContent = v.name || t("Fiole sans nom", "Unnamed vial", "قارورة بلا اسم");
  $("roPct").textContent = fmt(s.frac * 100, 0);
  $("roMass").textContent = t(`${mass(s.left)} sur ${mass(v.total)}`, `${mass(s.left)} of ${mass(v.total)}`, `${mass(s.left)} من ${mass(v.total)}`);
  $("roMl").textContent = t(`${vol(s.ml)} sur ${vol(v.water)}`, `${vol(s.ml)} of ${vol(v.water)}`, `${vol(s.ml)} من ${vol(v.water)}`);
  const conc = document.createElement("span");
  conc.textContent = ltr(`${massTxt(s.conc)}/mL`);
  $("roConc").replaceChildren(t("Concentration : ", "Concentration: ", "التركيز: "), conc);
  svg.setAttribute("aria-label", t(
    `Fiole : il reste ${massTxt(s.left)} sur ${massTxt(v.total)}, soit ${fmt(s.frac * 100, 0)} %.`,
    `Vial: ${massTxt(s.left)} left of ${massTxt(v.total)}, that is ${fmt(s.frac * 100, 0)}%.`,
    `القارورة: يتبقى ${massTxt(s.left)} من ${massTxt(v.total)}، أي ${fmt(s.frac * 100, 0)}٪.`));
  $("stageFoot").hidden = false;
  // Fiole vide : proposer d'en préparer une identique (mêmes réglages, date du jour)
  let again = $("againBtn");
  if (!again) {
    again = document.createElement("button");
    again.id = "againBtn";
    again.type = "button";
    again.className = "btn btn-primary";
    again.textContent = t("Nouvelle fiole identique", "New identical vial", "قارورة جديدة مماثلة");
    again.addEventListener("click", () => {
      const c = current();
      if (!c) return;
      const mg = c.total >= 1000;
      fillForm({ n: c.name, v: fmtIn(mg ? c.total / 1000 : c.total), vu: mg ? "mg" : "mcg", w: fmtIn(c.water),
        d: c.dose ? fmtIn(c.doseUnit === "mg" ? c.dose / 1000 : c.dose) : "", du: c.doseUnit, date: toDT(Date.now()).slice(0, 10) });
      showForm(true);
      $("newVial").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    $("stageFoot").prepend(again);
  }
  again.hidden = status(v).left > 0;
  renderTimeline(v);
}

/* Frise : revoir la fiole semaine après semaine */
function range(v) { const start = startOf(v); return { start, end: Math.max(Date.now(), ...v.logs.map((l) => parseDT(l.t))) }; }
function renderTimeline(v) {
  const { start, end } = range(v);
  const tl = $("timeline");
  tl.hidden = !v.logs.length;
  if (!v.logs.length) return;
  const at = Math.min(viewAt, end);
  if (viewAt === Infinity) $("tlRange").value = 1000;
  const week = weekOf(v, at);
  const weekTxt = t(`Semaine ${week}`, `Week ${week}`, `الأسبوع ${week}`);
  $("tlLabel").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = viewAt === Infinity ? t("Aujourd'hui", "Today", "اليوم") : dayLabel(at);
  $("tlLabel").append(b, ` · ${weekTxt} · ${t("reste", "left", "المتبقي")} ${mass(status(v, at).left)}`);
  $("tlRange").setAttribute("aria-valuetext", `${b.textContent}, ${weekTxt}`);
  $("tlRange").dataset.start = start;
  $("tlRange").dataset.end = end;
}
$("tlRange").addEventListener("input", (e) => {
  stopPlay();
  const v = current();
  if (!v) return;
  const { start, end } = range(v);
  viewAt = +e.target.value >= 1000 ? Infinity : start + (end - start) * (+e.target.value / 1000);
  renderStage();
});
let playRaf = 0;
function stopPlay() {
  cancelAnimationFrame(playRaf);
  playRaf = 0;
  $("tlPlay").setAttribute("aria-pressed", "false");
}
$("tlPlay").addEventListener("click", () => {
  const v = current();
  if (!v) return;
  if (playRaf) { stopPlay(); return; }
  const { start, end } = range(v);
  const dur = reduceMotion ? 1 : Math.min(7000, Math.max(2200, ((end - start) / (7 * DAY)) * 900));
  const t0 = performance.now();
  $("tlPlay").setAttribute("aria-pressed", "true");
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    $("tlRange").value = Math.round(k * 1000);
    viewAt = k >= 1 ? Infinity : start + (end - start) * k;
    renderStage();
    if (k < 1) playRaf = requestAnimationFrame(step); else stopPlay();
  };
  playRaf = requestAnimationFrame(step);
});

function renderPanel() {
  const v = current();
  $("dosePanel").hidden = !v || !$("newVial").hidden;
  if (!v) return;
  const s = status(v);
  $("dosePanel").dataset.printTitle = `${v.name || t("Fiole sans nom", "Unnamed vial", "قارورة بلا اسم")} · ${massTxt(v.total)} / ${fmt(v.water)} mL · ${dayLabel(parseDay(v.date))}`;
  const pill = $("vialStatus");
  const [tone, label] = budPassed(v) ? ["alert", t("Date limite dépassée", "Use-before date passed", "تجاوزت تاريخ الاستخدام")]
    : s.left <= 0 ? ["alert", t("Fiole vide", "Vial empty", "القارورة فارغة")]
    : s.frac < 0.2 ? ["warn", t("Bientôt vide", "Almost empty", "على وشك النفاد")]
    : ["ok", t("En cours", "In use", "قيد الاستخدام")];
  pill.dataset.tone = tone;
  pill.textContent = label;

  // Chiffres clés
  const now = Date.now();
  const since = Math.max(0, dayDiff(parseDay(v.date), now));
  $("stLeft").textContent = mass(s.left);
  $("stMl").textContent = vol(s.ml);
  $("stCount").textContent = String(v.logs.length);
  if (v.dose > 0) {
    $("stDosesLeft").replaceChildren(String(Math.floor(s.left / v.dose + 1e-9)), small(t(`à ${massTxt(v.dose)}`, `at ${massTxt(v.dose)}`, `بجرعة ${ltr(massTxt(v.dose))}`)));
  } else {
    $("stDosesLeft").replaceChildren("—", small(t("Indique une prise habituelle", "Set a usual dose", "حدّد جرعة معتادة")));
  }
  $("stSince").replaceChildren(since === 0 ? t("Aujourd'hui", "Today", "اليوم") : days(since), small(t(`depuis le ${dayLabel(parseDay(v.date))}`, `since ${dayLabel(parseDay(v.date))}`, `منذ ${dayLabel(parseDay(v.date))}`)));
  // Au rythme moyen depuis la reconstitution, date où la fiole serait vide
  const empty = emptyAt(v);
  if (empty) {
    $("stEmpty").replaceChildren(dayLabel(empty), small(v.bud
      ? t(`à utiliser avant le ${dayLabel(parseDay(v.bud))}`, `use before ${dayLabel(parseDay(v.bud))}`, `استخدمها قبل ${dayLabel(parseDay(v.bud))}`)
      : t("au rythme actuel", "at the current pace", "بالوتيرة الحالية")));
  } else {
    $("stEmpty").replaceChildren(s.left <= 0 ? t("Déjà vide", "Already empty", "فارغة بالفعل") : "—", small(s.left <= 0 ? "" : t("après 2 prises", "after 2 doses", "بعد جرعتين")));
  }

  // Formulaire de prise
  if (!$("dsAmount").dataset.touched) {
    if (v.dose > 0) {
      const u = v.doseUnit === "mg" ? "mg" : "mcg";
      $("dsAmount").value = fmtIn(u === "mg" ? v.dose / 1000 : v.dose);
      setSeg("dsUnit", u);
    } else $("dsAmount").value = "";
  }
  updatePreview();
  renderSites();
  renderHistory(v);
}
function small(text) { const e = document.createElement("small"); e.textContent = text; return e; }

/* Endroit de la prise : silhouette de face et de dos + liste de boutons (accessible au clavier).
   La couleur montre le repos depuis la dernière prise notée à cet endroit, toutes fioles confondues. */
let site = "";
let editing = null; // id de la prise en cours de modification
function lastBySite() {
  const last = {};
  store.vials.forEach((v) => v.logs.forEach((l) => {
    if (!l.site || l.id === editing) return;
    const ms = parseDT(l.t);
    if (!(last[l.site] >= ms)) last[l.site] = ms;
  }));
  return last;
}
const restLevel = (ms) => { if (ms === undefined) return "rest"; const d = dayDiff(ms, Date.now()); return d < 2 ? "fresh" : d < 7 ? "mid" : "rest"; };
const SIDE = { fr: ["D", "G"], en: ["R", "L"], ar: ["يمين", "يسار"] }[LANG] || ["R", "L"];
function figure(ox, zones, sideLeftFirst, label) {
  const [right, left] = SIDE;
  const marks = sideLeftFirst ? [left, right] : [right, left];
  return `<g transform="translate(${ox} 0)">
    <g class="bm-body">
      <circle cx="60" cy="24" r="15"/><rect x="53" y="37" width="14" height="10" rx="4"/>
      <path d="M30 51 Q60 43 90 51 Q98 54 98 63 L92 132 Q60 140 28 132 L22 63 Q22 54 30 51 Z"/>
      <rect x="4" y="55" width="16" height="96" rx="8" transform="rotate(9 12 55)"/>
      <rect x="100" y="55" width="16" height="96" rx="8" transform="rotate(-9 108 55)"/>
      <rect x="34" y="128" width="23" height="112" rx="11"/><rect x="63" y="128" width="23" height="112" rx="11"/>
    </g>
    ${zones.map(([id, cx, cy, rx, ry]) => `<ellipse class="bm-zone" data-site="${id}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join("")}
    <text class="bm-side" x="4" y="16">${marks[0]}</text><text class="bm-side" x="116" y="16" text-anchor="end">${marks[1]}</text>
    <text class="bm-label" x="60" y="258">${label}</text>
  </g>`;
}
function buildSiteMap() {
  // De face, la gauche de la personne est à droite du dessin ; de dos, elle est à gauche
  $("siteMap").innerHTML = `<svg viewBox="0 0 284 264" role="presentation">
    ${figure(8, [["abd-r", 48, 104, 10, 13], ["abd-l", 72, 104, 10, 13], ["thigh-r", 45, 170, 9, 20], ["thigh-l", 75, 170, 9, 20]], false, t("Devant", "Front", "الأمام"))}
    ${figure(156, [["arm-l", 8, 88, 7, 15], ["arm-r", 112, 88, 7, 15], ["glute-l", 48, 130, 11, 10], ["glute-r", 72, 130, 11, 10]], true, t("Dos", "Back", "الخلف"))}
  </svg>`;
  $("siteMap").querySelectorAll(".bm-zone").forEach((z) => z.addEventListener("click", () => selectSite(site === z.dataset.site ? "" : z.dataset.site)));
  $("siteList").replaceChildren(...SITES.map((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "site-btn";
    b.dataset.site = k.id;
    b.addEventListener("click", () => selectSite(site === k.id ? "" : k.id));
    return b;
  }));
}
function renderSites() {
  const last = lastBySite(), now = Date.now();
  // Le plus reposé : jamais utilisé en premier, sinon la dernière prise la plus ancienne
  let best = null;
  SITES.forEach((k) => { if (best === null || (last[k.id] ?? -Infinity) < (last[best] ?? -Infinity)) best = k.id; });
  $("siteMap").querySelectorAll(".bm-zone").forEach((z) => {
    z.setAttribute("class", `bm-zone is-${restLevel(last[z.dataset.site])}${z.dataset.site === site ? " is-sel" : ""}`);
  });
  $("siteList").querySelectorAll(".site-btn").forEach((b) => {
    const id = b.dataset.site, ms = last[id];
    const d = ms === undefined ? null : dayDiff(ms, now);
    const dot = document.createElement("i");
    dot.className = `is-${restLevel(ms)}`;
    const nm = document.createElement("b");
    nm.textContent = siteName(id);
    const rest = document.createElement("span");
    rest.textContent = d === null ? t("jamais utilisé", "never used", "لم يُستخدم")
      : d === 0 ? t("utilisé aujourd'hui", "used today", "استُخدم اليوم")
      : t(`repos : ${days(d)}`, `rested ${days(d)}`, `راحة: ${days(d)}`);
    b.replaceChildren(dot, nm, rest);
    if (id === best) { const em = document.createElement("em"); em.textContent = t("le plus reposé", "most rested", "الأكثر راحة"); b.append(em); }
    b.setAttribute("aria-pressed", String(id === site));
  });
}
function selectSite(id) { site = id; renderSites(); }

function doseMcg(v) {
  const n = parseNum($("dsAmount").value);
  if (!(n > 0)) return NaN;
  const u = segValue("dsUnit");
  return u === "u" ? (n / 100) * (v.total / v.water) : toMcg(n, u);
}
function updatePreview() {
  const v = current();
  if (!v) return;
  const mcg = doseMcg(v), s = status(v);
  if (editing) s.left += v.logs.find((l) => l.id === editing)?.mcg || 0; // la prise modifiée est remise dans la fiole
  const p = $("dsPreview");
  if (!(mcg > 0)) { p.textContent = t("Indique la quantité prélevée.", "Enter the amount drawn.", "أدخل الكمية المسحوبة."); return; }
  const ml = mcg / s.conc;
  p.textContent = t(
    `Soit ${massTxt(mcg)}, ${unitsTxt(ml * 100)} sur seringue U-100 (${fmt(ml, 3)} mL). Il restera ${massTxt(Math.max(0, s.left - mcg))}.`,
    `That is ${massTxt(mcg)}, ${unitsTxt(ml * 100)} on a U-100 syringe (${fmt(ml, 3)} mL). ${massTxt(Math.max(0, s.left - mcg))} will be left.`,
    `أي ${mass(mcg)}، ${ltr(fmt(ml * 100, 1))} وحدة على حقنة ${ltr("U-100")} (${vol(ml)}). سيتبقى ${mass(Math.max(0, s.left - mcg))}.`);
}
["input", "change"].forEach((ev) => {
  $("dsAmount").addEventListener(ev, () => { $("dsAmount").dataset.touched = "1"; $("dsError").hidden = true; updatePreview(); });
});
$("dsUnit").addEventListener("change", () => { $("dsAmount").dataset.touched = "1"; updatePreview(); });

$("dsAdd").addEventListener("click", () => {
  const v = current();
  if (!v) return;
  const err = (msg) => { $("dsError").textContent = msg; $("dsError").hidden = false; };
  const mcg = doseMcg(v);
  const when = parseDT($("dsTime").value);
  const s = status(v);
  const old = editing ? v.logs.find((l) => l.id === editing) : null;
  if (old) s.left += old.mcg;
  if (!(mcg > 0)) return err(t("Indique une quantité positive, par exemple 250.", "Enter a positive amount, for example 250.", "أدخل كمية موجبة، مثل 250."));
  if (!Number.isFinite(when)) return err(t("Indique la date et l'heure de la prise.", "Enter the date and time of the dose.", "أدخل تاريخ الجرعة ووقتها."));
  if (when < parseDay(v.date)) return err(t("Cette date est avant la reconstitution de la fiole.", "This date is before the vial was reconstituted.", "هذا التاريخ قبل تحضير القارورة."));
  if (when > Date.now() + 5 * 60000) return err(t("Cette date est dans le futur.", "This date is in the future.", "هذا التاريخ في المستقبل."));
  if (mcg > s.left + 1e-6) return err(t(`Il ne reste que ${massTxt(s.left)} dans la fiole.`, `Only ${massTxt(s.left)} is left in the vial.`, `لم يتبقَّ في القارورة سوى ${mass(s.left)}.`));
  if (!old && v.logs.length >= 1000) return err(t("Limite de 1000 prises atteinte pour cette fiole.", "Limit of 1000 doses reached for this vial.", "تم بلوغ حد 1000 جرعة لهذه القارورة."));
  const backup = JSON.stringify(v.logs);
  const entry = { t: toDT(when), mcg: Math.round(mcg * 1000) / 1000, site, note: $("dsNote").value.trim().slice(0, 140) };
  if (old) Object.assign(old, entry); else v.logs.push({ id: uid(), ...entry });
  v.logs.sort((a, b) => parseDT(a.t) - parseDT(b.t));
  if (!save()) { v.logs = JSON.parse(backup); return; }
  $("dsError").hidden = true;
  viewAt = Infinity;
  stopPlay();
  if (!old) vial.float(`−${massTxt(mcg)}`);
  endEdit();
  renderStage();
  vial.set(status(v).frac, { splash: old ? 0.6 : 1.2 });
  renderShelf();
  renderPanel();
  toast(old ? t("Prise modifiée", "Dose updated", "تم تعديل الجرعة") : t("Prise ajoutée", "Dose added", "تمت إضافة الجرعة"));
  $("srLive").textContent = $("vialSvg").getAttribute("aria-label");
});

// Modifier une prise : le formulaire se remplit avec ses valeurs, le bouton devient « Enregistrer la modification »
function startEdit(v, l) {
  editing = l.id;
  const mg = l.mcg >= 1000;
  $("dsAmount").value = fmtIn(mg ? l.mcg / 1000 : l.mcg);
  $("dsAmount").dataset.touched = "1";
  setSeg("dsUnit", mg ? "mg" : "mcg");
  $("dsTime").value = l.t;
  $("dsNote").value = l.note || "";
  site = l.site || "";
  $("dsAdd").lastChild.textContent = t("Enregistrer la modification", "Save changes", "حفظ التعديل");
  $("dsCancel").hidden = false;
  $("dosePanel").classList.add("is-editing");
  $("dsError").hidden = true;
  renderSites();
  updatePreview();
  $("dosePanel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  $("dsAmount").focus({ preventScroll: true });
}
function endEdit() {
  if (!editing && $("dsCancel").hidden) { site = ""; $("dsNote").value = ""; $("dsTime").value = toDT(Date.now()); return; }
  editing = null;
  site = "";
  $("dsNote").value = "";
  $("dsTime").value = toDT(Date.now());
  delete $("dsAmount").dataset.touched;
  $("dsAdd").lastChild.textContent = t("Ajouter la prise", "Add the dose", "أضف الجرعة");
  $("dsCancel").hidden = true;
  $("dosePanel").classList.remove("is-editing");
}
$("dsCancel").addEventListener("click", () => { endEdit(); renderPanel(); });

/* Historique, regroupé par semaine depuis la reconstitution */
function renderHistory(v) {
  const box = $("history");
  // Bouton « Imprimer » à côté du titre : l'historique sort seul (voir @media print dans suivi.css)
  if (!$("printHist")) {
    const b = document.createElement("button");
    b.id = "printHist";
    b.type = "button";
    b.className = "link-btn";
    b.textContent = t("Imprimer", "Print", "طباعة");
    b.addEventListener("click", () => window.print());
    document.querySelector(".history h3").append(b);
  }
  $("printHist").hidden = !v.logs.length;
  $("histEmpty").hidden = v.logs.length > 0;
  const start = parseDay(v.date);
  const weeks = new Map();
  [...v.logs].reverse().forEach((l) => {
    const w = weekOf(v, parseDT(l.t));
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(l);
  });
  const conc = v.total / v.water;
  box.replaceChildren(...[...weeks].map(([w, logs]) => {
    const sec = document.createElement("section");
    sec.className = "hist-week";
    const head = document.createElement("div");
    head.className = "hist-week-head";
    const b = document.createElement("b");
    b.textContent = t(`Semaine ${w}`, `Week ${w}`, `الأسبوع ${w}`);
    const from = addDays(start, (w - 1) * 7);
    const span = document.createElement("span");
    span.textContent = `${dayLabel(from)} – ${dayLabel(addDays(from, 6))} · ${doses(logs.length)} · ${mass(logs.reduce((s, l) => s + l.mcg, 0))}`;
    head.append(b, span);
    const ul = document.createElement("ul");
    ul.className = "hist-list";
    logs.forEach((l) => {
      const li = document.createElement("li");
      li.className = "hist-item";
      const when = document.createElement("span");
      when.className = "hist-when";
      const whenTxt = document.createElement("span");
      whenTxt.textContent = fWhen.format(parseDT(l.t));
      when.append(whenTxt);
      if (l.site) { const sm = document.createElement("small"); sm.className = "hist-site"; sm.textContent = siteName(l.site); when.append(sm); }
      if (l.note) { const nt = document.createElement("small"); nt.className = "hist-note"; nt.textContent = l.note; when.append(nt); }
      const amt = document.createElement("span");
      amt.className = "hist-amt";
      const am = document.createElement("b");
      am.textContent = mass(l.mcg);
      const un = document.createElement("span");
      un.textContent = ltr(`${fmt((l.mcg / conc) * 100, 1)} u · ${fmt(l.mcg / conc, 3)} mL`);
      amt.append(am, un);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "link-btn";
      del.textContent = t("Supprimer", "Delete", "حذف");
      del.setAttribute("aria-label", `${t("Supprimer la prise du", "Delete the dose of", "حذف جرعة")} ${whenTxt.textContent}`);
      const ed = document.createElement("button");
      ed.type = "button";
      ed.className = "link-btn";
      ed.textContent = t("Modifier", "Edit", "تعديل");
      ed.setAttribute("aria-label", `${t("Modifier la prise du", "Edit the dose of", "تعديل جرعة")} ${whenTxt.textContent}`);
      ed.addEventListener("click", () => startEdit(v, l));
      const acts = document.createElement("span");
      acts.className = "hist-acts";
      acts.append(ed, del);
      let timer = 0;
      del.addEventListener("click", () => {
        if (!del.classList.contains("is-confirm")) {
          del.classList.add("is-confirm");
          del.textContent = t("Confirmer ?", "Confirm?", "تأكيد؟");
          timer = setTimeout(() => { del.classList.remove("is-confirm"); del.textContent = t("Supprimer", "Delete", "حذف"); }, 3000);
          return;
        }
        clearTimeout(timer);
        if (editing === l.id) endEdit();
        v.logs = v.logs.filter((x) => x.id !== l.id);
        save();
        renderShelf();
        viewAt = Infinity;
        renderStage();
        vial.set(status(v).frac, { splash: 0.8 });
        renderPanel();
        toast(t("Prise supprimée", "Dose deleted", "تم حذف الجرعة"));
      });
      li.append(when, amt, acts);
      ul.append(li);
    });
    sec.append(head, ul);
    return sec;
  }));
}

/* ── Nouvelle fiole, ou modification de la fiole affichée ── */
let editingVial = null;
let nvColor = "shu";
function renderSwatches() {
  $("nvColor").replaceChildren(...PALETTE.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.setProperty("--sw", c[1]);
    b.setAttribute("aria-label", colorName(c));
    b.title = colorName(c);
    b.setAttribute("aria-pressed", String(c[0] === nvColor));
    b.addEventListener("click", () => { nvColor = c[0]; renderSwatches(); });
    return b;
  }));
}
function setFormMode(edit) {
  $("nvTitle").lastChild.textContent = edit ? t("Modifier la fiole", "Edit the vial", "تعديل القارورة") : t("Nouvelle fiole", "New vial", "قارورة جديدة");
  $("nvCreate").textContent = edit ? t("Enregistrer", "Save", "حفظ") : t("Créer la fiole", "Create the vial", "إنشاء القارورة");
  $("nvImportBox").hidden = edit || !saved.length;
}
function showForm(show) {
  $("newVial").hidden = !show;
  $("nvCancel").hidden = !store.vials.length;
  if (!show && editingVial) { editingVial = null; setFormMode(false); }
  renderPanel();
  if (show) {
    $("nvError").hidden = true;
    if (!$("nvDate").value) $("nvDate").value = toDT(Date.now()).slice(0, 10);
    if (!editingVial) {
      // Nouvelle fiole : la première couleur pas encore utilisée sur l'étagère
      const used = new Set(store.vials.map((v) => v.color));
      nvColor = (PALETTE.find((c) => !used.has(c[0])) || PALETTE[store.vials.length % PALETTE.length])[0];
    }
    renderSwatches();
  }
}
$("newVialBtn").addEventListener("click", () => { editingVial = null; setFormMode(false); $("nvBud").value = ""; showForm(true); $("newVial").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); $("nvName").focus({ preventScroll: true }); });
$("nvCancel").addEventListener("click", () => showForm(false));

// Reprendre un flacon enregistré dans « Mes flacons » du calculateur
function readSaved() {
  try { const v = JSON.parse(localStorage.getItem("aurapept-flacons") || "[]"); return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []; } catch (e) { return []; }
}
function fillForm(x) {
  $("nvName").value = (x.n || "").slice(0, 40);
  $("nvTotal").value = x.v || "";
  setSeg("nvTotalUnit", x.vu === "mcg" ? "mcg" : "mg");
  $("nvWater").value = x.w || "";
  $("nvDose").value = x.d || "";
  setSeg("nvDoseUnit", x.du === "mg" ? "mg" : "mcg");
  if (/^\d{4}-\d{2}-\d{2}$/.test(x.date || "")) $("nvDate").value = x.date;
}
const saved = readSaved();
$("nvImportBox").hidden = !saved.length;
saved.forEach((x, i) => {
  const o = document.createElement("option");
  o.value = String(i);
  o.textContent = `${x.n || t("Flacon sans nom", "Unnamed vial", "قارورة بلا اسم")} · ${x.v} ${x.vu} / ${x.w} mL`;
  $("nvImport").append(o);
});
$("nvImport").addEventListener("change", (e) => { if (e.target.value !== "") fillForm(saved[+e.target.value]); });

$("editVial").addEventListener("click", () => {
  const v = current();
  if (!v) return;
  editingVial = v.id;
  const mg = v.total >= 1000;
  fillForm({ n: v.name, v: fmtIn(mg ? v.total / 1000 : v.total), vu: mg ? "mg" : "mcg", w: fmtIn(v.water),
    d: v.dose ? fmtIn(v.doseUnit === "mg" ? v.dose / 1000 : v.dose) : "", du: v.doseUnit, date: v.date });
  $("nvBud").value = v.bud || "";
  nvColor = v.color;
  setFormMode(true);
  showForm(true);
  $("newVial").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  $("nvName").focus({ preventScroll: true });
});

$("nvCreate").addEventListener("click", () => {
  const err = (msg) => { $("nvError").textContent = msg; $("nvError").hidden = false; };
  const bud = $("nvBud").value;
  if (bud && !Number.isFinite(parseDay(bud))) return err(t("La date limite n'est pas valide.", "The use-before date is not valid.", "تاريخ الاستخدام غير صالح."));
  const total = toMcg(parseNum($("nvTotal").value), segValue("nvTotalUnit"));
  const water = parseNum($("nvWater").value);
  const doseRaw = parseNum($("nvDose").value);
  const date = $("nvDate").value;
  if (!(total > 0) || !(water > 0)) return err(t("Indique le contenu de la fiole et l'eau ajoutée avec des nombres positifs, par exemple 20 et 2.", "Enter the vial content and the water added as positive numbers, for example 20 and 2.", "أدخل محتوى القارورة والماء المضاف بأرقام موجبة، مثل 20 و2."));
  if (water > 100) return err(t("Le volume d'eau semble trop grand (100 mL au plus).", "The water volume looks too large (100 mL at most).", "حجم الماء يبدو كبيرًا جدًا (100 mL كحد أقصى)."));
  if (!Number.isFinite(parseDay(date))) return err(t("Indique la date de reconstitution.", "Enter the reconstitution date.", "أدخل تاريخ التحضير."));
  if (parseDay(date) > Date.now()) return err(t("La date de reconstitution est dans le futur.", "The reconstitution date is in the future.", "تاريخ التحضير في المستقبل."));
  if ($("nvDose").value.trim() !== "" && !(doseRaw > 0)) return err(t("La prise habituelle doit être un nombre positif, ou rester vide.", "The usual dose must be a positive number, or stay empty.", "يجب أن تكون الجرعة المعتادة رقمًا موجبًا، أو تُترك فارغة."));
  const fields = {
    name: $("nvName").value.trim().slice(0, 40), total, water, date, color: nvColor, bud: bud || "",
    dose: doseRaw > 0 ? toMcg(doseRaw, segValue("nvDoseUnit")) : 0, doseUnit: segValue("nvDoseUnit"),
  };
  const ed = editingVial ? store.vials.find((x) => x.id === editingVial) : null;
  if (ed) {
    // Modification : les prises déjà notées doivent rester possibles avec les nouveaux réglages
    const used = ed.logs.reduce((n, l) => n + l.mcg, 0);
    if (ed.logs.some((l) => parseDT(l.t) < parseDay(date))) return err(t("Une prise est notée avant cette date de reconstitution.", "A dose is logged before this reconstitution date.", "هناك جرعة مسجّلة قبل تاريخ التحضير هذا."));
    if (total + 1e-6 < used) return err(t(`Le contenu ne peut pas être plus petit que ce qui a déjà été noté (${massTxt(used)}).`, `The content can't be less than what is already logged (${massTxt(used)}).`, `لا يمكن أن يكون المحتوى أقل مما سُجّل بالفعل (${mass(used)}).`));
    const backup = JSON.stringify(ed);
    Object.assign(ed, fields);
    if (!save()) { Object.assign(ed, JSON.parse(backup)); return; }
    ["nvName", "nvTotal", "nvWater", "nvDose", "nvBud"].forEach((id) => ($(id).value = ""));
    editingVial = null;
    setFormMode(false);
    showForm(false);
    renderAll(true);
    toast(t("Fiole modifiée", "Vial updated", "تم تعديل القارورة"));
    $("vialStage").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    return;
  }
  if (store.vials.length >= 20) return err(t("Limite de 20 fioles atteinte : supprime une ancienne fiole.", "Limit of 20 vials reached: delete an old one.", "تم بلوغ حد 20 قارورة: احذف قارورة قديمة."));
  const v = { id: uid(), ...fields, logs: [] };
  store.vials.push(v);
  store.current = v.id;
  if (!save()) { store.vials.pop(); return; }
  ["nvName", "nvTotal", "nvWater", "nvDose", "nvBud"].forEach((id) => ($(id).value = ""));
  $("nvImport").value = "";
  delete $("dsAmount").dataset.touched;
  viewAt = Infinity;
  showForm(false);
  renderAll(true);
  vial.set(1, { splash: 1.5 });
  toast(t("Fiole créée", "Vial created", "تم إنشاء القارورة"));
  $("vialStage").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
});

// Supprimer la fiole affichée (avec confirmation)
let delTimer = 0;
$("delVial").addEventListener("click", () => {
  const b = $("delVial");
  if (!b.classList.contains("is-confirm")) {
    b.classList.add("is-confirm");
    b.lastChild.textContent = t(" Confirmer la suppression ?", " Confirm deletion?", " تأكيد الحذف؟");
    delTimer = setTimeout(resetDel, 3500);
    return;
  }
  clearTimeout(delTimer);
  endEdit();
  store.vials = store.vials.filter((v) => v.id !== store.current);
  store.current = store.vials[0]?.id || null;
  save();
  resetDel();
  viewAt = Infinity;
  renderAll(true);
  if (!store.vials.length) showForm(true);
  toast(t("Fiole supprimée", "Vial deleted", "تم حذف القارورة"));
});
function resetDel() { $("delVial").classList.remove("is-confirm"); $("delVial").lastChild.textContent = t(" Supprimer cette fiole", " Delete this vial", " حذف هذه القارورة"); }

/* ── Sauvegarde : exporter les fioles dans un fichier, et l'importer sur un autre appareil ── */
const vialsTxt = (n) => t(n > 1 ? `${n} fioles` : `${n} fiole`, n === 1 ? "1 vial" : `${n} vials`, arCount(n, ["قارورة واحدة", "قارورتان", "قوارير", "قارورة"]));
$("exportBtn").addEventListener("click", () => {
  if (!store.vials.length) { toast(t("Aucune fiole à exporter pour l'instant", "No vial to export yet", "لا توجد قارورة للتصدير بعد")); return; }
  const data = { app: "aurapept-suivi", version: 1, exported: new Date().toISOString(), vials: store.vials };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `aurapept-fioles-${toDT(Date.now()).slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t(`${vialsTxt(store.vials.length)} exportée${store.vials.length > 1 ? "s" : ""}`, `${vialsTxt(store.vials.length)} exported`, `تم تصدير ${vialsTxt(store.vials.length)}`));
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const bad = () => toast(t("Ce fichier n'est pas une sauvegarde du suivi AURAPEPT", "This file is not an AURAPEPT tracker backup", "هذا الملف ليس نسخة احتياطية من متابعة AURAPEPT"));
  if (file.size > 2e6) return bad();
  let data;
  try { data = JSON.parse(await file.text()); } catch (err) { return bad(); }
  if (!data || data.app !== "aurapept-suivi" || !Array.isArray(data.vials)) return bad();
  const list = data.vials.map(cleanVial).filter(Boolean);
  if (!list.length) return bad();
  const backup = JSON.stringify(store);
  let added = 0, updated = 0, skipped = 0;
  list.forEach((v) => {
    const i = store.vials.findIndex((x) => x.id === v.id);
    if (i >= 0) { store.vials[i] = v; updated++; }
    else if (store.vials.length < 20) { store.vials.push(v); added++; }
    else skipped++;
  });
  store.current = list.find((v) => store.vials.some((x) => x.id === v.id))?.id || store.current;
  if (!save()) { Object.assign(store, JSON.parse(backup)); return; }
  viewAt = Infinity;
  showForm(false);
  renderAll(true);
  vial.set(status(current()).frac, { splash: 1.2 });
  const n = added + updated;
  toast(t(`${vialsTxt(n)} importée${n > 1 ? "s" : ""}${skipped ? ` (${skipped} ignorée${skipped > 1 ? "s" : ""} : limite de 20)` : ""}`,
    `${vialsTxt(n)} imported${skipped ? ` (${skipped} skipped: limit of 20)` : ""}`,
    `تم استيراد ${vialsTxt(n)}${skipped ? ` (تم تجاهل ${skipped}: الحد 20)` : ""}`));
});

function renderAll(instant) {
  if (!current() && store.vials.length) store.current = store.vials[0].id;
  delete $("dsAmount").dataset.touched;
  renderShelf();
  renderStage(instant);
  renderPanel();
}

/* Démarrage : arrivée depuis le calculateur (?n=…&v=…), sinon dernière fiole suivie */
$("dsTime").value = toDT(Date.now());
buildSiteMap();
const q = new URLSearchParams(location.search);
renderAll(true);
if (q.has("v") && q.has("w")) {
  fillForm({ n: q.get("n"), v: (q.get("v") || "").slice(0, 12), vu: q.get("vu"), w: (q.get("w") || "").slice(0, 12), d: (q.get("d") || "").slice(0, 12), du: q.get("du"), date: q.get("date") });
  showForm(true);
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
} else if (!store.vials.length) {
  showForm(true);
}

/* Thème clair / sombre (même réglage que le reste du site) */
const THEMES = ["system", "light", "dark"];
const THEME_UI = {
  system: [t("Thème : automatique", "Theme: automatic", "المظهر: تلقائي"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>'],
  light: [t("Thème : clair", "Theme: light", "المظهر: فاتح"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'],
  dark: [t("Thème : sombre", "Theme: dark", "المظهر: داكن"), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'],
};
function setTheme(mode, saveIt) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme; else root.dataset.theme = mode;
  const [label, icon] = THEME_UI[mode];
  $("themeBtn").innerHTML = icon;
  $("themeBtn").setAttribute("aria-label", `${label}. ${t("Cliquer pour changer.", "Click to change.", "اضغط للتغيير.")}`);
  $("themeBtn").title = label;
  if (saveIt) { try { localStorage.setItem("aurapept-theme", mode); } catch (e) {} }
}
$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "system";
  setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length], true);
});
setTheme(document.documentElement.dataset.theme || "system", false);

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
