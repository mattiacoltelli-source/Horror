// Impronte di mano sui muri: decal con alpha ricavato da sagome vere, rosso scuro e bagnato (rispondono solo alla luce).
import * as THREE from 'three';

const tex = {};
const loader = new THREE.TextureLoader();
// graffi di artigli: 4 solchi curvi e irregolari, disegnati qui (originali)
function clawTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4; i++) {
    const x0 = 40 + i * 52 + r() * 8, y0 = 20 + i * 12, x1 = x0 + 36 + r() * 14, y1 = 470 - i * 20, bend = 18 + r() * 14, w = 8 + r() * 4, pts = [];
    for (let t = 0; t <= 1.0001; t += 0.03) { const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend, y = y0 + (y1 - y0) * t, ww = w * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7; pts.push([x, y, ww]); }
    const edge = (side) => pts.map(([x, y, ww]) => [x + side * (ww + (r() - 0.5) * 2.4), y + (r() - 0.5) * 1.6]);
    const L = edge(-1), R = edge(1);
    g.beginPath(); L.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); R.reverse().forEach(([x, y]) => g.lineTo(x, y)); g.closePath();
    g.fillStyle = 'rgba(12,2,2,.97)'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,238,228,.38)'; g.stroke();            // solco scuro con labbro chiaro
    g.beginPath(); pts.forEach(([x, y, ww], k) => (k ? g.lineTo(x + 0.5, y) : g.moveTo(x + 0.5, y))); g.lineWidth = 1.2; g.strokeStyle = 'rgba(110,10,8,.55)'; g.stroke();   // filo di sangue dentro
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const get = (k) => (tex[k] ??= k === 'X' ? clawTexture() : (() => { const t = loader.load(`assets/tex/hand${k}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })());
const ASPECT = { A: 309 / 425, C: 284 / 373, X: 0.5 };

// list: [{ k:'A'|'C', p:[x,y,z], wall:'+x'|'-x'|'+z'|'-z', h:0.30, rot:0, flip:false, a:0.8 }]
// wall = verso in cui guarda il decal (la normale del muro verso la stanza)
export function bloodDecals(group, list) {
  const made = [];
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };
  for (const d of list) {
    const h = d.h ?? 0.3, w = h * ASPECT[d.k];
    const mat = new THREE.MeshStandardMaterial({ map: get(d.k), transparent: true, color: d.k === 'X' ? new THREE.Color(1, 1, 1) : new THREE.Color(0.55, 0.07, 0.06), roughness: d.k === 'X' ? 0.7 : 0.28, metalness: 0, opacity: d.a ?? 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, alphaTest: 0.02 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); if (d.flip) m.scale.x = -1;
    m.rotation.set(0, rotY[d.wall], (d.rot ?? 0)); m.rotation.order = 'YXZ';
    m.position.set(...d.p); m.userData.blood = true; group.add(m); made.push(m);
  }
  return made;
}

// Macchie di umidità e sporco sui muri (rompono la ripetizione dei mattoni): chiazze scure irregolari con colature, non rosse.
let stainTex = null;
function stainTexture() {
  if (stainTex) return stainTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d'); let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) { const x = 70 + r() * 116, y = 40 + r() * 160, rad = 18 + r() * 46, gr = g.createRadialGradient(x, y, 2, x, y, rad); gr.addColorStop(0, 'rgba(8,10,9,.55)'); gr.addColorStop(.6, 'rgba(8,10,9,.2)'); gr.addColorStop(1, 'rgba(8,10,9,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 9; i++) { const x = 60 + r() * 136, y0 = 60 + r() * 100, h = 120 + r() * 200, gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, 'rgba(8,10,9,.34)'); gr.addColorStop(1, 'rgba(8,10,9,0)'); g.fillStyle = gr; g.fillRect(x, y0, 2 + r() * 5, h); }
  g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(128, 190, 20, 128, 190, 190); m.addColorStop(0, '#fff'); m.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = m; g.fillRect(0, 0, 256, 384);
  stainTex = new THREE.CanvasTexture(c); return stainTex;
}
// list: [{ p:[x,y,z], wall:'+x'|'-x'|'+z'|'-z', w:1.6, h:2.4, a:.7, flip:bool }]
export function stainDecals(group, list) {
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };
  for (const d of list) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w ?? 1.6, d.h ?? 2.4), new THREE.MeshBasicMaterial({ map: stainTexture(), color: 0x000000, transparent: true, opacity: d.a ?? 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }));
    m.rotation.y = rotY[d.wall]; if (d.flip) m.scale.x = -1; m.position.set(...d.p); m.userData.stain = true; group.add(m);
  }
}


// TRACCE D'INCENDIO (fuliggine sui muri e sul soffitto, pavimento bruciato, scia di benzina): texture generate al volo, nere e opache solo in parte, senza luce propria.
// kinds: 'wall' (lingue di fuliggine che salgono dal pavimento), 'floor' (macchia carbonizzata con cenere), 'trail' (scia stretta con schizzi), 'ceil' (annerimento diffuso)
const burnTex = {};
function burnTexture(kind) {
  if (burnTex[kind]) return burnTex[kind];
  let sd = { wall: 11, floor: 23, trail: 37, ceil: 53 }[kind]; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const W = kind === 'trail' ? 128 : 256, H = kind === 'trail' ? 512 : kind === 'wall' ? 512 : 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.filter = 'blur(2.5px)';
  if (kind === 'wall') {   // lingue verticali che si assottigliano verso l'alto, piu' fitte al centro-basso
    for (let i = 0; i < 38; i++) {
      const x = W * (0.5 + (R() + R() + R() - 1.5) * 0.45), hgt = H * (0.3 + R() * 0.6) * (1 - Math.abs(x / W - 0.5) * 0.9), w0 = 6 + R() * 22, y0 = H;
      const grd = g.createLinearGradient(0, y0, 0, y0 - hgt); grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(x - w0, y0); g.quadraticCurveTo(x - w0 * 0.6 + (R() - 0.5) * 18, y0 - hgt * 0.5, x + (R() - 0.5) * 14, y0 - hgt); g.quadraticCurveTo(x + w0 * 0.6 + (R() - 0.5) * 18, y0 - hgt * 0.5, x + w0, y0); g.closePath(); g.fill();
    }
    g.filter = 'none'; const gr = g.createLinearGradient(0, H, 0, H * 0.5); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(W * 0.12, H * 0.5, W * 0.76, H * 0.5);
  } else if (kind === 'floor') {   // macchia irregolare: nera al centro con cenere, bordo bruciacchiato
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, r = Math.pow(R(), 0.6) * W * 0.36, x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * 0.8, rr = 14 + R() * 38; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(0,0,0,${0.5 + R() * 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); }
    g.filter = 'none'; for (let i = 0; i < 160; i++) { const a = R() * 6.283, r = R() * W * 0.34; g.fillStyle = `rgba(${120 + R() * 40},${112 + R() * 30},${100 + R() * 25},${0.05 + R() * 0.12})`; g.fillRect(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.8, 1 + R() * 3, 1 + R() * 2); }   // cenere chiara a puntini
  } else if (kind === 'trail') {   // scia che serpeggia lungo il pavimento, con schizzi ai lati
    let x = W / 2; for (let y = 0; y < H; y += 5) { x += (R() - 0.5) * 7; x = Math.max(W * 0.3, Math.min(W * 0.7, x)); g.fillStyle = `rgba(0,0,0,${0.6 + R() * 0.3})`; g.beginPath(); g.ellipse(x, y, 11 + R() * 9, 7, 0, 0, 6.283); g.fill(); if (R() < 0.18) { g.beginPath(); g.arc(x + (R() - 0.5) * 70, y + (R() - 0.5) * 14, 2 + R() * 6, 0, 6.283); g.fill(); } }
  } else {   // soffitto: annerimento diffuso, piu' scuro al centro
    const gr = g.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W * 0.5); gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) { const x = R() * W, y = R() * H, rr = 10 + R() * 30, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, 'rgba(0,0,0,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (burnTex[kind] = t);
}
export function burnDecals(group, list) {
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };
  for (const d of list) {
    const kind = d.k || 'wall', m = new THREE.Mesh(new THREE.PlaneGeometry(d.w ?? 3, d.h ?? 3), new THREE.MeshBasicMaterial({ map: burnTexture(kind), color: 0x0a0806, transparent: true, opacity: d.a ?? 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, fog: true }));
    if (kind === 'floor' || kind === 'trail') { m.rotation.set(-Math.PI / 2, 0, d.rot ?? 0); m.rotation.order = 'YXZ'; }
    else if (kind === 'ceil') { m.rotation.set(Math.PI / 2, 0, d.rot ?? 0); m.rotation.order = 'YXZ'; }
    else { m.rotation.y = rotY[d.wall]; if (d.flip) m.scale.x = -1; }
    m.position.set(...d.p); m.userData.stain = true; group.add(m);
  }
}

// SCRITTE sul muro (sangue o bomboletta, immagini con trasparenza in assets/tex): grandi, leggibili nel cono della torcia.
// list: [{ img, p:[x,y,z], wall:'+x'|'-x'|'+z'|'-z', w: larghezza in metri, rot: 0, a: 0.95 }]  (l'altezza segue le proporzioni dell'immagine)
import { bloodText } from './bloodfont.js';
// PEZZI DI TEXTURE (intonaco scrostato, muro macchiato, blocchi, cemento) con bordo irregolare, appoggiati su pareti, pavimento o soffitto: rovinano le superfici troppo pulite.
// list: [{ img, p:[x,y,z], wall:'+x'|'-x'|'+z'|'-z'|'floor'|'ceil', w, h, rot, a, tint }]
export function patchDecals(group, list) {
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI }, made = [];
  for (const d of list) {
    const t = (wtex[d.img] ??= (() => { const x = loader.load(d.img); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; })());
    const c = d.tint ?? 0.62, mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, color: new THREE.Color(c, c * 0.97, c * 0.93), roughness: 0.95, metalness: 0, opacity: d.a ?? 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), mat); m.rotation.order = 'YXZ';
    if (d.wall === 'floor') m.rotation.set(-Math.PI / 2, 0, d.rot ?? 0); else if (d.wall === 'ceil') m.rotation.set(Math.PI / 2, 0, d.rot ?? 0); else m.rotation.set(0, rotY[d.wall], d.rot ?? 0);
    m.position.set(...d.p); m.userData.writing = true; group.add(m); made.push(m);
  }
  return made;
}

const wtex = {};
export function writingDecals(group, list) {
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI }, made = [];
  for (const d of list) {
    const T = d.text ? bloodText(d.text) : null;   // { text } = frase scritta al volo con il font di sangue
    const t = T ? T.tex : (wtex[d.img] ??= (() => { const x = loader.load(d.img, (tt) => { d.__asp = tt.image.width / tt.image.height; }); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; })());
    const asp = T ? T.aspect : (d.aspect ?? 4.5), mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, color: d.plain ? new THREE.Color(0.8, 0.78, 0.74) : T ? new THREE.Color(0.66, 0.4, 0.4) : new THREE.Color(0.95, 0.62, 0.62), emissive: d.plain ? 0x000000 : T ? 0x180303 : 0x300606, emissiveIntensity: 1.0, roughness: d.plain ? 0.85 : T ? 0.8 : 0.32, metalness: 0, opacity: d.a ?? 0.96, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const ww = d.maxH ? Math.min(d.w, d.maxH * asp) : d.w, m = new THREE.Mesh(new THREE.PlaneGeometry(ww, ww / asp), mat); m.rotation.set(0, rotY[d.wall], d.rot ?? 0); m.rotation.order = 'YXZ'; m.position.set(...d.p); if (d.glow) { mat.emissiveMap = t; mat.emissive = new THREE.Color(d.glow, d.glow, d.glow); mat.emissiveIntensity = 1; }   // murali: restano appena leggibili anche al buio (come un dipinto che conserva un po' di luce)
    m.userData.writing = true; group.add(m); made.push(m);
  }
  return made;
}
