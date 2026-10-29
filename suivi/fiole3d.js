// Fiole d'injection en 3D : verre épais à double paroi, col, bague aluminium sertie, capsule « flip-off »,
// bouchon en caoutchouc, liquide qui reste horizontal et ondule, ombre au sol.
// Les reflets viennent d'un petit studio photo virtuel (bandes lumineuses) rendu une fois dans une carte d'environnement.
import * as THREE from "../peptides/vendor/three.module.min.js";

const V2 = (x, y) => new THREE.Vector2(x, y);
// Courbe de Bézier quadratique échantillonnée (sans le premier point)
function bez(a, c, b, n = 10) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push(V2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y));
  }
  return out;
}
// Arc de cercle (angles en degrés, sans le premier point)
function arc(cx, cy, r, a0, a1, n = 8) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / n);
    out.push(V2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
}
const line = (pts) => pts.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : (acc.push(p), acc)), []);

/* Profils (unités : rayon extérieur = 1, hauteur du verre 3,17) */
// Paroi extérieure, du centre du fond jusqu'au haut de la bague du col
const OUTER = line([
  V2(0, 0.012), V2(0.6, 0.004), V2(0.86, 0),
  arc(0.86, 0.14, 0.14, -90, 0),
  V2(1, 0.6), V2(1, 1.4), V2(1, 2.25),
  bez(V2(1, 2.25), V2(1, 2.66), V2(0.66, 2.73), 14),
  bez(V2(0.66, 2.73), V2(0.6, 2.745), V2(0.6, 2.8), 5),
  V2(0.6, 2.92),
  bez(V2(0.6, 2.92), V2(0.6, 2.96), V2(0.69, 2.975), 5),
  V2(0.705, 3.0), V2(0.705, 3.13),
  bez(V2(0.705, 3.13), V2(0.705, 3.17), V2(0.66, 3.17), 5),
  V2(0.45, 3.17),
]);
// Paroi intérieure, du haut du col jusqu'au centre du fond (fond épais avec un léger dôme)
const INNER = line([
  V2(0.45, 3.17), V2(0.43, 3.13), V2(0.43, 2.8),
  bez(V2(0.43, 2.8), V2(0.43, 2.69), V2(0.62, 2.665), 8),
  bez(V2(0.62, 2.665), V2(0.94, 2.62), V2(0.94, 2.25), 14),
  V2(0.94, 1.4), V2(0.94, 0.6), V2(0.94, 0.3),
  arc(0.8, 0.3, 0.14, 0, -90),
  V2(0.5, 0.165), V2(0.25, 0.175),
  bez(V2(0.25, 0.175), V2(0.08, 0.235), V2(0, 0.24), 5),
]);
// Volume du liquide : la cavité, légèrement en retrait du verre, arrêtée sous le bouchon
const LIQUID = line([
  V2(0, 0.252),
  bez(V2(0, 0.252), V2(0.08, 0.247), V2(0.25, 0.187), 5),
  V2(0.5, 0.177), V2(0.79, 0.177),
  arc(0.79, 0.305, 0.128, -90, 0),
  V2(0.928, 0.6), V2(0.928, 1.4), V2(0.928, 2.25),
  bez(V2(0.928, 2.25), V2(0.928, 2.6), V2(0.62, 2.653), 12),
  bez(V2(0.62, 2.653), V2(0.418, 2.68), V2(0.418, 2.76), 6),
  V2(0, 2.76),
]);
// Bague aluminium sertie sous la lèvre du col
const CRIMP = line([
  V2(0.6, 2.905), V2(0.66, 2.9),
  bez(V2(0.66, 2.9), V2(0.735, 2.905), V2(0.738, 2.96), 5),
  V2(0.738, 3.1), V2(0.738, 3.17),
  bez(V2(0.738, 3.17), V2(0.737, 3.215), V2(0.69, 3.22), 5),
  V2(0.46, 3.222),
]);
// Capsule plastique « flip-off »
const CAP = line([
  V2(0.6, 3.214), V2(0.705, 3.218),
  bez(V2(0.705, 3.218), V2(0.728, 3.23), V2(0.728, 3.27), 4),
  bez(V2(0.728, 3.27), V2(0.728, 3.318), V2(0.66, 3.33), 5),
  bez(V2(0.66, 3.33), V2(0.3, 3.355), V2(0, 3.36), 6),
]);
const STOPPER = line([V2(0, 2.78), V2(0.424, 2.78), V2(0.427, 2.83), V2(0.427, 3.16), V2(0.46, 3.17), V2(0.46, 3.215), V2(0, 3.215)]);

