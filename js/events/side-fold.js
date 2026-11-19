// LA PORTA LATERALE E IL PASSAGGIO CHE SI PIEGA (primo tunnel): sul muro destro c'e' una porta; in fondo a un piccolo passaggio, lontano, si intravede una stanza sospesa nel vuoto con una croce enorme e una luce
// che sfarfalla (niente muri: solo luce, polvere, stelle). Entrando nel passaggio la luce si spegne, la stanza sparisce e il passaggio si piega davanti a te (U in pianta, la visuale ruota con la curva).
// Quando arrivi in fondo alla curva c'e' un attimo di buio e riemergi da una porta sul muro SINISTRO del tunnel, che prima non c'era; quella di destra si richiude.
// Tutto con materiali senza luci in piu' (la luce e' "dipinta": emissivo, additivo). ?porta=0 spegne l'evento (il tunnel resta com'era, con i varchi chiusi dai tamponi).
import * as THREE from 'three';
import { W, SIDE_DOORS, Z_END } from '../world/tunnel.js';
import { TILES } from '../world/materials.js';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const R_DOOR = SIDE_DOORS[0], L_DOOR = SIDE_DOORS[1], ZR = R_DOOR.z, ZL = L_DOOR.z, XD = W, PW = 0.7, PH = R_DOOR.h, LEN = 14, S0 = XD + 2.6, KEND = 0.4;
const RADIUS = 0.32;

