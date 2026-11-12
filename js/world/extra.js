// Oggetti di scena extra (Poly Haven, CC0): ogni voce è [modello, altezza in m, x, y (appoggio), z, rotazione Y].
// Il modello viene scalato all'altezza data e centrato su (x, z) con la base a y; se manca il file, la stanza resta com'è.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const loader = new GLTFLoader(), cache = {};
const get = (n) => cache[n] ??= new Promise((res) => loader.load(`assets/models/${n}.glb`, (g) => res(g.scene), undefined, () => res(null)));

export function addExtras(group, list) {
  for (const [name, h, x, y, z, ry = 0] of list) get(name).then((src) => {
    if (!src) return;
    const o = src.clone(true), b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o);
    const c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const g = new THREE.Group(); g.add(o); g.position.set(x, y, z); g.rotation.y = ry; group.add(g);
  });
}
// piedistallo in pietra scura per i busti
export function pedestal(group, x, z, h = 0.95, w = 0.42) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.85 }));
  m.position.set(x, h / 2, z); group.add(m);
}
