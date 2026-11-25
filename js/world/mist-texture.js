// One small alpha stamp shared by the drain and the crowd. Created at loading,
// never while either encounter is playing; no external resource to download.
import * as THREE from 'three';

let texture;
export function getMistTexture() {
  if (texture) return texture;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), image = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x - 63.5) / 64, v = (y - 63.5) / 64, r = u * u + v * v;
    const n = .76 + .13 * Math.sin(x * .19 + Math.sin(y * .14) * 2) + .11 * Math.sin(y * .31 - x * .13);
    const a = Math.exp(-r * 4.6) * Math.max(0, 1 - r) * n, i = (y * 128 + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
    image.data[i + 3] = Math.round(Math.max(0, a) * 255);
  }
  g.putImageData(image, 0, 0);
  texture = new THREE.CanvasTexture(c);
  texture.name = 'foschia-condivisa';
  return texture;
}
