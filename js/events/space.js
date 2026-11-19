// CADUTA NELLO SPAZIO (10 s): dopo ENTRA nel portale della cantina si cade tra le stelle. Non ci si muove, ma ci si guarda intorno (stessa visuale del gioco).
// Si vedono la Via Lattea, galassie lontane, un pianeta roccioso, un mondo con oceani e nuvole, un gigante gassoso con gli anelli, il Sole, un buco nero con il disco
// di accrescimento e, in fondo, un altro portale come quello della cantina. Entrandoci (ultimo istante, lampo bianco) si arriva nella torre.
// Scena a parte (nessuna luce, solo shader), disegnata al posto del gioco finche' dura: leggera per un telefono medio. ?spazio=0 la salta.
import * as THREE from 'three';
import { portalMaterial } from '../world/portal.js';
import { createGiantEye } from '../world/giant-eye.js';

const NOISE = `
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n3(p); p = p * 2.02 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return s; }
`;
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,235,190,.7)'); r.addColorStop(0.5, 'rgba(255,170,80,.18)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

const SUN = new THREE.Vector3(-46, 13, -64);   // posizione del Sole (illumina i pianeti)
const SUNR = 11;
const spikeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.08, 'rgba(255,255,255,.9)'); r.addColorStop(0.3, 'rgba(180,200,255,.18)'); r.addColorStop(1, 'rgba(120,150,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter'; for (const [w, h] of [[128, 3], [3, 128]]) { const l = g.createLinearGradient(0, 0, w > h ? 128 : 0, w > h ? 0 : 128); l.addColorStop(0, 'rgba(200,220,255,0)'); l.addColorStop(0.5, 'rgba(230,240,255,.9)'); l.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = l; g.fillRect(64 - w / 2, 64 - h / 2, w, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const flareTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 20, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.05)'); r.addColorStop(0.8, 'rgba(255,255,255,.22)'); r.addColorStop(0.93, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export function createSpaceFall({ renderer, camera, player, audio, say, isBusy }) {
  const S = { active: false, t: 0, phase: 'idle' };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000004); S.scene = scene;
  const sc = new THREE.PerspectiveCamera(68, 1, 0.1, 2000); S.camera = sc;
  const clock = { t: 0 };
  const U = { uT: { value: 0 } };
  // COTTURA DELLE TEXTURE: cielo, nebulose, galassie, superfici dei pianeti, Sole, corona e disco del buco nero si calcolano UNA volta in texture
  // (a strisce, una per fotogramma, mentre si e' ancora in cantina) e a runtime si legge solo la texture: niente rumore frattale per pixel durante la caduta.
  const bakeScene = new THREE.Scene(), bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), bakeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); bakeQuad.frustumCulled = false; bakeScene.add(bakeQuad);
  const BAKE_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const jobs = [];
  const SPHERE_DIR = 'vec3 sphereDir(vec2 uv) { float ph = uv.x * 6.2831853, th = (1.0 - uv.y) * 3.1415927; return vec3(-cos(ph) * sin(th), cos(th), sin(ph) * sin(th)); }';
  const bake = (w, h, frag, uniforms = {}, strips = 1, filter = THREE.LinearFilter) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: filter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
    const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: frag, uniforms: { uT: { value: 0 }, ...uniforms }, depthTest: false, depthWrite: false });
    jobs.push({ rt, mat, w, h, strips, done: 0 }); return rt.texture;
  };
  const bakeStep = () => {   // una striscia del primo lavoro in coda
    const j = jobs.find((x) => x.done < x.strips); if (!j) return false;
    const sh = Math.ceil(j.h / j.strips), y0 = j.done * sh;
    bakeQuad.material = j.mat; j.rt.scissorTest = true; j.rt.scissor.set(0, y0, j.w, Math.min(sh, j.h - y0)); j.rt.viewport.set(0, 0, j.w, j.h);
    const prev = renderer.getRenderTarget(), ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(j.rt); renderer.render(bakeScene, bakeCam); renderer.setRenderTarget(prev); renderer.autoClear = ac;
    j.rt.scissorTest = false; j.done++; if (j.done >= j.strips) j.mat.dispose(); return true;
  };
  const rnd = (() => { let sd = 7; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();

  // ---- cielo: Via Lattea + stelle + galassie lontane (segue la camera) ----
  const sky = new THREE.Group(); scene.add(sky);
  const skyTex = bake(2048, 1024, NOISE + SPHERE_DIR + `
      varying vec2 vUv;
      vec3 stars(vec3 d, float scale, float thr, float size) { vec3 p = d * scale, c = floor(p), f = fract(p); float h = h31(c); if (h < thr) return vec3(0.0);
        vec3 o = vec3(h31(c + 7.1), h31(c + 13.3), h31(c + 29.9)) * 0.7 + 0.15; float r = length(f - o), s = smoothstep(size, 0.0, r), t = h31(c + 3.7);
        return mix(vec3(0.6, 0.75, 1.0), vec3(1.0, 0.82, 0.6), t) * s * (0.35 + 1.4 * h31(c + 1.9)); }
      void main() { vec3 d = sphereDir(vUv);
        vec3 gn = normalize(vec3(0.32, 0.86, 0.4)), gu = normalize(cross(gn, vec3(0.0, 0.0, 1.0))), gv = cross(gn, gu);
        float lat = dot(d, gn), lon = atan(dot(d, gv), dot(d, gu));
        float band = exp(-lat * lat * 16.0), f = fbm3(d * 3.0) * 0.6 + fbm3(d * 9.0) * 0.4;
        float dust = smoothstep(0.5, 0.72, fbm3(d * 5.5 + 7.0)), core = exp(-pow(lon - 0.9, 2.0) * 0.9) * band;
        vec3 col = band * (0.25 + 1.05 * f) * mix(vec3(0.3, 0.42, 0.95), vec3(1.0, 0.72, 0.45), core) * (1.0 - 0.7 * dust * band);
        col += vec3(0.10, 0.03, 0.16) * pow(fbm3(d * 2.0 + 3.0), 2.0) * 1.6 + vec3(0.02, 0.07, 0.16) * pow(fbm3(d * 2.4 + 9.0), 2.0) * 1.6;
        float e1 = smoothstep(0.5, 0.8, fbm3(d * 1.7 + 21.0)), e2 = smoothstep(0.54, 0.82, fbm3(d * 2.2 + 41.0)), e3 = smoothstep(0.58, 0.84, fbm3(d * 3.1 + 63.0));
        col += vec3(0.62, 0.12, 0.30) * e1 * (0.3 + 0.8 * band) * 0.5 + vec3(0.06, 0.38, 0.55) * e2 * (0.3 + 0.8 * band) * 0.65 + vec3(0.75, 0.38, 0.10) * e3 * band * 0.45;   // nebulose a emissione (magenta, ciano, ambra) lungo la Via Lattea
        col *= 1.0 - 0.45 * smoothstep(0.5, 0.75, fbm3(d * 7.0 + 90.0)) * band;   // corsie di polvere scura
        for (int k = 0; k < 3; k++) { vec3 cd = normalize(vec3(-0.5 + 0.9 * float(k), 0.25 - 0.3 * float(k), -0.8 + 0.5 * float(k))); float cr = length(d - cd); col += mix(vec3(0.5, 0.65, 1.0), vec3(1.0, 0.75, 0.5), float(k) * 0.5) * (exp(-cr * cr * 1800.0) * 0.5 + exp(-cr * cr * 9000.0) * 0.9); }   // ammassi stellari luminosi
        float dens = 0.80 - 0.12 * band;
        col += stars(d, 90.0, dens + 0.08, 0.18) * 1.4 + stars(d, 170.0, dens + 0.05, 0.16) + stars(d, 320.0, dens, 0.14) * 0.8 + stars(d, 40.0, 0.94, 0.2) * 2.0;
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0); }`, {}, 16);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTex: { value: skyTex } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform sampler2D uTex; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }' });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 24), skyMat); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; sky.add(skyMesh);
  const galaxyMat = (seed, tilt, hue) => {
    const tex = bake(128, 128, NOISE + `varying vec2 vUv; uniform float uSeed, uTilt; uniform vec3 uHue;
      void main() { vec2 p = (vUv - 0.5) * 2.0; p.y /= uTilt; float r = length(p); if (r > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } float a = atan(p.y, p.x);
        float arms = 0.5 + 0.5 * cos(2.0 * (a - log(r + 0.06) * 3.4 + uSeed)); float disc = exp(-r * 3.4), core = exp(-r * 15.0);
        float spec = step(0.97, h31(vec3(floor(p * 40.0), uSeed))) * 0.7 * disc;
        vec3 col = mix(uHue, vec3(1.0, 0.86, 0.62), core) * (disc * (0.25 + 1.05 * arms * smoothstep(0.08, 0.3, r)) + core * 1.6) + spec;
        float edge = 1.0 - smoothstep(0.75, 1.0, r); col *= edge; gl_FragColor = vec4(min(col, vec3(1.0)), 1.0); }`, { uSeed: { value: seed }, uTilt: { value: tilt }, uHue: { value: hue } });
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); };
  const addGalaxy = (dir, size, seed, tilt, hue, roll) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), galaxyMat(seed, tilt, new THREE.Color(...hue))); m.position.copy(dir.clone().normalize().multiplyScalar(700)); m.lookAt(0, 0, 0); m.rotateZ(roll); m.frustumCulled = false; m.renderOrder = -9; sky.add(m); };
  addGalaxy(new THREE.Vector3(-0.6, 0.2, -1), 150, 1.3, 0.45, [0.45, 0.6, 1.0], 0.6);
  addGalaxy(new THREE.Vector3(0.7, 0.45, -0.8), 95, 4.1, 0.7, [1.0, 0.7, 0.5], -0.4);
  addGalaxy(new THREE.Vector3(0.25, -0.5, -1), 70, 2.2, 0.35, [0.7, 0.5, 1.0], 1.2);
  addGalaxy(new THREE.Vector3(-0.9, 0.55, 0.3), 110, 5.6, 0.6, [0.55, 0.75, 1.0], 0.2);
  addGalaxy(new THREE.Vector3(0.9, -0.25, -0.5), 60, 7.7, 0.5, [1.0, 0.8, 0.6], -0.9);
  addGalaxy(new THREE.Vector3(0.12, -0.18, -1), 105, 9.3, 0.55, [0.7, 0.62, 1.0], 0.35);   // una galassia a spirale dritta davanti alla caduta (si vede anche dal buco)
  addGalaxy(new THREE.Vector3(-0.35, 0.1, -1), 55, 11.2, 0.4, [1.0, 0.72, 0.5], -0.6);
  // stelle luminose con raggi di diffrazione (scintillano)
  const brights = [];
  for (let i = 0; i < 22; i++) { const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(750); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: spikeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, color: new THREE.Color().setHSL(0.55 + rnd() * 0.15 - (rnd() < 0.3 ? 0.5 : 0), 0.5, 0.85), opacity: 0.8 })); sp.position.copy(d); const sz = 25 + rnd() * 50; sp.scale.setScalar(sz); sp.renderOrder = -8; sky.add(sp); brights.push({ sp, sz, ph: rnd() * 6.28 }); }

  // ---- nebulose colorate vicino al percorso (parallasse) ----
  const nebMat = (c1, c2, seed) => {
    const tex = bake(256, 256, NOISE + `varying vec2 vUv; uniform float uS; uniform vec3 uC1, uC2;
      void main() { vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } vec3 q = vec3(p * 2.2, uS); float f = fbm3(q) * 0.65 + fbm3(q * 2.7 + 5.0) * 0.35, g = fbm3(q * 1.3 + 11.0);
        float dens = smoothstep(0.32, 0.8, f) * (1.0 - smoothstep(0.5, 1.0, r)); vec3 col = mix(uC1, uC2, g) * dens * 0.8 + uC2 * pow(smoothstep(0.62, 0.9, f), 3.0) * 0.35 * (1.0 - r); gl_FragColor = vec4(min(col, vec3(1.0)), 1.0); }`,
      { uS: { value: seed }, uC1: { value: new THREE.Color(...c1) }, uC2: { value: new THREE.Color(...c2) } });
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); };
  for (const [pos, size, c1, c2, seed, rot] of [[[2, -6, -62], 80, [0.2, 0.2, 0.65], [0.6, 0.15, 0.5], 21.0, 0.8], [[-34, -9, -34], 90, [0.55, 0.1, 0.5], [0.1, 0.35, 0.6], 3.0, 0.4], [[40, 14, -78], 110, [0.1, 0.45, 0.5], [0.7, 0.2, 0.35], 8.0, 1.2], [[-24, 18, -100], 120, [0.8, 0.35, 0.1], [0.35, 0.1, 0.6], 15.0, 2.3]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), nebMat(c1.map((x) => x), c2, seed)); m.position.set(...pos); m.rotation.z = rot; m.renderOrder = -5; m.frustumCulled = false; m.userData.bb = true; scene.add(m); }

  // ---- pianeti (shader: lavico, oceano con luci di citta' e nuvole, ghiaccio, gigante gassoso, lune), con ombra degli anelli ----
  const SURF = NOISE + `
    vec4 surface(vec3 p, float kind, vec3 uA, vec3 uB, vec3 uC) { vec3 col; float mask = 0.0;
      if (kind < 0.5) { float f = fbm3(p * 4.0), cr = smoothstep(0.58, 0.64, fbm3(p * 10.0)); col = mix(uA, uB, f) * (1.0 - 0.35 * cr); }
      else if (kind < 1.5) { float lat = p.y, warp = fbm3(vec3(p.x * 3.0, lat * 12.0, p.z * 3.0)) * 0.4, bands = sin((lat + warp) * 20.0) * 0.5 + 0.5;
        col = mix(uA, uB, bands); col = mix(col, uC, smoothstep(0.62, 0.78, fbm3(vec3(p.x * 6.0, lat * 24.0, p.z * 6.0)))); float storm = smoothstep(0.1, 0.0, length(vec2(p.x - 0.5, lat + 0.28)) - 0.16); col = mix(col, vec3(0.7, 0.3, 0.18), storm * 0.7); }
      else if (kind < 2.5) { float land = smoothstep(0.5, 0.56, fbm3(p * 3.0 + 4.0)); col = mix(uA, uB, land); float cl = smoothstep(0.5, 0.78, fbm3(p * 5.0)); col = mix(col, vec3(1.0), cl * 0.85); mask = step(0.78, fbm3(p * 30.0 + 2.0)) * land * (1.0 - cl); }
      else if (kind < 3.5) { float f = fbm3(p * 5.0), cr = abs(fbm3(p * 7.0 + 3.0) - 0.5); col = mix(uA, uB, f); float crack = 1.0 - smoothstep(0.0, 0.035, cr); mask = crack; col *= 1.0 - crack * 0.6; }
      else { float f = fbm3(p * 6.0), v = abs(fbm3(p * 9.0 + 1.0) - 0.5); col = mix(uA, uB, f) + vec3(0.3, 0.5, 0.7) * (1.0 - smoothstep(0.0, 0.03, v)) * 0.5; }
      return vec4(col, mask); }`;
  const bakeSurface = (kind, a, b, c, w = 512, h = 256, strips = 2) => bake(w, h, SURF + SPHERE_DIR + 'varying vec2 vUv; uniform float uKind; uniform vec3 uA, uB, uC; void main() { gl_FragColor = surface(sphereDir(vUv), uKind, uA, uB, uC); }',
    { uKind: { value: kind }, uA: { value: new THREE.Color(...a) }, uB: { value: new THREE.Color(...b) }, uC: { value: new THREE.Color(...c) } }, strips);
  const RING = { c: { value: new THREE.Vector3() }, n: { value: new THREE.Vector3(0, 1, 0) }, r: { value: 8.5 }, on: { value: 0 } };
  // il pianeta a runtime: texture + luce del Sole + atmosfera + ombra degli anelli; lava e luci di citta' sono una maschera che pulsa
  const planetMat = (kind, tex, tint = [1, 1, 1]) => new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uKind: { value: kind }, uSun: { value: SUN.clone() }, uTex: { value: tex }, uTint: { value: new THREE.Color(...tint) }, uRC: RING.c, uRN: RING.n, uRR: RING.r, uRon: RING.on },
    vertexShader: 'varying vec2 vUv; varying vec3 vP, vN, vW; void main() { vUv = uv; vP = position; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying vec3 vP, vN, vW; uniform float uT, uKind, uRR, uRon; uniform vec3 uSun, uRC, uRN, uTint; uniform sampler2D uTex;
      void main() { vec3 n = normalize(vN), L = normalize(uSun - vW), V = normalize(cameraPosition - vW); float ndl = dot(n, L), ndv = max(dot(n, V), 0.0);
        vec4 tx = texture2D(uTex, vUv); vec3 col = tx.rgb * uTint, emit = vec3(0.0);
        if (uKind > 1.5 && uKind < 2.5) emit = vec3(1.0, 0.82, 0.45) * tx.a * (1.0 - smoothstep(-0.12, 0.1, ndl)) * 1.6;                                   // luci di citta' sul lato notturno
        else if (uKind > 2.5 && uKind < 3.5) emit = vec3(1.0, 0.42, 0.08) * tx.a * (0.6 + 0.5 * sin(uT * 1.7 + vP.x * 6.0 + vP.y * 4.0)) * 1.5;               // crepe di lava che pulsano
        float sh = 1.0;
        if (uRon > 0.5 && uKind > 0.5 && uKind < 1.5) { float den = dot(L, uRN); if (abs(den) > 0.02) { float tt = dot(uRC - vW, uRN) / den; if (tt > 0.0) { vec3 hp = vW + L * tt; float rr = length(hp - uRC) / uRR, t = (rr - 1.25) / 1.05;
              if (t > 0.0 && t < 1.0) { float b = 0.5 + 0.5 * sin(t * 70.0), gap = 1.0 - smoothstep(0.02, 0.0, abs(t - 0.58)); sh = 1.0 - 0.75 * smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.88, t) * (0.4 + 0.5 * b) * gap; } } } }   // ombra degli anelli
        float rim = pow(1.0 - ndv, 3.0);
        vec3 atm = (uKind > 1.5 && uKind < 2.5 ? vec3(0.3, 0.6, 1.0) : (uKind > 0.5 && uKind < 1.5 ? vec3(0.95, 0.75, 0.5) : (uKind > 3.5 ? vec3(0.5, 0.75, 1.0) : vec3(0.55, 0.3, 0.25)))) * rim * (0.1 + 0.9 * smoothstep(-0.2, 0.6, ndl));
        float lit = smoothstep(-0.08, 0.35, ndl) * sh;
        gl_FragColor = vec4(col * (0.025 + lit * 1.2) + atm + emit, 1.0); }` });
  const T_LAVA = bakeSurface(3, [0.14, 0.07, 0.06], [0.35, 0.16, 0.1], [0, 0, 0]), T_OCEAN = bakeSurface(2, [0.03, 0.14, 0.4], [0.2, 0.45, 0.18], [1, 1, 1], 512, 256, 2), T_ICE = bakeSurface(4, [0.55, 0.7, 0.85], [0.85, 0.92, 1.0], [0, 0, 0], 256, 128, 1),
    T_GAS = bakeSurface(1, [0.78, 0.6, 0.38], [0.45, 0.28, 0.16], [0.9, 0.82, 0.65], 1024, 512, 6), T_MOON = bakeSurface(0, [0.5, 0.46, 0.43], [0.8, 0.76, 0.7], [0, 0, 0], 256, 128, 1);
  const planets = [];
  const addPlanet = (pos, r, mat, spin = 0.04) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); m.position.copy(pos); m.scale.setScalar(r); m.frustumCulled = false; scene.add(m); planets.push({ m, spin }); return m; };
  addPlanet(new THREE.Vector3(-8.5, 1.5, -15), 2.6, planetMat(3, T_LAVA), 0.06);                       // mondo lavico, vicino a sinistra
  addPlanet(new THREE.Vector3(10.5, -2.5, -27), 3.4, planetMat(2, T_OCEAN), 0.05);                         // oceani, nuvole, citta'
  addPlanet(new THREE.Vector3(-22, -11, -42), 1.7, planetMat(4, T_ICE), 0.09);                         // piccolo pianeta di ghiaccio
  const gas = addPlanet(new THREE.Vector3(17, 3.5, -50), 8.5, planetMat(1, T_GAS), 0.03);     // gigante gassoso
  // anelli: due sistemi concentrici, struttura fine, ombra del pianeta sull'anello
  const ringRot = new THREE.Euler(-1.25, 0.25, 0.35), ringN = new THREE.Vector3(0, 0, 1).applyEuler(ringRot).normalize();
  RING.c.value.copy(gas.position); RING.n.value.copy(ringN); RING.r.value = 8.5; RING.on.value = 1;
  const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uSun: { value: SUN.clone() }, uPC: { value: gas.position.clone() }, uPR: { value: 8.5 }, uRN: { value: ringN } },
    vertexShader: 'varying vec3 vL, vW; void main() { vL = position; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: NOISE + `varying vec3 vL, vW; uniform vec3 uSun, uPC, uRN; uniform float uPR; void main() { float t = (length(vL.xy) - 1.25) / 1.05; if (t < 0.0 || t > 1.0) discard;
        float b = 0.5 + 0.5 * sin(t * 90.0 + fbm3(vec3(t * 14.0, 0.0, 1.0)) * 10.0), fine = 0.55 + 0.45 * fbm3(vec3(t * 260.0, atan(vL.y, vL.x) * 2.0, 3.0));
        float gap = 1.0 - smoothstep(0.022, 0.0, abs(t - 0.58)) - smoothstep(0.012, 0.0, abs(t - 0.82)) - 0.5 * smoothstep(0.05, 0.0, abs(t - 0.33));
        float a = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.88, t) * (0.22 + 0.6 * b) * fine * gap;
        vec3 L = normalize(uSun - vW), oc = vW - uPC; float tc = dot(-oc, L); vec3 cp = oc + L * tc; float shadow = (tc > 0.0 && length(cp) < uPR * 0.98) ? 0.12 : 1.0;   // ombra del pianeta sull'anello
        vec3 col = mix(vec3(0.88, 0.76, 0.58), vec3(0.58, 0.48, 0.4), b) * (0.2 + 1.0 * shadow); gl_FragColor = vec4(col, a); }` });
  const rings = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.3, 160, 1), ringMat); rings.position.copy(gas.position); rings.scale.setScalar(8.5); rings.rotation.copy(ringRot); rings.frustumCulled = false; rings.renderOrder = 2; scene.add(rings);
  // lune del gigante gassoso (orbite diverse)
  const moons = [];
  for (const [r0, size, sp, ph, inc, col] of [[17.5, 1.05, 0.22, 0.4, 0.15, [0.9, 0.88, 0.85]], [24, 1.6, 0.14, 2.6, -0.1, [1.0, 0.8, 0.62]], [13.5, 0.55, 0.33, 4.4, 0.3, [1.1, 1.1, 1.15]]]) {
    const m = addPlanet(new THREE.Vector3(), size, planetMat(0, T_MOON, col), 0.1); moons.push({ m, r0, sp, ph, inc }); }
  // fascia di asteroidi (InstancedMesh con un solo shader), prima del gigante gassoso: da' il senso della velocita'
  { const NA = 110, geo = new THREE.IcosahedronGeometry(1, 1), dm = new THREE.Object3D(); const mat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN.clone() } },
      vertexShader: 'varying vec3 vN, vP, vW; void main() { vP = position; mat4 M = modelMatrix * instanceMatrix; vN = normalize(mat3(M) * normal); vec4 w = M * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: NOISE + 'varying vec3 vN, vP, vW; uniform vec3 uSun; void main() { vec3 n = normalize(vN), L = normalize(uSun - vW); float f = n3(vP * 3.0 + vW * 0.05); vec3 col = mix(vec3(0.16, 0.14, 0.13), vec3(0.44, 0.38, 0.32), f); float l = smoothstep(-0.1, 0.5, dot(n, L)); gl_FragColor = vec4(col * (0.03 + l * 1.3), 1.0); }' });
    const ast = S.ast = new THREE.InstancedMesh(geo, mat, NA); ast.frustumCulled = false;
    for (let i = 0; i < NA; i++) { const ang = rnd() * 6.283, rad = 5.2 + Math.pow(rnd(), 0.8) * 13, z = -30 - rnd() * 24; dm.position.set(Math.cos(ang) * rad + 6, Math.sin(ang) * rad * 0.7 - 1, z); const sz = 0.1 + Math.pow(rnd(), 3) * 0.75; dm.scale.set(sz * (0.7 + rnd() * 0.6), sz * (0.7 + rnd() * 0.6), sz * (0.7 + rnd() * 0.6)); dm.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); dm.updateMatrix(); ast.setMatrixAt(i, dm.matrix); }
    scene.add(ast); }

  // ---- il Sole: fotosfera con granulazione, protuberanze, raggi della corona, vento solare, riflessi di lente ----
  const sunTex = bake(1024, 512, NOISE + SPHERE_DIR + `varying vec2 vUv; void main() { vec3 p = sphereDir(vUv); float g = fbm3(p * 7.0) * 0.55 + fbm3(p * 20.0) * 0.45, cell = smoothstep(0.35, 0.8, fbm3(p * 34.0));
      float spots = smoothstep(0.68, 0.72, fbm3(p * 3.2 + 9.0)) * 0.7; vec3 hot = vec3(1.0, 0.95, 0.75), cool = vec3(1.0, 0.45, 0.08); gl_FragColor = vec4(mix(cool, hot, g * 0.7 + cell * 0.35) * (1.0 - spots * 0.65), 1.0); }`, {}, 6);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uTex: { value: sunTex } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP, vN, vW; void main() { vUv = uv; vP = position; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying vec3 vP, vN, vW; uniform float uT; uniform sampler2D uTex; void main() { vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float ndv = max(dot(n, V), 0.0);
      vec3 col = texture2D(uTex, vUv + vec2(uT * 0.004, 0.0)).rgb * (1.0 + 0.07 * sin(uT * 3.0 + vP.x * 9.0 + vP.y * 7.0));                  // la fotosfera ruota piano e ribolle appena
      col *= pow(ndv, 0.45) * 1.25 + 0.1; col += vec3(1.0, 0.5, 0.12) * pow(1.0 - ndv, 3.0) * 0.8; gl_FragColor = vec4(col * 1.4, 1.0); }` }));
  sun.position.copy(SUN); sun.scale.setScalar(SUNR); sun.frustumCulled = false; scene.add(sun);
  // raggi della corona (billboard con strisce radiali che ruotano e pulsano)
  const coronaTex = bake(512, 128, NOISE + `varying vec2 vUv; void main() { float a = vUv.x * 6.2831853; float ray = pow(fbm3(vec3(cos(a) * 3.0, sin(a) * 3.0, a * 2.0)), 2.2) * 2.6 + pow(fbm3(vec3(cos(a * 3.0) * 5.0, sin(a * 3.0) * 5.0, 1.0)), 3.0) * 1.4; gl_FragColor = vec4(vec3(min(ray / 4.0, 1.0)), 1.0); }`, {}, 1);
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uT: U.uT, uTex: { value: coronaTex } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform sampler2D uTex; void main() { vec2 p = (vUv - 0.5) * 2.0; float d = length(p), a = atan(p.y, p.x); if (d > 1.0) discard; float rd = 1.0 / 6.0;
      if (d < rd * 0.97) discard; float x = (d - rd) / (1.0 - rd);
      float u = a / 6.2831853; float ray = (texture2D(uTex, vec2(u + uT * 0.012, 0.5)).r * 0.65 + texture2D(uTex, vec2(u * 2.0 - uT * 0.02, 0.5)).r * 0.35) * 4.0;
      float fall = exp(-x * 3.2) * (1.0 - x), pulse = 0.85 + 0.25 * sin(uT * 1.7 + a * 3.0);
      vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.92, 0.7), exp(-x * 7.0)) * (fall * (0.35 + ray) * pulse + exp(-x * 14.0) * 1.2); gl_FragColor = vec4(col, 1.0); }` }));
  corona.position.copy(SUN); corona.scale.setScalar(SUNR * 12); corona.renderOrder = 3; corona.frustumCulled = false; scene.add(corona);
  for (const [sz, op] of [[60, 0.55], [150, 0.26]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: op })); sp.position.copy(SUN); sp.scale.setScalar(sz); sp.renderOrder = 3; scene.add(sp); }
  // protuberanze: archi di plasma che si alzano dalla superficie verso il percorso
  const promMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vW; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vN, vW; uniform float uT; void main() { float v = 0.6 + 0.5 * sin(uT * 2.0 + vUv.x * 22.0) * sin(uT * 1.1 + vUv.x * 7.0); float f = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 0.8); gl_FragColor = vec4(vec3(1.0, 0.5, 0.14) * (0.4 + f) * v * 1.4, 1.0); }' });
  const proms = [];
  for (const [nx, ny, nz, sz] of [[0.8, 0.25, 0.55, 0.55], [0.7, -0.45, 0.55, 0.42], [0.45, 0.65, 0.6, 0.35], [0.95, 0.0, 0.2, 0.7]]) {
    const n = new THREE.Vector3(nx, ny, nz).normalize(), m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 10, 48, Math.PI), promMat); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); m.rotateY(rnd() * 3); m.position.copy(SUN).addScaledVector(n, SUNR * 0.97); m.scale.setScalar(SUNR * sz * 1.2); m.frustumCulled = false; m.renderOrder = 4; scene.add(m); proms.push({ m, base: m.scale.x, ph: rnd() * 6 }); }
  // vento solare: particelle che si allontanano dal Sole
  const NW = 220, wind = { pos: new Float32Array(NW * 3), life: new Float32Array(NW), dir: [] };
  for (let i = 0; i < NW; i++) { const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(); wind.dir.push(d); wind.life[i] = rnd(); }
  const windPts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(wind.pos, 3)), new THREE.PointsMaterial({ map: glowTex, color: 0xffc070, size: 1.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 })); windPts.frustumCulled = false; windPts.renderOrder = 4; scene.add(windPts);
  // riflessi di lente: compaiono quando il Sole e' vicino al centro dello schermo
  const flares = []; for (const [k, sz, col] of [[-0.5, 0.35, 0xffb060], [-0.95, 0.22, 0x80b0ff], [0.5, 0.5, 0xff8040], [1.35, 0.3, 0xa0ffd0], [-1.7, 0.6, 0xffa050]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, opacity: 0 })); sp.renderOrder = 30; scene.add(sp); flares.push({ sp, k, sz }); }

  // ---- cometa che attraversa la scena (coda opposta al Sole) ----
  const comet = new THREE.Group(); scene.add(comet);
  const headS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); headS.scale.setScalar(4.2); comet.add(headS);
  const tailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uT; void main() { float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y; float w = (0.1 + 0.8 * smoothstep(0.0, 0.45, y)) * (1.0 - y) + 0.04; float a = (1.0 - smoothstep(0.0, w, x)) * smoothstep(0.0, 0.3, y) * pow(1.0 - y, 1.6) * (0.7 + 0.4 * sin(vUv.y * 40.0 - uT * 6.0) * sin(vUv.x * 17.0)); gl_FragColor = vec4(vec3(0.55, 0.78, 1.0) * a * 1.5, 1.0); }' });
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tailMat); tail.frustumCulled = false; tail.matrixAutoUpdate = false; scene.add(tail);

  // ---- buco nero: ombra, disco, anello di luce piegata, disco "piegato" sopra e sotto, getti relativistici ----
  const BH = new THREE.Vector3(14, 3, -80), BHR = 3.2;
  const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); hole.position.copy(BH); hole.scale.setScalar(BHR); hole.renderOrder = 4; hole.frustumCulled = false; scene.add(hole);
  const diskTex = bake(512, 64, NOISE + 'varying vec2 vUv; void main() { float u = vUv.x * 6.2831853, t = vUv.y; float st = fbm3(vec3(cos(u) * (1.2 + t * 3.0), sin(u) * (1.2 + t * 3.0), t * 9.0)); gl_FragColor = vec4(vec3(st), 1.0); }', {}, 1);
  const diskMat = (vis) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, uniforms: { uT: U.uT, uVis: { value: vis }, uTex: { value: diskTex } },
    vertexShader: 'varying vec3 vL; void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vL; uniform float uT, uVis; uniform sampler2D uTex; void main() { float rr = length(vL.xy), t = (rr - 1.7) / 4.6; if (t < 0.0 || t > 1.0) discard; float a = atan(vL.y, vL.x);
        float u = a + (1.4 / (t * 2.6 + 0.35)) * uT * 0.9; float st = texture2D(uTex, vec2(u / 6.2831853, t)).r, bands = 0.65 + 0.35 * sin(t * 60.0 + st * 8.0);
        float dop = 0.35 + 1.0 * (0.5 + 0.5 * cos(a - 0.9)); float inten = (1.0 - t) * (0.5 + 1.1 * st) * bands * dop * smoothstep(0.0, 0.06, t) * uVis;
        vec3 col = mix(vec3(1.0, 0.96, 0.85), vec3(1.0, 0.4, 0.08), pow(t, 0.7)) * inten * 1.55; gl_FragColor = vec4(col, 1.0); }` });
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.7, 6.3, 160, 8), diskMat(1)); disk.position.copy(BH); disk.scale.setScalar(BHR); disk.rotation.set(-1.42, 0.0, 0.5); disk.frustumCulled = false; disk.renderOrder = 5; scene.add(disk);
  const lensed = new THREE.Mesh(new THREE.RingGeometry(1.7, 6.3, 160, 8), diskMat(0.55)); lensed.position.copy(BH); lensed.scale.setScalar(BHR * 0.62); lensed.frustumCulled = false; lensed.renderOrder = 5; scene.add(lensed);   // il disco "visto dietro il buco nero"
  const haloMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uT; void main() { float d = length(vUv - 0.5) * 2.0; float ring = exp(-pow((d - 0.3) / 0.022, 2.0)) * (1.3 + 0.4 * sin(uT * 2.0)), glow = exp(-pow((d - 0.3) / 0.13, 2.0)) * 0.5; vec3 col = vec3(1.0, 0.78, 0.5) * ring + vec3(1.0, 0.45, 0.12) * glow; gl_FragColor = vec4(col, 1.0); }' });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(BHR * 14, BHR * 14), haloMat); halo.position.copy(BH); halo.renderOrder = 6; halo.frustumCulled = false; scene.add(halo);
  const jetMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vW; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vN, vW; uniform float uT; void main() { float fr = pow(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 1.5); float f = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.22, vUv.y) * fr * (0.7 + 0.45 * sin(vUv.x * 40.0 + vUv.y * 20.0 - uT * 5.0) * sin(vUv.x * 13.0 - uT * 2.0)); gl_FragColor = vec4(vec3(0.5, 0.7, 1.0) * f * 0.85, 1.0); }' });
  const jets = new THREE.Group(); jets.position.copy(BH); jets.rotation.copy(disk.rotation); scene.add(jets);
  for (const sgn of [1, -1]) { const g = new THREE.CylinderGeometry(0.05, 1.5, 30, 20, 8, true); g.translate(0, sgn * 15, 0); const m = new THREE.Mesh(g, jetMat); m.rotation.x = Math.PI / 2; if (sgn < 0) m.rotation.x = Math.PI / 2; m.scale.set(BHR * 0.6, BHR, BHR * 0.6); m.frustumCulled = false; m.renderOrder = 5; jets.add(m); if (sgn < 0) m.scale.y = -BHR; }

  // ---- l'altro portale (come quello della cantina), verticale, in fondo al percorso ----
  const PORTAL = new THREE.Vector3(0, 0, -104), PR = 4.2;
  const pMat = portalMaterial({ r: PR, reach: 9, wallX: 1e5, zMin: -1e6 });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), pMat); portal.position.copy(PORTAL); portal.renderOrder = 8; portal.frustumCulled = false; scene.add(portal);

  // ---- elementi che compaiono SOLO nelle finestre (dalla porta del tunnel e dal portale della cantina), lontani e non in primo piano: croce enorme che gira, secondo portale defilato ----
  const crossG = new THREE.Group(); crossG.visible = false; scene.add(crossG);
  { const m = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false });
    const bar = (sx, sy, sz, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.y = y; crossG.add(b); };
    bar(2.4, 26, 2.4, 13); bar(14, 2.4, 2.4, 19);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 })); halo.scale.set(70, 70, 1); halo.position.set(0, 17, -4); crossG.add(halo);
    crossG.position.set(14, -4, -190); crossG.renderOrder = -2; }
  const pMat2 = portalMaterial({ r: 4.2, reach: 9, wallX: 1e5, zMin: -1e6 }); pMat2.uniforms.uOpen.value = 1;
  const portal2 = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), pMat2); portal2.position.set(30, 9, -80); portal2.scale.setScalar(0.55); portal2.renderOrder = 8; portal2.frustumCulled = false; portal2.visible = false; scene.add(portal2);
  const EYE_FALL = new THREE.Vector3(-0.62, 0.78, 0.0), EYE_WIN = new THREE.Vector3(-0.2, 0.14, -0.97).normalize();
  // ---- polvere cosmica vicino alla camera: da' il senso della caduta ----
  const ND = 130, dust = { pos: new Float32Array(ND * 3), pts: null };
  for (let i = 0; i < ND; i++) { const a = rnd() * 6.283, r = 1.2 + rnd() * 7; dust.pos[i * 3] = Math.cos(a) * r; dust.pos[i * 3 + 1] = Math.sin(a) * r; dust.pos[i * 3 + 2] = -rnd() * 70; }
  dust.pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dust.pos, 3)), new THREE.PointsMaterial({ map: glowTex, color: 0xaecbff, size: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 })); dust.pts.frustumCulled = false; scene.add(dust.pts);

  // ---- scie di velocita' (si allungano verso il portale) e stelle di campo a diverse profondita' (parallasse) ----
  const NSK = 150, sk = { pos: new Float32Array(NSK * 6), a: [], z: [], len: [] };
  for (let i = 0; i < NSK; i++) { const an = rnd() * 6.283, r = 1.8 + rnd() * 9; sk.a.push([Math.cos(an) * r, Math.sin(an) * r]); sk.z.push(-rnd() * 90); sk.len.push(0.5 + rnd() * 1.3); }
  const streaks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sk.pos, 3)), new THREE.LineBasicMaterial({ color: 0xbcd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); streaks.frustumCulled = false; streaks.renderOrder = 3; scene.add(streaks);
  const NF = 280, fp = new Float32Array(NF * 3), fc = new Float32Array(NF * 3), fcol = [[0.7, 0.8, 1.0], [1.0, 0.85, 0.65], [0.85, 0.7, 1.0], [1.0, 1.0, 1.0]];
  for (let i = 0; i < NF; i++) { const an = rnd() * 6.283, r = 12 + rnd() * rnd() * 140; fp[i * 3] = Math.cos(an) * r; fp[i * 3 + 1] = Math.sin(an) * r * 0.8; fp[i * 3 + 2] = -rnd() * 150; const c = fcol[(rnd() * 4) | 0], b = 0.5 + rnd() * 0.9; fc[i * 3] = c[0] * b; fc[i * 3 + 1] = c[1] * b; fc[i * 3 + 2] = c[2] * b; }
  const fieldGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fp, 3)).setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const field = new THREE.Points(fieldGeo, new THREE.PointsMaterial({ map: glowTex, vertexColors: true, size: 0.9, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); field.frustumCulled = false; field.renderOrder = -4; scene.add(field);

  // ---- percorso: caduta accelerata verso il portale (la visuale e' libera) ----
  const DUR = 13, K = 10 / DUR;   // la caduta dura 13 s: tutta la scena e' pensata su 10 s di "tempo di scena" e viene dilatata (K); la durata si cambia qui
  S.DUR = DUR;
  const pathPos = (t, out) => { const z = -(2.5 * t + 0.7 * t * t); return out.set(0.5 * Math.sin(t * 0.9) + 0.015 * t * t, 0.35 * Math.sin(t * 0.7 + 1.0), z); };
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  let overlay = null;
  const ov = () => overlay ||= (() => { const d = document.createElement('div'); d.id = 'spacefade'; d.style.cssText = 'position:fixed;inset:0;z-index:60;background:#000;opacity:0;pointer-events:none;transition:opacity .5s'; document.body.appendChild(d); return d; })();

  let vigEl = null;   // vignettatura da obiettivo: bordi scuri, centro luminoso
  const vig = () => vigEl ||= (() => { const d = document.createElement('div'); d.id = 'spacevig'; d.style.cssText = 'position:fixed;inset:0;z-index:59;pointer-events:none;opacity:0;transition:opacity 1.2s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 48%,rgba(0,0,6,.55) 100%)'; document.body.appendChild(d); return d; })();
  // preparazione in anticipo (durante la cantina): cottura delle texture a strisce e precompilazione degli shader; a runtime resta solo il disegno
  S.prepared = false; S.preparing = false; S.compiled = false;
  // occhio gigante dietro di te (alto, a sinistra): quasi invisibile, lo si nota solo cercandolo; fa parte della caduta, non della finestra del portale
  const makeEye = () => { if (S.eye) return; S.eye = createGiantEye({ dir: new THREE.Vector3(-0.62, 0.78, 0.0), size: 600, distance: 850 }); S.eye.mat.depthTest = true; scene.add(S.eye.mesh); };
  S.prepare = () => { if (S.preparing || S.prepared) return; S.preparing = true; S.waitT = 0; };
  S.warm = (dt = 0.016) => {   // un passo per fotogramma
    if (!S.preparing || S.prepared) return; S.waitT += dt; if (S.waitT < 3.0) return;   // lascia passare l'ingresso nella cantina
    if (bakeStep()) return;
    makeEye(); S.prepared = true; try { renderer.compileAsync(scene, sc).then(() => { S.compiled = true; }).catch(() => { S.compiled = true; }); } catch (e) { S.compiled = true; }
  };
  S.finish = () => { let n = 0; while (bakeStep() && n++ < 400); makeEye(); S.prepared = true; if (!S.compiled) { try { renderer.compile(scene, sc); } catch (e) {} S.compiled = true; } };   // se serve subito, si fa sotto il nero
  // qualita' adattiva durante la caduta: scala la risoluzione se i fotogrammi sono lenti
  S.perf = (elapsed) => { if (!S.active) return; S.pf = (S.pf ?? 0) * 0.9 + elapsed * 0.1; S.pn = (S.pn || 0) + 1;
    if (S.pn > 10 && S.pf > 0.034 && S.pr > 0.55) { S.pr = Math.max(0.55, S.pr * 0.88); renderer.setPixelRatio(S.pr); S.pn = 0; } };
  S.start = (onDone, seam = null) => {
    if (S.phase !== 'idle') return;
    if (seam) {   // CADUTA DAL PORTALE: nessun nero, nessun caricamento; si e' gia' dentro l'immagine del buco
      S.finish(); S.onDone = onDone; S.pr0 = renderer.getPixelRatio(); S.pr = Math.min(S.pr0, 0.9); S.pf = 0; S.pn = 0; renderer.setPixelRatio(S.pr);
      const pose = mapPose(seam.camPos, seam.camQuat, seam.portalC, { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }); S.seam = { off: pose.pos.clone(), q: pose.quat.clone() };
      S.active = true; S.phase = 'fall'; S.t = 0; clock.t = 0; player.speedMul = 0; player.frozen = false; vig().style.opacity = 1; audio.space?.(DUR); say('Non puoi muoverti.\nGuardati intorno.', 3400); return;
    } S.phase = 'in'; S.onDone = onDone; S.t = 0; const o = ov(); o.style.background = '#000'; o.style.transition = 'opacity .5s'; o.style.opacity = '1';
    setTimeout(() => {
      S.finish(); S.pr0 = renderer.getPixelRatio(); S.pr = Math.min(S.pr0, 0.9); S.pf = 0; S.pn = 0; renderer.setPixelRatio(S.pr);   // risoluzione un po' piu' bassa: la scena e' morbida e va fluida
      S.active = true; S.phase = 'fall'; S.t = 0; clock.t = 0; player.speedMul = 0; player.yaw = 0; player.pitch = 0;   // da fermo, guardando in avanti
      o.style.transition = 'opacity .9s'; o.style.opacity = '0'; vig().style.opacity = 1; audio.space?.(DUR); say('Non puoi muoverti.\nGuardati intorno.', 3400);
    }, 600);
  };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), mx = new THREE.Matrix4(), zAx = new THREE.Vector3(0, 0, 1);
  // ---- nucleo del disegno: aggiorna tutto cio' che si muove nella scena per il tempo T, con la camera data (percorso della caduta, oppure posa esterna S.ext) ----
  const core = (dt, T, win = false) => {
    U.uT.value = T;
    { const lite = win; dust.pts.visible = !lite; windPts.visible = !lite; streaks.visible = !lite; S.ast.visible = !lite; for (const pl of planets) if (pl.m !== gas) pl.m.visible = !lite; corona.visible = !lite; for (const m of moons) m.m.visible = !lite; for (const m of proms) m.m.visible = !lite; for (const b of brights) b.sp.visible = !lite; jets.visible = halo.visible = !lite; for (const o of sky.children) if (o !== skyMesh) o.visible = !lite || o.userData.keepWin === true; }   // nelle finestre: meno particolari (lune, protuberanze, stelle a raggi, getti, galassie piccole)   // nelle finestre: via polvere, vento solare, scie e asteroidi (poco visibili da lontano, molto costosi)
    disk.visible = lensed.visible = !win; if (win) for (const f of flares) f.sp.material.opacity = 0;
    { const showEye = !!S.eye && (!win || !!S.opts?.eye); if (S.eye) { S.eye.mesh.visible = showEye; if (showEye) { S.eye.dir.copy(win ? EYE_WIN : EYE_FALL); S.eye.mesh.scale.setScalar(win ? 0.36 : 1); } }
      crossG.visible = win && !!S.opts?.cross; if (crossG.visible) crossG.rotation.y += dt * 0.12; portal2.visible = win && !!S.opts?.portal; pMat2.uniforms.uT.value = T; }
    for (const p of planets) p.m.rotation.y += p.spin * dt;
    if (S.ext) sc.position.copy(S.ext.pos); else { const t = Math.min(10, T); pathPos(t, tmp); sc.position.copy(tmp); }
    sc.aspect = camera.aspect; { const u = win ? 0 : Math.min(1, Math.max(0, (T - 5.5) / 4.5)); sc.fov = camera.fov * (1 + 0.2 * u * u * (3 - 2 * u)); } sc.updateProjectionMatrix();
    if (S.ext) sc.quaternion.copy(S.ext.quat); else { sc.quaternion.copy(camera.quaternion); q.setFromAxisAngle(zAx, 0.035 * Math.sin(T * 0.8)); sc.quaternion.multiply(q); }   // piccolo rollio: sembra di cadere
    sky.position.copy(sc.position); sc.updateMatrixWorld(true);
    if (S.eye && S.eye.mesh.visible) S.eye.update(dt, sc);
    halo.quaternion.copy(sc.quaternion); lensed.quaternion.copy(sc.quaternion); corona.quaternion.copy(sc.quaternion);
    for (const m of scene.children) if (m.userData.bb) m.quaternion.copy(sc.quaternion);   // nebulose sempre di fronte (rotazione fissa sullo schermo)
    // lune che orbitano attorno al gigante gassoso
    for (const m of moons) { const a = m.ph + T * m.sp; m.m.position.set(gas.position.x + Math.cos(a) * m.r0, gas.position.y + Math.sin(a) * m.r0 * m.inc, gas.position.z + Math.sin(a) * m.r0 * 0.9); }
    // stelle luminose che scintillano
    for (const b of brights) { b.sp.scale.setScalar(b.sz * (0.8 + 0.25 * Math.sin(T * 2.2 + b.ph))); }
    // protuberanze che respirano
    for (const p of proms) p.m.scale.setScalar(p.base * (0.9 + 0.2 * Math.sin(T * 0.9 + p.ph)));
    // vento solare: particelle che salgono dalla fotosfera e si disperdono
    for (let i = 0; i < NW; i++) { wind.life[i] += dt * 0.12; if (wind.life[i] > 1) wind.life[i] -= 1; const r = SUNR * (1.05 + wind.life[i] * 5.0), d = wind.dir[i];
      wind.pos[i * 3] = SUN.x + d.x * r; wind.pos[i * 3 + 1] = SUN.y + d.y * r; wind.pos[i * 3 + 2] = SUN.z + d.z * r; }
    windPts.geometry.attributes.position.needsUpdate = true;
    // riflessi di lente: file di cerchi lungo la retta Sole-centro dello schermo
    v1.copy(SUN).project(sc); const inFront = v1.z < 1 && v1.z > -1, nd = Math.hypot(v1.x, v1.y), vis = inFront ? 1 - Math.min(1, Math.max(0, (nd - 0.15) / 1.1)) : 0;
    for (const f of flares) { if (win || vis < 0.01) { f.sp.material.opacity = 0; continue; } v2.set(v1.x * -f.k, v1.y * -f.k, 0.5).unproject(sc); v3.copy(v2).sub(sc.position).normalize(); f.sp.position.copy(sc.position).addScaledVector(v3, 3); f.sp.scale.setScalar(f.sz * 3 * (1 + 0.15 * Math.sin(T * 3 + f.k))); f.sp.material.opacity = 0.5 * vis; }
    // cometa: attraversa da destra a sinistra tra 2,2 s e 6,5 s; la coda punta lontano dal Sole
    { const k = (T - 2.2) / 4.3; comet.visible = tail.visible = !win && k > 0 && k < 1;
      if (comet.visible) { comet.position.set(26 - k * 56, 13 - k * 24, -22 - k * 34); v1.copy(comet.position).sub(SUN).normalize(); v2.copy(comet.position).sub(sc.position).normalize(); v3.crossVectors(v1, v2).normalize();
        const len = 22; mx.makeBasis(v3.multiplyScalar(2.2), v1.clone().multiplyScalar(len), v2); mx.setPosition(comet.position.x + v1.x * len * 0.5, comet.position.y + v1.y * len * 0.5, comet.position.z + v1.z * len * 0.5); tail.matrix.copy(mx); tail.matrixWorldNeedsUpdate = true;
        tail.geometry.attributes.uv; } }
    // scie di velocita': lunghezza e visibilita' crescono con la velocita' (soprattutto verso il portale)
    { const sp = 2.5 + 1.4 * Math.min(10, T), u = Math.min(1, Math.max(0, (T - 2.5) / 6.5)), cz = sc.position.z;
      for (let i = 0; i < NSK; i++) { if (sk.z[i] > cz + 2) sk.z[i] -= 90; const z0 = sk.z[i], ln = sk.len[i] * sp * 0.22 * (0.4 + u * 2.2), a = sk.a[i];
        sk.pos[i * 6] = a[0]; sk.pos[i * 6 + 1] = a[1]; sk.pos[i * 6 + 2] = z0; sk.pos[i * 6 + 3] = a[0]; sk.pos[i * 6 + 4] = a[1]; sk.pos[i * 6 + 5] = z0 - ln; }
      streaks.geometry.attributes.position.needsUpdate = true; streaks.material.opacity = win ? 0 : 0.55 * u * u; }
    // polvere cosmica: scorre vicino alla camera
    for (let i = 0; i < ND; i++) { if (dust.pos[i * 3 + 2] - sc.position.z > 1.5) dust.pos[i * 3 + 2] -= 70; dust.pos[i * 3] += 0; }
    dust.pts.geometry.attributes.position.needsUpdate = true;
    pMat.uniforms.uOpen.value = win ? 0 : Math.min(1, Math.max(0, (T - 5.2) / 3.4)); pMat.uniforms.uT.value = T;
  };
  // ---- FINESTRA SUL PORTALE: la scena dello spazio vista attraverso il buco nel pavimento della cantina, a bassa risoluzione, con la stessa camera del giocatore
  // (la direzione "giu'" della cantina diventa "avanti" nello spazio, cosi' dal buco si vede il cielo con i pianeti, il Sole e il buco nero). ----
  const qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), vtmp = new THREE.Vector2();
  const winRT = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true, samples: 2, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); winRT.texture.colorSpace = THREE.SRGBColorSpace;
  S.win = { tex: winRT.texture, res: new THREE.Vector2(2, 2), wt: 0 }; S.ext = null; S.seam = null;
  const mapPose = (camPos, camQuat, pc, out, q = qR) => { out.pos.copy(camPos).sub(pc).applyQuaternion(q); out.quat.copy(camQuat).premultiply(q); return out; };
  const extWin = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  S.drawWindow = (dt, camPos, camQuat, pc, q, opts = null) => { S.opts = opts;
    if (!S.prepared || S.active) return false;
    renderer.getDrawingBufferSize(vtmp); const w = Math.max(64, Math.round(vtmp.x * 0.32)), h = Math.max(64, Math.round(vtmp.y * 0.32)); if (winRT.width !== w || winRT.height !== h) winRT.setSize(w, h); S.win.res.copy(vtmp);
    S.win.wt += dt; S.ext = mapPose(camPos, camQuat, pc, extWin, q); core(dt, S.win.wt, true); const prev = renderer.getRenderTarget(); renderer.setRenderTarget(winRT); renderer.render(scene, sc); renderer.setRenderTarget(prev); S.ext = null; S.opts = null; return true;
  };
  S.update = (dt) => {
    if (!S.active) return; S.t += dt; const TR = S.t, T = S.t * K;
    if (S.seam) {   // arrivo senza stacco: la posa parte esattamente da quella vista dal buco, poi si scioglie nel percorso e nella visuale libera
      const s = Math.min(1, S.t / 1.4), e = s * s * (3 - 2 * s), sm = S.seam; S.ext ||= { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
      pathPos(Math.min(10, T), tmp); S.ext.pos.copy(tmp).addScaledVector(sm.off, 1 - e); S.ext.quat.copy(sm.q).slerp(camera.quaternion, e);
      player.yaw -= player.yaw * Math.min(1, dt * 2.4); player.pitch -= player.pitch * Math.min(1, dt * 2.4);
      if (s >= 1) { S.seam = null; S.ext = null; }
    }
    core(dt, T);
    if (T > 2.9 && !S.said0) { S.said0 = true; say('ogni stella è un fuoco\nacceso prima del tempo.', 2600); }
    if (T > 4.6 && !S.said1) { S.said1 = true; say('Il plasma delle stelle ti attraversa.', 2600); }
    if (T > 6.0 && !S.said3) { S.said3 = true; say('luce prestata.\nbasta per un solo gesto.', 2400); }
    if (T > 7.4 && !S.said2) { S.said2 = true; say('Un varco si apre davanti a te.', 2800); }
    if (TR >= DUR - 0.5 && S.phase === 'fall') { S.phase = 'out'; const o = ov(); o.style.background = '#fff'; o.style.transition = 'opacity .45s'; o.style.opacity = '1'; }
    if (TR >= DUR) { S.active = false; S.phase = 'idle'; S.said0 = S.said1 = S.said2 = S.said3 = false; S.seam = null; S.ext = null; player.speedMul = 1; vig().style.opacity = 0; if (S.pr0) renderer.setPixelRatio(S.pr0); S.onDone?.(); setTimeout(() => { const o = ov(); o.style.transition = 'opacity 1.1s'; o.style.opacity = '0'; }, 1800); }
  };
  S.render = () => renderer.render(scene, sc);
  return S;
}
