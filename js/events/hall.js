// Sala oltre il portone: pavimento ampio, panorama scurito come sfondo e una folla di sagome nere ferme in file,
// tutte rivolte verso il giocatore. Le sagome sono pose "cotte" (nessuno scheletro): materiale nero, 1 draw call l'una.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END, DOOR } from '../world/tunnel.js';
import { buildRoom } from '../world/rooms.js';
import { decorHall } from '../world/decor.js';

const TYPES = [
  ['whisperer', 2.5], ['pirate', 1.95], ['nurse', 1.72], ['occ', 1.98], ['diver', 1.85], ['bell', 2.6], ['varka', 1.92], ['root', 3.6],
];
// file → [x, riga z, indice tipo] (riga 0 = più vicina). Disposizione fissa: stesso risultato a ogni partita.
const LAYOUT = [
  [-4.2, 0, 3], [-1.4, 0, 1], [1.9, 0, 2], [4.6, 0, 6],
  [-7.0, -3.4, 1], [-3.6, -3.2, 4], [0.2, -3.6, 0], [3.4, -3.3, 5], [6.8, -3.5, 3],
  [-8.6, -7, 2], [-5.4, -6.8, 6], [-2.0, -7.2, 7], [2.2, -6.9, 4], [5.6, -7.1, 1], [9.0, -6.8, 0],
];

export function createHall({ scene, mats, lights }) {
  const H = { ready: false, glow: 0, target: 0, flick: 0, dist: 26, active: false };
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);

  // la sala: pavimento, soffitto, muri di mattoni, pilastri; il vano della porta combacia con quello del tunnel
  const room = buildRoom(mats, { z0: Z_END - 0.35, w: 12, l: 40, h: 6, wall: 'brick', floor: 'floorB', ceil: 'stone', pillarEvery: 6, door: { w: DOOR.w, h: DOOR.h }, dark: 0.9, seed: 11 });
  grp.add(room.group); H.bounds = room.bounds; decorHall(grp, Z_END - 0.35);
  // grande apertura luminosa in fondo (è il controluce delle sagome)
  const wc = document.createElement('canvas'); wc.width = 256; wc.height = 256; const wg = wc.getContext('2d');
  const rg = wg.createRadialGradient(128, 150, 10, 128, 150, 128); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.55, 'rgba(255,255,255,.8)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  wg.fillStyle = rg; wg.beginPath(); wg.moveTo(20, 256); wg.lineTo(20, 110); wg.arc(128, 110, 108, Math.PI, 0); wg.lineTo(236, 256); wg.closePath(); wg.fill();
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wc), color: new THREE.Color(0.1, 0.13, 0.12), transparent: true, opacity: 0, fog: false, depthWrite: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), glowMat); win.position.set(0, 3.9, Z_END - 40.35 + 0.05); grp.add(win);

  // la folla e il bagliore dietro di essa
  const crowd = new THREE.Group(); grp.add(crowd);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const lit = new THREE.MeshStandardMaterial({ color: 0x1d1c1c, roughness: 0.92, metalness: 0 });   // la folla è illuminata davvero dalle lampade: si vede solo ciò che la luce raggiunge
  const loader = new GLTFLoader();
  Promise.all(TYPES.map(([n, h]) => new Promise((res) => loader.load(`assets/models/m_${n}.glb`, (gl) => {
    const geos = []; gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o) => { if (o.isMesh) { const ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld); geos.push(ge); } });
    const merged = geos[0]; // un solo mesh per modello
    merged.deleteAttribute('uv'); merged.deleteAttribute('color_0'); merged.deleteAttribute('COLOR_0');
    merged.computeBoundingBox(); const b = merged.boundingBox, s = h / (b.max.y - b.min.y);
    merged.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2); merged.scale(s, s, s); merged.computeVertexNormals();
    res(merged);
  }, undefined, () => res(null))))).then((geos) => {
    LAYOUT.forEach(([x, z, t], i) => {
      const ge = geos[t]; if (!ge) return;
      const m = new THREE.Mesh(ge, lit); m.position.set(x * 0.6 + Math.sin(i * 7.3) * 0.3, 0, z + Math.cos(i * 3.1) * 0.4);
      m.rotation.y = Math.sin(i * 5.7) * 0.28; m.matrixAutoUpdate = true; crowd.add(m);
    });
    H.geos = geos; H.ready = true; pending.forEach(([m, i]) => { if (geos[i]) m.geometry = geos[i]; });
  });

  const pending = [];
  H.silhouette = (i) => { const m = new THREE.Mesh(H.geos ? H.geos[i] : new THREE.BufferGeometry(), black); if (!H.geos) pending.push([m, i]); return m; };
  H.group = grp;
  // lampade a gabbia appese sopra la folla: una davanti (illumina da sopra), una dietro (controluce); si muovono con lei
  const lampAnchors = [[-1.9, 3.7, 1.6], [2.9, 3.7, -5.2]], lampMeshes = [];   // lampioni vittoriani (testa a ~3.7 m)
  new GLTFLoader().load('assets/models/slamp1.glb', (g) => lampAnchors.forEach(([x, y, z], i) => {
    const o = g.scene.clone(true); o.position.set(x, 0, z); o.rotation.y = i ? 0.6 : -0.4; o.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material = m.material.clone(); m.material.emissive.set(0xffd9a0); } });
    const emis = []; o.traverse((m) => { if (m.isMesh && m.material.emissive) emis.push(m.material); });
    o.userData.setGlow = (l) => emis.forEach((m) => (m.emissiveIntensity = 3 * l));
    crowd.add(o); lampMeshes[i] = o; const L = lights?.lamps?.[i]; if (L) L.mesh = o;
  }));
  H.setDist = (d) => { H.dist = d; crowd.position.z = Z_END - d; };
  H.enable = () => { H.active = true; grp.visible = true; H.setDist(H.dist); lights?.setLamps(lampAnchors.map(([x, y, z]) => [x, y - 0.3, Z_END - H.dist + z]), 3.6); lights?.lamps?.forEach((L, i) => { if (lampMeshes[i]) L.mesh = lampMeshes[i]; }); lights?.lamp(0, 'off'); lights?.lamp(1, 'off'); };
  H.lightOn = () => { H.target = 1; H.flick = 1.1; lights?.lamp(0, 'flicker', 1.0); lights?.lamp(1, 'flicker', 1.4); setTimeout(() => { if (H.target) { lights?.lamp(0, 'pulse'); lights?.lamp(1, 'pulse'); } }, 1500); };
  H.lightOff = () => { H.target = 0; H.flick = 0; H.glow = 0; lights?.lamp(0, 'off'); lights?.lamp(1, 'off'); };

  H.update = (dt) => {
    if (!H.active) return;
    if (H.flick > 0) H.flick -= dt;
    const k = H.target * (H.flick > 0 ? (Math.random() > 0.5 ? 1 : 0.08) : 1);
    H.glow += (k - H.glow) * Math.min(1, dt * (k > H.glow ? 14 : 30));
    const v = H.glow;
    glowMat.opacity = Math.min(1, v) * 0.38;
    crowd.visible = true;                                     // la visibilità la decide la luce, non un interruttore
    lights?.lamps?.forEach((L, i) => { const a = lampAnchors[i]; if (a) { L.x = a[0]; L.y = a[1] - 0.3; L.z = Z_END - H.dist + a[2]; } });
    scene.fog.density += (0.026 - scene.fog.density) * Math.min(1, dt * 2);   // nebbia più rada: si deve vedere in fondo alla sala
  };
  return H;
}
