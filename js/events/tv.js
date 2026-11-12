// La TV del magazzino: quando ti avvicini e la guardi si accende da sola, statica; per un attimo, in mezzo ai disturbi, una sagoma; poi si spegne.
// Una volta sola per partita. Lo schermo è un piano con canvas a bassa risoluzione sopra lo schermo spento del modello.
import * as THREE from 'three';

export function createTv({ camera, audio }) {
  const T = { g: null, state: 'idle', t: 0, seen: 0, plane: null, glow: null, ctx: null, tex: null, acc: 0, pos: new THREE.Vector3() };
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 48; const cx = cv.getContext('2d'), img = cx.createImageData(64, 48);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const noise = (figure) => {
    const d = img.data, cxm = 32, cym = 26;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
      let v = 70 + Math.random() * 170;
      if (figure) { const dx = (x - cxm) / 9, hd = Math.hypot(dx, (y - 17) / 10), body = (y > 25 && Math.abs(x - cxm) < 5 + (y - 25) * 0.8); if (hd < 1 || body) v = 6 + Math.random() * 30; }   // testa e spalle scure
      const i = (y * 64 + x) * 4; d[i] = v * 0.92; d[i + 1] = v; d[i + 2] = v * 1.05; d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0); tex.needsUpdate = true;
  };
  // g: gruppo dell'oggetto (centrato su x,z con la base a terra, davanti = +z); sw/sh/cx/cy: schermo in metri nel suo sistema
  T.attach = (g, { sw = 0.27, sh = 0.28, x = -0.065, y = 0.24, z = 0.182 } = {}) => {
    T.g = g;
    T.plane = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true })); T.plane.position.set(x, y, z); T.plane.visible = false; g.add(T.plane);
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(170,200,255,.55)'); gr.addColorStop(1, 'rgba(170,200,255,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    T.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); T.glow.scale.setScalar(1.6); T.glow.position.set(x, y, z + 0.25); g.add(T.glow);
  };
  const p = new THREE.Vector3(), f = new THREE.Vector3(), d = new THREE.Vector3();
  T.reset = () => { T.state = 'idle'; T.t = 0; T.seen = 0; if (T.plane) T.plane.visible = false; if (T.glow) T.glow.material.opacity = 0; };
  T.update = (dt, enabled = true) => {
    if (!T.g || !enabled || T.state === 'done') return;
    T.g.getWorldPosition(p); camera.getWorldDirection(f); d.copy(p).sub(camera.position); const dist = d.length(); d.normalize();
    if (T.state === 'idle') { if (dist < 6 && dist > 1.2 && d.dot(f) > 0.6) T.seen += dt; else T.seen = Math.max(0, T.seen - dt); if (T.seen > 0.6) { T.state = 'on'; T.t = 0; T.acc = 0; T.plane.visible = true; noise(false); T.pos.set(p.x, 0.5, p.z); audio.tvStatic(3.6, T.pos, 1); } return; }
    T.t += dt; T.acc += dt; const figure = T.state === 'on' && T.t > 2.6 && T.t < 3.0;
    if (T.acc > 0.06) { T.acc = 0; noise(figure); }
    T.glow.material.opacity = (0.28 + Math.random() * 0.14) * (T.t < 3.5 ? 1 : 0);
    if (T.t > 3.55) { T.state = 'done'; T.plane.visible = false; T.glow.material.opacity = 0; }
  };
  return T;
}
