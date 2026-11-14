// LA TORCIA A TERRA: un oggetto da scena (non si raccoglie). Quando ti avvicini e la guardi si accende da sola, aspetta un attimo,
// rotola piano per ~50 cm girando il fascio verso di te, poi resta accesa un po' e si spegne con due guizzi. Una sola volta.
// Nessuna fisica: rotolamento scritto a mano; una sola SpotLight senza ombre (spenta = intensita' 0, il numero di luci non cambia).
import * as THREE from 'three';

export function createTorch({ group, player, camera, audio, x, z, yaw = 0, roll = 0.5, turn = 0.6 }) {
  const T = { state: 'idle', t: 0, done: false };
  const G = new THREE.Group(); G.position.set(x, 0.036, z); G.rotation.y = yaw; group.add(G);     // il gruppo scivola; "R" ruota sul proprio asse
  const R = new THREE.Group(); G.add(R);
  const rub = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.85 }), met = new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.45, metalness: 0.8 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x18181a }), cyl = (r1, r2, h, m, zc) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 14), m); c.rotation.x = Math.PI / 2; c.position.z = zc; R.add(c); return c; };
  cyl(0.0225, 0.0225, 0.14, rub, 0); cyl(0.0235, 0.0235, 0.012, met, -0.073); cyl(0.0235, 0.0235, 0.012, met, 0.02);   // corpo, tappo, anello
  cyl(0.026, 0.036, 0.05, met, 0.095); const lens = new THREE.Mesh(new THREE.CircleGeometry(0.031, 14), lensM); lens.position.z = 0.1211; R.add(lens);   // testa conica e vetro
  const L = new THREE.SpotLight(0xffefcf, 0, 12, 0.42, 0.85, 1.4); L.castShadow = false; G.add(L, L.target); L.position.set(0, 0.012, 0.13); L.target.position.set(0, -0.02, 3);
  const set = (k) => { L.intensity = 9 * k; lensM.color.setRGB(0.09 + 1.4 * k, 0.09 + 1.3 * k, 0.09 + 1.1 * k); };
  const ease = (k) => k * k * (3 - 2 * k), d = new THREE.Vector3(), start = G.position.clone(), fwd = new THREE.Vector3();
  T.reset = () => { T.state = 'idle'; T.t = 0; T.done = false; G.position.copy(start); G.rotation.y = yaw; R.rotation.z = 0; set(0); };
  T.update = (dt) => {
    if (T.done) return;
    const P = player.pos;
    if (T.state === 'idle') {
      d.set(G.position.x - P.x, 0, G.position.z - P.z); const dist = d.length(); d.normalize(); fwd.set(player.forward.x, 0, player.forward.z).normalize();
      if (dist < 6.5 && dist > 2.2 && fwd.dot(d) > 0.55) { T.state = 'on'; T.t = 0; audio.tinkle?.(); }
      return;
    }
    T.t += dt;
    if (T.state === 'on') { const f = T.t < 0.5 ? (Math.sin(T.t * 55) > 0 ? 0.9 : 0.15) : 1; set(f); if (T.t > 0.5 && !roll) { T.state = 'stay'; T.t = 0; } else if (T.t > 1.5) { T.state = 'roll'; T.t = 0; } }          // si accende (guizzo), poi aspetta
    else if (T.state === 'roll') {
      const k = ease(Math.min(1, T.t / 3.4)), r = 0.0225;
      G.position.x = start.x + roll * k; G.rotation.y = yaw + turn * k; R.rotation.z = -(roll * k) / r;       // 50 cm: gira il fascio verso di te mentre rotola
      set(1 - 0.12 * Math.sin(T.t * 3.1));
      if (T.t > 3.4) { T.state = 'stay'; T.t = 0; }
    } else if (T.state === 'stay') { set(1); if (T.t > (roll ? 7 : 2)) { T.state = 'off'; T.t = 0; } }
    else if (T.state === 'off') { set(T.t < 0.12 ? 0 : T.t < 0.3 ? 0.9 : T.t < 0.38 ? 0 : T.t < 0.55 ? 0.7 : 0); if (T.t > 0.55) { T.state = 'idle'; T.done = true; set(0); } }
  };
  return T;
}
