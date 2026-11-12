// Sala oltre il portone: pavimento ampio, panorama scurito come sfondo e una folla di sagome nere ferme in file,
// tutte rivolte verso il giocatore. Le sagome sono pose "cotte" (nessuno scheletro): materiale nero, 1 draw call l'una.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END, DOOR } from '../world/tunnel.js';
import { buildRoom } from '../world/rooms.js';
import { decorHall } from '../world/decor.js';

const TYPES = [
  ['whisperer', 2.5], ['pirate', 1.95], ['nurse', 1.72], ['occ', 1.98], ['diver', 1.85], ['bell', 2.6], ['varka', 1.92], ['root', 3.6],
];
// file → [x, riga z, indice tipo] (riga 0 = più vicina). Disposizione fissa: stesso risultato a ogni partita.
const LAYOUT = [
  [-4.2, 0, 3], [-1.4, 0, 1], [1.9, 0, 2], [4.6, 0, 6],
  [-7.0, -3.4, 1], [-3.6, -3.2, 4], [0.2, -3.6, 0], [3.4, -3.3, 5], [6.8, -3.5, 3],
  [-8.6, -7, 2], [-5.4, -6.8, 6], [-2.0, -7.2, 7], [2.2, -6.9, 4], [5.6, -7.1, 1], [9.0, -6.8, 0],
];

