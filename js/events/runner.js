// DOPO IL VETRO: un uomo grosso, di spalle, in un angolo del corridoio, fermo a fissare il muro. Compare solo quando la luce
// sfarfalla; poi la luce si spegne e, quando torna, non c'è più. Nessun suono, nessun movimento: è l'immobilità a fare paura.
import * as THREE from 'three';

export function createRunner({ scene, player, audio, lights, instab, hall }) {
  const R = { t: -1, done: false, mesh: null };
  const LAMP = 2;                                   // la lampada di z ≈ -33
  R.start = () => {
    if (R.done || R.t >= 0) return; R.done = true; R.t = 0;
    if (!R.mesh) { R.mesh = hall.silhouette(5); scene.add(R.mesh); }
    R.mesh.position.set(-0.98, 0, -37.4); R.mesh.rotation.set(0, -Math.PI / 2, 0); R.mesh.visible = false;
    lights.lamp(LAMP, 'flicker', 1.6); instab.push(0.7, 6);
  };
  R.update = (dt) => {
    if (R.t < 0) return; R.t += dt; const t = R.t;
    if (t > 0.3 && t < 1.7) R.mesh.visible = true;               // la vedi solo nei guizzi di luce
    if (t >= 1.7 && R.mesh.visible) { R.mesh.visible = false; lights.lamp(LAMP, 'off'); }
    if (t > 2.9) { lights.lamp(LAMP, 'on'); R.t = -1; }          // la luce torna: l'angolo è vuoto
  };
  return R;
}
