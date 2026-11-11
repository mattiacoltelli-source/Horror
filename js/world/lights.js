// Torcia del giocatore + pool fisso di 2 luci puntiformi che seguono le lampade vicine
// (numero di luci costante: nessuna ricompilazione shader, buono per mobile).
import * as THREE from 'three';
import { LAMPS } from './tunnel.js';

export function createLights(scene, camera) {
  scene.add(new THREE.HemisphereLight(0x1a2230, 0x0a0806, 0.35));

  const torch = new THREE.SpotLight(0xfff1d6, 34, 26, 0.5, 0.9, 1.8);
  torch.position.set(0.12, -0.1, 0);
  torch.target.position.set(0, 0, -4);
  camera.add(torch, torch.target);
  scene.add(camera);

  const pool = [0, 1].map(() => {
    const l = new THREE.PointLight(0xaec8ff, 0, 11, 1.8);
    scene.add(l);
    return l;
  });

  const mk = (x, y, z, i) => ({ x, y, z, i, base: 1, flick: 0, kill: false, level: 1, t: Math.random() * 10 });
  let lamps = LAMPS.map((z, i) => mk(0, 2.95, z, i));
  const dummy = new THREE.Vector3();
  let flashlightOn = true, torchLevel = 1, battery = 1, killT = 0, stutterT = 0, nextStutter = 25 + Math.random() * 25;

  const api = {
    override: null,
    torch,
    lamps,
    setTorch(v) { flashlightOn = v; },
    // cambia stanza: nuove posizioni delle lampade [[x,y,z],...]
    setLamps(list) { lamps = list.map(([x, y, z], i) => mk(x, y, z, i)); api.lamps = lamps; },
    // la torcia si spegne per `dur` secondi (poi torna, un po' più debole)
    torchKill(dur, drain = 0.12) { killT = dur; battery = Math.max(0.45, battery - drain); },
    torchStutter(dur = 0.4) { stutterT = dur; },
    // sfarfallio/spegnimento di una lampada: mode 'off' | 'flicker' | 'on'
    lamp(i, mode, dur = 1) { const L = lamps[i]; if (!L) return; L.mode = mode; L.modeT = dur; L.modeT0 = dur; },
    update(dt, t, playerZ, px = 0) {
      // batteria: cala lentamente (mai sotto 0.45: non si resta al buio per sempre) e dà rari singhiozzi
      battery = Math.max(0.45, battery - dt * 0.0011);
      nextStutter -= dt * (1.6 - battery);
      if (nextStutter <= 0) { stutterT = 0.15 + Math.random() * 0.35; nextStutter = 30 + Math.random() * 40; }
      let live = flashlightOn ? battery : 0;
      if (killT > 0) { killT -= dt; live = 0; }
      if (stutterT > 0) { stutterT -= dt; live *= Math.random() > 0.55 ? 0.15 : 0.9; }
      torchLevel += (live - torchLevel) * Math.min(1, dt * (live < torchLevel ? 22 : 9));
      // lieve instabilità della torcia
      const jit = 1 + Math.sin(t * 37) * 0.012 + (Math.random() - 0.5) * 0.015;
      torch.intensity = api.override != null ? api.override : 34 * torchLevel * jit;

      for (const L of lamps) {
        L.t += dt;
        let k = 1;
        if (L.mode === 'off') k = 0;
        else if (L.mode === 'flicker') {
          L.modeT -= dt;
          k = (Math.sin(L.t * 60) > 0.2 ? 1 : 0.05) * (Math.random() > 0.15 ? 1 : 0);
          if (L.modeT <= 0) L.mode = 'on';
        } else {
          // lampade vecchie: leggero ronzio, rari sfarfallii casuali
          k = 0.9 + Math.sin(L.t * 3.1 + L.i) * 0.03;
          if (Math.random() < 0.0008) { L.mode = 'flicker'; L.modeT = 0.25 + Math.random() * 0.4; }
        }
        L.level = k;
      }
      // assegna le 2 luci alle lampade più vicine al giocatore
      const order = [...lamps].sort((a, b) => Math.hypot(a.x - px, a.z - playerZ) - Math.hypot(b.x - px, b.z - playerZ));
      for (let i = 0; i < pool.length; i++) {
        const L = order[i];
        if (L) { pool[i].position.set(L.x, L.y, L.z); pool[i].intensity = 14 * L.level; } else pool[i].intensity = 0;
      }
      for (const L of lamps) if (L.mesh) { L.mesh.userData.setGlow?.(L.level); }
    },
  };
  return api;
}