const radial = (stops, size = 128) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const linear = (stops, w = 8, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = g.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createSideFold({ scene, tunnel, mats, player, camera, audio, lights, say, instab, getSpace }) {
  const F = { state: 'idle', t: 0, done: false, enabled: true };
  const G = new THREE.Group(); G.name = 'porta-laterale'; scene.add(G);
  const U = { uK: { value: 0 }, uGlow: { value: 0 }, uS0: { value: S0 }, uZ0: { value: ZR } };
  // ---- materiali del passaggio: cloni dei mattoni/pavimento del tunnel con la piega e il bagliore nello shader ----
  const patch = (mat, key) => { mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uK, uS0, uZ0; varying float vRx;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz; if (uK > 1e-4 && wp0.x > uS0) { float ph = min(uK * (wp0.x - uS0), 3.14159), c = cos(ph), s = sin(ph); vec3 wn = mat3(modelMatrix) * objectNormal; float nx = wn.x, nz = wn.z; wn.x = nx * c - nz * s; wn.z = nx * s + nz * c; objectNormal = normalize(transpose(mat3(modelMatrix)) * wn); } }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp = modelMatrix * vec4(transformed, 1.0); vRx = wp.x;
          if (uK > 1e-4 && wp.x > uS0) { float u = wp.x - uS0, ph = uK * u, d = wp.z - uZ0; vec2 c2, nr;
            if (ph < 3.14159) { c2 = vec2(uS0 + sin(ph) / uK, uZ0 + (1.0 - cos(ph)) / uK); nr = vec2(-sin(ph), cos(ph)); }
            else { float rest = u - 3.14159 / uK; c2 = vec2(uS0 - rest, uZ0 + 2.0 / uK); nr = vec2(0.0, -1.0); }
            wp.x = c2.x + d * nr.x; wp.z = c2.y + d * nr.y; transformed = (inverse(modelMatrix) * wp).xyz; } }`);
    sh.fragmentShader = 'uniform float uGlow; varying float vRx;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.78, 0.48) * uGlow * pow(smoothstep(4.0, 15.0, vRx), 1.6) * 0.9;`);
  }; mat.customProgramCacheKey = () => 'sidefold-' + key; return mat; };
  const wallM = patch(mats.brick.clone(), 'w'), floorM = patch(mats.floorA.clone(), 'f');
  const colorAttr = (g, v) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const quadGeo = (w, h, nx, mat4, uvf) => { const g = new THREE.PlaneGeometry(w, h, nx, 1); g.applyMatrix4(mat4); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const [a, b] = uvf(p.getX(i), p.getY(i), p.getZ(i)); uv.setXY(i, a, b); } return colorAttr(g, 0.8); };
  const M = (rx, ry, x, y, z) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(1, 1, 1));
  const [bu, bv] = TILES.brick, [fu, fv] = TILES.floorA;
  const mesh = (g, m, parent) => { const o = new THREE.Mesh(g, m); o.frustumCulled = false; parent.add(o); return o; };
  // passaggio di destra (lungo LEN, aperto in fondo): pavimento, soffitto, due pareti
  const RP = new THREE.Group(); G.add(RP); const cx = XD + LEN / 2, nx = LEN * 4;
  mesh(quadGeo(LEN, PW * 2, nx, M(-Math.PI / 2, 0, cx, 0, ZR), (x, y, z) => [x / fu, z / fv]), floorM, RP);
  const NEARL = S0 - XD, FARL = LEN - NEARL;   // soffitto: solo i primi metri; il resto compare quando la luce si spegne (prima il passaggio e' aperto sul vuoto e si intravede la croce)
  mesh(quadGeo(NEARL, PW * 2, Math.round(NEARL * 4), M(Math.PI / 2, 0, XD + NEARL / 2, PH, ZR), (x, y, z) => [x / bu, z / bv]), wallM, RP);
  const ceilFar = mesh(quadGeo(FARL, PW * 2, Math.round(FARL * 4), M(Math.PI / 2, 0, S0 + FARL / 2, PH, ZR), (x, y, z) => [x / bu, z / bv]), wallM, RP); ceilFar.visible = false;
  mesh(quadGeo(LEN, PH, nx, M(0, 0, cx, PH / 2, ZR - PW), (x, y) => [x / bu, y / bv]), wallM, RP);
  mesh(quadGeo(LEN, PH, nx, M(0, Math.PI, cx, PH / 2, ZR + PW), (x, y) => [x / bu, y / bv]), wallM, RP);
  // passaggio di sinistra (6 m, chiuso in fondo), sullo stesso schema; nascosto finche' la porta non compare
  const LP = new THREE.Group(); LP.visible = false; G.add(LP); const lcx = -XD - 3, LL = 6;
  mesh(quadGeo(LL, PW * 2, 24, M(-Math.PI / 2, 0, lcx, 0, ZL), (x, y, z) => [x / fu, z / fv]), floorM, LP);
  mesh(quadGeo(LL, PW * 2, 24, M(Math.PI / 2, 0, lcx, PH, ZL), (x, y, z) => [x / bu, z / bv]), wallM, LP);
  mesh(quadGeo(LL, PH, 24, M(0, 0, lcx, PH / 2, ZL - PW), (x, y) => [x / bu, y / bv]), wallM, LP);
  mesh(quadGeo(LL, PH, 24, M(0, Math.PI, lcx, PH / 2, ZL + PW), (x, y) => [x / bu, y / bv]), wallM, LP);
  mesh(quadGeo(PW * 2, PH, 1, M(0, Math.PI / 2, -XD - LL, PH / 2, ZL), (x, y, z) => [z / bu, y / bv]), wallM, LP);
  // cornici di pietra attorno ai due varchi (spalle e architrave, sporgono 4 cm nel tunnel)
  // ---- PORTALE ANTICO E ROVINATO (ingresso e uscita): blocchi di pietra scheggiati, storti e mancanti, crepe nel muro, macerie e polvere, crepe e segni che brillano appena di una luce fredda ----
  const frameM = mats.stone.clone(); frameM.color.setRGB(0.8, 0.8, 0.86);
  const frng = (sd) => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const runeTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'), r = frng(17); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 34; i++) { let x = r() * 256, y = r() * 256, a = r() * 6.28; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * (10 + r() * 22); y += Math.sin(a) * (10 + r() * 22); g.lineTo(x, y); } g.strokeStyle = `rgba(120,170,255,${0.35 + r() * 0.4})`; g.lineWidth = 1 + r() * 1.4; g.stroke(); }   // crepe luminose
    for (let i = 0; i < 6; i++) { const x = 30 + (i % 3) * 78 + r() * 14, y = 40 + (i / 3 | 0) * 120 + r() * 14; g.strokeStyle = 'rgba(190,215,255,.9)'; g.lineWidth = 2.2; g.beginPath(); const k = i % 3;   // segni incisi: cerchio e raggi, triangolo, occhio
      if (k === 0) { g.arc(x, y, 14, 0, 7); g.moveTo(x - 22, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y + 22); } else if (k === 1) { g.moveTo(x, y - 18); g.lineTo(x + 17, y + 12); g.lineTo(x - 17, y + 12); g.closePath(); g.moveTo(x, y - 4); g.lineTo(x, y + 6); } else { g.ellipse(x, y, 20, 9, 0, 0, 7); g.moveTo(x + 5, y); g.arc(x, y, 5, 0, 7); } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const crackTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'), r = frng(23); g.lineCap = 'round';
    const crack = (x, y, a, len, w, d) => { g.strokeStyle = `rgba(6,5,5,${0.55 + r() * 0.35})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); let px = x, py = y; const n = 8; for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; g.lineTo(px, py); if (d > 0 && r() < 0.3) crack(px, py, a + (r() - 0.5) * 1.8, len * 0.5, w * 0.7, d - 1); } g.stroke(); };
    for (let i = 0; i < 22; i++) { const e = r(), x = e < 0.5 ? 256 + (r() < 0.5 ? -1 : 1) * (130 + r() * 90) : 256 + (r() - 0.5) * 360, y = e < 0.5 ? r() * 512 : (r() < 0.5 ? 30 + r() * 50 : 440 + r() * 50); crack(x, y, r() * 6.28, 50 + r() * 110, 1.5 + r() * 2.4, 2); }
    for (let i = 0; i < 16; i++) { const x = r() * 512, y = r() * 512, rad = 14 + r() * 38, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(4,4,3,${0.2 + r() * 0.25})`); gr.addColorStop(1, 'rgba(4,4,3,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }   // macchie di umidita' e fuliggine
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(256 - (PW + 0.55) / 3.2 * 512 / 2, 512 - (2.35 / 3.2) * 512 - 0, (PW + 0.55) / 3.2 * 512, (2.35 / 3.2) * 512);   // il vano e il portale restano liberi
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const runeMats = [], dustSets = [];
  // texture dell'anello decorato dell'arco (medaglioni con segni, stelle e spirali, in pietra consumata) e del timpano (anelli concentrici e sigillo); filigrana di bronzo e crepe luminose sulle colonne
  const archTex = (() => { const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = frng(31), cx = N / 2, cy = N / 2; g.fillStyle = '#5a554c'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.2 ? '60,74,50' : '14,12,10'},${r() * 0.28})`; g.fillRect(r() * N, r() * N, 2 + r() * 12, 2 + r() * 8); }
    g.strokeStyle = 'rgba(150,140,125,.6)'; g.lineWidth = 3; for (const rr of [0.5, 0.74, 0.97]) { g.beginPath(); g.arc(cx, cy, rr * cx, 0, 7); g.stroke(); }
    const sig = (x, y, rad, k) => { g.strokeStyle = 'rgba(190,180,160,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, rad, 0, 7); g.stroke(); g.beginPath(); if (k === 0) { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.moveTo(x + Math.cos(a) * rad * 0.3, y + Math.sin(a) * rad * 0.3); g.lineTo(x + Math.cos(a) * rad * 0.85, y + Math.sin(a) * rad * 0.85); } } else if (k === 1) { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad * 0.75, y + Math.sin(a) * rad * 0.75); } g.closePath(); } else if (k === 2) { for (let t = 0; t < 40; t++) { const a = t * 0.5, rr2 = rad * 0.1 + t * rad * 0.02; g[t ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } } else { g.ellipse(x, y, rad * 0.8, rad * 0.4, 0, 0, 7); g.moveTo(x + 6, y); g.arc(x, y, 6, 0, 7); } g.stroke(); };
    for (let i = 0; i < 12; i++) { const a = Math.PI + (i + 0.5) / 12 * Math.PI, rr = 0.855 * cx; sig(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 40, i % 4); }
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i + 0.5) / 9 * Math.PI, rr = 0.62 * cx; g.fillStyle = 'rgba(190,180,160,.5)'; g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2); g.fillRect(-4, -26, 8, 52); g.fillRect(-14, -10, 28, 6); g.restore(); }   // tacche incise sull'anello interno
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const archGlow = (() => { const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), cx = N / 2; g.lineCap = 'round';
    for (const [rr, w] of [[0.5, 3], [0.97, 3]]) { g.strokeStyle = 'rgba(140,180,255,.35)'; g.lineWidth = w; g.beginPath(); g.arc(cx, cx, rr * cx, Math.PI, 2 * Math.PI); g.stroke(); }
    g.strokeStyle = 'rgba(190,215,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, 0.2 * cx, 0, 7); g.moveTo(cx - 0.3 * cx, cx); g.lineTo(cx + 0.3 * cx, cx); g.moveTo(cx, cx - 0.3 * cx); g.lineTo(cx, cx); g.stroke();   // sigillo del timpano
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const filTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'), r = frng(41); g.fillStyle = '#48443d'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${r() < 0.2 ? '60,74,50' : '10,9,8'},${r() * 0.3})`; g.fillRect(r() * 256, r() * 512, 2 + r() * 10, 2 + r() * 6); }
    g.lineCap = 'round'; for (let k = 0; k < 5; k++) { const x = 60 + (k % 2) * 140, y = 70 + k * 90; g.strokeStyle = 'rgba(122,78,44,.9)'; g.lineWidth = 5; g.beginPath(); for (let t = 0; t < 60; t++) { const a = t * 0.34, rr = 4 + t * 0.9; g[t ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.stroke(); g.strokeStyle = 'rgba(200,140,80,.5)'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(122,78,44,.95)'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }   // spirali di bronzo
    g.strokeStyle = 'rgba(40,36,30,.8)'; for (let i = 0; i < 8; i++) { let x = r() * 256, y = r() * 512; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += 20 + r() * 30; g.lineTo(x, y); } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const frame = (side, zc, sd) => { const g = new THREE.Group(), r = frng(sd), parts = [], ry = -side * Math.PI / 2, XF = side * (W - 0.2);
    const blk = (sx, sy, sz, x, y, z, rx, rY, rz, shade) => { const gm = new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2); { const p = gm.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * sx * 0.12, p.getY(i) + (r() - 0.5) * sy * 0.1, p.getZ(i) + (r() - 0.5) * sz * 0.12); }
      gm.rotateX(rx); gm.rotateY(rY); gm.rotateZ(rz); gm.translate(x, y, z); const uv = gm.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + r(), uv.getY(i) * 0.9 + r()); const n = gm.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = shade * (0.8 + r() * 0.35), gr = r() < 0.14 ? 0.05 : 0; col[i * 3] = v * 0.95; col[i * 3 + 1] = v + gr; col[i * 3 + 2] = v * 0.9; } gm.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(gm); };
    const xs = (off) => side * (W - 0.11 - off);
    // piedritti: colonna interna (blocchi impilati e storti) e pilastro esterno piu' largo con la filigrana di bronzo
    for (const j of [-1, 1]) { let y = 0, k = 0; const missing = j === (r() < 0.5 ? -1 : 1) ? 4 : 99; while (y < PH - 0.05 && k < 6) { const h = 0.3 + r() * 0.3; if (k !== missing) blk(0.2 + r() * 0.04, Math.min(h, PH - y), 0.24 + r() * 0.05, xs(r() * 0.03), y + h / 2, zc + j * (PW + 0.13 + (r() - 0.5) * 0.04), (r() - 0.5) * 0.05, (r() - 0.5) * 0.14, (r() - 0.5) * 0.07, 0.2 + r() * 0.1); y += h; k++; }
      blk(0.2, PH + 0.05, 0.5, xs(0.0), (PH + 0.05) / 2, zc + j * (PW + 0.52), 0, (r() - 0.5) * 0.04, (r() - 0.5) * 0.03, 0.24); }
    // arco: anello interno di conci (alcuni scheggiati o mancanti), anello decorato, anello esterno piu' sottile; il timpano resta chiuso da pietra incisa
    const NV = 9; for (let i = 0; i < NV; i++) { if (i === 2 && r() < 0.8) continue; const th = (i + 0.5) / NV * Math.PI, Rm = 0.84; blk(0.22 + r() * 0.03, 0.3, 0.26, xs(r() * 0.03), PH + Math.sin(th) * Rm, zc + Math.cos(th) * Rm, -th, (r() - 0.5) * 0.06, (r() - 0.5) * 0.08, 0.2 + r() * 0.08); }
    for (let i = 0; i < 12; i++) { if (i === 9) continue; const th = (i + 0.5) / 12 * Math.PI, Rm = 1.42; blk(0.2, 0.34, 0.14, xs(0.02), PH + Math.sin(th) * Rm, zc + Math.cos(th) * Rm, -th, 0, (r() - 0.5) * 0.06, 0.22 + r() * 0.06); }
    // lastra davanti alla porta e macerie
    blk(0.6, 0.07, 2.0, xs(-0.3), 0.035, zc, 0, 0.0, 0.0, 0.2);
    for (let i = 0; i < 6; i++) blk(0.09 + r() * 0.1, 0.07 + r() * 0.1, 0.09 + r() * 0.1, xs(0.2 + r() * 0.4), 0.06, zc + (r() - 0.5) * 2.4, r(), r(), r(), 0.18);
    const fm = frameM.clone(); fm.vertexColors = true; g.add(new THREE.Mesh(mergeGeometries(parts), fm));
    // anello decorato (medaglioni) e timpano
    const stoneMat = (map, emissive) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.05, color: 0xc4c4cc, side: THREE.DoubleSide, emissive: 0x000000 });
    const ringM = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.28, 48, 1, 0, Math.PI), stoneMat(archTex)); ringM.geometry.attributes.uv; { const uv = ringM.geometry.attributes.uv, p = ringM.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 2.9, 0.5 + p.getY(i) / 2.9); }
    ringM.position.set(XF + side * 0.0, PH, zc); ringM.rotation.y = ry; g.add(ringM);
    const tymp = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32, 0, Math.PI), stoneMat(archTex)); { const uv = tymp.geometry.attributes.uv, p = tymp.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 2.9, 0.5 + p.getY(i) / 2.9); }
    tymp.position.set(XF + side * 0.012, PH, zc); tymp.rotation.y = ry; g.add(tymp);
    // filigrana di bronzo sui pilastri esterni
    for (const j of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, PH), new THREE.MeshStandardMaterial({ map: filTex, roughness: 0.8, metalness: 0.2, color: 0xaaaaaa })); m.position.set(XF - side * 0.0 + side * 0.0, PH / 2, zc + j * (PW + 0.52)); m.position.x = side * (W - 0.215); m.rotation.y = ry; g.add(m); }
    // crepe di muro tutto attorno
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true })); wall.position.set(side * (W - 0.006), 1.7, zc); wall.rotation.y = -side * Math.PI / 2; g.add(wall);
    // luce fredda: crepe sui pilastri, anello del timpano e sigillo, circolo inciso sulla lastra
    const rm = (map, op) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: op, color: 0x9ac0ff, side: THREE.DoubleSide }); runeMats.push(m); return m; };
    for (const j of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, PH), rm(runeTex, 0.5)); m.material.map = runeTex.clone(); m.material.map.repeat.set(0.4, 1.6); m.material.map.offset.set(r(), r()); m.material.map.needsUpdate = true; m.position.set(side * (W - 0.222), PH / 2, zc + j * (PW + 0.52)); m.rotation.y = ry; g.add(m); }
    const gl = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48, 0, Math.PI), rm(archGlow, 0.8)); gl.scale.setScalar(1.28); gl.position.set(side * (W - 0.215), PH, zc); gl.rotation.y = ry; g.add(gl);
    const slab = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), rm(radial([[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [0.64, 'rgba(150,190,255,.9)'], [0.7, 'rgba(0,0,0,0)'], [0.82, 'rgba(120,160,255,.5)'], [0.86, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']], 256), 0.6)); slab.rotation.x = -Math.PI / 2; slab.position.set(side * (W - 0.55), 0.075, zc); g.add(slab);
    // polvere che esce dal varco
    const NP = 26, pp = new Float32Array(NP * 3), pd = []; for (let i = 0; i < NP; i++) { pd.push([r(), 0.04 + r() * 0.08, (r() - 0.5) * 0.5]); }
    const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pp, 3)), new THREE.PointsMaterial({ color: 0xcfd8e8, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, map: radial([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32) })); dust.frustumCulled = false; g.add(dust); dustSets.push({ pts: dust, pp, pd, side, zc });
    return g; };
  const frameR = frame(1, ZR, 7), frameL = frame(-1, ZL, 11); frameL.visible = false; G.add(frameR, frameL);
  // ---- la stanza sospesa: pavimento di luce, croce enorme, raggi, alone, polvere e stelle. Nessun muro. Molto lontana, in fondo al passaggio ----
  const GL = new THREE.Group(); G.add(GL); const GX = XD + LEN + 34; GL.position.set(GX, 0, ZR);
  const glowMats = [], addGlow = (m, base) => { m.userData.base = base; glowMats.push(m); return m; };
  const add = (o, m) => { o.frustumCulled = false; GL.add(o); return o; };
  const discTex = radial([[0, 'rgba(255,240,205,1)'], [0.35, 'rgba(255,214,150,.7)'], [0.75, 'rgba(255,170,90,.18)'], [1, 'rgba(255,150,70,0)']]);
  const disc = add(new THREE.Mesh(new THREE.CircleGeometry(15, 48), addGlow(new THREE.MeshBasicMaterial({ map: discTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.55))); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01;
  const haloM = addGlow(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,224,160,.75)'], [0.55, 'rgba(255,170,90,.22)'], [1, 'rgba(255,140,60,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.75);
  const halo = add(new THREE.Sprite(haloM)); halo.scale.set(34, 34, 1); halo.position.set(12, 9, 0);
  const crossM = new THREE.MeshBasicMaterial({ color: 0x070504, fog: false });
  const cross = new THREE.Group(); const bar = (sx, sy, sz, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), crossM); m.position.set(x, y, 0); cross.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), addGlow(new THREE.LineBasicMaterial({ color: 0xffe6b8, transparent: true, fog: false }), 0.9)); e.position.copy(m.position); cross.add(e); };
  bar(1.3, 13, 1.3, 0, 6.5); bar(7.2, 1.3, 1.3, 0, 9.2);
  cross.position.set(4, 0, 0); cross.rotation.y = 0.06; add(cross);
  const rayTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,236,190,.8)'); v.addColorStop(0.5, 'rgba(255,200,130,.2)'); v.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in'; const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (let i = 0; i < 7; i++) { const a = (i / 7 - 0.5) * 1.9 + (i % 2) * 0.09, m = new THREE.Mesh(new THREE.PlaneGeometry(2.4 + (i % 3) * 1.2, 30), addGlow(new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0.32 + (i % 3) * 0.08));
    m.rotation.y = Math.PI / 2; m.rotation.x = a; m.position.set(10, 10.4, 0); m.geometry.translate(0, -15, 0); m.userData.ph = i; add(m); }   // raggi morbidi che partono da dietro la croce (verso di te)
  const rnd = (() => { let s = 91; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  { const N = 420, p = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1), r = 35 + rnd() * 90; p[i * 3] = 20 + Math.sin(ph) * Math.cos(th) * r; p[i * 3 + 1] = 12 + Math.cos(ph) * r * 0.8; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; }
    add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), addGlow(new THREE.PointsMaterial({ color: 0xd8e2ff, size: 0.55, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false, map: radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], 32) }), 0.9))); }
  const fbStart = GL.children.length;
  // cosmo dietro la stanza: nebulose colorate, una galassia a spirale e stelle luminose (disegnate una volta in canvas, solo sprite additivi)
  const nebTex = (hue1, hue2, seed) => { const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d'); let sd = seed; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 34; i++) { const x = 96 + (r() - 0.5) * 120, y = 96 + (r() - 0.5) * 120, rad = 18 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rad), col = r() < 0.55 ? hue1 : hue2; gr.addColorStop(0, `rgba(${col},${0.1 + r() * 0.16})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(96, 96, 10, 96, 96, 96); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, 192, 192); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  for (const [pos, size, c1, c2, sd, op] of [[[34, 14, -22], 60, '150,60,200', '60,90,230', 3, 0.9], [[40, 4, 24], 70, '255,130,50', '200,60,120', 8, 0.8], [[30, 28, 2], 52, '70,130,255', '150,90,255', 15, 0.8], [[46, -2, -4], 80, '255,170,90', '120,70,200', 21, 0.6]]) {
    const sp = new THREE.Sprite(addGlow(new THREE.SpriteMaterial({ map: nebTex(c1, c2, sd), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), op)); sp.scale.set(size, size, 1); sp.position.set(...pos); add(sp); }
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), ctr = 128; g.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 900; i++) { const t = Math.pow(i / 900, 0.8), a = arm * Math.PI + t * 7.2 + (rnd() - 0.5) * 0.35, rr = 6 + t * 112 + (rnd() - 0.5) * 9 * (0.4 + t); g.fillStyle = `rgba(${t < 0.35 ? '255,225,180' : '170,190,255'},${(0.35 + rnd() * 0.5) * (1 - t * 0.7)})`; g.beginPath(); g.arc(ctr + Math.cos(a) * rr, ctr + Math.sin(a) * rr * 0.5, 0.6 + rnd() * 1.6, 0, 7); g.fill(); }
    const core = g.createRadialGradient(ctr, ctr, 0, ctr, ctr, 36); core.addColorStop(0, 'rgba(255,240,215,.95)'); core.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = core; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const gal = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), addGlow(new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0.95)); gal.position.set(38, 15, -10); gal.rotation.set(0.35, -Math.PI / 2 + 0.2, 0.5); add(gal); }
  { const N = 70, p = new Float32Array(N * 3); for (let i = 0; i < N; i++) { p[i * 3] = 14 + rnd() * 40; p[i * 3 + 1] = 2 + rnd() * 26; p[i * 3 + 2] = (rnd() - 0.5) * 36; }
    add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), addGlow(new THREE.PointsMaterial({ color: 0xfff1d8, size: 1.5, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,210,.5)'], [1, 'rgba(255,220,180,0)']], 64) }), 0.95))); }   // stelle luminose
  const fallback = GL.children.slice(fbStart);   // ripiego se la scena dello spazio non e' ancora pronta
  const NM = 70, mp = new Float32Array(NM * 3), mv = []; for (let i = 0; i < NM; i++) { mp[i * 3] = -4 + rnd() * 20; mp[i * 3 + 1] = rnd() * 10; mp[i * 3 + 2] = (rnd() - 0.5) * 10; mv.push([rnd() * 6.28, 0.1 + rnd() * 0.25]); }
  const motes = add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mp, 3)), addGlow(new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.14, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: radial([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32) }), 0.8)));
  const debris = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5 + rnd() * 0.9, 0.12, 0.5 + rnd() * 0.9), new THREE.MeshBasicMaterial({ color: 0x120c08, fog: false })); m.position.set(-2 + rnd() * 14, 0.5 + rnd() * 5, (rnd() - 0.5) * 9); m.rotation.set(rnd(), rnd(), rnd()); m.userData.sp = [rnd() * 0.4 - 0.2, rnd() * 0.4 - 0.2]; add(m); debris.push(m); }
  // FINESTRA SULLO SPAZIO VERO: sul fondo del passaggio un grande piano mostra la scena della caduta (cielo, galassie, nebulose, pianeti, Sole) con la camera del giocatore, letta a schermo come nel buco del portale
  const winMat = new THREE.ShaderMaterial({ depthWrite: false, fog: false, uniforms: { uTex: { value: null }, uRes: { value: new THREE.Vector2(2, 2) }, uFade: { value: 1 } },
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; uniform vec2 uRes; uniform float uFade; void main() { gl_FragColor = vec4(texture2D(uTex, gl_FragCoord.xy / uRes).rgb * uFade, 1.0); }' });
  const winQuad = new THREE.Mesh(new THREE.PlaneGeometry(110, 70), winMat); winQuad.position.set(XD + LEN + 0.2, 14, ZR); winQuad.rotation.y = -Math.PI / 2; winQuad.renderOrder = -5; winQuad.frustumCulled = false; winQuad.visible = false; G.add(winQuad);
  const qWin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), pcWin = new THREE.Vector3(XD + LEN, 0, ZR), fw = new THREE.Vector3(); let spaceOn = false;
  // bagliore che esce dalla porta: macchia di luce sul pavimento del tunnel e alone sulla soglia
  const spillTex = radial([[0, 'rgba(255,214,150,.85)'], [0.35, 'rgba(255,200,130,.4)'], [0.7, 'rgba(255,180,110,.1)'], [1, 'rgba(255,170,100,0)']], 128);   // macchia morbida e rotonda, solo davanti alla porta
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), addGlow(new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.32)); spill.rotation.x = -Math.PI / 2; spill.position.set(W - 0.45, 0.012, ZR); spill.frustumCulled = false; G.add(spill);
  const spillSp = new THREE.Sprite(addGlow(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,232,190,.9)'], [0.4, 'rgba(255,190,120,.3)'], [1, 'rgba(255,160,90,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.35)); spillSp.scale.set(1.6, 2.2, 1); spillSp.position.set(W + 0.6, 1.0, ZR); G.add(spillSp);

  // ---- luce della stanza: 1 = piena; sfarfalla piano, ogni tanto un calo ----
  let lv = 0.9, dip = 0, tt = 0, flickerT = 0;
  const setLight = (v) => { lv = v; U.uGlow.value = v; for (const m of glowMats) m.opacity = (m.userData.base ?? 1) * v; };
  setLight(0.9);
  // ---- movimento: il passaggio e' un corridoio |z-ZR| < 0.55 (destra) o |z-ZL| < 0.55 (sinistra, quando c'e'); il resto del tunnel usa i limiti normali ----
  const corridor = (side, zc, xmax, x, z) => {   // corridoio laterale: si entra solo dal varco (|z-zc|<0.5), dentro si resta nelle pareti
    const lim = W - RADIUS, inside = side * player.pos.x > lim - 0.02, cand = side * x;
    if ((Math.abs(z - zc) < 0.5 || inside) && cand > lim - 0.05) return [side * Math.min(xmax, Math.max(lim - 0.02, cand)), Math.max(zc - 0.5, Math.min(zc + 0.5, z))];
    return null;
  };
  const cm = (x, z) => { const st = F.state; if (st === 'cut') return null; if (st === 'exit' || st === 'done') return corridor(-1, ZL, XD + LL - 0.6, x, z); return corridor(1, ZR, XD + LEN - 1.2, x, z); };
  player.constrainMove = cm;
  let overlay = null; const ov = () => overlay ||= (() => { const d = document.createElement('div'); d.id = 'foldfade'; d.style.cssText = 'position:fixed;inset:0;z-index:61;background:#000;opacity:0;pointer-events:none;transition:opacity .35s'; document.body.appendChild(d); return d; })();
  const lampAll = (mode, dur) => { for (let i = 0; i < 4; i++) lights.lamp?.(i, mode, dur); };

  F.update = (dt) => {
    if (!F.enabled) return; const P = player.pos; tt += dt; F.t += dt;
    const here = P.z > Z_END + 1.2 || F.state === 'fold' || F.state === 'cut'; G.visible = here || F.state === 'exit';
    if (!G.visible) return;
    const st = F.state;
    if ((st === 'idle' || st === 'done') && lights.lamps) for (const L of lights.lamps) if (L.mode === 'off' || L.mode === 'dim') L.mode = 'on';   // salvaguardia: fuori dall'evento le lampade del tunnel non restano mai spente o attenuate
    if (st === 'idle' || st === 'done') {
      if (st === 'idle') {
        const sp = getSpace?.(); if (sp) { if (P.z < -12) sp.prepare?.(); camera.getWorldDirection(fw);
          const dx = XD + LEN - P.x, dz = ZR - P.z, dist = Math.hypot(dx, dz), facing = (fw.x * dx + fw.z * dz) / Math.max(0.01, dist) > 0.3;
          if (sp.prepared && !sp.active && dist < 26 && facing && sp.drawWindow(dt, camera.position, camera.quaternion, pcWin, qWin, { eye: true, portal: true })) { if (!spaceOn) { spaceOn = true; winMat.uniforms.uTex.value = sp.win.tex; winQuad.visible = true; for (const o of fallback) o.visible = false; } winMat.uniforms.uRes.value = sp.win.res; } }
        dip -= dt; if (dip > 0) lv = 0.08 + Math.random() * 0.2; else { lv = 0.82 + 0.12 * Math.sin(tt * 2.3) + 0.05 * Math.sin(tt * 17); if (Math.random() < dt * 0.45) dip = 0.05 + Math.random() * 0.12; } setLight(lv);
        if (P.x > XD + 1.7 && Math.abs(P.z - ZR) < 0.7 && !player.frozen) { F.state = 'flicker'; F.t = 0; lampAll('flicker', 1.7); audio.swell?.(2.2, 0.45); audio.whisper?.(1.4, 0.2); instab?.push?.(0.6, 6); } }
      return;
    }
    if (st === 'flicker') { flickerT -= dt; if (flickerT <= 0) { flickerT = 0.04 + Math.random() * 0.1; lv = Math.random() < 0.5 ? 0.1 : 1.0; } setLight(lv); if (F.t > 1.7) { F.state = 'dark'; F.t = 0; setLight(0); GL.visible = false; winQuad.visible = false; ceilFar.visible = true; spill.visible = spillSp.visible = false; lampAll('off', 99); audio.lightOff?.(); audio.scare?.(); player.speedMul = 0; } return; }
    if (st === 'dark') { if (F.t > 1.0) { F.state = 'fold'; F.t = 0; player.speedMul = 1; say?.('La stanza non c’è più.\nIl passaggio si piega.', 3800); audio.swell?.(5, 0.55); } return; }
    if (st === 'fold') {
      const k = Math.min(1, F.t / 5.5), e = k * k * (3 - 2 * k); U.uK.value = KEND * e;
      if (F.t > 1.5) P.x += Math.min(1, (F.t - 1.5) / 2) * 0.7 * dt;   // il passaggio ti trascina avanti piano
      P.x = Math.min(P.x, XD + LEN - 1.2);
      if (Math.random() < dt * 0.6) player.addShake?.(0.25);
      if (P.x >= S0 + 6.3 && F.t > 3) { F.state = 'cut'; F.t = 0; player.frozen = true; ov().style.transition = 'opacity .45s'; ov().style.opacity = '1'; audio.swell?.(1.6, 0.6); }
      return;
    }
    if (st === 'cut') {
      if (F.t > 0.8 && !F.cutDone) { F.cutDone = true;   // buio completo: il passaggio si disfa, la porta sinistra compare, la destra si chiude
        U.uK.value = 0; RP.visible = false; LP.visible = true; frameL.visible = true; tunnel.userData.plugs?.[-1] && (tunnel.userData.plugs[-1].visible = false); tunnel.userData.plugs?.[1] && (tunnel.userData.plugs[1].visible = true); frameR.visible = false;
        P.set(-XD - LL + 1.6, 1.62, ZL); player.yaw = -Math.PI / 2; player.pitch = 0; player.frozen = false; player.speedMul = 1; lampAll('flicker', 1.6); audio.lightOn?.(); ov().style.transition = 'opacity .9s'; ov().style.opacity = '0'; }
      if (F.t > 1.3) { F.state = 'exit'; F.t = 0; say?.('Esci da una porta che prima non c’era.', 3400); }
      return;
    }
    if (st === 'exit') { if (P.x > -XD + 0.2) { F.state = 'done'; F.done = true; lampAll('on', 1); if (player.constrainMove === cm) player.constrainMove = null; } return; }
  };
  // la camera segue la curva: posizione e direzione dalla mappa (stessa formula dello shader)
  const qY = new THREE.Quaternion(), yA = new THREE.Vector3(0, 1, 0);
  F.applyCamera = () => {
    const K = U.uK.value; if (K < 1e-4 || F.state !== 'fold') return; const p = camera.position, x = p.x; if (x <= S0) return;
    const u = x - S0, ph = Math.min(K * u, Math.PI), d = p.z - ZR; let cxm, czm, nx2, nz2;
    if (K * u < Math.PI) { cxm = S0 + Math.sin(ph) / K; czm = ZR + (1 - Math.cos(ph)) / K; nx2 = -Math.sin(ph); nz2 = Math.cos(ph); } else { cxm = S0 - (u - Math.PI / K); czm = ZR + 2 / K; nx2 = 0; nz2 = -1; }
    p.x = cxm + d * nx2; p.z = czm + d * nz2; camera.quaternion.premultiply(qY.setFromAxisAngle(yA, -ph));
  };
  F.reset = () => { F.state = 'idle'; F.t = 0; F.done = false; F.cutDone = false; U.uK.value = 0; RP.visible = true; ceilFar.visible = false; winQuad.visible = false; spaceOn = false; for (const o of fallback) o.visible = true; LP.visible = false; frameL.visible = false; frameR.visible = true; GL.visible = true; spill.visible = spillSp.visible = true; tunnel.userData.plugs?.[-1] && (tunnel.userData.plugs[-1].visible = true); tunnel.userData.plugs?.[1] && (tunnel.userData.plugs[1].visible = false); player.constrainMove = cm; };
  // animazioni leggere della stanza (raggi che respirano, polvere che sale, frammenti che ruotano)
  F.animate = (dt) => { for (let i = 0; i < runeMats.length; i++) runeMats[i].opacity = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(tt * 0.9 + i * 1.7)) * (0.7 + 0.3 * Math.sin(tt * 4.1 + i * 3.1)); for (const d of dustSets) { const a = d.pts.geometry.attributes.position; for (let i = 0; i < d.pd.length; i++) { const k = (tt * d.pd[i][1] + d.pd[i][0] * 3) % 1; a.array[i * 3] = d.side * (W - 0.1 - k * 0.5); a.array[i * 3 + 1] = 0.15 + k * 1.9 * (0.5 + d.pd[i][0]); a.array[i * 3 + 2] = d.zc + d.pd[i][2] * 1.8 + Math.sin(tt * 0.5 + i) * 0.1; } a.needsUpdate = true; }
    if (!GL.visible) return; cross.rotation.y += dt * 0.14; for (const o of GL.children) if (o.userData.ph !== undefined) o.rotation.x += Math.sin(tt * 0.6 + o.userData.ph) * dt * 0.02; for (const d of debris) { d.rotation.x += d.userData.sp[0] * dt; d.rotation.y += d.userData.sp[1] * dt; d.position.y += Math.sin(tt * 0.5 + d.position.x) * dt * 0.05; }
    const a = motes.geometry.attributes.position; for (let i = 0; i < NM; i++) { a.array[i * 3 + 1] += mv[i][1] * dt; if (a.array[i * 3 + 1] > 10) a.array[i * 3 + 1] = 0; a.array[i * 3] += Math.sin(tt * 0.4 + mv[i][0]) * dt * 0.2; } a.needsUpdate = true; };
  const upd = F.update; F.update = (dt) => { upd(dt); if (G.visible) F.animate(dt); };
  F.group = G; F.U = U;
  return F;
}
