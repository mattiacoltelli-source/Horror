// LA PORTA LATERALE E IL PASSAGGIO CHE SI PIEGA (primo tunnel): sul muro destro c'e' una porta; in fondo a un piccolo passaggio, lontano, si intravede una stanza sospesa nel vuoto con una croce enorme e una luce
// che sfarfalla (niente muri: solo luce, polvere, stelle). Entrando nel passaggio la luce si spegne, la stanza sparisce e il passaggio si piega davanti a te (U in pianta, la visuale ruota con la curva).
// Quando arrivi in fondo alla curva c'e' un attimo di buio e riemergi da una porta sul muro SINISTRO del tunnel, che prima non c'era; quella di destra si richiude.
// Tutto con materiali senza luci in piu' (la luce e' "dipinta": emissivo, additivo). ?porta=0 spegne l'evento (il tunnel resta com'era, con i varchi chiusi dai tamponi).
import * as THREE from 'three';
import { W, SIDE_DOORS, Z_END } from '../world/tunnel.js';
import { TILES } from '../world/materials.js';
import { createCosmicLandscape } from '../world/cosmic-landscape.js';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const R_DOOR = SIDE_DOORS[0], L_DOOR = SIDE_DOORS[1], ZR = R_DOOR.z, ZLL = L_DOOR.z, ZL = SIDE_DOORS[2].z, XD = W, PW = 0.7, PH = R_DOOR.h, LEN = 14, S0 = XD + 2.6, SB = XD + 0.6, SDIR = Math.sign(SIDE_DOORS[2].z - ZR), KEND = 2 / Math.abs(ZR - SIDE_DOORS[2].z), LS = 0, U3 = Math.PI / KEND + LS;   // SB = inizio della curva; SDIR = verso della curva (+1 verso +z); U unica di raggio 1,8 m   // percorso a "stadio": curva verso -z (raggio 2,9 m), rettilineo di LS metri, curva di ritorno: il ritorno arriva esattamente davanti alla seconda porta
const RADIUS = 0.32;

