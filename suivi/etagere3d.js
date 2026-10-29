// Étagère en 3D : toutes les fioles posées sur une planche de bois clair (hinoki), avec la même fiole réaliste
// que fiole3d.js (verre, liquide, capsule de couleur, bouchon). Chaque fiole a un bouton HTML (nom, reste) posé sous elle.
import * as THREE from "../peptides/vendor/three.module.min.js";
import { OUTER, INNER, LIQUID, CRIMP, CAP, STOPPER, Y_EMPTY, Y_FULL, VERT, GLASS_FRAG, LIQ_FRAG, SURF_FRAG, createStudio } from "./fiole3d.js";

const SPACING = 2.45;   // écart entre deux fioles
const VIAL_H = 4.0;     // fiole soulevée + planche, en unités 3D (les étiquettes s'ajoutent en pixels)
const TAG_PX = 86;      // place réservée sous chaque planche pour l'étiquette en papier
const PLANK = { t: 0.24, d: 2.5 };

// Ombre d'une fiole sur la planche (douce, plus marquée au contact)
const SHADOW_FRAG = /* glsl */ `
  uniform vec2 center; uniform float strength;
  varying vec3 vN; varying vec3 vW;
  void main() {
    float r = length((vW.xz - center) * vec2(1.0, 1.25));
    float a = (1.0 - smoothstep(0.7, 1.45, r)) * 0.28 + (1.0 - smoothstep(0.86, 1.04, r)) * 0.3;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * strength);
  }`;