const Y_EMPTY = 0.2, Y_FULL = 1.82; // hauteur du liquide pour 0 % et 100 % de l'eau ajoutée

// Conversion pour l'écran (tone mapping + sRGB). Teinte du verre ou du liquide : convertie puis multipliée par l'opacité.
// Reflets : c'est de la lumière ajoutée, multipliée par Fresnel AVANT la conversion (une bande de studio très vive
// reste visible même avec 4 % de réflexion).
const ENV_GLSL = /* glsl */ `
  uniform samplerCube envMap;
  vec3 envAt(vec3 d) { return textureCube(envMap, d).rgb; }
  vec3 outCol(vec3 c) { return linearToOutputTexel(vec4(toneMapping(c), 1.0)).rgb; }
`;
const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
// Verre : réflexion de Fresnel (forte sur les bords, faible de face) + absorption légère dans l'épaisseur.
// Sortie en alpha prémultiplié : les reflets s'ajoutent à la lumière, les bords assombrissent un peu ce qui est derrière.
const GLASS_FRAG = /* glsl */ `
  ${ENV_GLSL}
  uniform vec3 tint; uniform float absorb; uniform float gain;
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    #ifdef FLIP_SIDED
      N = -N; // passe « faces arrière » : Three.js inverse le sens des faces, gl_FrontFacing reste vrai
    #endif
    vec3 V = normalize(cameraPosition - vW);
    float c = clamp(dot(N, V), 0.0, 1.0);
    float F = 0.045 + 0.955 * pow(1.0 - c, 4.0);
    vec3 refl = outCol(envAt(reflect(-V, N)) * gain * F);
    float edge = pow(1.0 - c, 2.6) * absorb;
    vec3 col = refl + outCol(tint) * edge * 0.35;
    float a = clamp(F * 0.85 + edge, 0.0, 0.97);
    gl_FragColor = vec4(col, a);
  }`;
// Liquide : paroi du volume, coupée par un plan horizontal (le niveau) qui ondule.
const LIQ_FRAG = /* glsl */ `
  ${ENV_GLSL}
  uniform vec3 P0; uniform vec3 Nrm; uniform float time; uniform float ripple;
  uniform vec3 tint; uniform vec3 deep; uniform float density;
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 q = vW - P0;
    float wave = ripple * (sin(q.x * 9.0 + time * 2.3) * 0.6 + sin(q.z * 11.0 - time * 1.7) * 0.4);
    float d = dot(q, Nrm) - wave;           // > 0 : au-dessus du liquide
    if (d > 0.0) discard;
    vec3 V = normalize(cameraPosition - vW);
      vec3 N = normalize(vN);
      float c = clamp(dot(N, V), 0.0, 1.0);
      float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
      vec3 refl = outCol(envAt(reflect(-V, N)) * F * 0.55);
      float edge = pow(1.0 - c, 1.6);
      // Ménisque : fine ligne claire au niveau du liquide, bande plus sombre juste en dessous
      float lineHi = smoothstep(-0.03, 0.0, d);
      float lineLo = smoothstep(-0.11, -0.04, d) * (1.0 - smoothstep(-0.04, -0.018, d));
      float depthK = clamp(-d / 1.6, 0.0, 1.0);
      vec3 body = outCol(mix(tint, deep, clamp(edge * 0.9 + depthK * 0.25, 0.0, 1.0)));
      float a = density * (0.14 + edge * 0.5 + depthK * 0.1) + lineLo * 0.28;
      vec3 col = body * a + refl + vec3(1.0) * lineHi * 0.75;
      gl_FragColor = vec4(col, clamp(a + F * 0.35 + lineHi * 0.45, 0.0, 0.95));
  }`;
