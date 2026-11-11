// Polvere nell'aria: pochi granelli che galleggiano lenti davanti alla camera, visibili solo dove arriva la torcia (additivi, molto deboli).
import * as THREE from 'three';

export function createDust(camera) {
  const N = 90, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), seed = new Float32Array(N);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-2.2, 2.2); pos[i * 3 + 1] = rnd(-1.6, 1.6); pos[i * 3 + 2] = rnd(-7, -0.6); vel[i * 3] = rnd(-0.03, 0.03); vel[i * 3 + 1] = rnd(-0.045, 0.01); vel[i * 3 + 2] = rnd(-0.02, 0.02); seed[i] = Math.random() * 6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 0.028, map: new THREE.CanvasTexture(c), color: 0xc9c0b0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; camera.add(pts);
  const D = { pts, enabled: true };
  D.update = (dt, t) => {
    if (!D.enabled) return;
    for (let i = 0; i < N; i++) {
      pos[i * 3] += (vel[i * 3] + Math.sin(t * 0.4 + seed[i]) * 0.012) * dt; pos[i * 3 + 1] += (vel[i * 3 + 1] + Math.cos(t * 0.3 + seed[i]) * 0.01) * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < -1.7) pos[i * 3 + 1] = 1.7; if (Math.abs(pos[i * 3]) > 2.4) pos[i * 3] *= -0.9; if (pos[i * 3 + 2] > -0.5) pos[i * 3 + 2] = -7; else if (pos[i * 3 + 2] < -7.2) pos[i * 3 + 2] = -0.7;
    }
    geo.attributes.position.needsUpdate = true;
  };
  D.hide = (b) => { pts.visible = !b; D.enabled = !b; };
  return D;
}
