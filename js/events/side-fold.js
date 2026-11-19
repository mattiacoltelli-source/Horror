// LA PORTA LATERALE E IL PASSAGGIO CHE SI PIEGA (primo tunnel): sul muro destro c'e' una porta; in fondo a un piccolo passaggio, lontano, si intravede una stanza sospesa nel vuoto con una croce enorme e una luce
// che sfarfalla (niente muri: solo luce, polvere, stelle). Entrando nel passaggio la luce si spegne, la stanza sparisce e il passaggio si piega davanti a te (U in pianta, la visuale ruota con la curva).
// Quando arrivi in fondo alla curva c'e' un attimo di buio e riemergi da una porta sul muro SINISTRO del tunnel, che prima non c'era; quella di destra si richiude.
// Tutto con materiali senza luci in piu' (la luce e' "dipinta": emissivo, additivo). ?porta=0 spegne l'evento (il tunnel resta com'era, con i varchi chiusi dai tamponi).
import * as THREE from 'three';
import { W, SIDE_DOORS, Z_END } from '../world/tunnel.js';
import { TILES } from '../world/materials.js';

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
  const frameM = mats.stone.clone(); frameM.color.setRGB(1.5, 1.4, 1.3);
  const frame = (side, zc) => { const g = new THREE.Group(), B = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), frameM); m.position.set(x, y, z); g.add(m); };
    const x = side * (W - 0.04); B(0.14, PH + 0.12, 0.16, x, (PH + 0.12) / 2, zc + PW + 0.08); B(0.14, PH + 0.12, 0.16, x, (PH + 0.12) / 2, zc - PW - 0.08); B(0.14, 0.14, PW * 2 + 0.32, x, PH + 0.07, zc); return g; };
  const frameR = frame(1, ZR), frameL = frame(-1, ZL); frameL.visible = false; G.add(frameR, frameL);
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
          if (sp.prepared && !sp.active && dist < 26 && facing && sp.drawWindow(dt, camera.position, camera.quaternion, pcWin, qWin)) { if (!spaceOn) { spaceOn = true; winMat.uniforms.uTex.value = sp.win.tex; winQuad.visible = true; for (const o of fallback) o.visible = false; } winMat.uniforms.uRes.value = sp.win.res; } }
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
  F.animate = (dt) => { if (!GL.visible) return; cross.rotation.y += dt * 0.14; for (const o of GL.children) if (o.userData.ph !== undefined) o.rotation.x += Math.sin(tt * 0.6 + o.userData.ph) * dt * 0.02; for (const d of debris) { d.rotation.x += d.userData.sp[0] * dt; d.rotation.y += d.userData.sp[1] * dt; d.position.y += Math.sin(tt * 0.5 + d.position.x) * dt * 0.05; }
    const a = motes.geometry.attributes.position; for (let i = 0; i < NM; i++) { a.array[i * 3 + 1] += mv[i][1] * dt; if (a.array[i * 3 + 1] > 10) a.array[i * 3 + 1] = 0; a.array[i * 3] += Math.sin(tt * 0.4 + mv[i][0]) * dt * 0.2; } a.needsUpdate = true; };
  const upd = F.update; F.update = (dt) => { upd(dt); if (G.visible) F.animate(dt); };
  F.group = G; F.U = U;
  return F;
}