export function createHall({ scene, mats, lights }) {
  const H = { ready: false, glow: 0, target: 0, flick: 0, dist: 26, active: false };
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);

  // la sala: pavimento, soffitto, muri di mattoni, pilastri; il vano della porta combacia con quello del tunnel
  const room = buildRoom(mats, { z0: Z_END - 0.35, w: 12, l: 40, h: 6, wall: 'brick', floor: 'floorB', ceil: 'stone', pillarEvery: 6, door: { w: DOOR.w, h: DOOR.h }, dark: 0.9, seed: 11 });
  grp.add(room.group); H.bounds = room.bounds; decorHall(grp, Z_END - 0.35);
  // grande apertura luminosa in fondo (è il controluce delle sagome)
  const wc = document.createElement('canvas'); wc.width = 256; wc.height = 256; const wg = wc.getContext('2d');
  const rg = wg.createRadialGradient(128, 150, 10, 128, 150, 128); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.55, 'rgba(255,255,255,.8)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  wg.fillStyle = rg; wg.beginPath(); wg.moveTo(20, 256); wg.lineTo(20, 110); wg.arc(128, 110, 108, Math.PI, 0); wg.lineTo(236, 256); wg.closePath(); wg.fill();
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wc), color: new THREE.Color(0.1, 0.13, 0.12), transparent: true, opacity: 0, fog: false, depthWrite: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), glowMat); win.position.set(0, 3.9, Z_END - 40.35 + 0.05); grp.add(win);

  // la folla e il bagliore dietro di essa
  const crowd = new THREE.Group(); grp.add(crowd);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  // la folla: corpo quasi nero + SOLO contorno illuminato (rim) dalle lampade alle spalle. Più è vicina, più il corpo si spegne
  // e resta il contorno: da vicino non si vedono i dettagli del modello, solo una sagoma con il bordo di luce.
  const rimU = { value: 0 };
  const mkLit = () => { const m = new THREE.MeshLambertMaterial({ color: 0x1d1c1c });   // Lambert: niente riflesso speculare, così la torcia da vicino non li "accende" (lo specular dielettrico li faceva sembrare chiari)
    m.onBeforeCompile = (sh) => { sh.uniforms.uRim = rimU; sh.uniforms.uNear = { value: 0 }; m.userData.sh = sh;
      sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObj = position;');
      sh.fragmentShader = `uniform float uRim; uniform float uNear; varying vec3 vObj;
        float hh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }
` + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          // sangue (solo da vicino): chiazze morbide a più ottave + colature verticali; niente griglia, bordi sfumati
          float nA = vn(vObj * vec3(2.4, 1.0, 2.4)) * 0.62 + vn(vObj * vec3(5.6, 2.4, 5.6)) * 0.38;
          float blot = smoothstep(0.60, 0.74, nA);
          float drip = smoothstep(0.58, 0.78, vn(vec3(vObj.x * 17.0, vObj.y * 1.3, vObj.z * 17.0))) * smoothstep(0.50, 0.66, vn(vObj * vec3(2.0, 0.8, 2.0) + 7.3));
          float stain = clamp(blot * 0.85 + drip, 0.0, 1.0) * uNear;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.003, 0.004) * (0.7 + 0.6 * nA), stain);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float rimF = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 5.0);
          float topF = clamp(normalize(vNormal).y * 0.5 + 0.55, 0.0, 1.0);
          totalEmissiveRadiance += vec3(1.0, 0.58, 0.26) * rimF * topF * uRim * (0.16 * (1.0 - uNear) + 0.05 * uNear);`); };
    m.customProgramCacheKey = () => 'crowdrim4'; return m; };
  // occhio: NON un tondo. Una fenditura morbida e un po' storta (più larga che alta), con un nucleo appena più chiaro decentrato, bordi sfumati e grana: sembra
  // un riflesso umido nel buio, spiritato, non una lucina. Colore smorzato (ambra pallida), da usare a bassissima opacità.
  const ecv = document.createElement('canvas'); ecv.width = 128; ecv.height = 64; { const g = ecv.getContext('2d'); g.clearRect(0, 0, 128, 64);
    g.save(); g.translate(64, 32); g.rotate(-0.08); g.scale(1, 0.42);
    const r = g.createRadialGradient(-3, 0, 0, 0, 0, 52); r.addColorStop(0, 'rgba(255,236,200,.9)'); r.addColorStop(.18, 'rgba(255,196,130,.55)'); r.addColorStop(.5, 'rgba(210,120,60,.16)'); r.addColorStop(1, 'rgba(180,80,30,0)');
    g.fillStyle = r; g.fillRect(-64, -64, 128, 128); g.restore();
    const img = g.getImageData(0, 0, 128, 64), d = img.data; for (let k = 0; k < d.length; k += 4) { const n = 0.72 + 0.28 * Math.random(); d[k] *= n; d[k + 1] *= n; d[k + 2] *= n; d[k + 3] *= n; } g.putImageData(img, 0, 0); }
  const eyeTex = new THREE.CanvasTexture(ecv), eyeCache = [];
  const eyeInfo = (t, ge) => (eyeCache[t] ??= (() => {   // altezza, profondità e distanza degli occhi dalla fascia della testa del modello (davanti = +z)
    const pos = ge.attributes.position, h = TYPES[t][1]; let zmax = -1e9, xmin = 1e9, xmax = -1e9;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > 0.84 * h && y < 0.96 * h) { zmax = Math.max(zmax, pos.getZ(i)); xmin = Math.min(xmin, pos.getX(i)); xmax = Math.max(xmax, pos.getX(i)); } }
    return { y: 0.9 * h, z: zmax > -1e8 ? zmax : 0.1, dx: Math.max(0.03, Math.min(0.07 * h, (xmax - xmin) * 0.2)) };
  })());
  // OCCHI SOLO DOVE SONO SICURI: i modelli sono a colori per vertice; gli occhi veri (bianchi, iride, o gialli) si riconoscono dal colore. Si cercano nella fascia
  // della testa, si divide a meta' in sinistro/destro e si prende il centro di ciascuno: cosi' la luce cade esattamente sugli occhi del modello.
  // Senza occhi veri (whisperer, palombaro, campana, occ a 6 occhi) niente luce.
  const near = (c, r, e = 0.035) => Math.abs(c[0] - r[0]) < e && Math.abs(c[1] - r[1]) < e && Math.abs(c[2] - r[2]) < e;
  const EYE_RULES = {
    pirate: { test: (c) => near(c, [0.79, 0.82, 0.74]), w: 0.05 },        // occhi bianchi
    nurse: { test: (c) => near(c, [0.43, 0.12, 0.14]), w: 0.045 },        // iridi rosso-brune
    varka: { test: (c) => near(c, [1.0, 0.76, 0.19]), test2: (c) => near(c, [0.39, 0.34, 0.29]), w: 0.045 },   // occhio acceso + l'altro
  };
  const EYES = {};
  const findEyes = (geo, rule, h, s, miny, cx, cz) => {
    const P = geo.attributes.position, C = geo.attributes.color; if (!C) return null; const A = [], Bc = [];
    for (let i = 0; i < P.count; i++) {
      const y = (P.getY(i) - miny) * s; if (y < 0.78 * h) continue; const c = [C.getX(i), C.getY(i), C.getZ(i)], q = [(P.getX(i) - cx) * s, y, (P.getZ(i) - cz) * s];
      if (rule.test(c)) A.push(q); else if (rule.test2 && rule.test2(c)) Bc.push(q);
    }
    const mean = (L) => L.length ? L.reduce((a, q) => [a[0] + q[0] / L.length, a[1] + q[1] / L.length, a[2] + q[2] / L.length], [0, 0, 0]) : null;
    let out;
    if (rule.test2) out = [mean(A), mean(Bc)];
    else { if (A.length < 2) return null; const mx = mean(A)[0]; out = [mean(A.filter((q) => q[0] < mx)), mean(A.filter((q) => q[0] >= mx))]; }
    if (!out[0] || !out[1]) return null; return { p: out, w: rule.w };
  };
  const loader = new GLTFLoader();
  Promise.all(TYPES.map(([n, h]) => new Promise((res) => loader.load(`assets/models/m_${n}.glb`, (gl) => {
    const geos = []; gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o) => { if (o.isMesh) { const ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld); geos.push(ge); } });
    const merged = geos[0]; // un solo mesh per modello
    merged.deleteAttribute('uv'); merged.deleteAttribute('color_0'); merged.deleteAttribute('COLOR_0');
    merged.computeBoundingBox(); const b = merged.boundingBox, s = h / (b.max.y - b.min.y);
    const cxm = (b.max.x + b.min.x) / 2, czm = (b.max.z + b.min.z) / 2, rule = EYE_RULES[n];
    if (rule) EYES[n] = findEyes(merged, rule, h, s, b.min.y, cxm, czm);
    merged.translate(-cxm, -b.min.y, -czm); merged.scale(s, s, s); merged.computeVertexNormals();
    res(merged);
  }, undefined, () => res(null))))).then((geos) => {
    LAYOUT.forEach(([x, z, t], i) => {
      const ge = geos[t]; if (!ge) return;
      const m = new THREE.Mesh(ge, mkLit()); m.userData.crowd = true; m.position.set(x * 0.6 + Math.sin(i * 7.3) * 0.3, 0, z + Math.cos(i * 3.1) * 0.4);
      m.rotation.y = Math.sin(i * 5.7) * 0.28; m.matrixAutoUpdate = true; crowd.add(m);
      // occhi: solo sui tipi dove li abbiamo trovati con sicurezza (vedi EYE_RULES): sprite tenue sul punto esatto
      const E = EYES[TYPES[t][0]];
      if (E) m.userData.eyes = E.p.map((q, k) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 })); sp.scale.set(E.w * 1.9, E.w * 0.9, 1); sp.material.rotation = (k ? 0.06 : -0.06) + Math.sin(i * 3.7 + k) * 0.08; sp.position.set(q[0], q[1], q[2] + 0.012); m.add(sp); return sp; });
    });
    H.geos = geos; H.ready = true; pending.forEach(([m, i]) => { if (geos[i]) m.geometry = geos[i]; });
  });

  const pending = [];
  H.silhouette = (i) => { const m = new THREE.Mesh(H.geos ? H.geos[i] : new THREE.BufferGeometry(), black); if (!H.geos) pending.push([m, i]); return m; };
  H.group = grp;
  // LAMPIONI vittoriani FISSI in fondo alla sala: uno a metà, due sul fondo. Restano dove sono: la folla avanza verso di te
  // e a ogni passo ha la luce alle spalle. Corpo in ghisa scura, luce calda di lampione; la lampadina pulsa.
  const HZ = Z_END - 0.35, lampAnchors = [[1.3, 3.55, HZ - 23], [-3.4, 3.55, HZ - 36], [3.6, 3.55, HZ - 36.5]], lampBulbs = [], lampGlows = [];
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = 128; const gg2 = gcv.getContext('2d'); const gr2 = gg2.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr2.addColorStop(0, 'rgba(255,240,200,1)'); gr2.addColorStop(.18, 'rgba(255,200,120,.75)'); gr2.addColorStop(.5, 'rgba(255,150,60,.18)'); gr2.addColorStop(1, 'rgba(255,120,40,0)'); gg2.fillStyle = gr2; gg2.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gcv);
  new GLTFLoader().load('assets/models/slamp1.glb', (g) => lampAnchors.forEach(([x, y, z], i) => {
    const o = g.scene.clone(true); o.position.set(x, 0, z); o.rotation.y = i * 0.9 - 0.4; grp.add(o);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false })); bulb.position.set(x, y + 0.06, z); grp.add(bulb); lampBulbs[i] = bulb;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb860, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 }));
    sp.scale.setScalar(2.6); sp.position.set(x, y + 0.06, z); grp.add(sp); lampGlows[i] = sp;
  }));
  H.setDist = (d) => { H.dist = d; crowd.position.z = Z_END - d; };
  H.enable = () => { H.active = true; grp.visible = true; H.setDist(H.dist); lights?.setLamps(lampAnchors.map(([x, y, z]) => [x, y - 0.1, z]), 3.4, 0xffc27a); [0, 1, 2].forEach((i) => lights?.lamp(i, 'off')); };
  H.lightOn = () => { H.target = 1; H.flick = 1.1; [0, 1, 2].forEach((i) => lights?.lamp(i, 'flicker', 0.8 + i * 0.3)); setTimeout(() => { if (H.target) [0, 1, 2].forEach((i) => lights?.lamp(i, 'pulse')); }, 1500); };
  H.lightOff = () => { H.target = 0; H.flick = 0; H.glow = 0; [0, 1, 2].forEach((i) => lights?.lamp(i, 'off')); };

  const wp = new THREE.Vector3(), camPos = new THREE.Vector3(); let lampPulseV = 1, time2 = 0;
  const lampPulse = () => lampPulseV;
  H.update = (dt, cam) => {
    if (cam) camPos.copy(cam.position);
    { const L = lights?.lamps; lampPulseV = L && L.length ? Math.min(1, L.reduce((a, l) => a + (l.level ?? 0), 0) / L.length) : 1; }
    if (!H.active || !grp.visible) return;
    if (H.flick > 0) H.flick -= dt;
    const k = H.target * (H.flick > 0 ? (Math.random() > 0.5 ? 1 : 0.08) : 1);
    H.glow += (k - H.glow) * Math.min(1, dt * (k > H.glow ? 14 : 30));
    const v = H.glow; time2 += dt;
    glowMat.opacity = Math.min(1, v) * 0.38;
    rimU.value = Math.min(1, v) * (0.5 + 0.5 * lampPulse());
    crowd.children.forEach((m) => { if (!m.userData.crowd) return; const d = Math.hypot(m.getWorldPosition(wp).x - camPos.x, wp.z - camPos.z), near = Math.min(1, Math.max(0, (15 - d) / 8));
      m.material.color.setScalar(0.06 * (1 - 0.9 * near));   // da vicino: sagoma quasi nera, niente dettaglio
      if (m.material.userData.sh) m.material.userData.sh.uniforms.uNear.value = near;
      if (m.userData.eyes) { const eo = (0.2 + 0.3 * Math.min(1, v)) * (0.8 + 0.2 * Math.sin(time2 * (1.3 + (m.id % 5) * 0.2) + m.id)) * (Math.sin(time2 * 0.37 + m.id * 2.1) > 0.985 ? 0.2 : 1);  m.userData.eyes.forEach((s) => { s.material.opacity = eo; }); } });
    crowd.visible = true;                                     // la visibilità la decide la luce, non un interruttore
    lights?.lamps?.forEach((L, i) => { const lv = L.level ?? 0; if (lampGlows[i]) { lampGlows[i].material.opacity = Math.min(1, lv) * 0.85; lampBulbs[i].material.color.setRGB(1, 0.78 + 0.1 * lv, 0.45 + 0.3 * lv).multiplyScalar(0.25 + 0.9 * lv); } });
    scene.fog.density += (0.026 - scene.fog.density) * Math.min(1, dt * 2);   // nebbia più rada: si deve vedere in fondo alla sala
  };
  return H;
}
