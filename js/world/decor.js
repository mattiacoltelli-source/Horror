// Arredo modulare delle stanze (tubi, cavi, recinzioni, tombini, grondaie). Tutto statico e fuso in pochi mesh.
import { kitMesh, runZ } from './props.js';
import * as THREE from 'three';
import { bloodDecals, stainDecals, burnDecals, patchDecals } from './blood.js';
import { aged } from './aged.js';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
const P2 = Math.PI / 2;
const add = async (group, kit, pl) => { try { const m = await kitMesh(kit, pl); if (m) { m.traverse((o) => { o.userData.decor = true; if (globalThis.__lowQ) o.visible = false; }); group.add(m); } } catch (e) { console.warn('decor', kit, e); } };
const manhole = (x, z, rot = 0) => [{ n: 'water_manhole_cover_frame', p: [x, -0.033, z], r: [0, rot, 0] }, { n: 'water_manhole_cover', p: [x, -0.007, z], r: [0, rot, 0] }]   // incassati: il bordo sporge di ~2 mm;
// pezzo di recinzione lungo l'asse z (altezza 2.37): n pannelli da 0.93 + paletti
const fenceZ = (x, z0, z1) => { const out = []; for (let z = z0 - 0.955; z > z1 - 0.5; z -= 1.91) { out.push({ n: 'Plane020', p: [x, 1.19, z], r: [0, P2, 0] }); out.push({ n: 'post', p: [x, 1.26, z + 0.955], r: [0, 0, 0] }); } out.push({ n: 'post', p: [x, 1.26, z0 - 1.91 * Math.ceil((z0 - z1) / 1.91)], r: [0, 0, 0] }); return out; };
const cableRun = (x, y, z0, z1) => [...runZ('cable_straight_long', 0.61, x, y, z0, Math.max(z1, z0 - 1.9)), { n: 'cable_box_turn', p: [x, y - 0.034, z0 + 0.051], r: [0, 0, 0] }];   // misurato sui vertici reali: lo spuntone della scatola entra di ~1 cm nel capo del cavo, alla stessa altezza

