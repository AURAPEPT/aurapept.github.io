// Corps humain réaliste de l'atlas.
// Modèles : BodyParts3D, © The Database Center for Life Science, CC BY 4.0 (allégés et réassemblés par zone).
// Repère : mètres, Y vers le haut (pieds à 0), avant du corps vers +z, gauche anatomique vers +x.
import * as THREE from "./vendor/three.module.min.js";
import { CORPS } from "./corps/manifest.js";

const H = CORPS.height;
const J = CORPS.joints; // par côté (droit puis gauche) : épaule, coude, poignet, hanche, genou, cheville
const c = (zone) => CORPS.zones[zone].center;

/* Zones affichables.
   mesh : pièce 3D à allumer ; skin : effet sur la peau ; joints : effet sur les os aux articulations ;
   hidden : invisible tant que la zone n'est pas allumée ; back : visible surtout de dos. */
export const ZONES = {
  cerveau: { label: "Cerveau", mesh: "cerveau", color: "#d8a7a4", anchor: c("cerveau") },
  hypophyse: { label: "Hypophyse", mesh: "hypophyse", color: "#e2a06e", anchor: c("hypophyse") },
  thymus: { label: "Thymus (immunité)", mesh: "thymus", color: "#dcb48e", anchor: c("thymus") },
  poumons: { label: "Poumons", mesh: "poumons", color: "#e6a4a2", anchor: c("poumons") },
  coeur: { label: "Cœur et vaisseaux", mesh: "coeur", color: "#b4262e", anchor: c("coeur") },
  foie: { label: "Foie", mesh: "foie", color: "#8e2f25", anchor: c("foie") },
  estomac: { label: "Estomac", mesh: "estomac", color: "#d88c78", anchor: c("estomac") },
  pancreas: { label: "Pancréas", mesh: "pancreas", color: "#e2b47a", anchor: c("pancreas") },
  intestins: { label: "Intestins", mesh: "intestins", color: "#d6908a", anchor: c("intestins") },
  reins: { label: "Reins", mesh: "reins", color: "#8f3b2f", anchor: c("reins"), back: true },
  reproduction: { label: "Organes reproducteurs", mesh: "reproduction", color: "#c98a8a", anchor: c("reproduction") },
  graisse: { label: "Graisse", skin: "fat", tone: "fat", anchor: [0, H * 0.585, 0.14] },
  muscles: { label: "Muscles", mesh: "muscles", color: "#bd4637", hidden: true, tone: "muscle", anchor: [0.1, H * 0.77, 0.1] },
  os: { label: "Os", mesh: "os", color: "#ebe3cf", hidden: true, anchor: [J[10][0], (J[10][1] + J[9][1]) / 2, J[10][2] + 0.02] },
  articulations: { label: "Tendons et articulations", mesh: "tendons", joints: true, color: "#efe7d6", hidden: true, anchor: J[4] },
  peau: { label: "Peau", skin: "all", anchor: [0.19, H * 0.74, 0.06] },
  "corps-entier": { label: "Tout le corps", all: true, anchor: [0.02, H * 0.42, 0.1] },
};

/* Matériau commun : éclairage doux, transparence sur les bords pour la peau,
   masques pour faire apparaître la graisse et les muscles sur la peau, ou les articulations sur les os. */
