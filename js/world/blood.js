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
  const rotY = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };
  for (const d of list) {
    const h = d.h ?? 0.3, w = h * ASPECT[d.k];
    const mat = new THREE.MeshStandardMaterial({ map: get(d.k), transparent: true, color: d.k === 'X' ? new THREE.Color(1, 1, 1) : new THREE.Color(0.55, 0.07, 0.06), roughness: d.k === 'X' ? 0.7 : 0.28, metalness: 0, opacity: d.a ?? 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, alphaTest: 0.02 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); if (d.flip) m.scale.x = -1;
    m.rotation.set(0, rotY[d.wall], (d.rot ?? 0)); m.rotation.order = 'YXZ';
    m.position.set(...d.p); m.userData.blood = true; group.add(m);
  }
}