export function decorTunnel(group) {
  stainDecals(group, [{ p: [-1.395, 1.2, -7.5], wall: '+x', w: 2.2, h: 2.6 }, { p: [1.395, 1.4, -19], wall: '-x', w: 2.0, h: 2.8, flip: true }, { p: [-1.395, 1.0, -30], wall: '+x', w: 2.4, h: 2.6, a: 0.8 }, { p: [1.395, 1.2, -39], wall: '-x', w: 2.2, h: 2.6 }]);
  // tracce di mani sul muro sinistro: una scia che porta verso il portone, come se qualcuno si fosse trascinato lungo la parete
  bloodDecals(group, [
    { k: 'C', p: [-1.397, 1.45, -39.2], wall: '+x', h: 0.3, rot: 0.2 }, { k: 'A', p: [-1.397, 1.22, -41.2], wall: '+x', h: 0.31, rot: -0.15, flip: true },
    { k: 'C', p: [-1.397, 1.05, -43.0], wall: '+x', h: 0.29, rot: 0.3 },
    // (tolta la mano a z -28.5: li' c'e' il murale)
    { k: 'X', p: [1.397, 1.55, -34.8], wall: '-x', h: 0.62, rot: 0.2 }, { k: 'X', p: [-1.397, 1.7, -35.0], wall: '+x', h: 0.55, rot: -0.15, flip: true },
  ]);
  burnDecals(group, [{ k: 'wall', p: [-1.393, 1.0, -46.5], wall: '+x', w: 1.7, h: 1.8, a: 0.3 }]);   // un segno di fumo vicino al portone: il fuoco ha toccato anche qui
  patchDecals(group, [{ img: 'assets/tex/pt_gravel.webp', p: [-0.5, 0.012, -16.7], wall: 'floor', w: 1.5, h: 2.3, rot: 0.55 }, { img: 'assets/tex/pt_layers.webp', p: [-0.3, 0.012, -33.5], wall: 'floor', w: 1.8, h: 2.8, rot: -0.15 }]);   // tunnel: cemento grezzo a chiazze sul pavimento
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -1.27, 2.0, 2.4, -48.4));
  add(group, 'pipes', [...runZ('pipe_thin_200cm_metal', 2.0, -1.33, 1.62, 2.4, -48.4).map((p) => ({ ...p, r: [0, P2, 0] }))]);
  add(group, 'cables', [...cableRun(1.38, 2.0, -3, -7), ...cableRun(1.38, 2.0, -28, -31.5)]);
  add(group, 'manhole', [...manhole(-0.15, -14.5), ...manhole(0.3, -45, 0.7)]);
  sideGate(group, 1.4, -11);
}
// VARCO LATERALE CON CANCELLO CHIUSO: sul muro destro il tunnel sembra diramarsi in un'altra direzione, ma e' sbarrato (cancello a rete); dietro, solo buio
function sideGate(group, wx, z) {
  const g = new THREE.Group(); g.position.set(wx - 0.004, 0, z); g.rotation.y = -Math.PI / 2; group.add(g);   // +z locale = verso l'interno del tunnel
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }), stone = new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.9 });
  // il varco sta sotto l'inizio della volta (y < 2.1): piu' in alto il muro si curva e la sagoma finirebbe dentro i mattoni
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.9), black); hole.position.set(0, 0.95, 0); g.add(hole);
  const post = (x, w, h, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), stone); m.position.set(x, y, 0.07); g.add(m); };
  post(-0.82, 0.16, 2.03, 1.015); post(0.82, 0.16, 2.03, 1.015); post(0, 1.8, 0.14, 1.96);
  // un filo di luce lontana nel buio dietro il cancello
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; { const x = c.getContext('2d'), gr = x.createRadialGradient(32, 70, 2, 32, 70, 60); gr.addColorStop(0, 'rgba(255,170,90,.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 128); }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); glow.position.set(0.3, 0.9, 0.004); g.add(glow);
  // il cancello e' una recinzione a rete (come quella del magazzino), appena davanti al buio
  add(group, 'fence', [{ n: 'Plane020', p: [wx - 0.12, 0.925, z], r: [0, P2, 0], s: 0.78 }]);
  // nessuna maniglia ne' chiavistello: e' chiuso, non si capisce nemmeno come aprirlo
}
export function decorHall(group, z0) {
  burnDecals(group, [{ k: 'wall', p: [-5.985, 1.3, z0 - 17.5], wall: '+x', w: 2.4, h: 2.4, a: 0.32 }, { k: 'floor', p: [3.2, 0.012, z0 - 30], w: 1.5, h: 1.3, rot: 0.8, a: 0.4 }]);   // pochi segni di fuoco
  patchDecals(group, [{ img: 'assets/tex/pt_blocks.webp', p: [-5.99, 0.65, z0 - 9], wall: '+x', w: 3.4, h: 1.1, a: 0.85 }, { img: 'assets/tex/pt_blocks.webp', p: [-5.99, 0.65, z0 - 33], wall: '+x', w: 3.4, h: 1.1, a: 0.85 }, { img: 'assets/tex/pt_blocks.webp', p: [5.99, 0.65, z0 - 21], wall: '-x', w: 3.4, h: 1.1, a: 0.85 }, { img: 'assets/tex/pt_blocks.webp', p: [5.99, 0.65, z0 - 27], wall: '-x', w: 3.4, h: 1.1, a: 0.85 }]);   // sala della folla: blocchi di pietra sporca in basso
  stainDecals(group, [{ p: [-5.99, 1.6, z0 - 12], wall: '+x', w: 3.0, h: 3.4 }, { p: [5.99, 1.6, z0 - 20], wall: '-x', w: 3.0, h: 3.4, flip: true }]);
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -5.8, 4.9, z0 - 1, z0 - 38));
  add(group, 'cables', [...cableRun(-5.97, 3.2, z0 - 3, z0 - 6), ...cableRun(5.97, 3.0, z0 - 14, z0 - 17)]);
  add(group, 'manhole', manhole(-2.4, z0 - 9, 0.4).concat(manhole(2.0, z0 - 23, 1.2)));
}
export function decorCellar(group, z0) {
  burnDecals(group, [{ k: 'wall', p: [3.97, 1.1, z0 - 12.5], wall: '-x', w: 1.8, h: 2.0, a: 0.3, flip: true }, { k: 'floor', p: [-1.5, 0.012, z0 - 21], w: 1.2, h: 1.1, rot: 2.0, a: 0.4 }]);   // pochi segni di fuoco
  patchDecals(group, [{ img: 'assets/tex/pt_mold.webp', p: [-3.97, 0.6, z0 - 20.5], wall: '+x', w: 2.8, h: 1.1 }]);   // cantina: intonaco ruvido con mattoni e muffa in basso
  stainDecals(group, [{ p: [-3.99, 1.2, z0 - 5], wall: '+x', w: 2.6, h: 2.8 }, { p: [3.99, 1.3, z0 - 8], wall: '-x', w: 2.4, h: 2.8, flip: true }, { p: [-3.99, 1.1, z0 - 15], wall: '+x', w: 2.6, h: 2.8, a: 0.8 }]);
  entryDoor(group, z0);
  bloodDecals(group, [{ k: 'X', p: [3.995, 1.7, z0 - 14], wall: '-x', h: 0.7, rot: 0.1 }, { k: 'C', p: [3.995, 1.5, z0 - 10], wall: '-x', h: 0.3, rot: 0.15 }]);
  add(group, 'pipes', [...runZ('pipe_200cm_metal', 2.0, 3.85, 3.6, z0 - 1, z0 - 23), ...runZ('pipe_thin_200cm_metal', 2.0, 3.9, 3.2, z0 - 1, z0 - 23).map((p) => ({ ...p, r: [0, P2, 0] }))]);
  add(group, 'fence', fenceZ(3.25, z0 - 14, z0 - 19));
  add(group, 'cables', cableRun(-3.97, 3.0, z0 - 2, z0 - 5));
  add(group, 'manhole', manhole(-1.0, z0 - 5.5, 0.3));
}
export function decorWarehouse(group, z0) {
  stainDecals(group, [{ p: [-5.99, 1.6, z0 - 6], wall: '+x', w: 3.0, h: 3.4 }, { p: [5.99, 1.6, z0 - 12], wall: '-x', w: 3.0, h: 3.4, flip: true }, { p: [5.99, 1.6, z0 - 30], wall: '-x', w: 3.2, h: 3.4, a: 0.8 }]);
  // L'INCENDIO E' PARTITO DA QUI: fuliggine sui muri e sul soffitto, pavimento carbonizzato, scia di benzina verso il cancello
  burnDecals(group, [
    { k: 'wall', p: [-5.985, 2.9, z0 - 15], wall: '+x', w: 4.6, h: 5.8, a: 0.8 }, { k: 'wall', p: [5.985, 2.8, z0 - 17.5], wall: '-x', w: 4.2, h: 5.6, a: 0.75, flip: true }, { k: 'wall', p: [5.985, 2.2, z0 - 7.5], wall: '-x', w: 3.0, h: 4.2, a: 0.5 },
    { k: 'ceil', p: [-0.8, 6.46, z0 - 16.5], w: 9, h: 9, rot: 0.4, a: 0.8 },
    { k: 'floor', p: [-1.4, 0.012, z0 - 15.5], w: 4.4, h: 3.8, rot: 0.3, a: 0.9 }, { k: 'floor', p: [2.7, 0.012, z0 - 19.4], w: 2.8, h: 2.4, rot: 2.1, a: 0.85 }, { k: 'floor', p: [-3.5, 0.012, z0 - 22.3], w: 1.9, h: 1.7, rot: 4.0, a: 0.8 },
    { k: 'wall', p: [-1.1, 2.0, z0 - 0.03], wall: '-z', w: 4.2, h: 4.4, a: 0.55 }, { k: 'wall', p: [2.6, 1.8, z0 - 0.03], wall: '-z', w: 3.0, h: 3.6, a: 0.45, flip: true },   // attorno alla porta d'ingresso: poche bruciature
    { k: 'trail', p: [0.7, 0.014, z0 - 24.5], w: 1.0, h: 10.5, rot: 0.05, a: 0.85 },
  ]);
  const entry = entryDoor(group, z0);
  patchDecals(group, [{ img: 'assets/tex/pt_rough.webp', p: [5.98, 1.5, z0 - 30.5], wall: '-x', w: 2.4, h: 1.8 }]);   // magazzino: muro ruvido e muffa
  add(group, 'ind', runZ('modular_industrial_pipes_01_pipe02', 1.95, -2.4, 6.2, z0 - 1, z0 - 34));
  add(group, 'fence', [...fenceZ(-4.05, z0 - 3, z0 - 8), ...fenceZ(4.05, z0 - 28.5, z0 - 34)]);
  add(group, 'gutter', runZ('modular_metal_gutter', 1.51, 5.55, 5.4, z0 - 1, z0 - 14).map((p) => ({ ...p, r: [0, P2, 0] })));
  add(group, 'manhole', manhole(0.2, z0 - 10, 0.5).concat(manhole(-1.0, z0 - 30.5, 0)));
  add(group, 'cables', [...cableRun(5.97, 3.1, z0 - 6, z0 - 9), ...cableRun(-5.97, 3.1, z0 - 20, z0 - 23)]);
  return entry;
}
export function decorTower(group, z0) {
  const entry = entryDoor(group, z0);
  add(group, 'ind', [...runZ('modular_industrial_pipes_01_pipe02', 1.95, -6.8, 6.5, z0 - 1, z0 - 16), ...runZ('modular_industrial_pipes_01_pipe02', 1.95, 6.8, 7.2, z0 - 1, z0 - 16)]);
  add(group, 'pipes', [{ n: 'pipe_valve_large_metal', p: [-6.7, 5.5, z0 - 8], r: [0, 0, 0] }]);
  add(group, 'cables', cableRun(6.97, 3.0, z0 - 3, z0 - 6));
  add(group, 'manhole', manhole(2.2, z0 - 5, 0.9));
  return entry;
}

// porta chiusa alle spalle: la stanza da cui sei arrivato non si riapre (muro d'ingresso a z0, la stanza va verso -z)
export function entryDoor(group, z0) {
  const holder = new THREE.Group(); group.add(holder);   // si può nascondere (es. al suo posto un cancello)
  new GLTFLoader().load('assets/models/door.glb', (g) => {
    const m = g.scene; aged(m, 0.5, 0.6); m.getObjectByName('large_castle_door_left')?.rotation.set(0, 0, 0); m.getObjectByName('large_castle_door_right')?.rotation.set(0, 0, 0);
    const d = new THREE.Group(); d.position.set(0, 0, z0 - 0.14); d.rotation.y = Math.PI; d.add(m); holder.add(d);
    const gt = new GLTFLoader().load('assets/models/gate.glb', (gg) => { const o = gg.scene; o.scale.setScalar(2.2); o.position.set(-0.08, 1.02, 0.13); d.add(o); });
  });
  return holder;
}
