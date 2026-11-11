// Polvere nell'aria: pochi granelli FERMI NEL MONDO (non attaccati alla camera) che galleggiano lenti; camminando li superi, come veri granelli.
// Attorno al giocatore c'è una scatola di spazio: quando un granello ne esce viene riportato dal lato opposto, fuori dal campo visivo vicino.
import * as THREE from 'three';

export function createDust(camera) {
  const N = 110, BX = 3.2, BY = 1.8, BZ = 5.5, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), seed = new Float32Array(N);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-BX, BX); pos[i * 3 + 1] = rnd(-BY, BY); pos[i * 3 + 2] = rnd(-BZ, BZ); vel[i * 3] = rnd(-0.03, 0.03); vel[i * 3 + 1] = rnd(-0.045, 0.01); vel[i * 3 + 2] = rnd(-0.02, 0.02); seed[i] = Math.random() * 6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 0.028, map: new THREE.CanvasTexture(c), color: 0xc9c0b0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; pts.userData.keep = true;
  const D = { pts, enabled: true };
  const cp = new THREE.Vector3(); let init = false;
  D.update = (dt, t) => {
    if (!D.enabled) return;
    if (!pts.parent) { if (!camera.parent) return; camera.parent.add(pts); }   // nella scena, non nella camera
    camera.getWorldPosition(cp);
    if (!init) { init = true; for (let i = 0; i < N; i++) { pos[i * 3] += cp.x; pos[i * 3 + 1] += cp.y; pos[i * 3 + 2] += cp.z; } }
    for (let i = 0; i < N; i++) {
      pos[i * 3] += (vel[i * 3] + Math.sin(t * 0.4 + seed[i]) * 0.012) * dt; pos[i * 3 + 1] += (vel[i * 3 + 1] + Math.cos(t * 0.3 + seed[i]) * 0.01) * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      // riporto dal lato opposto della scatola attorno al giocatore (i granelli restano fermi nel mondo mentre cammini)
      let d = pos[i * 3] - cp.x; if (d > BX) pos[i * 3] -= 2 * BX; else if (d < -BX) pos[i * 3] += 2 * BX;
      d = pos[i * 3 + 1] - cp.y; if (d > BY) pos[i * 3 + 1] -= 2 * BY; else if (d < -BY) pos[i * 3 + 1] += 2 * BY;
      d = pos[i * 3 + 2] - cp.z; if (d > BZ) pos[i * 3 + 2] -= 2 * BZ; else if (d < -BZ) pos[i * 3 + 2] += 2 * BZ;
    }
    geo.attributes.position.needsUpdate = true;
  };
  D.hide = (b) => { pts.visible = !b; D.enabled = !b; };
  return D;
}