// Surface du liquide : un disque dans le plan du niveau, découpé à la forme intérieure de la fiole
// (cylindre, et arrondi du fond quand il reste très peu de liquide). Elle reflète le studio comme un miroir d'eau.
const SURF_FRAG = /* glsl */ `
  ${ENV_GLSL}
  uniform mat4 toLocal; uniform vec3 Nrm; uniform vec3 tint; uniform float density;
  varying vec3 vN; varying vec3 vW;
  float cavity(float y) {
    if (y < 0.18) return 0.0;
    if (y < 0.305) return 0.79 + sqrt(max(0.0, 0.0164 - (0.305 - y) * (0.305 - y)));
    return 0.926;
  }
  void main() {
    vec3 L = (toLocal * vec4(vW, 1.0)).xyz;
    float r = length(L.xz), rmax = cavity(L.y);
    if (r > rmax) discard;
    vec3 V = normalize(cameraPosition - vW);
    float c = clamp(abs(dot(Nrm, V)), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
    vec3 refl = outCol(envAt(reflect(-V, Nrm)) * (F * 0.9 + 0.025));
    float rim = smoothstep(rmax - 0.07, rmax, r);           // ménisque vu d'en haut : bord plus marqué
    float a = density * (0.2 + rim * 0.25);
    vec3 col = outCol(tint) * a + refl + vec3(1.0) * rim * 0.12;
    gl_FragColor = vec4(col, clamp(a + F * 0.55, 0.0, 0.9));
  }`;
// Sol : ombre douce de la fiole et tache de lumière concentrée par le liquide (caustique)
const FLOOR_FRAG = /* glsl */ `
  uniform float shadow; uniform float caustic; uniform vec3 causticColor;
  varying vec3 vN; varying vec3 vW;
  void main() {
    float r = length(vW.xz);
    float sh = (1.0 - smoothstep(0.75, 1.55, r)) * shadow;
    float contact = (1.0 - smoothstep(0.86, 1.08, r)) * shadow * 0.9;
    vec2 cp = vW.xz - vec2(0.55, 0.62);
    float k = (1.0 - smoothstep(0.0, 0.5, length(cp * vec2(1.0, 1.6)))) * caustic;
    float a = clamp(sh * 0.32 + contact * 0.35, 0.0, 0.7);
    gl_FragColor = vec4(linearToOutputTexel(vec4(causticColor, 1.0)).rgb * k, a);
  }`;

