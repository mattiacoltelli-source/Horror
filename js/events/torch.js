// LA TORCIA A TERRA: un oggetto da scena (non si raccoglie). Quando ti avvicini e la guardi si accende da sola, aspetta un attimo,
// rotola piano per ~50 cm girando il fascio verso di te, poi resta accesa un po' e si spegne con due guizzi. Una sola volta.
// Nessuna fisica: rotolamento scritto a mano; una sola SpotLight senza ombre (spenta = intensita' 0, il numero di luci non cambia).
import * as THREE from 'three';

export function createTorch({ group, player, camera, audio, x, z, yaw = 0, roll = 0.5, turn = 0.6 }) {
  const T = { state: 'idle', t: 0, done: false, s: 0 };
  let I = 0; for (let t = 0; t < 5.2; t += 0.01) I += (1 - Math.exp(-t / 0.45)) * Math.exp(-t / 1.5) * 0.01; const RK = (roll || 0) / I;   // velocita' di scala: la corsa totale e' esattamente 'roll' metri
  const G = new THREE.Group(); G.position.set(x, 0.0385, z); G.rotation.y = yaw; group.add(G);     // il gruppo scivola; "R" ruota sul proprio asse
  const R = new THREE.Group(); G.add(R);
  // forma curata: corpo in gomma con nervature, testa svasata con bordo metallico consumato, riflettore a coppa, vetro incassato, pulsante, tappo bombato (tutto da profili di rotazione)
  const rub = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.9 }), rub2 = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.75 });
  const met = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.5, metalness: 0.85 }), refl = new THREE.MeshStandardMaterial({ color: 0x6a6862, roughness: 0.25, metalness: 1, emissive: 0x000000 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x18181a }), V = (r, y) => new THREE.Vector2(r, y);
  const lathe = (pts, m, seg = 20) => { const g = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), m); g.rotation.x = Math.PI / 2; R.add(g); return g; };   // asse Y del profilo -> asse Z della torcia
  const body = [V(0.0001, -0.074), V(0.012, -0.0735), V(0.0195, -0.071), V(0.0225, -0.064)];                  // tappo bombato
  for (let i = 0; i < 6; i++) { const y = -0.058 + i * 0.0095; body.push(V(0.0222, y), V(0.0236, y + 0.002), V(0.0236, y + 0.0055), V(0.0222, y + 0.0075)); }   // nervature di presa
  body.push(V(0.0222, 0.0035), V(0.0234, 0.005), V(0.0234, 0.012), V(0.0242, 0.014));
  lathe(body, rub);
  lathe([V(0.0242, 0.014), V(0.0252, 0.016), V(0.0258, 0.024), V(0.0275, 0.05), V(0.0345, 0.092), V(0.0372, 0.099), V(0.0372, 0.107), V(0.034, 0.108)], rub2);   // testa svasata
  lathe([V(0.0345, 0.1075), V(0.0382, 0.1075), V(0.0382, 0.1115), V(0.0345, 0.1115)], met);                                                                    // anello metallico
  lathe([V(0.0105, 0.058), V(0.014, 0.07), V(0.021, 0.087), V(0.0305, 0.104)], refl, 24);                                                                      // riflettore a coppa
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0315, 20), lensM); lens.position.z = 0.1085; R.add(lens);                                              // vetro incassato nell'anello
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.007, 0.022), rub2); btn.position.set(0, 0.0255, 0.026); R.add(btn);                                  // pulsante
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.03), met); clip.position.set(0.0245, 0, -0.045); R.add(clip);                               // occhiello per il cinturino
  const L = new THREE.SpotLight(0xffefcf, 0, 12, 0.42, 0.85, 1.4); L.castShadow = false; G.add(L, L.target); L.position.set(0, 0.012, 0.13); L.target.position.set(0, -0.02, 3);
  const set = (k) => { L.intensity = 9 * k; lensM.color.setRGB(0.09 + 1.4 * k, 0.09 + 1.3 * k, 0.09 + 1.1 * k); refl.emissive.setRGB(0.5 * k, 0.45 * k, 0.33 * k); };
  const ease = (k) => k * k * (3 - 2 * k), d = new THREE.Vector3(), start = G.position.clone(), fwd = new THREE.Vector3();
  T.reset = () => { T.state = 'idle'; T.t = 0; T.s = 0; T.done = false; G.position.copy(start); G.rotation.y = yaw; R.rotation.z = 0; set(0); };
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
      // rotolamento naturale: parte da fermo (pavimento appena inclinato), accelera piano e rallenta per attrito; si muove di lato rispetto al suo asse,
      // la testa piu' larga lo fa curvare (il fascio vira da solo), la rotazione sul proprio asse e' esattamente spazio/raggio; a fine corsa un dondolio che si smorza
      const v = RK * (1 - Math.exp(-T.t / 0.45)) * Math.exp(-T.t / 1.5), ds = v * dt; T.s += ds;
      G.position.x += Math.cos(G.rotation.y) * ds; G.position.z -= Math.sin(G.rotation.y) * ds;   // di lato rispetto all'asse
      G.rotation.y += turn * (ds / roll); R.rotation.z = -T.s / 0.0225;
      if (T.t > 3.2) R.rotation.z += Math.sin((T.t - 3.2) * 16) * 0.05 * Math.exp(-(T.t - 3.2) * 2.6);
      set(1 - 0.08 * Math.sin(T.t * 3.1));
      if (T.t > 5.2) { T.state = 'stay'; T.t = 0; }
    } else if (T.state === 'stay') { set(1); if (T.t > 2) { T.state = 'off'; T.t = 0; } }
    else if (T.state === 'off') { set(T.t < 0.12 ? 0 : T.t < 0.3 ? 0.9 : T.t < 0.38 ? 0 : T.t < 0.55 ? 0.7 : 0); if (T.t > 0.55) { T.state = 'idle'; T.done = true; set(0); } }
  };
  return T;
}
