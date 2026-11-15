// MICRO CAPPELLA SCONSACRATA: una nicchia dietro un arco sempre aperto sul muro destro della cantina. Ci si affaccia (non si entra).
// Tre murales sui tre muri (il quarto e' l'arco), altare di pietra, sedie ribaltate, candele, un rito: la foto (viso coperto) capovolta sull'altare con nome e data a sangue.
import * as THREE from 'three';
import { buildRoom } from './rooms.js';
import { writingDecals, burnDecals } from './blood.js';
import { bloodText } from './bloodfont.js';
import { addExtras } from './extra.js';

export function createChapel({ group, mats, zc, P, PHOTO, BDAY, x0 = 4.0, w = 3.2, l = 3.0, h = 3.4 }) {
  const K = { group: new THREE.Group(), t: 0 }; group.add(K.group);
  const G = K.group, xr = x0 + w, z0 = zc + l / 2, z1 = zc - l / 2;
  const room = buildRoom(mats, { cx: x0 + w / 2, z0, w, l, h, wall: 'stone', floor: 'floorA', ceil: 'stone', dark: 0.7, seed: 61, sideDoor: { side: -1, z: zc, w: 2.0, h: 3.1 } });
  G.add(room.group);

  // arco: cornice di pietra attorno al varco (fa da spalletta e riempie gli angoli sopra la curva)
  const sh = new THREE.Shape(); sh.moveTo(-1.3, 0); sh.lineTo(1.3, 0); sh.lineTo(1.3, 3.3); sh.lineTo(-1.3, 3.3); sh.lineTo(-1.3, 0);
  const hole = new THREE.Path(); hole.moveTo(-1.0, 0); hole.lineTo(-1.0, 2.1); hole.absarc(0, 2.1, 1.0, Math.PI, 0, true); hole.lineTo(1.0, 0); hole.lineTo(-1.0, 0); sh.holes.push(hole);
  const stoneM = mats.stone.clone(); stoneM.vertexColors = false; stoneM.color.setRGB(0.2, 0.185, 0.175);   // pietra con la texture del gioco, scurita
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 18 }), stoneM); arch.rotation.y = -Math.PI / 2; arch.position.set(x0, 0, zc); G.add(arch);

  // altare di pietra contro il muro di fondo, sopra due gradini
  const box = (bw, bh, bd, x, y, z, m = stoneM) => { const o = new THREE.Mesh(new THREE.BoxGeometry(bd, bh, bw), m); o.position.set(x, y, z); G.add(o); return o; };   // bw = lungo z, bd = lungo x
  const aX = xr - 0.5;
  box(2.5, 0.14, 1.3, aX - 0.15, 0.07, zc); box(2.1, 0.12, 1.05, aX - 0.1, 0.2, zc);
  box(1.7, 0.95, 0.8, aX, 0.74, zc, (() => { const m = stoneM.clone(); m.color.setRGB(0.27, 0.25, 0.23); return m; })()); box(1.9, 0.1, 0.92, aX - 0.02, 1.27, zc);   // blocco e piano (mensa)

  // candele sul piano e luce calda che sfarfalla
  const wax = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.8 }), flame = new THREE.MeshBasicMaterial({ color: 0xffb35c });
  for (const [dx, dz, ch] of [[-0.25, -0.78, 0.26], [-0.1, 0.8, 0.2], [0.05, -0.5, 0.14], [-0.2, 0.52, 0.3]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, ch, 8), wax); c.position.set(aX + dx, 1.32 + ch / 2, zc + dz); G.add(c);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), flame); f.position.set(aX + dx, 1.32 + ch + 0.025, zc + dz); G.add(f);
  }
  K.light = new THREE.PointLight(0xff8a3a, 1.5, 6.5, 1.6); K.light.position.set(aX - 0.9, 2.0, zc); G.add(K.light);

  // il rito: foto capovolta appoggiata al muro sul piano, viso coperto; nome e data a sangue sul davanti dell'altare
  if (PHOTO) {
    const tx = new THREE.TextureLoader().load('assets/tex/' + PHOTO); tx.colorSpace = THREE.SRGBColorSpace;
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.42), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9, color: new THREE.Color(0.7, 0.68, 0.64) }));
    ph.position.set(aX + 0.27, 1.5, zc + 0.02); ph.rotation.set(0, -Math.PI / 2, Math.PI + 0.05); ph.rotation.order = 'YXZ'; G.add(ph);   // capovolta
  }
  if (P) {
    const T = P.name.toUpperCase() + (BDAY ? '\n' + BDAY : ''), ta = bloodText(T).aspect, ww = Math.min(1.45, 0.52 * ta);
    writingDecals(G, [{ text: T, aspect: ta, p: [aX - 0.405, 0.78, zc], wall: '-x', w: ww, dry: true }]);
  }
  burnDecals(G, [{ k: 'floor', p: [aX - 1.1, 0.012, zc], w: 1.7, h: 1.7, rot: 0.6, a: 0.85 }]);

  // sedie ribaltate (sgabelli di legno)
  addExtras(G, [['stool', 0.46, x0 + 1.0, 0, zc - 0.95, 0.5, 1, -1.45], ['stool', 0.46, x0 + 1.5, 0, zc + 0.85, 2.2, 1, -1.5], ['stool', 0.46, x0 + 0.55, 0, zc + 0.35, 4.0, 1, 0]]);

  // i tre murales: muro di fondo (sopra l'altare), muro di sinistra e di destra (il quarto lato e' l'arco)
  const mur = (img, asp, p, wall, ww) => ({ img: 'assets/tex/' + img, aspect: asp, p, wall, w: ww, rot: 0, a: 0.95, plain: true });
  writingDecals(G, [
    mur('pic_chapel_altar.webp', 0.9663, [xr - 0.012, 2.15, zc], '-x', 2.4),      // fondo
    mur('pic_chapel_skel.webp', 1.8286, [x0 + w / 2, 1.95, z1 + 0.012], '+z', 2.85),   // lato -z
    mur('pic_chapel_hell.webp', 0.5392, [x0 + w / 2, 1.75, z0 - 0.012], '-z', 1.4),    // lato +z
  ]);

  K.update = (dt) => { K.t += dt; K.light.intensity = 1.4 + Math.sin(K.t * 11.3) * 0.12 + Math.sin(K.t * 27.1) * 0.07 + (Math.sin(K.t * 3.1) > 0.97 ? -0.3 : 0); };
  return K;
}