export function createVial3D(canvas, { reduceMotion = false } = {}) {
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
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 60);
  const TARGET = new THREE.Vector3(0, 1.62, 0);

  /* Studio virtuel : dégradé gris, grandes bandes lumineuses (softbox), plafond, fenêtre chaude */
  const envScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 32, 16);
  const skyCols = [];
  const pos = sky.attributes.position;
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  envScene.add(new THREE.Mesh(sky, skyMat));
  const strips = [];
  const addStrip = (w, h, p, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.position.copy(p);
    m.lookAt(0, 0, 0);
    m.userData = { color: new THREE.Color(color), k };
    envScene.add(m);
    strips.push(m);
  };
  addStrip(2.2, 13, new THREE.Vector3(-6.5, 1, 4), "#ffffff", 7);     // grande bande verticale à gauche
  addStrip(1.2, 11, new THREE.Vector3(6.8, 0.6, 2.5), "#fff4e6", 4);  // bande plus fine à droite
  addStrip(9, 5, new THREE.Vector3(0, 9, 1), "#ffffff", 3.2);          // plafond
  addStrip(5, 3.4, new THREE.Vector3(-3.5, 2.2, -7), "#ffd9b0", 2.2); // fenêtre chaude derrière
  addStrip(3.5, 8, new THREE.Vector3(4.5, 0.5, -6.5), "#cfe1ff", 1.6); // reflet froid derrière à droite
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 40, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envPm = null;
  function buildEnv(dark) {
    // Comme en photo de verre sur fond clair : un studio sombre dessine les bords du verre, les bandes font les reflets
    const top = new THREE.Color(dark ? "#2a2f3c" : "#7b776f"), mid = new THREE.Color(dark ? "#151820" : "#3e3b36"), bot = new THREE.Color(dark ? "#07080b" : "#16140f");
    skyCols.length = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 20;
      const c = y > 0 ? mid.clone().lerp(top, Math.min(1, y * 1.6)) : mid.clone().lerp(bot, Math.min(1, -y * 2.2));
      skyCols.push(c.r, c.g, c.b);
    }
    sky.setAttribute("color", new THREE.Float32BufferAttribute(skyCols, 3));
    strips.forEach((m) => m.material.color.copy(m.userData.color).multiplyScalar(m.userData.k * (dark ? 0.75 : 1)));
    cubeCam.update(renderer, envScene);
    envPm?.dispose();
    envPm = pmrem.fromCubemap(cubeRT.texture).texture;
    scene.environment = envPm;
  }

  /* La fiole */
  const vial = new THREE.Group();
  scene.add(vial);
  const SEG = 96;
  const lathe = (pts) => new THREE.LatheGeometry(pts, SEG);
  const shaderMat = (frag, uniforms, side) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, side, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: { envMap: { value: cubeRT.texture }, ...uniforms },
  });
  const glassU = { tint: { value: new THREE.Color("#7f97a6") }, absorb: { value: 0.32 }, gain: { value: 1 } };
  const outerG = lathe(OUTER), innerG = lathe(INNER), liqG = lathe(LIQUID);
  const liqU = {
    P0: { value: new THREE.Vector3() }, Nrm: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, ripple: { value: 0.003 },
    tint: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, density: { value: 1 },
  };
  // Ordre de dessin, du fond vers l'avant : paroi extérieure du fond, paroi intérieure du fond,
  // liquide (surface puis face avant), paroi intérieure avant, paroi extérieure avant
  const parts = [
    [outerG, shaderMat(GLASS_FRAG, glassU, THREE.BackSide), 1],
    [innerG, shaderMat(GLASS_FRAG, glassU, THREE.FrontSide), 2],
    [liqG, shaderMat(LIQ_FRAG, liqU, THREE.FrontSide), 4],
    [innerG, shaderMat(GLASS_FRAG, glassU, THREE.BackSide), 5],
    [outerG, shaderMat(GLASS_FRAG, glassU, THREE.FrontSide), 6],
  ];
  const liquidMeshes = [];
  const surfU = { toLocal: { value: new THREE.Matrix4() }, Nrm: liqU.Nrm, tint: liqU.tint, density: liqU.density };
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1.5, 96), shaderMat(SURF_FRAG, surfU, THREE.DoubleSide));
  surface.renderOrder = 3;
  scene.add(surface);
  parts.forEach(([g, m, order]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = order;
    vial.add(mesh);
    if (m.uniforms.P0) liquidMeshes.push(mesh);
  });
  const metal = new THREE.MeshStandardMaterial({ color: "#d9dce1", metalness: 1, roughness: 0.27 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: "#c23a22", roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.22 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#4e5157", roughness: 0.88, metalness: 0 });
  vial.add(new THREE.Mesh(lathe(CRIMP), metal), new THREE.Mesh(lathe(CAP), capMat), new THREE.Mesh(lathe(STOPPER), rubber));
  const key = new THREE.DirectionalLight("#ffffff", 1.4);
  key.position.set(-4, 7, 5);
  scene.add(key);

  // Sol : ombre + caustique
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: { shadow: { value: 1 }, caustic: { value: 0 }, causticColor: { value: new THREE.Color("#fff6e8") } },
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.renderOrder = 0;
  scene.add(floor);

  /* Thème : studio clair ou sombre, couleur du liquide */
  let dark = null;
  function applyTheme() {
    const isDark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    if (isDark === dark) return;
    dark = isDark;
    buildEnv(dark);
    liqU.tint.value.set(dark ? "#9cc0ee" : "#a8c6e6");
    liqU.deep.value.set(dark ? "#4a78b8" : "#4b74a6");
    liqU.density.value = dark ? 0.95 : 1;
    glassU.gain.value = dark ? 0.75 : 1;
    floor.material.uniforms.causticColor.value.set(dark ? "#bfd6ff" : "#fff1dc");
    floor.material.uniforms.shadow.value = dark ? 0.9 : 1;
    wake();
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

  /* Taille du canvas */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // recule la caméra si le cadre est étroit, pour que la fiole tienne en entier
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const need = Math.max(4.25 / (2 * Math.tan(vFov / 2)), 2.75 / (2 * Math.tan(vFov / 2) * camera.aspect));
    dist = need;
    camera.updateProjectionMatrix();
    wake();
  }
  let dist = 11;
  new ResizeObserver(resize).observe(canvas);

  /* Animation : orbite lente de la caméra, inclinaison au doigt avec ressort, liquide qui ondule */
  let az = -0.35, azV = reduceMotion ? 0 : 0.12, tilt = 0, tiltV = 0, tiltT = 0, wob = 0, wobV = 0;
  let shown = 0, target = 0, time = 0, last = 0, raf = 0, visible = true, dragX = null, dragAz = 0;
  const axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(), p0 = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3();
  const PIVOT = new THREE.Vector3(0, 1.7, 0);
  function place() {
    camera.position.set(Math.sin(az) * dist, TARGET.y + dist * 0.105, Math.cos(az) * dist);
    camera.lookAt(TARGET);
    axis.set(-Math.sin(az), 0, -Math.cos(az));              // direction de vue (horizontale)
    right.set(Math.cos(az), 0, -Math.sin(az));               // droite de l'écran
    vial.quaternion.setFromAxisAngle(axis, -tilt);
    vial.position.copy(PIVOT).sub(tmp.copy(PIVOT).applyQuaternion(vial.quaternion)); // pivote au milieu, comme tenue entre les doigts
    vial.updateMatrixWorld();
    const y = Y_EMPTY + shown * (Y_FULL - Y_EMPTY);
    p0.set(0, y, 0).applyMatrix4(vial.matrixWorld);
    liqU.P0.value.copy(p0);
    liqU.Nrm.value.copy(up).addScaledVector(right, wob).normalize();
    liquidMeshes.forEach((m) => (m.visible = shown > 0.004));
    surface.visible = shown > 0.004;
    surface.position.copy(p0);
    surface.quaternion.setFromUnitVectors(zAxis, liqU.Nrm.value);
    surfU.toLocal.value.copy(vial.matrixWorld).invert();
    floor.material.uniforms.caustic.value = Math.min(1, shown * 1.4) * (dark ? 0.55 : 0.9);
  }
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    if (dragX === null && !reduceMotion) { az += azV * dt; azV += (0.12 - azV) * (1 - Math.exp(-dt * 1.5)); }
    const prevTV = tiltV;
    tiltV += (70 * (tiltT - tilt) - 7 * tiltV) * dt;          // la fiole revient droite après un geste
    tilt += tiltV * dt;
    const tiltAcc = (tiltV - prevTV) / dt;
    wobV += (-60 * wob - 2.6 * wobV - tiltAcc * 0.012) * dt;  // le liquide clapote quand la fiole bouge
    wob = THREE.MathUtils.clamp(wob + wobV * dt, -0.35, 0.35);
    shown += (target - shown) * (1 - Math.exp(-dt * 3.5));
    liqU.time.value = time;
    liqU.ripple.value = 0.0025 + Math.min(0.02, Math.abs(wobV) * 0.012);
    place();
    renderer.render(scene, camera);
    const busy = !reduceMotion || Math.abs(target - shown) > 0.0005 || Math.abs(tiltV) > 0.001 || Math.abs(wobV) > 0.001;
    raf = visible && busy ? requestAnimationFrame(frame) : 0;
  }
  function wake() {
    if (reduceMotion && !raf) { shown = target; place(); renderer.render(scene, camera); return; }
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; if (visible) wake(); }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) wake(); });

  // Glisser : tourne autour de la fiole et la penche dans le sens du geste
  let lastX = 0, lastT = 0, vx = 0;
  canvas.addEventListener("pointerdown", (e) => { dragX = lastX = e.clientX; dragAz = az; lastT = performance.now(); vx = 0; canvas.setPointerCapture(e.pointerId); wake(); });
  canvas.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    const now = performance.now();
    vx = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    az = dragAz - (e.clientX - dragX) * 0.008;
    // tant qu'on tient la fiole, elle reste penchée dans le sens du geste (et le liquide reste à plat)
    tiltT = THREE.MathUtils.clamp((e.clientX - dragX) * 0.003 + vx * 0.22, -0.3, 0.3);
    wake();
  });
  const release = () => { if (dragX === null) return; dragX = null; tiltT = 0; azV = THREE.MathUtils.clamp(-vx * 1.2, -2, 2); wake(); };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  applyTheme();
  resize();
  place();
  renderer.render(scene, camera);

  return {
    set(f, { instant = false, splash = 0 } = {}) {
      target = THREE.MathUtils.clamp(f, 0, 1);
      if (instant) shown = target;
      if (splash && !reduceMotion) wobV += splash * 0.9;
      wake();
    },
    ticks() {},
    // Couleur de la capsule « flip-off » (choisie pour chaque fiole)
    color(hex) { capMat.color.set(hex); wake(); },
  };
}
