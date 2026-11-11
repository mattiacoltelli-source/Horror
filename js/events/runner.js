// DOPO IL VETRO: appena ti allontani, una sagoma nera corre lungo il muro di fronte a te, nel buio del tunnel, e svanisce.
// Veloce (poco più di un secondo), a 5-15 m, nel cono della torcia e nella penombra: si capisce solo che qualcuno ha corso.
import * as THREE from 'three';

export function createRunner({ scene, player, audio, lights, instab, hall }) {
  const R = { t: -1, done: false, mesh: null, z0: 0, stepT: 0 };
  R.start = () => {
    if (R.done || R.t >= 0) return; R.done = true; R.t = 0;
    if (!R.mesh) { R.mesh = hall.silhouette(1); scene.add(R.mesh); }
    R.z0 = player.pos.z - 3.5; R.mesh.visible = true; R.stepT = 0;
    audio.dash(1.0); instab.set(0.9, 7); lights.lamp(1, 'flicker', 0.9); player.addShake(0.12);
  };
  R.update = (dt, time) => {
    if (R.t < 0) return; R.t += dt;
    const D = 1.15, k = Math.min(1, R.t / D);
    R.mesh.position.set(-0.98, Math.abs(Math.sin(R.t * 17)) * 0.07, R.z0 - 15 * k);
    R.mesh.rotation.set(0.22, Math.PI, Math.sin(R.t * 17) * 0.05);         // di schiena, piegata in avanti nella corsa
    R.stepT -= dt; if (R.stepT <= 0 && k < 1) { R.stepT = 0.13; audio.step(1.6); }
    if (k >= 1) { R.mesh.visible = false; R.t = -1; }
  };
  return R;
}