// Veinage du bois, dessiné une fois dans une petite texture
function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#d9b98f"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * c.height, amp = 2 + Math.random() * 6, len = 0.004 + Math.random() * 0.01;
    g.strokeStyle = `rgba(${120 + Math.random() * 40}, ${80 + Math.random() * 30}, ${45 + Math.random() * 20}, ${0.08 + Math.random() * 0.14})`;
    g.lineWidth = 0.6 + Math.random() * 1.8;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 8) g.lineTo(x, y + Math.sin(x * len + i) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function createShelf3D(canvas, labelsEl, { reduceMotion = false, onPick } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(16, 1, 0.5, 200);
  const { cubeRT, buildEnv } = createStudio(renderer, scene);
  const key = new THREE.DirectionalLight("#fff4e8", 1.6);
  key.position.set(-5, 9, 7);
  scene.add(key, new THREE.AmbientLight("#ffffff", 0.35));

  // Géométries et matériaux partagés par toutes les fioles
  const SEG = 72;
  const lathe = (pts) => new THREE.LatheGeometry(pts, SEG);
  const G = { outer: lathe(OUTER), inner: lathe(INNER), liq: lathe(LIQUID), crimp: lathe(CRIMP), cap: lathe(CAP), stopper: lathe(STOPPER), disc: new THREE.CircleGeometry(1.5, 72) };
  const shaderMat = (frag, uniforms, side) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, side, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: { envMap: { value: cubeRT.texture }, ...uniforms },
  });
  const glassU = { tint: { value: new THREE.Color("#7f97a6") }, absorb: { value: 0.32 }, gain: { value: 1 } };
  const liqTint = { value: new THREE.Color("#a8c6e6") }, liqDeep = { value: new THREE.Color("#4b74a6") }, liqDensity = { value: 1 };
  const M = {
    outerBack: shaderMat(GLASS_FRAG, glassU, THREE.BackSide), innerFront: shaderMat(GLASS_FRAG, glassU, THREE.FrontSide),
    innerBack: shaderMat(GLASS_FRAG, glassU, THREE.BackSide), outerFront: shaderMat(GLASS_FRAG, glassU, THREE.FrontSide),
    metal: new THREE.MeshStandardMaterial({ color: "#d9dce1", metalness: 1, roughness: 0.27 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#4e5157", roughness: 0.88 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.58, metalness: 0 }),
    bracket: new THREE.MeshStandardMaterial({ color: "#2b2b2e", metalness: 0.6, roughness: 0.45 }),
  };
  M.wood.map.repeat.set(1, 1);

  const world = new THREE.Group();
  scene.add(world);
  let vials = [];      // { id, group, lift, liftT, liq, surf, surfU, frac, x, y }
  let cols = 3, rows = 1, rowH = 5.1;

  function clear() {
    world.children.slice().forEach((o) => {
      world.remove(o);
      o.traverse((m) => { if (m.material && m.userData.own) m.material.dispose(); if (m.geometry && m.userData.ownGeo) m.geometry.dispose(); });
    });
    vials = [];
  }

  function buildVial(item, x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    const liqU = { P0: { value: new THREE.Vector3() }, Nrm: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, ripple: { value: 0 }, tint: liqTint, deep: liqDeep, density: liqDensity };
    const liqMat = shaderMat(LIQ_FRAG, liqU, THREE.FrontSide);
    const surfU = { toLocal: { value: new THREE.Matrix4() }, Nrm: liqU.Nrm, tint: liqTint, density: liqDensity };
    const surfMat = shaderMat(SURF_FRAG, surfU, THREE.DoubleSide);
    const capMat = new THREE.MeshPhysicalMaterial({ color: item.color, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.22 });
    const parts = [[G.outer, M.outerBack, 1], [G.inner, M.innerFront, 2], [G.liq, liqMat, 4], [G.inner, M.innerBack, 5], [G.outer, M.outerFront, 6]];
    let liq;
    parts.forEach(([g, m, order]) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = order;
      if (m === liqMat) { liq = mesh; mesh.userData.own = true; }
      group.add(mesh);
    });
    const cap = new THREE.Mesh(G.cap, capMat);
    cap.userData.own = true;
    group.add(new THREE.Mesh(G.crimp, M.metal), cap, new THREE.Mesh(G.stopper, M.rubber));
    const surf = new THREE.Mesh(G.disc, surfMat);
    surf.renderOrder = 3;
    surf.userData.own = true;
    world.add(group, surf);
    // ombre sur la planche
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
      uniforms: { center: { value: new THREE.Vector2(x, 0) }, strength: { value: 1 } },
    }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(x, y + 0.004, 0);
    sh.renderOrder = 0;
    sh.userData.own = sh.userData.ownGeo = true;
    world.add(sh);
    return { id: item.id, group, liq, surf, surfU, liqU, shadow: sh, frac: item.frac, x, y, lift: item.selected ? 1 : 0, liftT: item.selected ? 1 : 0 };
  }

  function buildShelf(y, width) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, PLANK.t, PLANK.d), M.wood);
    plank.position.set(0, y - PLANK.t / 2, 0);
    plank.userData.ownGeo = true;
    world.add(plank);
    // deux équerres métalliques sous la planche
    [-1, 1].forEach((side) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), M.bracket);
      b.position.set(side * (width / 2 - 0.9), y - PLANK.t - 0.45, -PLANK.d / 2 + 0.2);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, PLANK.d - 0.4), M.bracket);
      arm.position.set(side * (width / 2 - 0.9), y - PLANK.t - 0.05, 0);
      b.userData.ownGeo = arm.userData.ownGeo = true;
      world.add(b, arm);
    });
  }

  // Placement : la fiole sélectionnée se soulève un peu ; le liquide reste à son niveau dans la fiole
  function place() {
    vials.forEach((v) => {
      v.group.position.y = v.y + v.lift * 0.22;
      v.group.updateMatrixWorld();
      const p0 = new THREE.Vector3(0, Y_EMPTY + v.frac * (Y_FULL - Y_EMPTY), 0).applyMatrix4(v.group.matrixWorld);
      v.liqU.P0.value.copy(p0);
      v.surf.position.copy(p0);
      v.surf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
      v.surfU.toLocal.value.copy(v.group.matrixWorld).invert();
      v.liq.visible = v.surf.visible = v.frac > 0.004;
      v.shadow.material.uniforms.strength.value = 1 - v.lift * 0.35;
    });
  }

  // Étiquettes HTML (boutons) sous chaque fiole, sur le chant de la planche
  const proj = new THREE.Vector3();
  function placeLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    [...labelsEl.children].forEach((el) => {
      const v = vials.find((x) => x.id === el.dataset.id);
      if (!v) return;
      proj.set(v.x, v.y - PLANK.t - 0.15, PLANK.d / 2).project(camera);
      el.style.left = `${((proj.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - proj.y) / 2) * h}px`;
      el.style.width = `${Math.max(70, (w / (cols * SPACING + 0.7)) * SPACING * 0.93)}px`; // un peu moins que l'écart entre deux fioles
    });
  }

  function frameCamera() {
    const w = canvas.clientWidth;
    if (!w) return;
    // limites du contenu : haut des capsules (fiole soulevée) et bas des étiquettes du dernier rayon
    const top = 3.85, bottom = -(rows - 1) * rowH - (rowH - VIAL_H) - 0.2;
    const worldW = cols * SPACING + 0.7, worldH = top - bottom;
    const h = Math.round(w * (worldH / worldW));
    canvas.style.height = `${h}px`;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.max((worldH / 2) / Math.tan(vFov / 2), (worldW / 2) / (Math.tan(vFov / 2) * camera.aspect)) * 1.04;
    const cy = (top + bottom) / 2;
    camera.position.set(0, cy + dist * 0.08, dist);
    camera.lookAt(0, cy, 0);
  }

  let raf = 0;
  function render() {
    raf = 0;
    let moving = false;
    vials.forEach((v) => {
      const d = v.liftT - v.lift;
      if (Math.abs(d) > 0.002) { v.lift += reduceMotion ? d : d * 0.22; moving = true; } else v.lift = v.liftT;
    });
    place();
    renderer.render(scene, camera);
    placeLabels();
    if (moving) raf = requestAnimationFrame(render);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(render); };

  // Thème clair / sombre : même studio que la grande fiole
  let dark = null;
  function applyTheme() {
    const isDark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    if (isDark === dark) return;
    dark = isDark;
    buildEnv(dark);
    liqTint.value.set(dark ? "#9cc0ee" : "#a8c6e6");
    liqDeep.value.set(dark ? "#4a78b8" : "#4b74a6");
    glassU.gain.value = dark ? 0.75 : 1;
    M.wood.color.set(dark ? "#b9a389" : "#ffffff");
    wake();
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

  // Toucher une fiole dans le dessin : on retrouve la plus proche du doigt
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    let best = null, bestD = Infinity;
    vials.forEach((v) => {
      proj.set(v.x, v.y + 1.7, 0).project(camera);
      const dx = ((proj.x + 1) / 2) * r.width - (e.clientX - r.left), dy = ((1 - proj.y) / 2) * r.height - (e.clientY - r.top);
      const d = Math.hypot(dx, dy * 0.45);
      if (d < bestD) { bestD = d; best = v; }
    });
    if (best && bestD < (r.width / cols) * 0.6) onPick?.(best.id);
  });

  // Nombre d'emplacements par rayon selon la largeur (3 à 6), comme une vraie étagère avec de la place libre
  const slots = (w) => Math.max(3, Math.min(6, Math.floor(w / 175)));
  let items = [];
  function rebuild() {
    clear();
    const w = canvas.clientWidth || 600;
    cols = slots(w);
    rows = Math.max(1, Math.ceil(items.length / cols));
    // hauteur d'un rayon : la fiole et la planche, plus la place de l'étiquette (en pixels, convertis en unités 3D)
    rowH = VIAL_H + TAG_PX / (w / (cols * SPACING + 0.7));
    const width = cols * SPACING + 0.5;
    for (let r = 0; r < rows; r++) buildShelf(-r * rowH, width);
    vials = items.map((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, items.length - r * cols);   // fioles centrées sur la planche
      const rtl = document.documentElement.dir === "rtl" ? -1 : 1; // en arabe, la première fiole est à droite
      return buildVial(it, rtl * (c - (inRow - 1) / 2) * SPACING, -r * rowH);
    });
    frameCamera();
    wake();
  }
  new ResizeObserver(() => {
    const w = canvas.clientWidth;
    rebuild();
  }).observe(canvas.parentElement);

  applyTheme();
  return {
    // items : [{ id, color, frac, selected }] ; les boutons d'étiquette sont fournis par la page (data-id)
    update(next) {
      const sameLayout = next.length === items.length && next.every((it, i) => it.id === items[i].id && it.color === items[i].color);
      items = next;
      if (!sameLayout) { rebuild(); return; }
      vials.forEach((v, i) => { v.frac = items[i].frac; v.liftT = items[i].selected ? 1 : 0; });
      wake();
    },
  };
}
