// LA SORELLA (mostro nuovo, modellato per il gioco: ~20k triangoli, 42 ossa, animazioni Idle/Walk/Lunge).
// Sequenza SEMPRE uguale, prima della pistola: (1) entri nel magazzino e in fondo, nel buio, si accendono i suoi occhi e la si intravede;
// (2) ti avvicini e, quando c'è ancora poca luce, sparisce a scatti; (3) un attimo dopo ti viene incontro da davanti in un lampo (0,3 s): jump scare.
// Se arrivi al carrello senza che sia successo, scatta comunque. Una volta sola per partita.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createSorella({ group, camera, player, audio, lights, instab, say, zMin, zMax, xMax = 4.2 }) {
  const S = { state: 'off', model: null, mixer: null, act: {}, t: 0, seen: 0, n: 0, loading: null, wait: 0, eyes: null, sp: [], fromP: new THREE.Vector3(), toP: new THREE.Vector3(), eyeV: 0 };
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const g = gc.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(.18, 'rgba(255,140,50,.95)'); r.addColorStop(.5, 'rgba(255,70,15,.28)'); r.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const glowTex = new THREE.CanvasTexture(gc);
  S.load = () => (S.loading ??= new Promise((res) => new GLTFLoader().load('assets/models/sorella.glb', (g) => {
    const m = g.scene; m.visible = false;
    m.traverse((o) => {
      if (!o.isMesh) return; o.frustumCulled = false; o.material.envMapIntensity = 0.12;
      if (o.material.name === 'skin_game') { S.skin = o.material; o.material.color.multiplyScalar(0.45); o.material.roughness = 0.85; o.material.metalness = 0; }
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
  S.reset = () => { S.pending = false; S.state = 'idle'; S.t = 0; S.seen = 0; hide(); };
  const f = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const face = () => { const m = S.model; m.rotation.y = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z); };
  // occhi: le braci del modello + un alone additivo (visibile anche nella nebbia), seguono la testa
  const updateEyes = (op) => {
    if (!S.eyes || !S.eyes.isSkinnedMesh) return; const pos = S.eyes.geometry.attributes.position, n = pos.count, h = n >> 1; a.set(0, 0, 0); b.set(0, 0, 0);
    for (let i = 0; i < n; i++) { S.eyes.getVertexPosition(i, q); S.eyes.localToWorld(q); (i < h ? a : b).add(q); }
    a.multiplyScalar(1 / h); b.multiplyScalar(1 / (n - h));
    S.sp[0].position.copy(a); S.sp[1].position.copy(b); S.sp.forEach((s) => { s.visible = op > 0.01; s.material.opacity = op; });
  };
  // il lampo da davanti: parte nel buio a ~9 m nella direzione in cui guardi e ti arriva addosso in 0,3 s
  const dashFront = () => {
    const m = S.model; camera.getWorldDirection(f); p.set(f.x, 0, f.z).normalize();
    S.fromP.set(camera.position.x + p.x * 9, 0, camera.position.z + p.z * 9); S.fromP.x = Math.max(-xMax - 0.5, Math.min(xMax + 0.5, S.fromP.x));
    S.toP.set(camera.position.x + p.x * 1.15, 0, camera.position.z + p.z * 1.15);
    m.position.copy(S.fromP); face(); m.visible = true; S.eyeV = 1; S.t = 0; S.state = 'dash'; play('Lunge', 0.03); S.act.Lunge.timeScale = 2.4;
    audio.scare(); player.addShake(1.5); lights.torchStutter?.(0.4); instab.set(1, 6); try { navigator.vibrate?.([110, 30, 170]); } catch (_) {}
  };
  S.ambush = () => { if (S.state === 'done' || S.state === 'dash' || S.state === 'off') return; S.load(); S.pending = true; };   // presa l'arma senza che sia successo: scatta ora
  S.update = (dt, enabled = true) => {
    if (S.state === 'off' || S.state === 'done' || !enabled) return;
    if (S.pending && S.model && S.state !== 'dash') { S.pending = false; hide(); S.state = 'gap'; S.t = 0; S.gap = 0.6; }
    if (S.state === 'idle') {
      if (!S.model) { S.load(); return; }
      if (player.pos.z < zMax - 6) { const m = S.model; m.position.set(-3.4, 0, Math.max(zMin, player.pos.z - 19)); face(); m.visible = true; S.seen = 0; S.t = 0; S.eyeV = 0; S.revealed = false; S.rv = 0; play('Idle', 0.01); S.state = 'show'; }
      return;
    }
    S.mixer.update(dt); const m = S.model; S.t += dt;
    camera.getWorldDirection(f); d.copy(m.position).setY(1.4).sub(camera.position); const dist = d.length(); d.normalize();
    const inView = d.dot(f) > 0.6, late = player.pos.z < zMax - 22;                 // late: sei quasi al carrello, ora basta aspettare
    if (S.state === 'show') {
      S.eyeV = Math.min(1, S.eyeV + dt * 1.6); if (inView) S.seen += dt;
      // per farla intravedere: appena la guardi, la lampadina più vicina sfarfalla e per ~0,5 s la sagoma si illumina di taglio
      if (inView && S.seen > 0.35 && !S.revealed) { S.revealed = true; S.rv = 0.55; const L = lights.lamps; if (L && L.length) { let bi = 0, bd = 1e9; L.forEach((l, i) => { const dd = Math.hypot(l.x - m.position.x, l.z - m.position.z); if (dd < bd) { bd = dd; bi = i; } }); lights.lamp(bi, 'flicker', 0.7); } }
      if (S.rv > 0) { S.rv -= dt; S.skin.color.setScalar(0.45 + 0.9 * Math.sin(Math.min(1, S.rv / 0.55) * Math.PI)); } else if (S.skin) S.skin.color.setScalar(0.45);
      updateEyes(S.eyeV * (0.85 + 0.15 * Math.sin(S.t * 3.1)));
      if (late || (S.seen > 0.8 && dist < 9) || S.seen > 6 || dist < 6.5) { S.state = 'fade'; S.t = 0; }   // ti avvicini (o la guardi a lungo): sparisce
    } else if (S.state === 'fade') {                                                 // gli occhi si spengono a scatti
      updateEyes(Math.random() < 0.5 ? 0 : 0.6 * (1 - S.t / 0.35));
      if (S.t > 0.35) { hide(); S.state = 'gap'; S.t = 0; S.gap = late ? 0.5 : 1.6 + Math.random() * 1.4; }
    } else if (S.state === 'gap') {                                                  // silenzio, buio: poi il lampo
      if (S.t > S.gap) dashFront();
    } else if (S.state === 'dash') {
      const k = Math.min(1, S.t / 0.3); m.position.lerpVectors(S.fromP, S.toP, k * k); face(); updateEyes(1);
      lights.override = S.t < 0.14 ? 22 : null;                                      // lampo di luce all'impatto
      if (S.t > 0.52) { lights.override = null; hide(); S.state = 'done'; lights.lamp?.(0, 'flicker', 0.8); }
    }
  };
  return S;
}
