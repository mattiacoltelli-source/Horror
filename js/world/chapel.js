// MICRO CAPPELLA SCONSACRATA: una nicchia dietro un arco sempre aperto sul muro destro della cantina. Ci si affaccia (non si entra).
// Tre murales sui tre muri (il quarto e' l'arco), altare di pietra, sedie ribaltate, candele, un rito: nome e data di oggi a sangue sull'altare.
import * as THREE from 'three';
import { buildRoom } from './rooms.js';
import { writingDecals, burnDecals, patchDecals } from './blood.js';
import { bloodText } from './bloodfont.js';
import { addExtras } from './extra.js';

export function createChapel({ group, mats, zc, P, x0 = 4.0, w = 3.2, l = 3.0, h = 3.4 }) {
  const K = { group: new THREE.Group(), t: 0 }; group.add(K.group);
  const G = K.group, xr = x0 + w, z0 = zc + l / 2, z1 = zc - l / 2;
  const room = buildRoom(mats, { cx: x0 + w / 2, z0, w, l, h, wall: 'stone', floor: 'floorA', ceil: 'stone', dark: 0.7, seed: 61, sideDoor: { side: -1, z: zc, w: 2.0, h: 3.1 } });
  G.add(room.group);

  // arco: cornice di pietra attorno al varco (fa da spalletta e riempie gli angoli sopra la curva)
  const sh = new THREE.Shape(); sh.moveTo(-1.3, 0); sh.lineTo(1.3, 0); sh.lineTo(1.3, 3.3); sh.lineTo(-1.3, 3.3); sh.lineTo(-1.3, 0);
  const hole = new THREE.Path(); hole.moveTo(-1.0, 0); hole.lineTo(-1.0, 2.1); hole.absarc(0, 2.1, 1.0, Math.PI, 0, true); hole.lineTo(1.0, 0); hole.lineTo(-1.0, 0); sh.holes.push(hole);
  const stoneM = mats.stone.clone(); stoneM.vertexColors = false; stoneM.color.setRGB(0.2, 0.185, 0.175);   // pietra con la texture del gioco, scurita
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 18 }), stoneM); arch.rotation.y = -Math.PI / 2; arch.position.set(x0, 0, zc); G.add(arch);

  // altare di pietra contro il muro di fondo, sopra due gradini: arenaria a blocchi consumata, una texture per mesh (la ripetizione segue le misure)
  const altMat = (rx, ry) => new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.TextureLoader().load('assets/tex/alt_stone.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })(), color: new THREE.Color(0.5, 0.47, 0.45), roughness: 1 });
  const box = (bw, bh, bd, x, y, z, m) => { m ??= altMat(bw / 0.9, bh / 0.9); const o = new THREE.Mesh(new THREE.BoxGeometry(bd, bh, bw), m); o.position.set(x, y, z); G.add(o); return o; };   // bw = lungo z, bd = lungo x
  const aX = xr - 0.5;
  box(2.5, 0.14, 1.3, aX - 0.15, 0.07, zc); box(2.1, 0.12, 1.05, aX - 0.1, 0.2, zc);
  box(1.7, 0.95, 0.8, aX, 0.74, zc, undefined); box(1.9, 0.1, 0.92, aX - 0.02, 1.27, zc);   // blocco e piano (mensa)

  // muffa scura che sale dal basso sul davanti dell'altare e sui gradini; polvere chiara sul piano
  patchDecals(G, [{ img: 'assets/tex/pt_altar_mold.webp', p: [aX - 0.406, 0.42, zc - 0.1], wall: '-x', w: 1.6, h: 0.8 }, { img: 'assets/tex/pt_altar_mold.webp', p: [aX - 0.806, 0.075, zc + 0.2], wall: '-x', w: 1.9, h: 0.14 }, { img: 'assets/tex/pt_altar_mold.webp', p: [aX - 0.631, 0.205, zc - 0.3], wall: '-x', w: 1.5, h: 0.1 }]);
  { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); let sd = 9; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) { const gx = r() * 256, gy = r() * 128, rad = 14 + r() * 30, g = x.createRadialGradient(gx, gy, 0, gx, gy, rad); g.addColorStop(0, 'rgba(190,180,165,' + (0.1 + r() * 0.12) + ')'); g.addColorStop(1, 'rgba(190,180,165,0)'); x.fillStyle = g; x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(205,195,180,' + (0.06 + r() * 0.2) + ')'; x.fillRect(r() * 256, r() * 128, 1 + r() * 1.5, 1 + r() * 1.5); }
    const dt = new THREE.CanvasTexture(c); dt.colorSpace = THREE.SRGBColorSpace;
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.9), new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, fog: true })); dust.rotation.x = -Math.PI / 2; dust.position.set(aX - 0.02, 1.322, zc); G.add(dust); }

  // candele sul piano e luce calda che sfarfalla
  const wax = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.8 }), flame = new THREE.MeshBasicMaterial({ color: 0xffb35c });
  const candle = (x, y, z, ch) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, ch, 8), wax); c.position.set(x, y + ch / 2, z); G.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), flame); f.position.set(x, y + ch + 0.025, z); G.add(f); };
  for (const [dx, dz, ch] of [[-0.25, -0.78, 0.26], [-0.1, 0.8, 0.2], [0.05, -0.5, 0.14], [-0.2, 0.52, 0.3], [0.0, 0.25, 0.1], [-0.3, -0.2, 0.18]]) candle(aX + dx, 1.32, zc + dz, ch);   // sul piano
  for (const [dx, dz, ch] of [[-0.55, -1.0, 0.2], [-0.5, 0.95, 0.14], [-0.6, -0.4, 0.24], [-0.52, 0.45, 0.12]]) candle(aX + dx, 0.26, zc + dz, ch);   // sul secondo gradino
  for (const [x, z, ch] of [[x0 + 1.55, zc - 0.55, 0.3], [x0 + 1.7, zc + 0.5, 0.22], [x0 + 0.95, zc - 1.25, 0.16], [x0 + 0.9, zc + 1.2, 0.26]]) candle(x, 0, z, ch);   // sul pavimento, davanti all'altare
  K.light = new THREE.PointLight(0xff8a3a, 2.2, 3.4, 1.3); K.light.position.set(aX - 0.8, 2.1, zc);   // raggio corto: le luci non sono bloccate dai muri, devono morire dentro la cappella G.add(K.light);
  K.light2 = new THREE.PointLight(0xff7a30, 1.3, 2.6, 1.4); K.light2.position.set(x0 + 2.0, 0.8, zc); G.add(K.light2);   // candele sul pavimento: schiariscono i muri laterali

  // il rito: nome e data di OGGI (il giorno in cui si gioca) a sangue sul davanti dell'altare. Nessuna foto, in nessuna versione.
  // la minaccia di suor Agnese, a sangue sul davanti dell'altare (uguale in tutte le versioni, senza nome): data e ORA del giocatore (quelle del suo telefono) e «tra sette minuti».
  // La scritta si rifà quando ci si avvicina, quindi l'ora è quella dell'arrivo.
  let stampMesh = null;
  K.stamp = () => {
    if (stampMesh) { G.remove(stampMesh); stampMesh.geometry.dispose(); stampMesh.material.dispose(); stampMesh = null; }
    const nw = new Date(), p2 = (n) => String(n).padStart(2, '0'), T = 'È IL ' + nw.getDate() + '/' + (nw.getMonth() + 1) + '/' + String(nw.getFullYear()).slice(2) + '.\nSONO LE ' + p2(nw.getHours()) + ':' + p2(nw.getMinutes()) + '.\nTRA SETTE MINUTI\nTI PORTO VIA.\n- SUOR AGNESE', ta = bloodText(T).aspect, ww = Math.min(1.62, 0.9 * ta);
    stampMesh = writingDecals(G, [{ text: T, aspect: ta, p: [aX - 0.405, 0.615, zc], wall: '-x', w: ww, dry: true }])[0];
  };
  K.stamp();
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

  K.update = (dt) => { K.t += dt; K.light.intensity = 2.1 + Math.sin(K.t * 11.3) * 0.14 + Math.sin(K.t * 27.1) * 0.08 + (Math.sin(K.t * 3.1) > 0.97 ? -0.3 : 0); K.light2.intensity = 1.25 + Math.sin(K.t * 9.1 + 1) * 0.12 + Math.sin(K.t * 23.3) * 0.07; };
  return K;
}
