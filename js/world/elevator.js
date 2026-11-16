// Ascensore fuori servizio: nicchia statica, porte/grate raccolte ai lati.
// Nessuna luce, animazione o interazione: l'interno emerge alla luce della torcia.
import * as THREE from 'three';
import { Builder, gray } from './tunnel.js';
import { writingDecals } from './blood.js';

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
  // Pulsante di chiamata spento sullo stipite; la pulsantiera e' sul fondo.
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
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: 0x393025, roughness: 0.85 }));
  bulb.position.set(0, 2.075, -0.95); bulb.scale.y = 1.35; G.add(bulb);

  // Atlante ricreato dal riferimento: cartello nella meta' superiore,
  // pulsantiera nel quadrante in basso a sinistra. Un'unica texture e mesh.
  const map = new THREE.TextureLoader().load('assets/tex/elevator_details.webp');
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const details = new THREE.MeshStandardMaterial({ map, color: 0xc7bda9, roughness: 0.95, metalness: 0.12, vertexColors: true });
  const uv = (u0, v0, u1, v1) => [[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
  const face = (x, y, z, w, h, coords) => {
    B.quad('details', [[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]], coords, [gray(1),gray(1),gray(1),gray(1)], [0,0,1]);
  };
  // Lamiera spessa dietro il cartello: niente testo procedurale sovrapposto.
  box('trim', -0.18, 1.66, -1.75, 1.02, 0.51, 0.025);
  face(-0.18, 1.66, -1.736, 1.02, 0.51, uv(0.002, 0.502, 0.998, 0.998));
  const px = -0.04, py = 1.14, pw = 0.43, pz = -1.72;
  box('trim', px, py, pz - 0.02, pw, pw, 0.035);
  face(px, py, pz, pw, pw, uv(0.002, 0.002, 0.498, 0.498));
  // Tasti tondi in rilievo, campionati dalla stessa immagine: restano spenti.
  const button = (u, v, radius) => {
    const x = px + (u - 0.5) * pw, y = py + (0.5 - v) * pw;
    const sample = (dx, dy) => [0.002 + 0.496 * (u + dx / pw), 0.002 + 0.496 * (1 - v + dy / pw)];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, b = (i + 1) * Math.PI / 6;
      const ax = Math.cos(a) * radius, ay = Math.sin(a) * radius, bx = Math.cos(b) * radius, by = Math.sin(b) * radius;
      B.quad('trim', [[x+ax,y+ay,pz],[x+bx,y+by,pz],[x+bx,y+by,pz+0.018],[x+ax,y+ay,pz+0.018]], [[0,0],[0.02,0],[0.02,0.02],[0,0.02]], [gray(0.6),gray(0.6),gray(0.8),gray(0.8)], [Math.cos((a+b)/2),Math.sin((a+b)/2),0]);
      B.quad('details', [[x,y,pz+0.019],[x+ax,y+ay,pz+0.019],[x+bx,y+by,pz+0.019],[x,y,pz+0.019]], [sample(0,0),sample(ax,ay),sample(bx,by),sample(0,0)], [gray(1),gray(1),gray(1),gray(1)], [0,0,1]);
    }
  };
  button(0.257, 0.25, 0.035);
  for (const v of [0.244, 0.448, 0.67]) button(0.78, v, 0.035);
  const geometry = B.build({ iron, trim, floor, dark, details });
  geometry.name = 'ascensore-geometria'; G.add(geometry);
  // Simbolo fornito dall'autore, senza fondo bianco: dipinto sulla lamiera
  // interna sinistra, dietro il corrimano, visibile affacciandosi dal corridoio.
  const mural = writingDecals(G, [{ img: 'assets/tex/elevator_mural.webp', aspect: 768 / 895, p: [-0.995, 1.29, -1.0], wall: '+x', w: 1.4, a: 0.96, plain: true }])[0];
  mural.name = 'murale-ascensore';
  // Sangue vecchio di mesi: bruno molto scuro e opaco anche sotto la torcia.
  mural.material.color.setRGB(0.12, 0.075, 0.055);
  mural.material.roughness = 1;
  mural.material.envMapIntensity = 0;
  return G;
}
