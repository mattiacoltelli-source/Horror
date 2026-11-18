// FINALE ALTERNATIVO — L'ONDA DI PLASMA: si arriva nella torre dal portale della cripta con un nucleo di plasma in mano (accumulato attraversando le stelle).
// Suor Agnese compare in fondo alla stanza e avanza piano. Quando vuoi premi ONDA: il nucleo si carica, poi una sfera d'urto bianca esplode da te e attraversa la stanza.
// Dove passa, la suora evapora come un'ombra (fumo nero che sale, figura che si allunga e si assottiglia). Poi il finale.
// Nessuna luce in piu' nella scena: il nucleo e l'onda illuminano usando la luce "warm" della torre (numero di luci invariato, nessuna ricompilazione).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  r.addColorStop(0, 'rgba(235,245,255,1)'); r.addColorStop(0.25, 'rgba(140,190,255,.55)'); r.addColorStop(1, 'rgba(70,120,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(8,8,10,.9)'); r.addColorStop(0.5, 'rgba(10,10,14,.45)'); r.addColorStop(1, 'rgba(10,10,14,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export function createLightBlade({ group, camera, player, audio, say, warm, finish, z0, text }) {
  const B = { active: false, state: 'idle', t: 0, ready: false };
  const top = (m) => { m.renderOrder = 12; m.frustumCulled = false; return m; };
  // ---- il nucleo di plasma in mano (figlio della camera) ----
  const hand = new THREE.Group(); hand.visible = false; camera.add(hand);
  const coreMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uT: { value: 0 }, uK: { value: 0 } },
    vertexShader: 'varying vec3 vN, vV, vP; void main() { vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vN, vV, vP; uniform float uT, uK;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() { float fr = pow(1.0 - max(0.0, dot(normalize(vN), normalize(vV))), 2.2);
        vec3 q = vP * 38.0; float pl = n3(q + vec3(0.0, uT * 2.4, 0.0)) * 0.6 + n3(q * 2.1 - vec3(uT * 3.1, 0.0, uT)) * 0.4;
        float arc = smoothstep(0.62, 0.9, pl);
        vec3 col = mix(vec3(0.05, 0.18, 0.9), vec3(0.4, 0.8, 1.0), pl) * (0.5 + 0.9 * pl) * 0.95 + vec3(0.55, 0.8, 1.0) * fr * 0.9 + vec3(0.95, 0.98, 1.0) * arc * 0.55;
        col *= 0.85 + 0.3 * uK; gl_FragColor = vec4(min(col, vec3(0.95)), 0.9); }` });
  const core = top(new THREE.Mesh(new THREE.SphereGeometry(0.022, 28, 20), coreMat)); hand.add(core);
  const halo = top(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, opacity: 0.4 }))); halo.scale.setScalar(0.15); hand.add(halo);
  // scintille attorno al nucleo
  const NS = 26, sparkPos = new Float32Array(NS * 3), sparkSeed = Array.from({ length: NS }, () => [Math.random() * 6.28, Math.random() * 6.28, 0.07 + Math.random() * 0.1, 0.5 + Math.random() * 1.5]);
  const sparks = top(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)), new THREE.PointsMaterial({ map: glowTex, color: 0xbfe0ff, size: 0.03, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }))); hand.add(sparks);
  const rest = new THREE.Vector3(0.075, -0.115, -0.36);
  let charge = 0;
  const setPose = (k) => {
    hand.position.copy(rest); hand.position.y += Math.sin(k * 1.9) * 0.006; hand.position.x += Math.sin(k * 1.3) * 0.003;
    hand.position.lerp(new THREE.Vector3(0, -0.04, -0.42), Math.min(1, charge * 0.7));
    core.scale.setScalar((1 + 0.06 * Math.sin(k * 7) + charge * 1.5)); halo.scale.setScalar(0.15 + 0.015 * Math.sin(k * 5) + charge * 0.4);
    coreMat.uniforms.uT.value = k; coreMat.uniforms.uK.value = charge;
    for (let i = 0; i < NS; i++) { const [a, b, r, sp] = sparkSeed[i], rr = r * (1 + charge * 1.8), t = k * sp; sparkPos[i * 3] = Math.cos(a + t) * rr; sparkPos[i * 3 + 1] = Math.sin(b + t * 1.3) * rr; sparkPos[i * 3 + 2] = Math.sin(a + t) * rr * 0.8; }
    sparks.geometry.attributes.position.needsUpdate = true;
  };
  // lampo bianco a schermo intero (figlio della camera)
  const flash = top(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }))); flash.position.z = -0.3; camera.add(flash);
  // ---- la sfera d'urto (nel mondo) ----
  const waveMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uFade: { value: 0 }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vN, vV, vP; void main() { vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vN, vV, vP; uniform float uFade, uT;
      void main() { float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
        float band = 0.5 + 0.5 * sin(vP.y * 16.0 + uT * 14.0) * sin(vP.x * 11.0 - uT * 9.0);
        vec3 col = vec3(0.9, 0.96, 1.0) * (0.25 + 1.5 * fr) + vec3(0.4, 0.65, 1.0) * fr * band;
        gl_FragColor = vec4(col, (0.12 + 0.85 * fr) * uFade); }` });
  const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), waveMat); wave.visible = false; wave.frustumCulled = false; wave.renderOrder = 8; group.add(wave);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xdfeeff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.frustumCulled = false; group.add(ring);
  // ---- la suora ----
  const nun = new THREE.Group(); nun.visible = false; group.add(nun); let mixer = null, clips = {}, model = null, mats = [];
  B.load = () => B.loading ||= new GLTFLoader().loadAsync('assets/models/agnese/suor-agnese.glb').then((g) => {
    const m = g.scene; m.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false; for (const mt of [].concat(o.material)) mt.envMapIntensity = 0.15; });
    m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), sc = 1.95 / Math.max(0.001, b.max.y - b.min.y);
    m.scale.setScalar(sc); m.position.set(-c.x * sc, -b.min.y * sc, -c.z * sc); mixer = new THREE.AnimationMixer(m);
    for (const a of g.animations) clips[a.name] = mixer.clipAction(a);
    m.traverse((o) => { if (o.isMesh) { o.material = [].concat(o.material).map((mt) => { const k = mt.clone(); k.transparent = true; mats.push(k); return k; }); if (o.material.length === 1) o.material = o.material[0]; } });
    nun.add(m); model = m; B.ready = true;
  }).catch((e) => { console.warn('onda di plasma: modello della suora non disponibile', e); B.failed = true; });
  // ---- fumo d'ombra ----
  const N = 70, smoke = { pos: new Float32Array(N * 3), vel: [], life: new Float32Array(N), pts: null };
  { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(smoke.pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: smokeTex, color: 0x000000, size: 0.8, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, fog: false })); pts.frustumCulled = false; pts.visible = false; group.add(pts); smoke.pts = pts;
    for (let i = 0; i < N; i++) smoke.vel.push(new THREE.Vector3()); }

  const dir = new THREE.Vector3(), btn = () => document.getElementById('fire');
  let onKey = null, saved = null, waveO = new THREE.Vector3(), nunDist = 99, dis = -1, away = new THREE.Vector3();
  const release = () => {
    if (B.state !== 'wait') return;
    B.state = 'charge'; B.t = 0; audio.swell?.(1.4, 0.5); showBtn(false);
  };
  const showBtn = (on) => { const b = btn(); if (!b) return; b.textContent = 'ONDA'; b.classList.toggle('hidden', !on); };
  B.start = async () => {
    if (B.active) return; B.active = true; B.state = 'loading'; B.t = 0; charge = 0; hand.visible = true; setPose(0);
    saved = { c: warm.color.getHex(), i: warm.intensity }; warm.color.setHex(0x8fb4ff);
    onKey = (e) => { if (e.code === 'Space') release(); }; addEventListener('keydown', onKey);
    const b = btn(); if (b) { B.onBtn = (e) => { e.preventDefault(); release(); }; b.addEventListener('pointerdown', B.onBtn); }
    await B.load();
    if (B.failed) { B.state = 'end'; B.t = 2.5; return; }
    nun.position.set(0, 0, player.pos.z - 9.5); nun.rotation.y = 0; nun.visible = true; for (const m of mats) { m.opacity = 1; m.color.setScalar(1); }
    nun.scale.set(1, 1, 1); clips.Idle?.stop(); clips.Apparition?.reset().setLoop(THREE.LoopOnce, 1).play(); if (clips.Apparition) clips.Apparition.clampWhenFinished = true;
    audio.swell?.(3, 0.5); say('Hai accumulato potere al plasma.', 3200); B.state = 'come'; B.t = 0;
  };
  B.lightUp = (k) => { const v = new THREE.Vector3(0.1, -0.1, -0.5); camera.localToWorld(v); warm.position.copy(v); warm.intensity = 14 * k * (1 + Math.sin(performance.now() * 0.02) * 0.05); };
  let tAll = 0;
  const startDissolve = () => {
    dis = 0; audio.whisper?.(1.6, 0.18); smoke.pts.visible = true; smoke.pts.material.opacity = 0.8;
    away.set(nun.position.x - waveO.x, 0, nun.position.z - waveO.z).normalize();
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.random() * 0.35;
      smoke.pos[i * 3] = nun.position.x + Math.cos(a) * r; smoke.pos[i * 3 + 1] = 0.2 + Math.random() * 1.7; smoke.pos[i * 3 + 2] = nun.position.z + Math.sin(a) * r;
      smoke.vel[i].set((Math.random() - 0.5) * 0.35 + away.x * 0.4, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.35 + away.z * 0.4); }
  };
  B.update = (dt) => {
    if (!B.active) return; tAll += dt; B.t += dt; mixer?.update(dt);
    B.nunX = nun.position.x; B.nunZ = nun.position.z; const st = B.state;
    setPose(tAll);
    if (st === 'loading') { B.lightUp(0.7); return; }
    if (st === 'come' || st === 'wait') {
      dir.set(player.pos.x - nun.position.x, 0, player.pos.z - nun.position.z); const d = dir.length(); dir.normalize(); nunDist = d;
      nun.rotation.y = Math.atan2(dir.x, dir.z);
      if (d > 2.4 && B.t > 1.2) { const sp = Math.min(0.95, (d - 2.4) * 0.6 + 0.35); nun.position.addScaledVector(dir, sp * dt); }
      if (st === 'come' && B.t > 2.2) { B.state = 'wait'; if (clips.Idle) { clips.Idle.reset().play(); clips.Apparition?.crossFadeTo?.(clips.Idle, 0.5, false); } }
      showBtn(B.state === 'wait'); B.lightUp(0.8); return;
    }
    if (st === 'charge') {
      charge = Math.min(1, B.t / 0.55); B.lightUp(0.8 + charge * 2.4);
      flash.material.opacity = Math.max(0, (charge - 0.7) / 0.3) * 0.5;
      if (B.t >= 0.55) { B.state = 'wave'; B.t = 0; B.hit = false; waveO.copy(player.pos); waveO.y = 1.3; wave.position.copy(waveO); ring.position.set(waveO.x, 0.03, waveO.z); wave.visible = ring.visible = true; player.addShake?.(1.0); audio.swell?.(1.8, 0.7); audio.scare?.(); }
      return;
    }
    if (st === 'wave') {
      const k = Math.min(1, B.t / 1.25), e = 1 - Math.pow(1 - k, 2.6), r = 0.3 + 15.5 * e;
      wave.scale.setScalar(r); waveMat.uniforms.uFade.value = Math.pow(1 - k, 1.4); waveMat.uniforms.uT.value = tAll; ring.scale.setScalar(r * 1.0); ringMat.opacity = 0.9 * Math.pow(1 - k, 1.2);
      charge = Math.max(0, charge - dt * 2.2); flash.material.opacity = Math.max(0, 0.9 * (1 - B.t / 0.5)); B.lightUp(3.2 * (1 - k) + 0.6);
      if (!B.hit && r >= nunDist) { B.hit = true; startDissolve(); }
      if (B.t >= 1.3) { wave.visible = ring.visible = false; if (!B.hit) { B.hit = true; startDissolve(); } B.state = 'after'; B.t = 0; }
    }
    if (dis >= 0) {   // la suora evapora: trasparente, si assottiglia e si allunga, fumo nero che sale
      dis += dt; const k = Math.min(1, dis / 2.4), e = k * k * (3 - 2 * k);
      for (const m of mats) { m.opacity = 1 - e; m.color.setScalar(1 - 0.85 * e); }
      nun.scale.set(1 - 0.5 * e, 1 + 0.18 * e, 1 - 0.5 * e); nun.position.y = 0.25 * e; nun.position.addScaledVector(away, dt * 0.5 * (1 - e)); nun.rotation.y += dt * (0.4 + e * 1.4);
      for (let i = 0; i < N; i++) { smoke.pos[i * 3] += smoke.vel[i].x * dt; smoke.pos[i * 3 + 1] += smoke.vel[i].y * dt; smoke.pos[i * 3 + 2] += smoke.vel[i].z * dt; }
      smoke.pts.geometry.attributes.position.needsUpdate = true; smoke.pts.material.opacity = 0.8 * (1 - Math.max(0, (k - 0.55) / 0.45));
      if (dis >= 2.6) { nun.visible = false; smoke.pts.visible = false; dis = -2; }
    }
    if (st === 'after') { flash.material.opacity = Math.max(0, flash.material.opacity - dt * 2); charge = Math.max(0, charge - dt * 1.5); B.lightUp(0.6);
      if (dis === -2) { B.state = 'end'; B.t = 0; } }
    if (st === 'end') {
      const k = Math.min(1, B.t / 1.6); hand.visible = B.t < 1.2; charge = Math.max(0, charge - dt); halo.material.opacity = 0.4 * (1 - k); B.lightUp(1 - k);
      if (B.t > 0.5 && !B.said) { B.said = true; say('Svanita come un’ombra.', 2600); }
      if (B.t >= 3.2) B.finish();
    }
  };
  const cleanup = () => { hand.visible = false; showBtn(false); wave.visible = ring.visible = false; flash.material.opacity = 0; if (onKey) removeEventListener('keydown', onKey); const b = btn(); if (b && B.onBtn) b.removeEventListener('pointerdown', B.onBtn); if (saved) { warm.color.setHex(saved.c); warm.intensity = saved.i; } };
  B.finish = () => { if (!B.active) return; B.active = false; B.state = 'done'; cleanup(); finish?.(text); };
  B.abort = () => { if (!B.active) return; B.active = false; nun.visible = false; smoke.pts.visible = false; dis = -1; cleanup(); };
  return B;
}
