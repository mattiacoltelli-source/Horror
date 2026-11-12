// LA SORELLA (mostro nuovo, modellato per il gioco: ~20k triangoli, 42 ossa, animazioni Idle/Walk/Lunge).
// Nel magazzino non si vede mai bene: resta nel buio, lontana, e di lei si notano soprattutto gli occhi, due braci. Se ti avvicini (< 10 m) o la guardi
// troppo a lungo sparisce, e dopo un po' ricompare altrove, sempre lontana (anche alle tue spalle). Alla terza volta, se la guardi, ti viene addosso
// in un lampo (0,3 s) e sparisce: l'unica volta in cui si vede da vicino, per un istante. Una volta sola per partita.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createSorella({ group, camera, player, audio, lights, instab, zMin, zMax, xMax = 4.2 }) {
  const S = { state: 'off', model: null, mixer: null, act: {}, t: 0, seen: 0, n: 0, loading: null, wait: 0, eyes: null, sp: [], fromP: new THREE.Vector3(), toP: new THREE.Vector3(), eyeV: 0 };
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const g = gc.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(.18, 'rgba(255,140,50,.95)'); r.addColorStop(.5, 'rgba(255,70,15,.28)'); r.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const glowTex = new THREE.CanvasTexture(gc);
  S.load = () => (S.loading ??= new Promise((res) => new GLTFLoader().load('assets/models/sorella.glb', (g) => {
    const m = g.scene; m.visible = false;
    m.traverse((o) => {
      if (!o.isMesh) return; o.frustumCulled = false; o.material.envMapIntensity = 0.12;
      if (o.material.name === 'skin_game') { o.material.color.multiplyScalar(0.45); o.material.roughness = 0.85; o.material.metalness = 0; }
      if (o.material.name === 'cloth_game') o.material.color.multiplyScalar(0.5);
      if (o.material.name === 'ember') { o.material.emissiveIntensity = 3.2; S.eyes = o; }
    });
    for (let i = 0; i < 2; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 })); sp.scale.setScalar(0.26); sp.visible = false; group.add(sp); S.sp.push(sp); }
    S.mixer = new THREE.AnimationMixer(m);
    for (const c of g.animations) S.act[c.name] = S.mixer.clipAction(c);
    S.act.Lunge.setLoop(THREE.LoopOnce, 1); S.act.Lunge.clampWhenFinished = true;
    S.act.Idle.play(); group.add(m); S.model = m; res(m);
  }, undefined, () => res(null))));
  const play = (name, fade = 0.2) => { const a = S.act[name]; if (!a) return; for (const k in S.act) if (S.act[k] !== a && S.act[k].isRunning()) S.act[k].fadeOut(fade); a.reset().fadeIn(fade).play(); };
  const hide = () => { if (S.model) S.model.visible = false; S.sp.forEach((s) => { s.visible = false; }); };
  S.reset = () => { S.state = 'idle'; S.t = 0; S.seen = 0; S.n = 0; S.wait = 0; hide(); };
  const f = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const face = () => { const m = S.model; m.rotation.y = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z); };
  const place = (x, z) => { const m = S.model; m.position.set(Math.max(-xMax, Math.min(xMax, x)), 0, Math.max(zMin, Math.min(zMax, z))); face(); m.visible = true; S.seen = 0; S.t = 0; S.eyeV = 0; play('Idle', 0.01); S.state = 'show'; S.n++; };
  // occhi: le braci del modello + un alone additivo (visibile anche nella nebbia), seguono la testa
  const updateEyes = (op) => {
    if (!S.eyes || !S.eyes.isSkinnedMesh) return; const pos = S.eyes.geometry.attributes.position, n = pos.count, h = n >> 1; a.set(0, 0, 0); b.set(0, 0, 0);
    for (let i = 0; i < n; i++) { S.eyes.getVertexPosition(i, q); S.eyes.localToWorld(q); (i < h ? a : b).add(q); }
    a.multiplyScalar(1 / h); b.multiplyScalar(1 / (n - h));
    S.sp[0].position.copy(a); S.sp[1].position.copy(b); S.sp.forEach((s) => { s.visible = op > 0.01; s.material.opacity = op; });
  };
  const nextSpawn = () => {                                                      // sempre lontana (> 10 m): davanti nel fondo, oppure alle spalle
    const side = (S.n % 2 ? 1 : -1) * (3.0 + Math.random() * 1.2), za = Math.max(zMin, player.pos.z - 14 - Math.random() * 3), zb = Math.min(zMax, player.pos.z + 13 + Math.random() * 2);
    if (player.pos.z - za > 10.5) return [side, za];
    if (zb - player.pos.z > 10.5) return [side, zb];
    return null;
  };
  S.update = (dt, enabled = true) => {
    if (S.state === 'off' || S.state === 'done' || !enabled) return;
    if (S.state === 'idle') {
      if (!S.model) { S.load(); return; }
      if (player.pos.z < zMax - 7) place(-3.4, Math.max(zMin, player.pos.z - 19));
      return;
    }
    if (S.state === 'wait') { S.wait -= dt; if (S.wait <= 0) { const s = nextSpawn(); if (s) place(s[0], s[1]); else S.state = 'done'; } return; }
    S.mixer.update(dt); const m = S.model; S.t += dt;
    camera.getWorldDirection(f); d.copy(m.position).setY(1.4).sub(camera.position); const dist = d.length(); d.normalize();
    const inView = d.dot(f) > 0.6;
    if (S.state === 'show') {
      S.eyeV = Math.min(1, S.eyeV + dt * 1.6); updateEyes(S.eyeV * (0.85 + 0.15 * Math.sin(S.t * 3.1)));
      if (inView) S.seen += dt;
      if (S.n >= 3 && inView && S.seen > 0.9) {                                  // il lampo: da lontano ti viene addosso, velocissima
        S.state = 'dash'; S.t = 0; S.fromP.copy(m.position); camera.getWorldDirection(f); p.set(f.x, 0, f.z).normalize();
        S.toP.set(camera.position.x + p.x * 1.15, 0, camera.position.z + p.z * 1.15); play('Lunge', 0.03); S.act.Lunge.timeScale = 2.4;
        audio.scare(); player.addShake(1.5); lights.torchStutter?.(0.4); instab.set(1, 6); try { navigator.vibrate?.([110, 30, 170]); } catch (_) {}
      } else if (dist < 10 || S.seen > 4.2) { S.state = 'fade'; S.t = 0; }
    } else if (S.state === 'fade') {                                             // gli occhi si spengono a scatti e sparisce
      updateEyes(Math.random() < 0.5 ? 0 : 0.6 * (1 - S.t / 0.3));
      if (S.t > 0.3) { hide(); S.state = 'wait'; S.wait = 6 + Math.random() * 6; if (S.n >= 3) S.state = 'done'; }
    } else if (S.state === 'dash') {
      const k = Math.min(1, S.t / 0.3); m.position.lerpVectors(S.fromP, S.toP, k * k); face(); updateEyes(1);
      lights.override = S.t < 0.14 ? 22 : null;                                  // lampo di luce all'impatto
      if (S.t > 0.52) { lights.override = null; hide(); S.state = 'done'; lights.lamp?.(0, 'flicker', 0.8); }
    }
  };
  return S;
}
