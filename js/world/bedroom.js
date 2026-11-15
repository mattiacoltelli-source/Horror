// MICRO CAMERA BRUCIATA (la camera della sorella): una nicchia dietro un arco sempre aperto sul muro destro della torre. Ci si affaccia (non si entra).
// Pareti con carta da parati floreale bruciata, pavimento d'assi annerite, letto, comodino con la lampada che sfarfalla, giocattoli, sedia a rotelle, segni d'altezza a matita sullo stipite.
import * as THREE from 'three';
import { buildRoom } from './rooms.js';
import { writingDecals } from './blood.js';
import { addExtras } from './extra.js';

const loadTex = (url, rx = 1, ry = 1, flip = false) => { const t = new THREE.TextureLoader().load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(flip ? -rx : rx, ry); if (flip) t.offset.x = 1; return t; };

export function createBedroom({ group, mats, zc, x0 = 7.0, w = 3.4, l = 3.4, h = 3.2 }) {
  const K = { group: new THREE.Group(), t: 0 }; group.add(K.group); const G = K.group;
  const xr = x0 + w, z0 = zc + l / 2, z1 = zc - l / 2;
  const room = buildRoom(mats, { cx: x0 + w / 2, z0, w, l, h, wall: 'stone', floor: 'floorA', ceil: 'stone', dark: 0.5, seed: 77, sideDoor: { side: -1, z: zc, w: 2.0, h: 3.1 } });
  G.add(room.group);

  // cornice ad arco attorno al varco (spalletta di pietra)
  const sh = new THREE.Shape(); sh.moveTo(-1.3, 0); sh.lineTo(1.3, 0); sh.lineTo(1.3, 3.3); sh.lineTo(-1.3, 3.3); sh.lineTo(-1.3, 0);
  const hole = new THREE.Path(); hole.moveTo(-1.0, 0); hole.lineTo(-1.0, 2.1); hole.absarc(0, 2.1, 1.0, Math.PI, 0, true); hole.lineTo(1.0, 0); hole.lineTo(-1.0, 0); sh.holes.push(hole);
  const stoneM = mats.stone.clone(); stoneM.vertexColors = false; stoneM.color.setRGB(0.2, 0.185, 0.175);
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 18 }), stoneM); arch.rotation.y = -Math.PI / 2; arch.position.set(x0, 0, zc); G.add(arch);

  // carta da parati bruciata sui tre muri (un pannello per muro, specchiato sul secondo per non ripetersi) e pavimento d'assi annerite
  const paper = (flip) => new THREE.MeshStandardMaterial({ map: loadTex('assets/tex/wallpaper_burnt.jpg', 1, 1, flip), color: new THREE.Color(0.5, 0.46, 0.42), roughness: 1 });
  const wall = (ww, x, z, ry, flip) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), paper(flip)); m.position.set(x, h / 2, z); m.rotation.y = ry; G.add(m); };
  wall(l, xr - 0.006, zc, -Math.PI / 2, false);          // fondo (guarda verso -x)
  wall(w, x0 + w / 2, z0 - 0.006, Math.PI, true);        // lato +z (guarda verso -z)
  wall(w, x0 + w / 2, z1 + 0.006, 0, false);             // lato -z (guarda verso +z)
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: loadTex('assets/tex/floor_planks.jpg', 2, 2), color: new THREE.Color(0.26, 0.22, 0.2), roughness: 1 })); fl.rotation.x = -Math.PI / 2; fl.position.set(x0 + w / 2, 0.004, zc); G.add(fl);

  // arredo: letto con la testata contro il muro di fondo, comodino, sedia a rotelle vuota, giocattoli a terra
  addExtras(G, [['hs_bed', 0.8, xr - 1.2, 0, zc + 0.6, Math.PI / 2, 0.2], ['cabinet', 0.55, xr - 0.28, 0, zc - 0.4, -Math.PI / 2, 0.28], ['hw_wheel_chair', 0.95, x0 + 0.85, 0, zc - 1.0, 0.7, 0.5],
    ['x_lion', 0.3, x0 + 1.5, 0, zc - 0.2, 0.9, 0.5], ['x_gnome', 0.34, x0 + 1.9, 0, zc + 1.1, -0.4, 0.4]]);

  // lampada da comodino: paralume acceso e luce calda a raggio corto (le luci non sono bloccate dai muri: deve morire dentro la stanza)
  const lamp = new THREE.Group(); lamp.position.set(xr - 0.28, 0.55, zc - 0.4); G.add(lamp);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.8 })); base.position.y = 0.06; lamp.add(base);
  K.shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.13, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb867, side: THREE.DoubleSide })); K.shade.position.y = 0.19; lamp.add(K.shade);
  K.light = new THREE.PointLight(0xffa850, 1.7, 2.6, 1.4); K.light.position.set(xr - 0.55, 0.95, zc - 0.3); G.add(K.light);

  // segni d'altezza a matita sulla spalletta sinistra: si fermano all'improvviso
  { const c = document.createElement('canvas'); c.width = 128; c.height = 340; const x = c.getContext('2d'); x.strokeStyle = 'rgba(70,64,58,0.85)'; x.fillStyle = 'rgba(70,64,58,0.85)'; x.font = 'italic 16px cursive'; x.lineWidth = 2;
    const marks = [[40, '3 anni'], [62, '4'], [80, '5'], [98, '6'], [114, '7']];   // altezze in cm: l'ultima è a 114
    for (const [cm, t] of marks) { const y = 340 - 20 - cm * 2.4; x.beginPath(); x.moveTo(8, y); x.lineTo(54 + (cm % 3) * 4, y); x.stroke(); x.fillText(t, 62, y - 3); }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.06), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0.8 })); mk.rotation.y = Math.PI / 2; mk.position.set(x0 + 0.006, 0.62, zc + 1.36); G.add(mk); }

  // quattro disegni di bambino (fogli ingialliti e bruciacchiati) sui due muri di lato
  const kid = (n, asp, x, y, z, wall, ww, rot) => ({ img: 'assets/tex/pic_kid_' + n + '.webp', aspect: asp, p: [x, y, z], wall, w: ww, rot, a: 1, plain: true });
  writingDecals(G, [kid(1, 1.709, x0 + 0.85, 1.62, z0 - 0.012, '-z', 0.62, -0.04), kid(2, 1.758, x0 + 2.45, 1.32, z0 - 0.012, '-z', 0.66, 0.03),
    kid(3, 1.707, x0 + 1.0, 1.45, z1 + 0.012, '+z', 0.64, 0.035), kid(4, 1.731, x0 + 2.5, 1.7, z1 + 0.012, '+z', 0.62, -0.03)]);

  K.update = (dt) => { K.t += dt; const f = 1 + Math.sin(K.t * 9.7) * 0.07 + Math.sin(K.t * 23.1) * 0.05 + (Math.sin(K.t * 2.3) > 0.985 ? -0.45 : 0); K.light.intensity = 1.7 * f; K.shade.material.color.setRGB(1, 0.72 * Math.min(1, f), 0.4 * Math.min(1, f)); };
  return K;
}