const VERT = `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uColor; uniform float uOpacity; uniform float uFresnel;
uniform vec3 uGlowColor; uniform float uGlow;
uniform float uFat; uniform vec3 uFatColor;
uniform float uMuscle; uniform vec3 uMuscleColor;
uniform float uJoint; uniform vec3 uJ[12];
uniform float uAmb; uniform float uDiff; uniform float uSpec; uniform float uShin; uniform float uFiber;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
float seg(vec3 p, vec3 a, vec3 b) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float ell(vec3 p, vec3 c, vec3 r) { return length((p - c) / r); }
void main() {
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vV);
  float rim = pow(1.0 - abs(dot(N, V)), 2.2);
  vec3 L1 = normalize(vec3(0.35, 0.65, 0.9)), L2 = normalize(vec3(-0.7, 0.2, 0.4));
  float diff = max(dot(N, L1), 0.0) * 0.8 + max(dot(N, L2), 0.0) * 0.3;
  vec3 col = uColor * (uAmb + uDiff * diff) + pow(max(dot(N, normalize(L1 + V)), 0.0), uShin) * uSpec;
  // Muscles : bords légèrement éclaircis pour bien détacher chaque muscle de ses voisins
  if (uFiber > 0.0) col += uFiber * 0.1 * pow(1.0 - abs(dot(N, V)), 3.0);
  float a = uOpacity * mix(1.0, clamp(0.1 + rim * 1.25, 0.0, 1.0), uFresnel);

  float H = ${H.toFixed(4)};
  if (uFat > 0.0) {
    float f = 1.0 - smoothstep(0.55, 1.0, ell(vP, vec3(0.0, H * 0.585, 0.03), vec3(0.2, 0.15, 0.19)));
    f = max(f, 1.0 - smoothstep(0.5, 1.0, ell(vP, vec3(0.105, H * 0.47, 0.0), vec3(0.115, 0.15, 0.115))));
    f = max(f, 1.0 - smoothstep(0.5, 1.0, ell(vP, vec3(-0.105, H * 0.47, 0.0), vec3(0.115, 0.15, 0.115))));
    f *= uFat;
    col = mix(col, uFatColor * (0.75 + 0.45 * diff), f * 0.9);
    a = max(a, f * 0.88);
  }
  if (uMuscle > 0.0) {
    float d = min(min(seg(vP, uJ[0], uJ[1]), seg(vP, uJ[1], uJ[2])), min(seg(vP, uJ[6], uJ[7]), seg(vP, uJ[7], uJ[8])));
    float dl = min(min(seg(vP, uJ[3], uJ[4]), seg(vP, uJ[4], uJ[5])), min(seg(vP, uJ[9], uJ[10]), seg(vP, uJ[10], uJ[11])));
    float m = max(1.0 - smoothstep(0.045, 0.075, d), 1.0 - smoothstep(0.07, 0.11, dl));
    m = max(m, 1.0 - smoothstep(0.6, 1.0, ell(vP, vec3(0.0, H * 0.77, 0.06), vec3(0.17, 0.08, 0.12))));
    m *= uMuscle;
    col = mix(col, uMuscleColor * (0.7 + 0.5 * diff), m * 0.85);
    a = max(a, m * 0.8);
  }
  if (uJoint > 0.0) {
    float d = 1e3;
    for (int i = 0; i < 12; i++) d = min(d, distance(vP, uJ[i]));
    float j = (1.0 - smoothstep(0.03, 0.07, d)) * uJoint;
    col = mix(col, uGlowColor, j);
    a = max(a, j);
  }
  col = mix(col, uGlowColor, uGlow * (0.18 + 0.55 * rim));
  a = max(a, uGlow * (0.55 + 0.45 * rim));
  gl_FragColor = vec4(col, a);
}`;

function material(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uFresnel: { value: 0 },
      uGlowColor: { value: new THREE.Color() }, uGlow: { value: 0 },
      uFat: { value: 0 }, uFatColor: { value: new THREE.Color() },
      uMuscle: { value: 0 }, uMuscleColor: { value: new THREE.Color() },
      uJoint: { value: 0 }, uJ: { value: J.map((p) => new THREE.Vector3(...p)) },
      uAmb: { value: 0.42 }, uDiff: { value: 0.7 }, uSpec: { value: 0.18 }, uShin: { value: 36 }, uFiber: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true,
  });
}

function decode(buf, zone) {
  const z = CORPS.zones[zone];
  const { min, max } = CORPS.bbox;
  const q = new Int16Array(buf, z.pos[0], z.pos[1] * 3);
  const pos = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) {
    const k = i % 3;
    pos[i] = min[k] + ((q[i] + 32767) / 65534) * (max[k] - min[k]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const I = z.idx[2] === 32 ? new Uint32Array(buf, z.idx[0], z.idx[1]) : new Uint16Array(buf, z.idx[0], z.idx[1]);
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeVertexNormals();
  return g;
}

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, f) => cs.getPropertyValue(n).trim() || f;
  return { skin: get("--skin", "#d9b39a"), hot: get("--shu", "#c23a22"), fat: get("--fat", "#e0952a"), muscle: get("--muscle", "#c0392b"), ring: get("--line-strong", "#cfc2ab"), skinAlpha: parseFloat(get("--skin-alpha", "0.55")) };
}

