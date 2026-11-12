// LA SORELLA (mostro nuovo, modellato per il gioco: ~20k triangoli, 42 ossa, animazioni Idle/Walk/Lunge, texture cotte da un modello ad alta risoluzione).
// Nel magazzino compare in fondo, nel buio, ferma. Si muove solo quando non la guardi: ogni volta che distogli lo sguardo la ritrovi più vicina
// (3 volte). Alla fine, se la guardi da vicino, scatta verso di te con la bocca aperta e sparisce. Una volta sola per partita.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createSorella({ group, camera, player, audio, lights, instab, zMin, zMax, xMax = 4.4 }) {
  const S = { state: 'off', model: null, mixer: null, act: {}, t: 0, seen: 0, unseen: 0, step: 0, loading: null, walkT: 0, fromP: new THREE.Vector3(), toP: new THREE.Vector3() };
  S.load = () => (S.loading ??= new Promise((res) => new GLTFLoader().load('assets/models/sorella.glb', (g) => {
    const m = g.scene; m.visible = false;
    m.traverse((o) => {
      if (!o.isMesh) return; o.frustumCulled = false; o.material.envMapIntensity = 0.18;   // la luce d'ambiente riflessa (panorama del bagno) la sbiancava: resta al buio
      if (o.material.name === 'skin_game') { o.material.color.multiplyScalar(0.5); o.material.roughness = 0.84; o.material.metalness = 0; }
      if (o.material.name === 'cloth_game') o.material.color.multiplyScalar(0.7);
      if (o.material.name === 'ember') { o.material.emissiveIntensity = 1.2; }
    });
    S.mixer = new THREE.AnimationMixer(m);
    for (const c of g.animations) S.act[c.name] = S.mixer.clipAction(c);
    S.act.Lunge.setLoop(THREE.LoopOnce, 1); S.act.Lunge.clampWhenFinished = true; S.act.Walk.timeScale = 1.1;
    S.act.Idle.play(); group.add(m); S.model = m; res(m);
  }, undefined, () => res(null))));
  const play = (name, fade = 0.25) => { const a = S.act[name]; if (!a) return; for (const k in S.act) if (S.act[k] !== a && S.act[k].isRunning()) S.act[k].fadeOut(fade); a.reset().fadeIn(fade).play(); };
  S.reset = () => { S.state = 'idle'; S.t = 0; S.seen = 0; S.unseen = 0; S.step = 0; if (S.model) S.model.visible = false; };
  const f = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  const face = () => { const m = S.model; m.rotation.y = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z); };
  const clampPos = (v) => { v.x = Math.max(-xMax, Math.min(xMax, v.x)); v.z = Math.max(zMin, Math.min(zMax, v.z)); v.y = 0; return v; };
  S.update = (dt, enabled = true) => {
    if (S.state === 'off' || S.state === 'done' || !enabled) return;
    if (S.state === 'idle') {                                                    // prima: la sala è vuota; dopo 11 m dentro, compare in fondo
      if (!S.model) { S.load(); return; }
      if (player.pos.z < zMax - 11) { const m = S.model; m.position.set(-3.1, 0, Math.max(zMin, player.pos.z - 21)); face(); m.visible = true; S.state = 'watch'; play('Idle', 0.01); }
      return;
    }
    S.mixer.update(dt); const m = S.model; S.t += dt;
    camera.getWorldDirection(f); d.copy(m.position).setY(1.1).sub(camera.position); const dist = d.length(); d.normalize();
    const inView = d.dot(f) > 0.62 && dist < 26;
    if (S.state === 'watch') {
      if (S.walkT > 0) { S.walkT -= dt; if (S.walkT <= 0) play('Idle', 0.3); }
      if (inView) { S.seen += dt; S.unseen = 0; } else { S.unseen += dt; }
      if (S.step >= 3 && inView && dist < 7.5 && S.seen > 0.5) {               // da vicino, se la guardi: scatta
        S.state = 'lunge'; S.t = 0; S.fromP.copy(m.position); face(); p.set(player.pos.x - m.position.x, 0, player.pos.z - m.position.z).normalize(); S.toP.set(player.pos.x - p.x * 1.9, 0, player.pos.z - p.z * 1.9);
        play('Lunge', 0.05); audio.scare(); player.addShake(1.2); lights.torchStutter?.(0.5); instab.set(1, 6); try { navigator.vibrate?.([120, 40, 170]); } catch (_) {}
      } else if (S.seen > 1.1 && S.unseen > 0.7 && S.step < 3) {                // distogli lo sguardo: si avvicina
        const dists = [14, 9, 5.8], side = S.step % 2 ? 0.55 : -0.55, a = Math.atan2(-f.x, -f.z) + side;
        p.set(player.pos.x - Math.sin(a) * dists[S.step], 0, player.pos.z - Math.cos(a) * dists[S.step]); clampPos(p);
        if (p.z > player.pos.z - 3) p.z = player.pos.z - 3;                      // mai alle spalle: resta avanti a te
        m.position.copy(p); face(); S.step++; S.seen = 0; S.unseen = 0; play('Walk', 0.2); S.walkT = 0.9; audio.heavyStep?.(m.position, 0.55);
      }
    } else if (S.state === 'lunge') {
      const k = Math.min(1, S.t / 0.55); m.position.lerpVectors(S.fromP, S.toP, k * k * (3 - 2 * k)); face();
      if (S.t > 1.15) { m.visible = false; S.state = 'done'; lights.lamp?.(0, 'flicker', 1.0); }
    }
  };
  return S;
}
