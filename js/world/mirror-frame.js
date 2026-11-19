// CORNICE DELLO SPECCHIO (cantina): barocca in legno scuro con foglia d'oro consumata a chiazze, modanatura a gradini, perle, ovoli, rosoni agli angoli e cimasa a cartiglio con volute.
// Geometria leggera: una sola mesh spazzolata per il profilo + istanze per perle/ovoli/petali (circa 10 disegni in tutto). Coordinate locali: il vetro e' il rettangolo hx x hy nel piano XY, la cornice sporge verso +z.
import * as THREE from 'three';

const DARK = 0.9;   // la cornice e' il 10% piu' scura della prima proposta

function sweep(hx, hy, profile) {   // profile: [[w (verso l'esterno), z (verso chi guarda)], ...], angoli a sega
  const pos = [], uv = [], sides = [[hx, hy, 0], [hy, hx, -Math.PI / 2], [hx, hy, Math.PI], [hy, hx, Math.PI / 2]];
  for (const [hl, hd, rot] of sides) { const c = Math.cos(rot), s = Math.sin(rot); let acc = 0;
    for (let i = 0; i < profile.length - 1; i++) { const [w0, z0] = profile[i], [w1, z1] = profile[i + 1], L0 = hl + w0, L1 = hl + w1, d0 = hd + w0, d1 = hd + w1, v0 = acc, v1 = acc + Math.hypot(w1 - w0, z1 - z0); acc = v1;
      const P = (x, y, z) => [x * c - y * s, x * s + y * c, z], A = P(-L0, d0, z0), B = P(L0, d0, z0), C = P(L1, d1, z1), D = P(-L1, d1, z1);
      pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(-L0 * 1.6, v0 * 6, L0 * 1.6, v0 * 6, L1 * 1.6, v1 * 6, -L0 * 1.6, v0 * 6, L1 * 1.6, v1 * 6, -L1 * 1.6, v1 * 6); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

export function createMirrorFrame({ hx, hy, seed = 5 }) {
  const rnd = (() => { let s = seed * 7919 + 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const G = new THREE.Group(); G.name = 'cornice-specchio';
  // ---- texture: legno scuro + foglia d'oro a chiazze (dove manca si vede il legno), graffi, sporco colato; la stessa come rilievo ----
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d'); g.fillStyle = '#25180e'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 700; i++) { g.strokeStyle = `rgba(28,16,7,${0.05 + rnd() * 0.25})`; g.lineWidth = 0.4 + rnd() * 1.6; const y = rnd() * W, x = rnd() * W, l = 60 + rnd() * 300; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (rnd() - 0.5) * 6, x + l * 0.7, y + (rnd() - 0.5) * 6, x + l, y + (rnd() - 0.5) * 4); g.stroke(); }
  { const t = document.createElement('canvas'); t.width = t.height = 70; const tg = t.getContext('2d'); for (let y = 0; y < 70; y++) for (let x = 0; x < 70; x++) { const r = rnd(); tg.fillStyle = r > 0.42 ? `rgba(${Math.round(168 * DARK)},${Math.round(128 * DARK)},${Math.round(52 * DARK)},${Math.min(1, (r - 0.42) * 2.4)})` : 'rgba(0,0,0,0)'; tg.fillRect(x, y, 1, 1); }
    const t2 = document.createElement('canvas'); t2.width = t2.height = 200; const g2 = t2.getContext('2d'); g2.imageSmoothingEnabled = true; g2.imageSmoothingQuality = 'high'; g2.drawImage(t, 0, 0, 200, 200); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(t2, 0, 0, W, W);
    g.fillStyle = 'rgba(255,230,160,.04)'; for (let i = 0; i < 300; i++) g.fillRect(rnd() * W, rnd() * W, 1 + rnd() * 3, 1); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(190,160,105,${rnd() * 0.25})`; g.fillRect(rnd() * W, rnd() * W, 1 + rnd() * 5, 1 + rnd() * 2); }
  for (let i = 0; i < 40; i++) { const x = rnd() * W, y0 = rnd() * W; g.fillStyle = 'rgba(8,6,4,.3)'; g.fillRect(x, y0, 1 + rnd() * 2, 30 + rnd() * 120); }   // sporco colato
  for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(12,8,4,${0.3 + rnd() * 0.3})`; g.beginPath(); g.ellipse(rnd() * W, rnd() * W, 6 + rnd() * 26, 3 + rnd() * 9, rnd() * 3, 0, 7); g.fill(); }   // macchie scure di polvere nei solchi
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.35, side: THREE.DoubleSide, bumpMap: tex, bumpScale: 1.3 });

  const prof = [[0, 0], [0, 0.035], [0.018, 0.052], [0.034, 0.03], [0.046, 0.03], [0.05, 0.066], [0.072, 0.082], [0.094, 0.064], [0.104, 0.046], [0.128, 0.05], [0.143, 0.082], [0.158, 0.078], [0.174, 0.042], [0.174, 0]];
  G.add(new THREE.Mesh(sweep(hx, hy, prof), mat));

  // ornamenti ripetuti lungo i 4 lati, con istanze (un disegno per tipo)
  const sides = [[hx, hy, 0], [hy, hx, -Math.PI / 2], [hx, hy, Math.PI], [hy, hx, Math.PI / 2]], dm = new THREE.Object3D();
  const along = (geo, w, z, step, orient = 0, sc = [1, 1, 1], phase = 0) => {
    const spots = []; for (const [hl, hd, rot] of sides) { const L = hl + w, n = Math.floor(L * 2 / step), cs = Math.cos(rot), sn = Math.sin(rot); for (let i = 0; i < n; i++) { const x = -L + (i + 0.5 + phase) * (L * 2 / n), y = hd + w; spots.push([x * cs - y * sn, x * sn + y * cs, rot]); } }
    const im = new THREE.InstancedMesh(geo, mat, spots.length); spots.forEach(([x, y, rot], i) => { dm.position.set(x, y, z); dm.rotation.set(0, 0, rot + orient); dm.scale.set(...sc); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; G.add(im); return im; };
  along(new THREE.SphereGeometry(0.0105, 8, 6), 0.083, 0.078, 0.034);                                        // fila di perle sul listello
  along(new THREE.SphereGeometry(0.014, 8, 6), 0.1505, 0.083, 0.05, 0, [1, 1.7, 0.55]);                      // ovoli sulla gola esterna
  along(new THREE.ConeGeometry(0.0055, 0.034, 5), 0.1505, 0.075, 0.05, Math.PI, [1, 1, 0.5], 0.5);            // dardi tra gli ovoli

  // rosoni agli angoli: cupola con costolature + petali (istanze)
  const rosGeo = new THREE.LatheGeometry([[0, 0.07], [0.02, 0.078], [0.04, 0.07], [0.05, 0.052], [0.062, 0.058], [0.08, 0.046], [0.092, 0.03], [0.1, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const petalGeo = new THREE.SphereGeometry(0.026, 10, 8), outerGeo = new THREE.SphereGeometry(0.02, 8, 6);
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]], petals = new THREE.InstancedMesh(petalGeo, mat, 4 * 14), outers = new THREE.InstancedMesh(outerGeo, mat, 4 * 12); let pi = 0, oi = 0;
  corners.forEach(([sx, sy]) => { const cx = sx * (hx + 0.087), cy = sy * (hy + 0.087), r = new THREE.Mesh(rosGeo, mat); r.rotation.x = Math.PI / 2; r.position.set(cx, cy, 0.07); G.add(r);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; dm.position.set(cx + Math.cos(a) * 0.078, cy + Math.sin(a) * 0.078, 0.116); dm.rotation.set(0, 0, a); dm.scale.set(1.6, 0.8, 0.55); dm.updateMatrix(); petals.setMatrixAt(pi++, dm.matrix); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + 0.26; dm.position.set(cx + Math.cos(a) * 0.112, cy + Math.sin(a) * 0.112, 0.09); dm.rotation.set(0, 0, a); dm.scale.set(1.3, 0.8, 0.5); dm.updateMatrix(); outers.setMatrixAt(oi++, dm.matrix); } });
  petals.frustumCulled = outers.frustumCulled = false; G.add(petals, outers);

  // cimasa: cartiglio con volute laterali, bottone centrale e fiamma
  const sh = new THREE.Shape(); sh.moveTo(-0.46, 0); sh.bezierCurveTo(-0.46, 0.1, -0.3, 0.1, -0.26, 0.17); sh.bezierCurveTo(-0.2, 0.27, -0.1, 0.22, -0.06, 0.3); sh.bezierCurveTo(-0.03, 0.38, 0.03, 0.38, 0.06, 0.3); sh.bezierCurveTo(0.1, 0.22, 0.2, 0.27, 0.26, 0.17); sh.bezierCurveTo(0.3, 0.1, 0.46, 0.1, 0.46, 0); sh.lineTo(-0.46, 0);
  const crest = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.016, bevelSegments: 3, curveSegments: 20 }), mat); crest.position.set(0, hy + 0.17, 0.03); G.add(crest);
  for (const sx of [-1, 1]) { const pts = []; for (let k = 0; k <= 26; k++) { const t = k / 26, a = t * 4.6 + 0.3, r = 0.115 * (1 - t * 0.82); pts.push(new THREE.Vector3(sx * (0.36 + Math.cos(a) * r * 0.9 * 0 + Math.cos(a + (sx > 0 ? 0 : Math.PI)) * r), 0.1 + Math.sin(a) * r, 0.0)); }
    const v = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 6, false), mat); v.position.set(0, hy + 0.17, 0.095); G.add(v); }
  const knob = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), mat); knob.position.set(0, hy + 0.35, 0.06); G.add(knob);
  const flame = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.026, 0.01], [0.03, 0.05], [0.018, 0.1], [0.006, 0.16], [0, 0.19]].map(([r, y]) => new THREE.Vector2(r, y)), 12), mat); flame.position.set(0, hy + 0.395, 0.06); G.add(flame);
  return G;
}