// Cadrage automatique : demi-hauteur de chaque zone autour de son étiquette, et zones qui couvrent tout le corps
const EXT = { graisse: 0.3, intestins: 0.12, poumons: 0.12, cerveau: 0.1, coeur: 0.1 };
const WIDE = new Set(["peau", "corps-entier", "muscles", "os", "articulations"]);

const DETAIL = ["os", "muscles", "tendons"]; // pièces lourdes, chargées après la base
const HIDDEN_PARTS = new Set(DETAIL);

export function createBody(canvas, labelsEl, { onPick, onReady, onLoading } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  const pivot = new THREE.Group();
  pivot.position.y = H / 2;
  const body = new THREE.Group();
  body.position.y = -H / 2;
  pivot.add(body);
  scene.add(pivot);

  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
  [0.24, 0.34].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + (i ? 0.003 : 0.005), 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    body.add(ring);
  });

  const parts = {}; // pièce 3D -> { mesh, mat }
  let pickables = [];
  let ready = false;
  let active = new Set();
  let colors = readColors();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Chargement : la base (peau + organes) d'abord, puis le squelette, les muscles et les tendons */
  const files = {};
  function loadFile(fname) {
    return (files[fname] ||= fetch(new URL(`./corps/${CORPS.files[fname].url}`, import.meta.url))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((buf) => addParts(fname, buf)));
  }
  function addParts(fname, buf) {
    const order = { os: 1, muscles: 1, tendons: 1, peau: 3 };
    for (const [zone, z] of Object.entries(CORPS.zones)) {
      if (z.file !== fname || parts[zone]) continue;
      const meta = Object.values(ZONES).find((m) => m.mesh === zone);
      const mat = material(zone === "peau" ? colors.skin : meta?.color || "#cccccc");
      const mesh = new THREE.Mesh(decode(buf, zone), mat);
      mesh.renderOrder = order[zone] ?? 2;
      mesh.userData.zone = zone;
      if (zone === "peau") { mat.depthWrite = false; mat.uniforms.uFresnel.value = 1; }
      if (HIDDEN_PARTS.has(zone)) { mesh.visible = false; mat.uniforms.uOpacity.value = 0; }
      // Éclairage propre à chaque tissu : muscles brillants et striés, os mats et clairs
      const LOOK = {
        muscles: { uAmb: 0.36, uDiff: 1.05, uSpec: 0.32, uShin: 22, uFiber: 1 },
        os: { uAmb: 0.5, uDiff: 0.62, uSpec: 0.26, uShin: 40 },
        tendons: { uAmb: 0.55, uDiff: 0.6, uSpec: 0.45, uShin: 30 },
        intestins: { uAmb: 0.4, uDiff: 0.85, uSpec: 0.3, uShin: 26 },
      }[zone];
      if (LOOK) Object.entries(LOOK).forEach(([k, val]) => (mat.uniforms[k].value = val));
      body.add(mesh);
      parts[zone] = { mesh, mat, level: 0 };
    }
    pickables = Object.entries(parts).filter(([z]) => z !== "peau" && !HIDDEN_PARTS.has(z)).map(([, p]) => p.mesh);
    applyColors();
    wake();
  }
  loadFile("base")
    .then(() => {
      ready = true;
      onReady?.(true);
      const later = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
      later(() => DETAIL.forEach((f) => loadFile(f).catch(() => {})));
    })
    .catch(() => onReady?.(false));

  // Si une zone allumée a besoin d'une pièce pas encore chargée, on l'indique et on la charge tout de suite
  function ensureParts(ids) {
    const need = new Set();
    ids.forEach((id) => {
      const z = ZONES[id];
      if (z?.mesh && CORPS.zones[z.mesh]) need.add(z.mesh);
      if (z?.joints) need.add("os");
    });
    const missing = [...need].filter((p) => !parts[p]);
    if (!missing.length) { onLoading?.(null); return; }
    onLoading?.(missing[0]); // pièce en cours de chargement ; le texte affiché est choisi par la page
    Promise.all(missing.map((p) => loadFile(CORPS.zones[p].file)))
      .then(() => { if ([...need].every((p) => parts[p])) onLoading?.(null); })
      .catch(() => onLoading?.(null));
  }

  function applyColors() {
    colors = readColors();
    ringMat.color.set(colors.ring);
    if (!parts.peau) return;
    parts.peau.mat.uniforms.uColor.value.set(colors.skin);
    for (const p of Object.values(parts)) {
      p.mat.uniforms.uGlowColor.value.set(colors.hot);
      p.mat.uniforms.uFatColor.value.set(colors.fat);
      p.mat.uniforms.uMuscleColor.value.set(colors.muscle);
    }
    wake();
  }
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyColors);

  function highlight(ids) {
    active = new Set(ids.filter((id) => ZONES[id]));
    if (ready) ensureParts([...active]);
    renderLabels();
    if (active.size) {
      const allBack = [...active].every((id) => ZONES[id].back);
      const want = allBack ? Math.PI : 0;
      target.yaw = want + Math.round((target.yaw - want) / (2 * Math.PI)) * 2 * Math.PI;
      autoRotate = false;
    }
    frameZones();
    wake();
  }

  // La caméra cadre les zones allumées : zoom sur la tête pour le cerveau, sur le ventre pour les intestins…
  function frameZones() {
    const ids = [...active];
    if (!ids.length || ids.some((id) => WIDE.has(id))) {
      target.fy = H / 2;
      target.zoom = 1;
      return;
    }
    let lo = Infinity, hi = -Infinity;
    for (const id of ids) {
      const y = ZONES[id].anchor[1], e = EXT[id] ?? 0.08;
      lo = Math.min(lo, y - e);
      hi = Math.max(hi, y + e);
    }
    target.zoom = clamp((H + 0.2) / (hi - lo + 0.3), 1, 2.3);
    target.fy = clamp((lo + hi) / 2, H / 2 - 0.55, H / 2 + 0.55);
  }

  /* Étiquettes HTML */
  let labelNodes = [];
  function renderLabels() {
    labelsEl.replaceChildren();
    labelNodes = [...active].map((id) => {
      const el = document.createElement("span");
      el.className = "zl" + (ZONES[id].tone === "fat" ? " zl-fat" : "");
      el.textContent = ZONES[id].label;
      labelsEl.appendChild(el);
      return { id, el };
    });
  }
  const tmp = new THREE.Vector3();
  // Place les étiquettes sur leurs zones, en les écartant si elles se chevauchent
  // et en les passant à gauche si elles touchent le bord droit (boutons de zoom)
  const LINE = 22;
  function placeLabels(w, h) {
    const pts = labelNodes.map((n) => {
      tmp.set(...ZONES[n.id].anchor);
      body.localToWorld(tmp);
      tmp.project(camera);
      n.w ||= n.el.offsetWidth;
      return { n, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
    }).sort((a, b) => a.y - b.y);
    const lastY = { left: -1e9, right: -1e9 };
    for (const p of pts) {
      const left = p.x + p.n.w > w - 64;
      const side = left ? "left" : "right";
      p.y = Math.max(p.y, lastY[side] + LINE);
      lastY[side] = p.y;
      p.n.el.classList.toggle("zl-left", left);
      const x = left ? p.x - p.n.w + 12 : p.x;
      p.n.el.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }

  /* Caméra et contrôles */
  const target = { yaw: 0, pitch: 0.04, zoom: 1, fy: H / 2 };
  const cur = { yaw: 0.7, pitch: 0.04, zoom: 1, fy: H / 2 };
  let autoRotate = !reduceMotion;
  let size = { w: 1, h: 1 };
  function resize() {
    const r = canvas.getBoundingClientRect();
    size = { w: Math.max(r.width, 1), h: Math.max(r.height, 1) };
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    wake();
  }
  new ResizeObserver(resize).observe(canvas);

  const pointers = new Map();
  let down = null, pinchStart = 0, zoomStart = 1;
  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      zoomStart = target.zoom;
    }
    autoRotate = false;
    canvas.setPointerCapture?.(e.pointerId);
    wake();
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (pinchStart > 0) target.zoom = clamp(zoomStart * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart), 0.75, 2.6);
    } else {
      target.yaw += dx * 0.011;
      target.pitch = clamp(target.pitch + dy * 0.004, -0.25, 0.35);
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    wake();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (down && !down.moved && pointers.size === 0 && e.type === "pointerup") pick(e);
    if (pointers.size === 0) down = null;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("dblclick", () => resetView());

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    if (!ready) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const part = hit?.object.userData.zone;
    onPick?.(part ? Object.keys(ZONES).find((id) => ZONES[id].mesh === part) : null);
  }

  function resetView() {
    target.pitch = 0.04;
    target.zoom = 1;
    target.fy = H / 2;
    target.yaw = Math.round(target.yaw / (2 * Math.PI)) * 2 * Math.PI;
    wake();
  }
  function zoomBy(f) {
    target.zoom = clamp(target.zoom * f, 0.75, 2.6);
    wake();
  }

  /* Boucle d'animation : s'arrête quand rien ne bouge ou quand le corps est hors écran */
  let raf = 0, visible = true, last = performance.now();
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  function wake() {
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (autoRotate) target.yaw += dt * 0.32;
    const k = 1 - Math.pow(0.0015, dt);
    cur.yaw += (target.yaw - cur.yaw) * k;
    cur.pitch += (target.pitch - cur.pitch) * k;
    cur.zoom += (target.zoom - cur.zoom) * k;
    cur.fy += (target.fy - cur.fy) * k;
    pivot.rotation.set(cur.pitch, cur.yaw, 0);
    const fit = ((H / 2 + 0.1) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * Math.max(1, 0.5 / camera.aspect);
    camera.position.set(0, cur.fy, fit / cur.zoom);
    camera.lookAt(0, cur.fy, 0);

    let moving = autoRotate || Math.abs(target.yaw - cur.yaw) > 1e-3 || Math.abs(target.pitch - cur.pitch) > 1e-3 || Math.abs(target.zoom - cur.zoom) > 1e-3 || Math.abs(target.fy - cur.fy) > 1e-4;
    if (ready) moving = updateMaterials(now, dt) || moving;
    renderer.render(scene, camera);
    placeLabels(size.w, size.h);
    if (moving && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function updateMaterials(now, dt) {
    const pulse = reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(now / 420);
    const all = active.has("corps-entier");
    const anyOn = active.size > 0;
    const on = (zone) => (all && !HIDDEN_PARTS.has(zone)) || [...active].some((id) => ZONES[id].mesh === zone);
    const skinOn = all || active.has("peau");
    const deep = active.has("muscles") || active.has("os") || active.has("articulations");
    const ease = 1 - Math.pow(0.002, dt);
    // Les muscles couvrent presque tout le corps : s'ils s'allument avec d'autres zones, on les rend plus discrets
    const muscleMax = active.has("muscles") && active.size > 1 ? 0.38 : 1;
    let moving = false;
    for (const [zone, p] of Object.entries(parts)) {
      const u = p.mat.uniforms;
      if (zone === "peau") {
        // La peau s'efface quand on montre les muscles, les os ou les tendons
        u.uOpacity.value = colors.skinAlpha * (anyOn ? 0.85 : 1) * (deep ? 0.45 : 1);
        u.uGlow.value = skinOn ? 0.6 * pulse : 0;
        u.uFat.value += ((active.has("graisse") ? pulse : 0) - u.uFat.value) * ease;
        moving ||= u.uFat.value > 0.002;
        continue;
      }
      const lit = on(zone);
      const goal = lit ? 1 : 0;
      p.level += (goal - p.level) * ease;
      if (Math.abs(goal - p.level) > 0.002) moving = true;
      const hidden = HIDDEN_PARTS.has(zone);
      const jointsOn = zone === "os" && active.has("articulations");
      const rest = hidden ? (jointsOn ? 0.3 : 0) : anyOn ? 0.16 : 0.62;
      const top = zone === "muscles" ? muscleMax : 1;
      u.uOpacity.value = rest + (top - rest) * p.level;
      // Muscles et os gardent leurs vraies couleurs : lueur légère seulement
      u.uGlow.value = p.level * (hidden ? 0.12 : 0.55) * pulse;
      u.uJoint.value += ((jointsOn ? pulse : 0) - u.uJoint.value) * ease;
      if (u.uJoint.value > 0.002) moving = true;
      p.mesh.visible = u.uOpacity.value > 0.004 || u.uJoint.value > 0.004;
      p.mat.depthWrite = u.uOpacity.value > 0.5;
    }
    return moving || (anyOn && !reduceMotion);
  }

  resize();
  wake();
  return { highlight, resetView, zoomBy };
}

function clamp(x, a, b) {
  return Math.min(Math.max(x, a), b);
}
