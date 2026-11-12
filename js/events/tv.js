// La TV del magazzino: quando ti avvicini e la guardi si accende da sola, statica; per un attimo una macchia scura, veloce e indistinta ci passa
// attraverso; poi si spegne. Una volta sola per partita. Lo schermo è un piano con canvas a bassa risoluzione sopra lo schermo spento del modello.
// La luce è soffusa: un alone morbido sul pavimento davanti e uno piccolo attorno allo schermo, che tremolano col segnale (niente righe nette).
import * as THREE from 'three';

const radial = (stops, w = 128, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = r; g.fillRect(0, 0, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createTv({ camera, audio }) {
  const T = { g: null, state: 'idle', t: 0, seen: 0, plane: null, glow: null, floor: null, acc: 0, pos: new THREE.Vector3() };
  const W = 64, H = 48, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'), img = cx.createImageData(W, H);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  // statica fioca e morbida (schermo vecchio, poco luminoso), con bordi scuri e una fascia di rullaggio; smear: 0..1 = posizione della macchia scura che attraversa
  const noise = (smear, roll) => {
    const d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1) - 0.5, v = y / (H - 1) - 0.5;
      const e = Math.max(Math.abs(u), Math.abs(v)) * 2, ee = Math.min(1, Math.max(0, (e - 0.8) / 0.2));
      let k = 1 - ee * ee * (3 - 2 * ee) * 0.4 - (u * u + v * v) * 0.25;       // schermo pieno: si scurisce solo un filo sul bordo, come un tubo catodico
      k *= 0.82 + 0.18 * Math.sin((y / H) * 6.28 * 14 + roll * 3);             // linee di scansione appena percettibili
      k *= 1 + 0.35 * Math.exp(-(((y / H) - roll % 1.2 + 0.1) ** 2) / 0.012);   // fascia chiara che scorre
      let n = (34 + Math.random() * 120) * Math.max(0, k);
      if (smear != null) {                                                       // macchia scura sfocata, senza forma: passa da sinistra a destra in un attimo
        const sx = -0.25 + smear * 1.5, dx = (x / W) - sx, m = Math.exp(-(dx * dx) / 0.012) * Math.exp(-((v + 0.05 + (Math.random() - 0.5) * 0.1) ** 2) / 0.16);
        n *= 1 - 0.93 * m;
      }
      const i = (y * W + x) * 4; d[i] = n * 0.86; d[i + 1] = n * 0.97; d[i + 2] = n * 1.08; d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0); tex.needsUpdate = true;
  };
  // g: gruppo dell'oggetto (centrato su x,z con la base a terra, davanti = +z)
  T.attach = (g, { sw = 0.285, sh = 0.292, x = -0.066, y = 0.241, z = 0.1825 } = {}) => {
    T.g = g;
    T.plane = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true })); T.plane.position.set(x, y, z); T.plane.visible = false; g.add(T.plane);
    const soft = (map, size, pos, rotX) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ map, color: 0x8fa8d8, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.position.set(...pos); if (rotX) m.rotation.x = rotX; m.visible = false; g.add(m); return m; };
    T.floor = soft(radial([[0, 0.55], [0.35, 0.28], [0.7, 0.08], [1, 0]], 128, 128), [2.4, 1.9], [x, 0.012, z + 0.95], -Math.PI / 2);    // alone sul pavimento davanti
    T.glow = soft(radial([[0, 0.5], [0.3, 0.22], [0.7, 0.05], [1, 0]], 128, 128), [0.9, 0.8], [x, y, z + 0.12], 0);                         // bagliore attorno allo schermo (piano, non una riga)
  };
  const p = new THREE.Vector3(), f = new THREE.Vector3(), d = new THREE.Vector3();
  T.reset = () => { T.state = 'idle'; T.t = 0; T.seen = 0; [T.plane, T.glow, T.floor].forEach((m) => { if (m) m.visible = false; }); };
  T.update = (dt, enabled = true) => {
    if (!T.g || !enabled || T.state === 'done') return;
    T.g.getWorldPosition(p); camera.getWorldDirection(f); d.copy(p).sub(camera.position); const dist = d.length(); d.normalize();
    if (T.state === 'idle') { if (dist < 6 && dist > 1.2 && d.dot(f) > 0.6) T.seen += dt; else T.seen = Math.max(0, T.seen - dt); if (T.seen > 0.6) { T.state = 'on'; T.t = 0; T.acc = 0; [T.plane, T.glow, T.floor].forEach((m) => { m.visible = true; }); noise(null, 0); T.pos.set(p.x, 0.5, p.z); audio.tvStatic(3.6, T.pos, 1); } return; }
    T.t += dt; T.acc += dt;
    const smear = T.t > 2.6 && T.t < 2.85 ? (T.t - 2.6) / 0.25 : null;
    if (T.acc > 0.06) { T.acc = 0; noise(smear, T.t); }
    // tremolio della luce col segnale, accensione e spegnimento morbidi
    const fade = Math.min(1, T.t / 0.25) * Math.min(1, Math.max(0, (3.55 - T.t) / 0.2)), fl = 0.8 + Math.random() * 0.2 - (smear != null ? 0.35 : 0);
    T.floor.material.opacity = 0.34 * fl * fade; T.glow.material.opacity = 0.3 * fl * fade;
    if (T.t > 3.55) { T.state = 'done'; [T.plane, T.glow, T.floor].forEach((m) => { m.visible = false; }); }
  };
  return T;
}
