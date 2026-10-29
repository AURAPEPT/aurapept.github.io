// Étagère en 3D : toutes les fioles alignées sur des étagères en verre, dans une vitrine bleu nuit.
// Mêmes fioles réalistes que fiole3d.js (verre, liquide teinté, capsule dorée, graduations).
// Sous chaque fiole, un bouton HTML (nom, jours restants) fourni par la page.
import * as THREE from "../peptides/vendor/three.module.min.js";
import {
  OUTER, INNER, LIQUID, CRIMP, CAP, STOPPER, Y_EMPTY, Y_FULL, VERT, GLASS_FRAG, LIQ_FRAG, SURF_FRAG,
  createStudio, liquidLook, goldMaterials, addGraduations,
} from "./fiole3d.js";

const SPACING = 2.3;    // écart entre deux fioles
const VIAL_H = 3.95;    // fiole soulevée + étagère, en unités 3D (les étiquettes s'ajoutent en pixels)
const TAG_PX = 58;      // place réservée sous chaque étagère pour le nom et les jours restants
const SHELF = { t: 0.07, d: 2.4 };

// Reflet doux de la fiole sur l'étagère en verre (halo clair sous le fond, ombre de contact)
const POOL_FRAG = /* glsl */ `
  uniform vec2 center; uniform vec3 glow; uniform float lift;
  varying vec3 vN; varying vec3 vW;
  void main() {
    float r = length((vW.xz - center) * vec2(1.0, 1.35));
    float halo = (1.0 - smoothstep(0.6, 1.5, r)) * 0.32 * (1.0 - lift * 0.5);
    float contact = (1.0 - smoothstep(0.82, 1.0, r)) * 0.35 * (1.0 - lift);
    gl_FragColor = vec4(glow * halo, contact * 0.6 + halo * 0.15);
  }`;

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
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(16, 1, 0.5, 300);
  // Vitrine sombre : on utilise toujours le studio « sombre », le verre ressort sur le bleu nuit
  const { cubeRT, buildEnv } = createStudio(renderer, scene);
  buildEnv(true);
  const key = new THREE.DirectionalLight("#fff1dc", 2.2);
  key.position.set(-4, 9, 8);
  scene.add(key, new THREE.AmbientLight("#9fb3d9", 0.45));

  // Géométries et matériaux partagés
  const lathe = (pts) => new THREE.LatheGeometry(pts, 72);
  const G = { outer: lathe(OUTER), inner: lathe(INNER), liq: lathe(LIQUID), crimp: lathe(CRIMP), cap: lathe(CAP), stopper: lathe(STOPPER), disc: new THREE.CircleGeometry(1.5, 72) };
  const shaderMat = (frag, uniforms, side) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, side, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: { envMap: { value: cubeRT.texture }, ...uniforms },
  });
  const glassU = { tint: { value: new THREE.Color("#8fa6b8") }, absorb: { value: 0.3 }, gain: { value: 0.85 } };
  const gold = goldMaterials();
  const M = {
    outerBack: shaderMat(GLASS_FRAG, glassU, THREE.BackSide), innerFront: shaderMat(GLASS_FRAG, glassU, THREE.FrontSide),
    innerBack: shaderMat(GLASS_FRAG, glassU, THREE.BackSide), outerFront: shaderMat(GLASS_FRAG, glassU, THREE.FrontSide),
    rubber: new THREE.MeshStandardMaterial({ color: "#4e5157", roughness: 0.88 }),
    // étagère en verre : plateau à peine visible, chant avant lumineux
    plate: shaderMat(GLASS_FRAG, { tint: { value: new THREE.Color("#a9c4e8") }, absorb: { value: 0.9 }, gain: { value: 0.7 } }, THREE.DoubleSide),
    edge: new THREE.MeshBasicMaterial({ color: "#cfe0ff", transparent: true, opacity: 0.55, depthWrite: false }),
  };

  const world = new THREE.Group();
  scene.add(world);
  let vials = [];
  let cols = 4, rows = 1, rowH = 5;

  function clear() {
    world.children.slice().forEach((o) => {
      world.remove(o);
      o.traverse((m) => { if (m.userData.own) m.material.dispose(); if (m.userData.ownGeo) m.geometry.dispose(); });
    });
    vials = [];
  }

  function buildVial(item, x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    const look = liquidLook(item.color, true);
    const liqU = {
      P0: { value: new THREE.Vector3() }, Nrm: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, ripple: { value: 0 },
      tint: { value: look.tint }, deep: { value: look.deep }, density: { value: look.density },
    };
    const liqMat = shaderMat(LIQ_FRAG, liqU, THREE.FrontSide);
    const surfU = { toLocal: { value: new THREE.Matrix4() }, Nrm: liqU.Nrm, tint: liqU.tint, density: liqU.density };
    const surfMat = shaderMat(SURF_FRAG, surfU, THREE.DoubleSide);
    let liq;
    [[G.outer, M.outerBack, 1], [G.inner, M.innerFront, 2], [G.liq, liqMat, 4], [G.inner, M.innerBack, 5], [G.outer, M.outerFront, 6]].forEach(([g, m, order]) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = order;
      if (m === liqMat) { liq = mesh; mesh.userData.own = true; }
      group.add(mesh);
    });
    group.add(new THREE.Mesh(G.crimp, gold.crimp), new THREE.Mesh(G.cap, gold.cap), new THREE.Mesh(G.stopper, M.rubber));
    addGraduations(group);
    const surf = new THREE.Mesh(G.disc, surfMat);
    surf.renderOrder = 3;
    surf.userData.own = true;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
      uniforms: { center: { value: new THREE.Vector2(x, 0) }, glow: { value: look.tint.clone().lerp(new THREE.Color("#ffffff"), 0.4) }, lift: { value: 0 } },
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, y + 0.004, 0);
    pool.renderOrder = 0;
    pool.userData.own = pool.userData.ownGeo = true;
    world.add(group, surf, pool);
    return { id: item.id, group, liq, surf, surfU, liqU, pool, frac: item.frac, x, y, lift: item.selected ? 1 : 0, liftT: item.selected ? 1 : 0 };
  }

  function buildShelf(y, width) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(width, SHELF.t, SHELF.d), M.plate);
    plate.position.set(0, y - SHELF.t / 2, 0);
    plate.renderOrder = 0;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, 0.02), M.edge);
    edge.position.set(0, y - 0.015, SHELF.d / 2);
    edge.renderOrder = 8;
    plate.userData.ownGeo = edge.userData.ownGeo = true;
    world.add(plate, edge);
  }

  function place() {
    vials.forEach((v) => {
      v.group.position.y = v.y + v.lift * 0.2;
      v.group.updateMatrixWorld();
      const p0 = new THREE.Vector3(0, Y_EMPTY + v.frac * (Y_FULL - Y_EMPTY), 0).applyMatrix4(v.group.matrixWorld);
      v.liqU.P0.value.copy(p0);
      v.surf.position.copy(p0);
      v.surf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
      v.surfU.toLocal.value.copy(v.group.matrixWorld).invert();
      v.liq.visible = v.surf.visible = v.frac > 0.004;
      v.pool.material.uniforms.lift.value = v.lift;
    });
  }

  // Étiquettes HTML sous chaque fiole, juste sous l'étagère
  const proj = new THREE.Vector3();
  function placeLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ppu = w / (cols * SPACING + 0.5);
    [...labelsEl.children].forEach((el) => {
      const v = vials.find((x) => x.id === el.dataset.id);
      if (!v) return;
      proj.set(v.x, v.y - SHELF.t, SHELF.d / 2).project(camera);
      el.style.left = `${((proj.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - proj.y) / 2) * h + 4}px`;
      el.style.width = `${Math.max(64, ppu * SPACING * 0.96)}px`;
    });
  }

  function frameCamera() {
    const w = canvas.clientWidth;
    if (!w) return;
    const top = 3.75, bottom = -(rows - 1) * rowH - (rowH - VIAL_H) - 0.05;
    const worldW = cols * SPACING + 0.5, worldH = top - bottom;
    const h = Math.round(w * (worldH / worldW));
    canvas.style.height = `${h}px`;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.max((worldH / 2) / Math.tan(vFov / 2), (worldW / 2) / (Math.tan(vFov / 2) * camera.aspect)) * 1.03;
    const cy = (top + bottom) / 2;
    camera.position.set(0, cy + dist * 0.07, dist);
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

  // Toucher une fiole dans le dessin : on prend la plus proche du doigt
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    let best = null, bestD = Infinity;
    vials.forEach((v) => {
      proj.set(v.x, v.y + 1.7, 0).project(camera);
      const dx = ((proj.x + 1) / 2) * r.width - (e.clientX - r.left), dy = ((1 - proj.y) / 2) * r.height - (e.clientY - r.top);
      const d = Math.hypot(dx, dy * 0.45);
      if (d < bestD) { bestD = d; best = v; }
    });
    const ppu = r.width / (cols * SPACING + 0.5);
    if (best && bestD < ppu * SPACING * 0.6) onPick?.(best.id);
  });

  // 4 fioles par étagère sur téléphone, jusqu'à 6 sur grand écran
  const slots = (w) => Math.max(3, Math.min(6, Math.floor(w / 82)));
  let items = [];
  function rebuild() {
    clear();
    const w = canvas.clientWidth || 600;
    cols = slots(w);
    rows = Math.max(1, Math.ceil(items.length / cols));
    rowH = VIAL_H + TAG_PX / (w / (cols * SPACING + 0.5));
    const width = cols * SPACING + 0.3;
    const rtl = document.documentElement.dir === "rtl" ? -1 : 1; // en arabe, la première fiole est à droite
    for (let r = 0; r < rows; r++) buildShelf(-r * rowH, width);
    vials = items.map((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      return buildVial(it, rtl * (c - (cols - 1) / 2) * SPACING, -r * rowH);
    });
    frameCamera();
    wake();
  }
  let lastW = 0;
  new ResizeObserver(() => { const w = canvas.clientWidth; if (w !== lastW) { lastW = w; rebuild(); } }).observe(canvas.parentElement);

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
