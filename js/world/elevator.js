// Ascensore fuori servizio: nicchia statica, porte/grate raccolte ai lati.
// Nessuna luce, animazione o interazione: l'interno emerge alla luce della torcia.
import * as THREE from 'three';
import { Builder, gray } from './tunnel.js';

export function createElevator({ group, mats, x, z }) {
  const G = new THREE.Group(); G.name = 'ascensore-fuori-servizio';
  G.position.set(x, 0, z); G.rotation.y = -Math.PI / 2; group.add(G);
  // Coordinate locali: ingresso a z=0, cabina dietro (z negativo).
  // Pannelli, telaio e grate uniti per materiale: poche draw call anche su telefono.
  const B = new Builder();
  const box = (key, x, y, z, w, h, d, angle = 0, shade = 1) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const point = ([a, b, e]) => [x + a * c - b * s, y + a * s + b * c, z + e];
    const normal = ([a, b, e]) => [a * c - b * s, a * s + b * c, e];
    const X = w / 2, Y = h / 2, Z = d / 2;
    for (const [p, n, u, v] of [
      [[[-X,-Y,Z],[X,-Y,Z],[X,Y,Z],[-X,Y,Z]], [0,0,1], w,h],
      [[[X,-Y,-Z],[-X,-Y,-Z],[-X,Y,-Z],[X,Y,-Z]], [0,0,-1], w,h],
      [[[-X,-Y,-Z],[-X,-Y,Z],[-X,Y,Z],[-X,Y,-Z]], [-1,0,0], d,h],
      [[[X,-Y,Z],[X,-Y,-Z],[X,Y,-Z],[X,Y,Z]], [1,0,0], d,h],
      [[[-X,Y,Z],[X,Y,Z],[X,Y,-Z],[-X,Y,-Z]], [0,1,0], w,d],
      [[[-X,-Y,-Z],[X,-Y,-Z],[X,-Y,Z],[-X,-Y,Z]], [0,-1,0], w,d],
    ]) {
      const pts = p.map(point), colors = pts.map((q) => gray(shade * (0.64 + 0.36 * Math.min(1, Math.max(0, q[1]) / 1.4))));
      B.quad(key, pts, [[0,0],[u,0],[u,v],[0,v]], colors, normal(n));
    }
  };
  const bar = (ax, ay, bx, by, z, width = 0.018) => {
    const dx = bx - ax, dy = by - ay;
    box('trim', (ax + bx) / 2, (ay + by) / 2, z, width, Math.hypot(dx, dy), 0.018, -Math.atan2(dx, dy));
  };
  // Cabina chiusa su tre lati, poco profonda; giunti e nervature interrompono la lamiera.
  box('iron', 0, 1.12, -1.85, 2.12, 2.24, 0.08);
  for (const side of [-1, 1]) {
    box('iron', side * 1.04, 1.12, -1.04, 0.08, 2.24, 1.7);
    box('trim', side * 0.98, 0.87, -1.04, 0.045, 0.055, 1.45); // corrimano
    for (const zz of [-0.5, -1.16, -1.76]) box('trim', side * 0.99, 1.13, zz, 0.025, 2.18, 0.025);
  }
  box('iron', 0, 2.25, -0.98, 2.16, 0.08, 1.85);
  box('floor', 0, -0.025, -0.94, 2.16, 0.05, 1.94);
  box('trim', 0, 0.87, -1.78, 1.84, 0.055, 0.045);
  for (const xx of [-0.65, 0, 0.65]) box('trim', xx, 1.12, -1.8, 0.022, 2.2, 0.025);
  // Stipiti profondi coprono lo spessore delle piastrelle del corridoio.
  for (const side of [-1, 1]) box('iron', side * 1.105, 1.13, -0.13, 0.18, 2.26, 0.42);
  box('iron', 0, 2.27, -0.13, 2.39, 0.16, 0.42);
  box('trim', 0, 0.025, -0.1, 2.2, 0.05, 0.39);
  for (const zz of [-0.03, -0.12, -0.21]) box('dark', 0, 0.052, zz, 2.03, 0.006, 0.012); // guide a terra
  // Due grate a pantografo completamente aperte, raccolte contro gli stipiti.
  for (const side of [-1, 1]) {
    const edge = side * 0.91;
    for (let i = 0; i < 4; i++) box('trim', edge + (i - 1.5) * 0.046, 1.1, -0.19, 0.012, 2.12, 0.025);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const a = edge - 0.075 + i * 0.045, b = a + 0.055, y = 0.1 + j * 0.67;
      bar(a, y, b, y + 0.67, -0.16); bar(b, y, a, y + 0.67, -0.14);
    }
    box('trim', edge - side * 0.105, 1.12, -0.13, 0.025, 2.12, 0.035);
  }
  // Pulsantiera interna spenta e pulsante di chiamata sullo stipite.
  box('trim', 0.97, 1.19, -0.64, 0.04, 0.38, 0.19);
  for (let i = 0; i < 3; i++) box('dark', 0.944, 1.31 - i * 0.105, -0.64, 0.015, 0.06, 0.06);
  box('trim', 1.105, 1.16, 0.088, 0.105, 0.22, 0.025);
  box('dark', 1.105, 1.18, 0.107, 0.045, 0.045, 0.016);
  // Lampada a gabbia bruciata; nessuna luce aggiunta al pool della stanza.
  box('trim', 0, 2.18, -0.95, 0.23, 0.04, 0.23);
  for (const side of [-1, 1]) {
    for (const dz of [-0.085, 0.085]) box('trim', side * 0.085, 2.06, -0.95 + dz, 0.012, 0.2, 0.012);
    box('trim', side * 0.085, 1.96, -0.95, 0.012, 0.012, 0.18);
    box('trim', 0, 1.96, -0.95 + side * 0.085, 0.18, 0.012, 0.012);
  }
  // Cavo allentato e griglia di aerazione sul fondo: dettagli tutti statici.
  bar(-0.74, 2.18, -0.61, 1.93, -1.76, 0.014);
  bar(-0.61, 1.93, -0.64, 1.65, -1.76, 0.014);
  box('dark', 0.54, 1.84, -1.8, 0.4, 0.23, 0.025);
  for (let i = 0; i < 5; i++) box('trim', 0.38 + i * 0.08, 1.84, -1.78, 0.013, 0.23, 0.018);

  const iron = mats.rust.clone(); iron.color.setHex(0x746356); iron.metalness = 0.42; iron.roughness = 0.96;
  const trim = mats.rust.clone(); trim.color.setHex(0x494038); trim.metalness = 0.55; trim.roughness = 0.86;
  const floor = mats.rust.clone(); floor.color.setHex(0x484139); floor.metalness = 0.3; floor.roughness = 1;
  const dark = new THREE.MeshStandardMaterial({ color: 0x100e0b, roughness: 1, vertexColors: true });
  G.add(B.build({ iron, trim, floor, dark }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: 0x393025, roughness: 0.85 }));
  bulb.position.set(0, 2.075, -0.95); bulb.scale.y = 1.35; G.add(bulb);

  // Targa invecchiata: comunica che la nicchia e' solo scenografia.
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#a49a7d'; ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#39332a'; ctx.lineWidth = 7; ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = '#30251e'; ctx.textAlign = 'center'; ctx.font = 'bold 56px sans-serif';
  ctx.fillText('FUORI', 256, 103); ctx.fillText('SERVIZIO', 256, 172);
  let seed = 83;
  for (let i = 0; i < 550; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed % 512;
    seed = (seed * 1664525 + 1013904223) >>> 0; const y = seed % 256;
    ctx.fillStyle = i % 3 ? '#5c463038' : '#24201b52'; ctx.fillRect(x, y, 2 + i % 9, 1 + i % 5);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.63, 0.315), new THREE.MeshStandardMaterial({ map, roughness: 1 }));
  sign.position.set(-0.1, 1.45, -1.76); sign.rotation.z = -0.055; G.add(sign);
  return G;
}
