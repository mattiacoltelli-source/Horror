// Oggetti di scena extra (Poly Haven, CC0): ogni voce è [modello, altezza in m, x, y (appoggio), z, rotazione Y].
// 7° valore opzionale: 'dark' (0-1, moltiplicatore lineare) scurisce e desatura i colori, per gli oggetti troppo vivaci per l'atmosfera.
// 9° valore opzionale: funzione chiamata col gruppo dell'oggetto, quando è pronto (per animarlo).
// 8° valore opzionale: 'lie' (rad) ribalta l'oggetto sull'asse X, es. -PI/2 = sdraiato a pancia in su, appoggiato.
// Il modello viene scalato all'altezza data e centrato su (x, z) con la base a y; se manca il file, la stanza resta com'è.
import * as THREE from 'three';
import { aged } from './aged.js';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const loader = new GLTFLoader(), cache = {};
const get = (n) => cache[n] ??= new Promise((res) => loader.load(`assets/models/${n}.glb`, (g) => res(g.scene), undefined, () => res(null)));

export function addExtras(group, list) {
  for (const [name, h, x, y, z, ry = 0, dark = 1, lie = 0, cb] of list) get(name).then((src) => {
    if (!src) return;
    const o = src.clone(true), b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o);
    if (lie) { o.rotation.x = lie; o.updateMatrixWorld(true); b.setFromObject(o); }   // la base si calcola dopo averlo sdraiato
    const c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    if (dark < 1) o.traverse((m) => { if (!m.isMesh) return; m.material = m.material.clone(); const c = m.material.color, gr = (c.r + c.g + c.b) / 3; c.setRGB(c.r + (gr - c.r) * 0.6, c.g + (gr - c.g) * 0.6, c.b + (gr - c.b) * 0.6).multiplyScalar(dark); if (m.material.emissive) m.material.emissive.multiplyScalar(dark); });
    if (/x_clock|x_bust|x_basket|x_gnome|x_lion|x_tv|x_screen|bin|stove|cabinet|chair|stool|tank|rim|can$/.test(name)) aged(o, name === 'x_clock' ? 0.85 : 0.7);
    const g = new THREE.Group(); g.add(o); g.position.set(x, y, z); g.rotation.y = ry; group.add(g); cb?.(g);
  });
}
// il busto si volta verso di te, un po' di più ogni volta che lo perdi di vista (1ª volta 40%, 2ª 75%, 3ª di fronte)
export function turnToward(g, target, n) {
  const want = Math.atan2(target.x - g.position.x, target.z - g.position.z); let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * [0.4, 0.75, 1][Math.min(2, Math.max(0, n - 1))];
}
// piedistallo in pietra scura per i busti
export function pedestal(group, x, z, h = 0.95, w = 0.42) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.85 }));
  m.position.set(x, h / 2, z); group.add(m);
}
