// Sala oltre il portone: pavimento ampio, panorama scurito come sfondo e una folla di sagome nere ferme in file,
// tutte rivolte verso il giocatore. Le sagome sono pose "cotte" (nessuno scheletro): materiale nero, 1 draw call l'una.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END } from '../world/tunnel.js';

const TYPES = [
  ['whisperer', 2.5], ['pirate', 1.95], ['nurse', 1.72], ['occ', 1.98], ['diver', 1.85], ['bell', 2.6], ['varka', 1.92], ['root', 3.6],
];
// file → [x, riga z, indice tipo] (riga 0 = più vicina). Disposizione fissa: stesso risultato a ogni partita.
const LAYOUT = [
  [-4.2, 0, 3], [-1.4, 0, 1], [1.9, 0, 2], [4.6, 0, 6],
  [-7.0, -3.4, 1], [-3.6, -3.2, 4], [0.2, -3.6, 0], [3.4, -3.3, 5], [6.8, -3.5, 3],
  [-8.6, -7, 2], [-5.4, -6.8, 6], [-2.0, -7.2, 7], [2.2, -6.9, 4], [5.6, -7.1, 1], [9.0, -6.8, 0],
];

export function createHall({ scene, mats }) {
  const H = { ready: false, glow: 0, target: 0, flick: 0, dist: 26, active: false };
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);

  // pavimento (usa le mappe del pavimento del tunnel, UV scalate in metri)
  const fm = mats.floorB, W = 70, L = 90;
  const fg = new THREE.PlaneGeometry(W, L); fg.rotateX(-Math.PI / 2);
  const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / 1.6, uv.getY(i) * L / 1.6);
  const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: fm.map, normalMap: fm.normalMap, roughnessMap: fm.roughnessMap, roughness: 1, color: 0x8a857d }));
  floor.position.set(0, -0.01, Z_END - L / 2 + 1); grp.add(floor);

  // panorama scurito (sfondo lontano); si accende e si spegne con la luce della sala
  const bg = new THREE.TextureLoader().load('assets/tex/hall_bg.jpg'); bg.colorSpace = THREE.SRGBColorSpace;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(85, 32, 16), new THREE.MeshBasicMaterial({ map: bg, side: THREE.BackSide, fog: false, color: 0x000000 }));
  sphere.position.set(0, 4, Z_END - 40); sphere.rotation.y = 0.9; grp.add(sphere);

  // la folla e il bagliore dietro di essa
  const crowd = new THREE.Group(); grp.add(crowd);
  const gc = document.createElement('canvas'); gc.width = 512; gc.height = 128; const g = gc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.18, 'rgba(255,255,255,.85)'); gr.addColorStop(.82, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  const vg = g.createLinearGradient(0, 0, 0, 128); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(.5, 'rgba(0,0,0,0)'); vg.addColorStop(.68, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = vg; g.fillRect(0, 0, 512, 128);
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: new THREE.Color(0.2, 0.26, 0.25), transparent: true, opacity: 0, fog: false, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(46, 12), glowMat); glow.position.set(0, 4.2, -11); crowd.add(glow);

  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const loader = new GLTFLoader();
  Promise.all(TYPES.map(([n, h]) => new Promise((res) => loader.load(`assets/models/m_${n}.glb`, (gl) => {
    const geos = []; gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o) => { if (o.isMesh) { const ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld); geos.push(ge); } });
    const merged = geos[0]; // un solo mesh per modello
    merged.deleteAttribute('uv'); merged.deleteAttribute('normal'); merged.deleteAttribute('color_0'); merged.deleteAttribute('COLOR_0');
    merged.computeBoundingBox(); const b = merged.boundingBox, s = h / (b.max.y - b.min.y);
    merged.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2); merged.scale(s, s, s);
    res(merged);
  }, undefined, () => res(null))))).then((geos) => {
    LAYOUT.forEach(([x, z, t], i) => {
      const ge = geos[t]; if (!ge) return;
      const m = new THREE.Mesh(ge, black); m.position.set(x + Math.sin(i * 7.3) * 0.35, 0, z + Math.cos(i * 3.1) * 0.4);
      m.rotation.y = Math.sin(i * 5.7) * 0.28; m.matrixAutoUpdate = true; crowd.add(m);
    });
    H.ready = true;
  });

  H.setDist = (d) => { H.dist = d; crowd.position.z = Z_END - d; };
  H.enable = () => { H.active = true; grp.visible = true; H.setDist(H.dist); };
  H.lightOn = () => { H.target = 1; H.flick = 1.1; };
  H.lightOff = () => { H.target = 0; H.flick = 0; H.glow = Math.min(H.glow, 0.0); };

  H.update = (dt) => {
    if (!H.active) return;
    if (H.flick > 0) H.flick -= dt;
    const k = H.target * (H.flick > 0 ? (Math.random() > 0.5 ? 1 : 0.08) : 1);
    H.glow += (k - H.glow) * Math.min(1, dt * (k > H.glow ? 14 : 30));
    const v = H.glow;
    sphere.material.color.setRGB(1.1 * v, 1.15 * v, 1.12 * v);
    glowMat.opacity = Math.min(1, v) * 0.95;
    crowd.visible = v > 0.02;
    // nebbia più rada: dal portone si deve poter vedere in fondo alla sala
    scene.fog.density += ((H.active ? 0.024 : 0.085) - scene.fog.density) * Math.min(1, dt * 2);
  };
  return H;
}