const radial = (stops, size = 128) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const linear = (stops, w = 8, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = g.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createSideFold({ scene, tunnel, mats, player, camera, audio, lights, say, instab, getSpace }) {
  const F = { state: 'idle', t: 0, done: false, enabled: true };
  const G = new THREE.Group(); G.name = 'porta-laterale'; scene.add(G);
  const U = { uLs: { value: LS }, uK: { value: 0 }, uGlow: { value: 0 }, uS0: { value: SB }, uZ0: { value: ZR }, uSd: { value: SDIR } };
  // ---- materiali del passaggio: cloni dei mattoni/pavimento del tunnel con la piega e il bagliore nello shader ----
  const patch = (mat, key) => { mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const PATH = `uniform float uLs, uSd;
      void sfPath(float u, out vec2 c, out float th) { float K = uK, s = uSd, u1 = 1.5707963 / K, u2 = u1 + uLs, u3 = u2 + 1.5707963 / K;
        if (u < u1) { th = K * u; c = vec2(uS0 + sin(th) / K, uZ0 + s * (1.0 - cos(th)) / K); }
        else if (u < u2) { th = 1.5707963; c = vec2(uS0 + 1.0 / K, uZ0 + s * (1.0 / K + (u - u1))); }
        else if (u < u3) { th = 1.5707963 + K * (u - u2); c = vec2(uS0 + 1.0 / K + (sin(th) - 1.0) / K, uZ0 + s * (1.0 / K + uLs - cos(th) / K)); }
        else { th = 3.14159265; c = vec2(uS0 - (u - u3), uZ0 + s * (2.0 / K + uLs)); } }\n`;
    sh.vertexShader = 'uniform float uK, uS0, uZ0; varying float vRx;\n' + PATH + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz; if (uK > 1e-4 && wp0.x > uS0) { vec2 c0; float th; sfPath(wp0.x - uS0, c0, th); float c = cos(th), s = sin(th); vec3 wn = mat3(modelMatrix) * objectNormal; float nx = wn.x, nz = wn.z; wn.x = nx * c - nz * uSd * s; wn.z = nx * uSd * s + nz * c; objectNormal = normalize(transpose(mat3(modelMatrix)) * wn); } }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp = modelMatrix * vec4(transformed, 1.0); vRx = wp.x;
          if (uK > 1e-4 && wp.x > uS0) { vec2 c2; float th; sfPath(wp.x - uS0, c2, th); float d = wp.z - uZ0; wp.x = c2.x - uSd * d * sin(th); wp.z = c2.y + d * cos(th); transformed = (inverse(modelMatrix) * wp).xyz; } }`);
    sh.fragmentShader = 'uniform float uGlow; varying float vRx;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.78, 0.48) * uGlow * pow(smoothstep(5.0, 16.0, vRx), 1.8) * 0.45;`);
  }; mat.customProgramCacheKey = () => 'sidefold-' + key; return mat; };
  const lamb = (m, k = 1) => new THREE.MeshLambertMaterial({ map: m.map, vertexColors: true, color: new THREE.Color(m.color).multiplyScalar(k) });   // materiali del passaggio: Lambert con la sola mappa colore (niente normal/roughness/ao: molto meno costo per pixel con le luci della scena)
  const wallM = lamb(mats.brick), floorM = lamb(mats.floorA);
  const colorAttr = (g, v) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const quadGeo = (w, h, nx, mat4, uvf) => { const g = new THREE.PlaneGeometry(w, h, nx, 1); g.applyMatrix4(mat4); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const [a, b] = uvf(p.getX(i), p.getY(i), p.getZ(i)); uv.setXY(i, a, b); } return colorAttr(g, 0.8); };
  const M = (rx, ry, x, y, z) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(1, 1, 1));
  const [bu, bv] = TILES.brick, [fu, fv] = TILES.floorA;
  const mesh = (g, m, parent) => { const o = new THREE.Mesh(g, m); o.frustumCulled = false; parent.add(o); return o; };
  // sezione ad arco (pareti verticali fino alla linea d'imposta, poi mezzo cerchio): lo stesso profilo del varco nel muro del tunnel
  const SPR = R_DOOR.spring, ARC = 14;
  const sweep = (poly, nrm, xA, xB, nx, topFn = null) => {   // poly: [[z,y],...] lungo la sezione; nrm: normali verso l'interno; si estrude lungo x
    const n = poly.length, pos = [], nor = [], uv = [], idx = [], acc = [0]; for (let k = 1; k < n; k++) acc.push(acc[k - 1] + Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]));
    for (let i = 0; i <= nx; i++) { const x = xA + (xB - xA) * i / nx; for (let k = 0; k < n; k++) { pos.push(x, poly[k][2] && topFn ? poly[k][1] * topFn(x) : poly[k][1], poly[k][0]); nor.push(0, nrm[k][1], nrm[k][0]); uv.push(x / bu, acc[k] / bv); } }
    for (let i = 0; i < nx; i++) for (let k = 0; k < n - 1; k++) { const a0 = i * n + k, b0 = a0 + 1, c0 = a0 + n, d0 = c0 + 1; for (const t of [[a0, c0, b0], [b0, c0, d0]]) { const A = new THREE.Vector3(pos[t[0] * 3], pos[t[0] * 3 + 1], pos[t[0] * 3 + 2]), B = new THREE.Vector3(pos[t[1] * 3], pos[t[1] * 3 + 1], pos[t[1] * 3 + 2]), C = new THREE.Vector3(pos[t[2] * 3], pos[t[2] * 3 + 1], pos[t[2] * 3 + 2]), fn = B.clone().sub(A).cross(C.clone().sub(A)); const wn = new THREE.Vector3(0, nor[t[0] * 3 + 1], nor[t[0] * 3 + 2]); idx.push(...(fn.dot(wn) >= 0 ? t : [t[0], t[2], t[1]])); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0.8), 3)); g.setIndex(idx); return g; };
  const arcPoly = (zc, rad = PW) => { const poly = [], nrm = []; for (let k = 0; k <= ARC; k++) { const th = Math.PI - k / ARC * Math.PI; poly.push([zc + rad * Math.cos(th), SPR + rad * Math.sin(th)]); nrm.push([-Math.cos(th), -Math.sin(th)]); } return [poly, nrm]; };
  const wallsLo = (zc, xA, xB, nx, parent) => { mesh(sweep([[zc - PW, 0], [zc - PW, SPR]], [[1, 0], [1, 0]], xA, xB, nx), wallM, parent); mesh(sweep([[zc + PW, SPR], [zc + PW, 0]], [[-1, 0], [-1, 0]], xA, xB, nx), wallM, parent); };
  // passaggio di destra (lungo LEN, aperto in fondo): pavimento, pareti e volta; la volta oltre S0 compare quando la luce si spegne (prima il passaggio e' aperto sul vuoto e si intravede la croce)
  const RP = new THREE.Group(); G.add(RP); const cx = XD + LEN / 2, nx = LEN * 4, END = XD + LEN, SV = S0, NEARL = SV - XD, FARL = END - SV;   // la volta copre tutto il passaggio tranne gli ultimi 3,2 m (aperti sul vuoto: li' si intravede lo spazio)
  const LIN = 0.5;   // i primi 50 cm del passaggio sono rivestiti dagli stessi conci dell'arco (non mattoni nuovi)
  const FEND = END - 2.6;   // il pavimento finisce prima della fine: il resto e' una scia di lastre spezzate che si perdono nel vuoto
  const mainFloor = mesh(quadGeo(FEND - XD - LIN, PW * 2, Math.round((FEND - XD) * 3), M(-Math.PI / 2, 0, (XD + LIN + FEND) / 2, 0, ZR), (x, y, z) => [x / fu, z / fv]), floorM, RP);
  { const [pl, nr] = arcPoly(ZR); mesh(sweep(pl, nr, XD + LIN, SV, Math.round(NEARL * 4)), wallM, RP); }   // volta di mattoni
  // oltre la volta le pareti sono muri veri, spessi 35 cm, con il bordo che si sgretola verso il fondo (altezza irregolare), fino a sparire
  const nz1 = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const crumble = (x) => { const t = Math.min(1, Math.max(0, (x - (SV + 2.2)) / (END - SV - 2.2))); return t <= 0 ? 1 : Math.max(0.04, 1 - t * (0.35 + 0.8 * nz1(Math.floor(x * 2.6)))); };
  const TH = 0.5;   // spessore dei muretti e dei muri del passaggio
  const wallThick = (xa, xb, fn, parent, zc = ZR) => { for (const j of [-1, 1]) { const zi = zc + j * PW, zo = zc + j * (PW + TH), ni = -j;
      mesh(sweep([[zi, 0, 0], [zi, SPR, 1], [zi, SPR, 1], [zo, SPR, 1], [zo, SPR, 1], [zo, 0, 0]], [[ni, 0], [ni, 0], [0, 1], [0, 1], [j, 0], [j, 0]], xa, xb, Math.max(2, Math.round((xb - xa) * 4)), fn), wallM, parent); } };
  const capGeo = (x, j, dir, zc) => { const g = new THREE.PlaneGeometry(TH, SPR); g.applyMatrix4(M(0, dir * Math.PI / 2, x, SPR / 2, zc + j * (PW + TH / 2))); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / bu, p.getY(i) / bv); return colorAttr(g, 0.7); };
  const wallThickSide = (xa, xb, j, parent, zc = ZR, capA = false, capB = false) => { if (capA) mesh(capGeo(xa, j, -1, zc), wallM, parent); if (capB) mesh(capGeo(xb, j, 1, zc), wallM, parent); const zi = zc + j * PW, zo = zc + j * (PW + TH), ni = -j; mesh(sweep([[zi, 0, 0], [zi, SPR, 1], [zi, SPR, 1], [zo, SPR, 1], [zo, SPR, 1], [zo, 0, 0]], [[ni, 0], [ni, 0], [0, 1], [0, 1], [j, 0], [j, 0]], xa, xb, Math.max(2, Math.round((xb - xa) * 4)), null), wallM, parent); };
  const XF = 12.0, ENDR = SB + U3 + SB - 1.4 + 0.1, PEND = Math.max(ENDR, XD + LEN);   // da XF in poi, durante la piega, il passaggio diventa intero (tratto di ritorno): le parti sgretolate spariscono
  const nearWalls = new THREE.Group(); RP.add(nearWalls); wallThick(XD + LIN, XF, crumble, nearWalls);
  const farWalls = new THREE.Group(); RP.add(farWalls); wallThick(XF, END, crumble, farWalls);
  const RET = new THREE.Group(); RET.visible = false; RP.add(RET);
  // durante la piega il passaggio e' un tunnel chiuso (muri interi fino alla volta) con solo due spaccature strette, una a destra e una a sinistra, da cui si vede l'universo
  const FW = new THREE.Group(); FW.visible = false; RP.add(FW);
  mesh(quadGeo(PEND - XD - LIN, PW * 2, Math.round((PEND - XD) * 3), M(-Math.PI / 2, 0, (XD + LIN + PEND) / 2, 0, ZR), (x, y, z) => [x / fu, z / fv]), floorM, FW);   // pavimento durante la piega
  // durante la piega il passaggio e' un tunnel chiuso (muri spessi 50 cm fino alla volta) con solo due squarci, uno a destra e uno a sinistra; i bordi dello squarcio hanno lo spessore pieno del muro; dietro si vede solo l'universo
  { const CR = [], CW = 0.55;   // nessuna feritoia: il tunnel che si piega e' chiuso
    const skyTex = (() => { const W2 = 1024, H2 = 512, c = document.createElement('canvas'); c.width = W2; c.height = H2; const g = c.getContext('2d'), rr = (() => { let sd = 53; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })(); g.fillStyle = '#01010a'; g.fillRect(0, 0, W2, H2);
      for (let i = 0; i < 70; i++) { const x = rr() * W2, y = rr() * H2, rad = 40 + rr() * 150, hue = rr() < 0.4 ? '130,60,200' : rr() < 0.5 ? '240,120,60' : rr() < 0.5 ? '50,150,200' : '200,70,140', gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${hue},${0.07 + rr() * 0.16})`); gr.addColorStop(1, `rgba(${hue},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }   // nebulose a strati
      g.globalCompositeOperation = 'lighter';
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 700; i++) { const t = Math.pow(i / 700, 0.8), a = arm * Math.PI + t * 7 + (rr() - 0.5) * 0.4, r = 4 + t * 70, x = 700 + Math.cos(a) * r * 1.4, y = 170 + Math.sin(a) * r * 0.55; g.fillStyle = `rgba(${t < 0.35 ? '255,225,185' : '170,190,255'},${(0.3 + rr() * 0.5) * (1 - t * 0.6)})`; g.fillRect(x, y, 1 + rr() * 1.4, 1 + rr() * 1.4); }   // galassia a spirale
      { const co = g.createRadialGradient(700, 170, 0, 700, 170, 26); co.addColorStop(0, 'rgba(255,240,215,.9)'); co.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = co; g.fillRect(660, 130, 80, 80); }
      for (let i = 0; i < 1100; i++) { const b = 0.3 + rr() * rr() * 0.7, sz = rr() < 0.04 ? 2.4 : rr() < 0.2 ? 1.4 : 1; g.fillStyle = `rgba(255,${230 + rr() * 25 | 0},${210 + rr() * 45 | 0},${b})`; g.fillRect(rr() * W2, rr() * H2, sz, sz); }
      for (let i = 0; i < 6; i++) { const x = rr() * W2, y = rr() * H2, gr = g.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - 16, y - 16, 32, 32); }   // stelle luminose
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
    for (const j of [-1, 1]) { const cs = CR.filter((c) => c[0] === j).map((c) => c[1]); let x0 = XD + LIN, capA = false; for (const c of cs) { wallThickSide(x0, c, j, FW, ZR, capA, true); x0 = c + CW; capA = true; } wallThickSide(x0, PEND, j, FW, ZR, capA, false); }
    for (const [j, cxs] of CR) { const gm = patch(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.DoubleSide, fog: false }), 'sky'); const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5, 12, 1), gm); m.rotation.y = j > 0 ? Math.PI : 0; m.position.set(cxs + CW / 2, 1.2, ZR + j * (PW + TH + 1.4)); m.frustumCulled = false; FW.add(m);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8, 6, 6), patch(new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(190,170,255,.7)'], [0.45, 'rgba(150,130,230,.28)'], [1, 'rgba(120,100,220,0)']], 128), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 }), 'spill')); sp.rotation.x = -Math.PI / 2; sp.position.set(cxs + CW / 2, 0.015, ZR + j * 0.35); sp.frustumCulled = false; FW.add(sp); } }
  { const sh = new THREE.Shape(); sh.moveTo(-PW, 0); sh.lineTo(-PW, SPR); for (let k = 1; k <= ARC; k++) { const th = Math.PI - k / ARC * Math.PI; sh.lineTo(PW * Math.cos(th), SPR + PW * Math.sin(th)); } sh.lineTo(PW, 0); sh.lineTo(-PW, 0);
    const ge = new THREE.ShapeGeometry(sh); const pe = ge.attributes.position, ue = ge.attributes.uv; for (let i = 0; i < pe.count; i++) ue.setXY(i, pe.getX(i) / bu, pe.getY(i) / bv); colorAttr(ge, 0.7); ge.rotateY(-Math.PI / 2); ge.translate(PEND, 0, ZR); mesh(ge, wallM, FW); }   // fondo chiuso del passaggio (dopo l'evento: un normale corridoio senza universo)
  // lastre del pavimento spezzate che continuano oltre la fine, sempre piu' rade e piccole, leggermente inclinate
  const slabs = [];
  { const rr = (() => { let sd = 5; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 16; i++) { const t = i / 16, w = (0.9 - t * 0.55) * (0.6 + rr() * 0.6), len = (0.8 - t * 0.4) * (0.6 + rr() * 0.8), g = new THREE.BoxGeometry(len, 0.1, w); g.rotateX((rr() - 0.5) * 0.3 * (0.4 + t)); g.rotateZ((rr() - 0.5) * 0.3 * (0.4 + t)); g.rotateY((rr() - 0.5) * 0.9); g.translate(FEND + 0.15 + t * 7.5 + rr() * 0.5, -t * 0.5 * rr() - 0.05 * i * 0.2, ZR + (rr() - 0.5) * (1.3 - t * 0.5));
      const p = g.attributes.position, uv = g.attributes.uv; for (let q = 0; q < p.count; q++) uv.setXY(q, p.getX(q) / fu, p.getZ(q) / fv); colorAttr(g, 0.8 * (1 - t * 0.6)); slabs.push(mesh(g, floorM, RP)); } }
  const ceilFar = new THREE.Group(); ceilFar.visible = false; RP.add(ceilFar); { const [pl, nr] = arcPoly(ZR); mesh(sweep(pl, nr, SV, PEND, Math.round((PEND - SV) * 4)), wallM, ceilFar); }
  // passaggio di sinistra (6 m, chiuso in fondo), nascosto finche' la porta non compare
  const LP = new THREE.Group(); LP.visible = false; G.add(LP); const lcx = -XD - 3, LL = 6;
  mesh(quadGeo(LL - LIN, PW * 2, 24, M(-Math.PI / 2, 0, (-XD - LL - XD - LIN) / 2, 0, ZLL), (x, y, z) => [x / fu, z / fv]), floorM, LP);
  wallsLo(ZLL, -XD - LL, -XD - LIN, 24, LP); { const [pl, nr] = arcPoly(ZLL); mesh(sweep(pl, nr, -XD - LL, -XD - LIN, 24), wallM, LP); }
  { const sh = new THREE.Shape(); sh.moveTo(-PW, 0); sh.lineTo(-PW, SPR); for (let k = 1; k <= ARC; k++) { const th = Math.PI - k / ARC * Math.PI; sh.lineTo(PW * Math.cos(th), SPR + PW * Math.sin(th)); } sh.lineTo(PW, 0); sh.lineTo(-PW, 0);
    const gcap = new THREE.ShapeGeometry(sh); const pp = gcap.attributes.position, uvc = gcap.attributes.uv; for (let i = 0; i < pp.count; i++) uvc.setXY(i, pp.getX(i) / bu, pp.getY(i) / bv); colorAttr(gcap, 0.8); gcap.rotateY(Math.PI / 2); gcap.translate(-XD - LL, 0, ZLL); mesh(gcap, wallM, LP); }
  // ---- ARCO DI PIETRA, rovinato e integrato nel muro: conci a filo di parete (sporgono pochi centimetri), imposte a capitello, chiave d'arco piu' grossa, pietre scheggiate e un po' sconnesse,
  // muschio e sporco verso il basso, lastra consumata sulla soglia. Nessun disegno: solo pietra. ----
  const frameM = mats.stone.clone(); frameM.color.setRGB(0.95, 0.95, 1);
  const frng = (sd) => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const runeMats = [], dustSets = [];
  const frame = (side, zc, sd) => { const g = new THREE.Group(), r = frng(sd), parts = [], IN = -side;
    // blocco di pietra: spigoli appena irregolari, UV a scala reale dalla posizione; ombreggiatura per vertice (sporco in basso, muschio sparso)
    const blk = (sx, sy, sz, x, y, z, rx, rY, rz, shade, chip = 0.05) => { const gm = new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2); const p0 = gm.attributes.position; for (let i = 0; i < p0.count; i++) { const e = (Math.abs(p0.getX(i)) > sx * 0.45 ? 1 : 0) + (Math.abs(p0.getY(i)) > sy * 0.45 ? 1 : 0) + (Math.abs(p0.getZ(i)) > sz * 0.45 ? 1 : 0); const k = e >= 2 ? chip : chip * 0.3; p0.setXYZ(i, p0.getX(i) + (r() - 0.5) * k, p0.getY(i) + (r() - 0.5) * k, p0.getZ(i) + (r() - 0.5) * k); }
      gm.rotateX(rx); gm.rotateY(rY); gm.rotateZ(rz); gm.translate(x, y, z); gm.computeVertexNormals(); const p = gm.attributes.position, nn = gm.attributes.normal, uv = gm.attributes.uv, n = p.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i)); if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i) / 1.8, p.getY(i) / 1.8); else if (ay >= az) uv.setXY(i, p.getX(i) / 1.8, p.getZ(i) / 1.8); else uv.setXY(i, p.getX(i) / 1.8, p.getY(i) / 1.8);
        const low = Math.max(0, 1 - p.getY(i) / 1.2), v = shade * (0.85 + r() * 0.25) * (1 - 0.35 * low), moss = r() < 0.1 + low * 0.1 ? 0.07 : 0; col[i * 3] = v * 0.94; col[i * 3 + 1] = v + moss; col[i * 3 + 2] = v * 0.88; }
      gm.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(gm); };
    const xo = side * (W - 0.04);   // centro dei conci: sporgono ~7 cm dal muro
    const RAD = PW;   // raggio del varco
    // piedritti: filari di conci (altezze diverse, giunti sfalsati) profondi 59 cm: fuori dal muro per 9 cm e dentro il passaggio per 50; con una pietra mancante
    const XC = side * (W + 0.205), DEP = 0.59;   // centro e profondita' dei conci (da W-0.09 a W+0.5, nel verso del passaggio)
    for (const j of [-1, 1]) { let y = 0, k = 0; const gap = Math.floor(r() * 3) + 1; while (y < SPR - 0.04) { const h = Math.min(0.34 + r() * 0.2, SPR - y), wdt = 0.3 + (k % 2) * 0.1 + r() * 0.04; if (!(j === 1 && k === gap && r() < 0.6)) blk(DEP + r() * 0.02, h - 0.012, wdt, XC + side * 0.01 * r(), y + h / 2, zc + j * (RAD - 0.012 + wdt / 2), 0, (r() - 0.5) * 0.015, (r() - 0.5) * 0.01, 0.5 + r() * 0.15, 0.03); y += h; k++; } }
    // imposte: capitelli piatti che sporgono un po' di piu' e segnano l'attacco dell'arco
    for (const j of [-1, 1]) blk(DEP + 0.03, 0.14, 0.62, XC - side * 0.015, SPR + 0.05, zc + j * (RAD + 0.2), 0, 0, 0, 0.6, 0.03);
    // arco: conci radiali (11), spessore 0.27, uno scheggiato e storto; chiave piu' alta e sporgente
    const NV = 11; for (let i = 0; i < NV; i++) { const th = (i + 0.5) / NV * Math.PI, key = i === (NV - 1) / 2, Rm = RAD - 0.012 + (key ? 0.15 : 0.135), tang = Math.PI * Rm / NV * 1.02;
      blk(DEP + (key ? 0.06 : r() * 0.02), key ? 0.3 : 0.27, tang + (key ? 0.06 : 0), XC - side * (key ? 0.03 : 0.0), SPR + Math.sin(th) * Rm, zc + Math.cos(th) * Rm, -th, 0, (i === 3 ? 0.03 : (r() - 0.5) * 0.01), 0.5 + r() * 0.15, 0.03); }
    // secondo anello, piu' sottile e a filo di parete, con un buco dove un concio e' caduto
    const NV2 = 15; for (let i = 0; i < NV2; i++) { if (i === 11) continue; const th = (i + 0.5) / NV2 * Math.PI, Rm = RAD + 0.38; blk(0.06 + r() * 0.02, 0.24, Math.PI * Rm / NV2 * 1.02, xo + side * 0.02, SPR + Math.sin(th) * Rm, zc + Math.cos(th) * Rm, -th, 0, 0, 0.42 + r() * 0.12, 0.04); }
    const fm = frameM.clone(); fm.vertexColors = true; g.add(new THREE.Mesh(mergeGeometries(parts), fm));
    return g; };
  // RIVESTIMENTO DI SOSTEGNO dietro i conci: un guscio continuo di pietra (arco, pareti e pavimento) lungo la profondita' dell'arco; chiude ogni fessura tra un concio e l'altro (da li' non si vede mai il vuoto o l'universo)
  let lin; { const linM = mats.stone.clone(); linM.color.setRGB(0.5, 0.5, 0.52);
    lin = (zc, side, parent) => { const rad = PW - 0.004, xa = side > 0 ? XD - 0.09 : -(XD + LIN + 0.01), xb = side > 0 ? XD + LIN + 0.01 : -(XD - 0.09), nxl = 6; const [pl, nr] = arcPoly(zc, rad);
      mesh(sweep(pl, nr, xa, xb, nxl), linM, parent); mesh(sweep([[zc - rad, 0], [zc - rad, SPR]], [[1, 0], [1, 0]], xa, xb, nxl), linM, parent); mesh(sweep([[zc + rad, SPR], [zc + rad, 0]], [[-1, 0], [-1, 0]], xa, xb, nxl), linM, parent);
      mesh(quadGeo(xb - xa, rad * 2, nxl, M(-Math.PI / 2, 0, (xa + xb) / 2, -0.004, zc), (x, y, z) => [x / fu, z / fv]), linM, parent); };
    lin(ZR, 1, G); lin(ZLL, -1, LP); }
  const frameR = frame(1, ZR, 7), frameL = frame(-1, ZLL, 11); frameL.visible = false; G.add(frameR, frameL);
  const frame2 = frame(1, ZL, 13); frame2.visible = false; G.add(frame2);
  // corridoio di ritorno (static): compare quando, dopo la piega, si rientra nel tunnel dalla porta destra piu' avanti; dietro e' chiuso
  const R2 = new THREE.Group(); R2.visible = false; G.add(R2); const XR2 = SB + 0.4;
  mesh(quadGeo(XR2 - XD, PW * 2, 12, M(-Math.PI / 2, 0, (XD + XR2) / 2, 0, ZL), (x, y, z) => [x / fu, z / fv]), floorM, R2);
  { const [pl, nr] = arcPoly(ZL); mesh(sweep(pl, nr, XD + LIN, XR2, 12), wallM, R2); } wallsLo(ZL, XD + LIN, XR2, 12, R2); wallThick(XD + LIN, XR2, null, R2, ZL);
  { const sh = new THREE.Shape(); sh.moveTo(-PW, 0); sh.lineTo(-PW, SPR); for (let k = 1; k <= ARC; k++) { const th = Math.PI - k / ARC * Math.PI; sh.lineTo(PW * Math.cos(th), SPR + PW * Math.sin(th)); } sh.lineTo(PW, 0); sh.lineTo(-PW, 0);
    const gc = new THREE.ShapeGeometry(sh); const pp = gc.attributes.position, uvc = gc.attributes.uv; for (let i = 0; i < pp.count; i++) uvc.setXY(i, pp.getX(i) / bu, pp.getY(i) / bv); colorAttr(gc, 0.8); gc.rotateY(-Math.PI / 2); gc.translate(XR2, 0, ZL); mesh(gc, wallM, R2); }
  lin(ZL, 1, R2);
  // cielo del vuoto (solo durante la piega): nero con stelle e qualche luce lontana, segue la camera
  const SKY = new THREE.Group(); SKY.visible = false; G.add(SKY); const skyLights = [];
  { const N = 700, p = new Float32Array(N * 3), c = new Float32Array(N * 3), rs = (() => { let sd = 77; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < N; i++) { const th = rs() * 6.283, ph = Math.acos(2 * rs() - 1), r = 38; p[i * 3] = Math.sin(ph) * Math.cos(th) * r; p[i * 3 + 1] = Math.cos(ph) * r; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; const b = 0.25 + rs() * rs() * 0.9, w = rs(); c[i * 3] = b * (0.8 + 0.2 * w); c[i * 3 + 1] = b * (0.85 + 0.1 * w); c[i * 3 + 2] = b; }
    const pg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)).setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false, map: radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']], 32) })); pts.frustumCulled = false; pts.renderOrder = -6; SKY.add(pts);
    for (const [dx, dy, dz, col, sz] of [[-0.8, 0.3, -0.5, 0xffc890, 20], [0.7, 0.45, 0.6, 0x9ab4ff, 16], [0.2, 0.15, -0.95, 0xffe2b0, 12], [-0.5, 0.6, 0.65, 0xc89aff, 18]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,255,255,.9)'], [0.3, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.4 })); const v = new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(36); sp.position.copy(v); sp.scale.set(sz, sz, 1); sp.renderOrder = -6; SKY.add(sp); skyLights.push(sp); } }

  // ---- la stanza sospesa: pavimento di luce, croce enorme, raggi, alone, polvere e stelle. Nessun muro. Molto lontana, in fondo al passaggio ----
  const GL = new THREE.Group(); G.add(GL); const GX = XD + LEN + 34; GL.position.set(GX, 0, ZR);
  const glowMats = [], addGlow = (m, base) => { m.userData.base = base; glowMats.push(m); return m; };
  const add = (o, m) => { o.frustumCulled = false; GL.add(o); return o; };
  const discTex = radial([[0, 'rgba(255,240,205,1)'], [0.35, 'rgba(255,214,150,.7)'], [0.75, 'rgba(255,170,90,.18)'], [1, 'rgba(255,150,70,0)']]);
  const disc = add(new THREE.Mesh(new THREE.CircleGeometry(15, 48), addGlow(new THREE.MeshBasicMaterial({ map: discTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.55))); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01;
  const haloM = addGlow(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,224,160,.75)'], [0.55, 'rgba(255,170,90,.22)'], [1, 'rgba(255,140,60,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.75);
  const halo = add(new THREE.Sprite(haloM)); halo.scale.set(34, 34, 1); halo.position.set(12, 9, 0);
  const crossM = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false });
  const cross = new THREE.Group(); const bar = (sx, sy, sz, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), crossM); m.position.set(x, y, 0); cross.add(m);
  };
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
    fragmentShader: 'uniform sampler2D uTex; uniform vec2 uRes; uniform float uFade; void main() { vec3 c = texture2D(uTex, gl_FragCoord.xy / uRes).rgb; c = pow(c, vec3(1.7)) * 0.5; gl_FragColor = vec4(c * uFade, 1.0); }' });
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
    if ((Math.abs(z - zc) < 0.66 || inside) && cand > lim - 0.05) return [side * Math.min(xmax, Math.max(lim - 0.02, cand)), Math.max(zc - 0.5, Math.min(zc + 0.5, z))];
    return null;
  };
  const FMAX = ENDR + 0.4;   // fine del tratto di ritorno nelle coordinate "a riposo" del passaggio (oltre c'e' il tunnel)
  const cm = (x, z) => { const st = F.state; if (st === 'fold') return corridor(1, ZR, FMAX, x, z); if (st === 'exit' || st === 'done') return corridor(1, ZR, PEND - 0.7, x, z); return corridor(1, ZR, XD + LEN - 1.2, x, z); };
  player.constrainMove = cm;
  let overlay = null; const ov = () => overlay ||= (() => { const d = document.createElement('div'); d.id = 'foldfade'; d.style.cssText = 'position:fixed;inset:0;z-index:61;background:#000;opacity:0;pointer-events:none;transition:opacity .35s'; document.body.appendChild(d); return d; })();
  const lampAll = (mode, dur) => { for (let i = 0; i < 4; i++) lights.lamp?.(i, mode, dur); };

  // ===================== PIANETA ALIENO (macchina a stati: ENTER -> EXPLORE -> FLICKER -> BLACKOUT -> RETURN) =====================
  // Paesaggio nella scena principale: terreno e massi statici, stelle a 360 gradi e galassia separata.
  // Quattro draw call, nessun secondo render. Sfarfallio, blackout e ritorno restano quelli esistenti.
  RP.visible = true; for (const o of slabs) o.visible = false; GL.visible = false; winQuad.visible = false; SKY.visible = false; spill.visible = spillSp.visible = false; for (const o of fallback) o.visible = false; frame2.visible = false; frameL.visible = false;
  const PX0 = XD + 0.4, PXMAX = XD + 7.0, PZH = 0.5, FRONT = XD + 0.62;   // collisioni e soglie dell'evento invariate
  const landscape = createCosmicLandscape({ x: XD, z: ZR, xStart: SV, uvScale: [fu, fv] });
  const PL = landscape.group; G.add(PL);
  const gTex = landscape.groundTexture, TS = 2.2;
  // Sotto la volta resta il pavimento vero del tunnel, illuminato dalla torcia.
  // Oltre l'arco si cammina sul terreno gia' presente: niente lunga corsia piatta
  // sovrapposta al paesaggio e nessuna geometria aggiunta.
  mainFloor.geometry.dispose();
  mainFloor.geometry = quadGeo(SV - XD - LIN, PW * 2, Math.ceil((SV - XD - LIN) * 3), M(-Math.PI / 2, 0, (XD + LIN + SV) / 2, 0, ZR), (x, y, z) => [x / fu, z / fv]);
  mainFloor.name = 'cosmo-soglia'; mainFloor.material = floorM;
  gTex.repeat.set(fu / TS, fv / TS);
  const sky = (v) => landscape.setSkyBrightness(v);   // la macchina a stati continua a comandare lo stesso sfarfallio
  F.landscape = landscape;
  F.prepare = (renderer) => landscape.prepare(renderer, scene, camera);
  // movimento: dal tunnel si passa dal varco (fascia stretta) e poi si cammina in una piccola area; il limite non si raggiunge mai (il collasso parte prima)
  const cmP = (x, z) => { const st = F.state; const back = st === 'dark' || st === 'exit' || st === 'done', xm = back ? PEND - 0.7 : PXMAX; const lim = W - RADIUS;
    // Appena il corpo rientra nel tunnel decide il controller normale: nessuna
    // fascia minima che rimandi indietro i passi piccoli (60/120 Hz).
    if (x <= lim) return null;
    const inside = player.pos.x > lim && Math.abs(player.pos.z - ZR) <= PZH + 0.01;
    if (Math.abs(z - ZR) < 0.66 || inside) return [Math.min(xm, x), Math.max(ZR - PZH, Math.min(ZR + PZH, z))];
    return null; };
  player.constrainMove = cmP;
  F.update = (dt) => {
    // Il passaggio e' un gruppo separato: segue la visibilita' del suo tunnel,
    // anche quando il risveglio riporta il giocatore alle coordinate iniziali.
    if (!F.enabled || !tunnel.visible) { G.visible = false; return; }
    const P = player.pos; tt += dt; F.t += dt;
    { const near = P.z > Z_END + 1.2 && P.z < 6 && Math.abs(P.z - ZR) < 16; const far = near ? 62 : 30; if (P.z > Z_END + 1.2 && P.z < 6 && camera.far !== far && (camera.far === 30 || camera.far === 62 || camera.far > 30.5 && !F.farSaved)) { F.farSaved ||= camera.far; camera.far = far; camera.updateProjectionMatrix(); } else if (!(P.z > Z_END + 1.2 && P.z < 6) && F.farSaved && (camera.far === 30 || camera.far === 62)) { camera.far = F.farSaved; F.farSaved = 0; camera.updateProjectionMatrix(); } }   // nel tunnel la nebbia nasconde tutto oltre ~28 m; vicino alla porta serve vedere il fondale (56 m)
    G.visible = P.z > Z_END + 1.2; if (!G.visible) return;
    const st = F.state;
    if ((st === 'idle' || st === 'done') && lights.lamps) for (const L of lights.lamps) if (L.mode === 'off' || L.mode === 'dim') L.mode = 'on';   // salvaguardia: fuori dall'evento le lampade del tunnel non restano mai spente
    if (st === 'idle') { sky(0.85 + 0.12 * Math.sin(tt * 0.7));
      if (P.x > FRONT && Math.abs(P.z - ZR) < 0.8 && !player.frozen) { F.state = 'explore'; F.t = 0; audio.swell?.(2.0, 0.35); audio.whisper?.(1.6, 0.18); say?.('Un altro mondo.', 2600); } return; }
    if (st === 'explore') { sky(0.85 + 0.12 * Math.sin(tt * 0.7));
      if (P.x < XD - 0.05) { F.state = 'idle'; return; }
      if (P.x > XD + 3.2 || F.t > 9) { F.state = 'flicker'; F.t = 0; audio.swell?.(2.2, 0.4); instab?.push?.(0.6, 6); } return; }
    if (st === 'flicker') {   // il cielo sfarfalla come una lampadina difettosa, sempre piu' spezzato
      flickerT -= dt; if (flickerT <= 0) { flickerT = 0.04 + Math.random() * 0.11; const env = Math.min(1, F.t / 2.2); lv = Math.random() < 0.3 + 0.5 * env ? 0.02 + Math.random() * 0.2 : 0.55 + 0.45 * (1 - env); }
      sky(lv); if (F.t > 2.2) { F.state = 'dark'; F.t = 0; F.tp = false; sky(0); ov().style.transition = 'opacity .1s'; ov().style.opacity = '1'; audio.lightOff?.(); audio.scare?.(); } return; }
    if (st === 'dark') {   // buio assoluto: si ripristina tutto e si torna nel corridoio originale (stesso gameplay, nessun caricamento)
      if (F.t > 0.45 && !F.tp) { F.tp = true; PL.visible = false; nearWalls.visible = false; farWalls.visible = false; mainFloor.visible = false; FW.visible = true; ceilFar.visible = true;   // il pianeta non c'e' piu': il passaggio e' un normale corridoio chiuso e ci si ritrova alla stessa profondita', girati verso il tunnel
        signIn.visible = false; signOut.position.set(-W + 0.03, 1.2, ZR); signOut.visible = true; player.yaw += Math.PI; player.pitch = 0; lampAll('on', 1); }
      if (F.t > 1.1) { F.state = 'exit'; F.t = 0; ov().style.transition = 'opacity .9s'; ov().style.opacity = '0'; audio.lightOn?.(); } return; }
    if (st === 'exit') { if (F.t > 1.2) { F.state = 'done'; F.done = true; } return; }
  };
  F.applyCamera = () => landscape.followCamera(camera);
  F.reset = () => { ov().style.transition = 'opacity .1s'; ov().style.opacity = '0'; F.tp = false; F.state = 'idle'; F.t = 0; F.done = false; PL.visible = true; nearWalls.visible = true; farWalls.visible = true; mainFloor.visible = true; FW.visible = false; ceilFar.visible = false; sky(0.85); signOut.visible = false; signIn.visible = true; frameR.visible = true; RP.visible = true; if (tunnel.userData.plugs) { tunnel.userData.plugs[0].visible = false; tunnel.userData.plugs[1].visible = true; tunnel.userData.plugs[2].visible = true; } player.constrainMove = cmP; };
  // animazioni leggere della stanza (raggi che respirano, polvere che sale, frammenti che ruotano)
  F.animate = (dt) => { for (let i = 0; i < runeMats.length; i++) runeMats[i].opacity = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(tt * 0.9 + i * 1.7)) * (0.7 + 0.3 * Math.sin(tt * 4.1 + i * 3.1)); for (const d of dustSets) { const a = d.pts.geometry.attributes.position; for (let i = 0; i < d.pd.length; i++) { const k = (tt * d.pd[i][1] + d.pd[i][0] * 3) % 1; a.array[i * 3] = d.side * (W - 0.1 - k * 0.5); a.array[i * 3 + 1] = 0.15 + k * 1.9 * (0.5 + d.pd[i][0]); a.array[i * 3 + 2] = d.zc + d.pd[i][2] * 1.8 + Math.sin(tt * 0.5 + i) * 0.1; } a.needsUpdate = true; }
    if (!GL.visible) return; cross.rotation.y += dt * 0.14; for (const o of GL.children) if (o.userData.ph !== undefined) o.rotation.x += Math.sin(tt * 0.6 + o.userData.ph) * dt * 0.02; for (const d of debris) { d.rotation.x += d.userData.sp[0] * dt; d.rotation.y += d.userData.sp[1] * dt; d.position.y += Math.sin(tt * 0.5 + d.position.x) * dt * 0.05; }
    const a = motes.geometry.attributes.position; for (let i = 0; i < NM; i++) { a.array[i * 3 + 1] += mv[i][1] * dt; if (a.array[i * 3 + 1] > 10) a.array[i * 3 + 1] = 0; a.array[i * 3] += Math.sin(tt * 0.4 + mv[i][0]) * dt * 0.2; } a.needsUpdate = true; };
  const upd = F.update; F.update = (dt) => { upd(dt); if (G.visible) F.animate(dt); };
  // ---- CARTELLI DI LAMIERA ARRUGGINITA: uno davanti all'ingresso («ENTRA QUI, FIDATI») e uno dopo l'uscita con una freccia verso la direzione giusta (la sala in fondo al tunnel) ----
  const hsh = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return hsh(xi, yi) * (1 - u) * (1 - v) + hsh(xi + 1, yi) * u * (1 - v) + hsh(xi, yi + 1) * (1 - u) * v + hsh(xi + 1, yi + 1) * u * v; };
  const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.1 + 5, y * 2.1 + 3) * 0.28 + vnoise(x * 4.3 + 9, y * 4.3 + 1) * 0.15 + vnoise(x * 9 + 2, y * 9 + 7) * 0.07;
  // cartello di lamiera vecchio di 30 anni nell'umidita': ruggine a strati (nera, bruna, arancio), vernice scrostata a placche, colature verticali, bordi mangiati, angoli piegati
  const signMesh = (w, h, draw, x, y, z, tilt = 0, seed = 1) => {
    const cw = 512, ch = Math.round(512 * h / w), pc = document.createElement('canvas'); pc.width = cw; pc.height = ch; draw(pc.getContext('2d'), cw, ch);
    const pa = pc.getContext('2d').getImageData(0, 0, cw, ch).data, c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'), img = g.createImageData(cw, ch), o = img.data;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const k = (j * cw + i) * 4, nx = i / cw, ny = j / ch;
      const n1 = fbm(i * 0.018 + seed * 13, j * 0.018), n2 = fbm(i * 0.06 + seed * 7, j * 0.06 + 11), n3 = fbm(i * 0.22 + seed, j * 0.22), streak = vnoise(i * 0.07 + seed, j * 0.004) , edge = Math.min(i, j, cw - 1 - i, ch - 1 - j) / 40;
      // rust: dark where wet/old, orange where fresh pits
      const rustT = Math.min(1, Math.max(0, n1 * 1.4 - 0.2 + (n3 - 0.5) * 0.5)); let r = 30 + rustT * 120, gg = 16 + rustT * 52, b = 10 + rustT * 22;
      r *= 0.55 + streak * 0.7; gg *= 0.55 + streak * 0.7; b *= 0.55 + streak * 0.7;
      const pit = Math.max(0, n3 - 0.62) * 5; r *= 1 - pit * 0.6; gg *= 1 - pit * 0.6; b *= 1 - pit * 0.6;
      // paint: only where the flaking mask allows it, dirty and faded
      const keep = Math.min(1, Math.max(0, (n2 * 0.7 + n1 * 0.4 - 0.34) * 5)), pA = (pa[k + 3] / 255) * keep;
      r = r * (1 - pA) + (150 + n3 * 40) * pA * 0.8; gg = gg * (1 - pA) + (140 + n3 * 40) * pA * 0.75; b = b * (1 - pA) + (112 + n3 * 40) * pA * 0.65;
      // grime and edge rust
      const ed = Math.max(0, 1 - edge); r = r * (1 - ed * 0.5) + 70 * ed * 0.5; gg *= 1 - ed * 0.55; b *= 1 - ed * 0.6;
      const dr = Math.max(0, vnoise(i * 0.05 + seed * 3, j * 0.01) - 0.55) * Math.min(1, ny * 1.5) * 1.6; r *= 1 - dr * 0.5; gg *= 1 - dr * 0.55; b *= 1 - dr * 0.55;
      // eaten edges and corner losses
      const eat = fbm(i * 0.05 + seed * 5, j * 0.05 + 2) * 26, dEdge = Math.min(i, j, cw - 1 - i, ch - 1 - j), corner = Math.min(Math.hypot(i, j), Math.hypot(cw - i, j), Math.hypot(i, ch - j), Math.hypot(cw - i, ch - j));
      let alpha = dEdge + eat - 20 > 0 ? 1 : 0; if (corner < 70 && fbm(i * 0.1 + seed, j * 0.1) < 0.42 + (70 - corner) / 150) alpha = 0;
      o[k] = Math.min(255, r); o[k + 1] = Math.min(255, gg); o[k + 2] = Math.min(255, b); o[k + 3] = alpha ? 255 : 0; }
    g.putImageData(img, 0, 0);
    for (const [bx, by, sk] of [[28, 28, 0], [cw - 28, 28, 1], [28, ch - 28, 1], [cw - 28, ch - 28, 0]]) { if (hsh(bx + seed, by) < 0.3) continue; g.fillStyle = '#1c1008'; g.beginPath(); g.arc(bx, by, 10, 0, 7); g.fill(); g.fillStyle = 'rgba(150,70,25,.55)'; g.beginPath(); g.arc(bx - 2, by - 2, 5, 0, 7); g.fill(); g.strokeStyle = 'rgba(90,35,10,.5)'; g.lineWidth = 5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (hsh(bx, seed) - 0.5) * 30, by + 50 + hsh(by, seed) * 70); g.stroke(); }   // bulloni con colatura
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(w, h, 10, 6), pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i), fx = px / w + 0.5, fy = py / h + 0.5; pos.setZ(i, 0.02 * Math.sin(fx * 3 + seed) + 0.05 * Math.pow(Math.max(0, fx - 0.7) / 0.3, 2) * (seed % 2 ? 1 : -1) + 0.04 * Math.pow(Math.max(0, 0.25 - fy) / 0.25, 2)); }   // lamiera ondulata e angoli piegati
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, metalness: 0.35 }));
    m.position.set(x, y, z); m.rotation.y = Math.PI / 2; m.rotation.x = tilt; m.rotation.z = tilt * 0.6; G.add(m); return m; };
  const paint = (g, txt, cw, ch, sz) => { g.fillStyle = '#fff'; g.font = `bold ${sz}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const L = txt.split('\n'); L.forEach((l, i) => g.fillText(l, cw / 2, ch / 2 + (i - (L.length - 1) / 2) * sz * 1.1)); };
  // i due cartelli sono foto di lamiera vera (assets/tex/sign_in.webp, sign_out.webp): lievemente ondulati, un po' storti
  const signImg = (url, w, h, x, y, z, tilt) => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(w, h, 8, 6), pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const fx = pos.getX(i) / w + 0.5, fy = pos.getY(i) / h + 0.5; pos.setZ(i, 0.012 * Math.sin(fx * 4 + fy * 2) + 0.03 * Math.pow(Math.max(0, fx - 0.8) / 0.2, 2)); } geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.25, color: 0xd8d0c8 })); m.position.set(x, y, z); m.rotation.y = Math.PI / 2; m.rotation.x = tilt; m.rotation.z = tilt * 0.6; G.add(m); return m; };
  const signIn = signImg('assets/tex/sign_in.webp', 0.72, 0.88, -W + 0.03, 1.2, ZR, 0.03);
  const signOut = signImg('assets/tex/sign_out.webp', 0.84, 0.7, -W + 0.03, 1.3, ZR - 1.3, -0.02);
  signOut.visible = false; F.signOut = signOut; F.signIn = signIn;
  F.group = G; F.U = U;
  return F;
}
