// Il dipinto fornito dall'utente, raddrizzato e compresso. L'alfa rovina
// soltanto il bordo: il centro dell'illustrazione mantiene tutti i dettagli.
import * as THREE from 'three';
import { writingDecals } from './blood.js';

export function addInfernalMural(group) {
  const mesh = writingDecals(group, [{
    img: 'assets/tex/pic_mural_infernal_smoke.webp', aspect: 1280 / 692,
    p: [1.38, 1.13, -28.5], wall: '-x', w: 3.48, rot: 0, a: .91, plain: true,
  }])[0];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), data = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const edge = Math.min(x, y, 127 - x, 127 - y);
    const chips = 3 + Math.sin(x * .31 + y * .17) * 2.1 + Math.sin(x * .67 - y * .29) * 1.1;
    const t = Math.max(0, Math.min(1, (edge - chips) / 10)), alpha = Math.round(t * t * (3 - 2 * t) * 255), i = (y * 128 + x) * 4;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = alpha; data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  mesh.material.alphaMap = new THREE.CanvasTexture(c); mesh.material.needsUpdate = true;
  mesh.name = 'murale-infernale-del-tunnel'; return mesh;
}
