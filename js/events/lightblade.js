// FINALE ALTERNATIVO — LA LAMA DI LUCE: si arriva nella torre dal portale della cripta. In mano una lama di luce; suor Agnese compare in fondo alla stanza e avanza piano.
// Quando e' vicina si colpisce (COLPISCI / spazio): lampo, e lei si dissolve come un'ombra (fumo nero che sale, figura che si allunga e si assottiglia). Poi il finale.
// Nessuna luce in piu' nella scena: la lama illumina usando la luce "warm" della torre (numero di luci invariato, nessuna ricompilazione).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const glowTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(32, 64, 2, 32, 64, 62);
  r.addColorStop(0, 'rgba(210,235,255,1)'); r.addColorStop(0.35, 'rgba(110,170,255,.45)'); r.addColorStop(1, 'rgba(60,120,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(8,8,10,.9)'); r.addColorStop(0.5, 'rgba(10,10,14,.45)'); r.addColorStop(1, 'rgba(10,10,14,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export function createLightBlade({ group, camera, player, audio, say, warm, finish, z0, text }) {
  const B = { active: false, state: 'idle', t: 0, ready: false };
  // ---- la lama (figlia della camera) ----
  const hand = new THREE.Group(); hand.visible = false; camera.add(hand);
  const top = (m) => { m.renderOrder = 12; m.frustumCulled = false; return m; };
  const handle = top(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0x1a1b1d, depthTest: false }))); handle.rotation.x = Math.PI / 2; handle.position.z = 0.0; hand.add(handle);
  const guard = top(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x2c2e31, depthTest: false }))); guard.position.z = -0.105; hand.add(guard);
  const blade = top(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.78), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3), toneMapped: false, depthTest: false, fog: false }))); blade.position.z = -0.5; hand.add(blade);
  const halo = top(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, opacity: 0.5 }))); halo.rotation.x = -Math.PI / 2; halo.position.z = -0.5; hand.add(halo);
  const halo2 = top(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.9), halo.material)); halo2.rotation.y = Math.PI / 2; halo2.rotation.x = 0; halo2.position.z = -0.5; halo2.geometry.rotateZ(Math.PI / 2); hand.add(halo2);   // secondo piano sottile, verticale: alone attorno alla lama
  const rest = { p: new THREE.Vector3(0.2, -0.2, -0.32), r: new THREE.Euler(0.55, 0.1, -0.35) };
  const setPose = (k, sw) => {   // sw: 0..1 del fendente
    hand.position.copy(rest.p); hand.position.y += Math.sin(k * 1.7) * 0.004; hand.rotation.set(rest.r.x, rest.r.y, rest.r.z);
    if (sw > 0) { const e = sw < 0.5 ? 2 * sw * sw : 1 - Math.pow(-2 * sw + 2, 2) / 2; hand.rotation.z = rest.r.z + 1.7 - e * 3.1; hand.rotation.x = rest.r.x - 0.3 * Math.sin(e * Math.PI); hand.position.x -= 0.18 * e - 0.05; }
  };
  // lampo bianco a schermo intero (figlio della camera)
  const flash = top(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }))); flash.position.z = -0.3; camera.add(flash);
  // ---- la suora ----
  const nun = new THREE.Group(); nun.visible = false; group.add(nun); let mixer = null, clips = {}, model = null, mats = [];
  B.load = () => B.loading ||= new GLTFLoader().loadAsync('assets/models/agnese/suor-agnese.glb').then((g) => {
    const m = g.scene; m.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false; for (const mt of [].concat(o.material)) mt.envMapIntensity = 0.15; });
    m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), sc = 1.95 / Math.max(0.001, b.max.y - b.min.y);
    m.scale.setScalar(sc); m.position.set(-c.x * sc, -b.min.y * sc, -c.z * sc); mixer = new THREE.AnimationMixer(m);
    for (const a of g.animations) clips[a.name] = mixer.clipAction(a);
    m.traverse((o) => { if (o.isMesh) { o.material = [].concat(o.material).map((mt) => { const k = mt.clone(); k.transparent = true; mats.push(k); return k; }); if (o.material.length === 1) o.material = o.material[0]; } });
    nun.add(m); model = m; B.ready = true;
  }).catch((e) => { console.warn('lama di luce: modello della suora non disponibile', e); B.failed = true; });
  // ---- fumo d'ombra ----
  const N = 70, smoke = { pos: new Float32Array(N * 3), vel: [], life: new Float32Array(N), pts: null };
  { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(smoke.pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: smokeTex, color: 0x000000, size: 0.8, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, fog: false })); pts.frustumCulled = false; pts.visible = false; group.add(pts); smoke.pts = pts;
    for (let i = 0; i < N; i++) smoke.vel.push(new THREE.Vector3()); }

  const dir = new THREE.Vector3(), fwd = new THREE.Vector3(), btn = () => document.getElementById('fire');
  let onKey = null, saved = null;
  const strike = () => {
    if (B.state !== 'wait' && B.state !== 'near') return;
    dir.set(nun.position.x - player.pos.x, 0, nun.position.z - player.pos.z); const d = dir.length(); dir.normalize(); fwd.set(player.forward.x, 0, player.forward.z).normalize();
    B.state = 'swing'; B.t = 0; B.hit = d < 3.6 && fwd.dot(dir) > 0.35; audio.swish?.();
  };
  const showBtn = (on) => { const b = btn(); if (!b) return; b.textContent = 'COLPISCI'; b.classList.toggle('hidden', !on); };
  B.start = async () => {
    if (B.active) return; B.active = true; B.state = 'loading'; B.t = 0; hand.visible = true; setPose(0, 0);
    saved = { c: warm.color.getHex(), i: warm.intensity }; warm.color.setHex(0x8fb4ff);
    onKey = (e) => { if (e.code === 'Space') strike(); }; addEventListener('keydown', onKey);
    const b = btn(); if (b) { B.onBtn = (e) => { e.preventDefault(); strike(); }; b.addEventListener('pointerdown', B.onBtn); }
    await B.load();
    if (B.failed) { B.state = 'end'; B.t = 2.5; return; }
    // la suora compare in fondo alla stanza, davanti a te
    nun.position.set(0, 0, player.pos.z - 9.5); nun.rotation.y = 0; nun.visible = true; for (const m of mats) { m.opacity = 1; m.color.setScalar(1); }
    nun.scale.set(1, 1, 1); clips.Idle?.stop(); clips.Apparition?.reset().setLoop(THREE.LoopOnce, 1).play(); if (clips.Apparition) clips.Apparition.clampWhenFinished = true;
    audio.swell?.(3, 0.5); say('Hai in mano una lama di luce.', 3000); B.state = 'come'; B.t = 0;
  };
  B.lightUp = (k) => { // la luce "warm" segue la punta della lama
    const v = new THREE.Vector3(0.15, -0.1, -0.7); camera.localToWorld(v); warm.position.copy(v); warm.intensity = 16 * k * (1 + Math.sin(performance.now() * 0.02) * 0.04);
  };
  let tAll = 0;
  B.update = (dt) => {
    if (!B.active) return; tAll += dt; B.t += dt; mixer?.update(dt);
    B.nunX = nun.position.x; B.nunZ = nun.position.z; const st = B.state;
    if (st === 'loading') { setPose(tAll, 0); B.lightUp(0.7); return; }
    if (st === 'come' || st === 'wait' || st === 'near') {
      // avanza fino a 2,4 m, poi si ferma e ti guarda
      dir.set(player.pos.x - nun.position.x, 0, player.pos.z - nun.position.z); const d = dir.length(); dir.normalize();
      nun.rotation.y = Math.atan2(dir.x, dir.z);
      if (d > 2.4 && B.t > 1.2) { const sp = Math.min(0.95, (d - 2.4) * 0.6 + 0.35); nun.position.addScaledVector(dir, sp * dt); }
      if (B.state === 'come' && B.t > 2.2) { B.state = 'wait'; if (clips.Idle) { clips.Idle.reset().play(); clips.Apparition?.crossFadeTo?.(clips.Idle, 0.5, false); } }
      const close = d < 5.5; showBtn(close);
      B.lightUp(close ? 1 : 0.7 + 0.3 * Math.max(0, 1 - (d - 5.5) / 5)); setPose(tAll, 0);
      halo.material.opacity = halo2.material.opacity = close ? 0.6 : 0.45;
      return;
    }
    if (st === 'swing') {
      const k = Math.min(1, B.t / 0.26); setPose(tAll, k); B.lightUp(1.6); showBtn(false);
      flash.material.opacity = Math.max(0, Math.sin(Math.min(1, Math.max(0, (B.t - 0.1) / 0.3)) * Math.PI)) * (B.hit ? 0.85 : 0.18);
      if (B.t >= 0.4) { if (B.hit) { B.state = 'dissolve'; B.t = 0; audio.swell?.(2.2, 0.55); audio.whisper?.(1.6, 0.18);
          smoke.pts.visible = true; smoke.pts.material.opacity = 0.8; for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.35;
            smoke.pos[i * 3] = nun.position.x + Math.cos(a) * r; smoke.pos[i * 3 + 1] = 0.2 + Math.random() * 1.7; smoke.pos[i * 3 + 2] = nun.position.z + Math.sin(a) * r;
            smoke.vel[i].set((Math.random() - 0.5) * 0.35, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.35); smoke.life[i] = 0.6 + Math.random() * 0.4; } }
        else { B.state = 'wait'; B.t = 1.5; say('Ancora troppo lontana.', 1400); } }
      return;
    }
    if (st === 'dissolve') {
      const k = Math.min(1, B.t / 2.4), e = k * k * (3 - 2 * k);
      for (const m of mats) { m.opacity = 1 - e; m.color.setScalar(1 - 0.85 * e); }
      nun.scale.set(1 - 0.5 * e, 1 + 0.18 * e, 1 - 0.5 * e);
      nun.position.y = 0.25 * e; nun.rotation.y += dt * (0.4 + e * 1.4);
      for (let i = 0; i < N; i++) { smoke.pos[i * 3] += smoke.vel[i].x * dt; smoke.pos[i * 3 + 1] += smoke.vel[i].y * dt; smoke.pos[i * 3 + 2] += smoke.vel[i].z * dt; }
      smoke.pts.geometry.attributes.position.needsUpdate = true; smoke.pts.material.opacity = 0.8 * (1 - Math.max(0, (k - 0.55) / 0.45));
      flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.6);
      setPose(tAll, 1); B.lightUp(1.2 - 0.6 * e);
      if (B.t >= 2.6) { nun.visible = false; smoke.pts.visible = false; B.state = 'end'; B.t = 0; }
      return;
    }
    if (st === 'end') {
      const k = Math.min(1, B.t / 1.6); hand.visible = B.t < 1.2; setPose(tAll, 1); halo.material.opacity = halo2.material.opacity = 1 - k; B.lightUp(1 - k);
      if (B.t > 0.5 && !B.said) { B.said = true; say('Svanita come un’ombra.', 2600); }
      if (B.t >= 3.2) { B.finish(); }
    }
  };
  B.finish = () => {
    if (!B.active) return; B.active = false; B.state = 'done'; hand.visible = false; showBtn(false);
    if (onKey) removeEventListener('keydown', onKey); const b = btn(); if (b && B.onBtn) b.removeEventListener('pointerdown', B.onBtn);
    if (saved) { warm.color.setHex(saved.c); warm.intensity = saved.i; }
    finish?.(text);
  };
  B.abort = () => { if (!B.active) return; B.active = false; hand.visible = false; nun.visible = false; smoke.pts.visible = false; showBtn(false); flash.material.opacity = 0; if (onKey) removeEventListener('keydown', onKey); const b = btn(); if (b && B.onBtn) b.removeEventListener('pointerdown', B.onBtn); if (saved) { warm.color.setHex(saved.c); warm.intensity = saved.i; } };
  return B;
}
