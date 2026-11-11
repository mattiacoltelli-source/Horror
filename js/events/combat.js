// COMBATTIMENTO (non arcade): pistola compatta con 6 colpi, mira con zoom e sensibilità ridotta, rinculo, lampo che illumina
// la stanza per un istante. Il mostro si vede solo nei lampi e nel cono della torcia e avanza a scatti. I primi colpi lo
// fanno arretrare; poi ti raggiunge, ti disarma e il combattimento è perso: è scritto così, ma non si capisce subito.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui }) {
  const K = { armed: false, active: false, ammo: 6, aim: 0, aiming: false, state: 'off', t: 0, hits: 0, D: 13, recoil: 0, kick: 0, held: false };
  const gun = new THREE.Group(); camera.add(gun); gun.visible = false;
  const holder = new THREE.Group(); gun.add(holder);
  new GLTFLoader().load('assets/models/pistol.glb', (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; o.material.metalness = Math.min(0.35, o.material.metalness ?? 0); o.material.roughness = 0.55; o.material.envMapIntensity = 1.2; o.material.side = THREE.DoubleSide; } });
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
    m.position.sub(c); m.rotation.y = Math.PI / 2; holder.scale.setScalar(0.72);           // canna verso -z
    holder.add(m); K.ready = true;
  }, undefined, (e) => console.warn('pistol', e));
  const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mg = mc.getContext('2d'); const rg = mg.createRadialGradient(64, 64, 2, 64, 64, 62); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.25, 'rgba(255,220,150,.9)'); rg.addColorStop(1, 'rgba(255,140,40,0)'); mg.fillStyle = rg; mg.fillRect(0, 0, 128, 128);
  const muzzle = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc), color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  muzzle.position.set(0, 0.025, -0.2); muzzle.renderOrder = 11; holder.add(muzzle);

  // il mostro
  const mon = new THREE.Group(); mon.visible = false; scene.add(mon); let monModel = null;
  K.setMonster = (kind) => new Promise((res) => new GLTFLoader().load(kind === 'behind' ? 'assets/models/c_nurse.glb' : 'assets/models/c_occ.glb', (g) => {
    if (monModel) mon.remove(monModel); const m = g.scene;
    m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.roughness = 0.9; o.material.metalness = 0; o.material.color?.multiplyScalar(0.6); o.material.emissive?.setRGB(0, 0, 0); } });
    const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    m.scale.setScalar((kind === 'behind' ? 1.95 : 2.15) / sz.y); b.setFromObject(m); m.position.set(-c.x, -b.min.y, -c.z); mon.add(m); monModel = m; res();
  }, undefined, () => res()));

  const poses = {   // posizioni dell'arma (relative alla camera)
    low: { p: [0.13, -0.24, -0.42], r: [-0.45, 0, 0.1] }, ready: { p: [0.09, -0.115, -0.45], r: [0, 0, 0.03] }, ads: { p: [0, -0.078, -0.36], r: [0, 0, 0] },
  };
  let pose = 'low', pz = new THREE.Vector3(...poses.low.p), pr = new THREE.Euler(...poses.low.r), knocked = 0, kv = new THREE.Vector3();
  K.give = () => { K.armed = true; gun.visible = true; pose = 'low'; };
  K.ammoLeft = () => K.ammo;

  const ray = new THREE.Ray(), pt = new THREE.Vector3(), dir = new THREE.Vector3(), fwd = new THREE.Vector3();
  const hitTest = () => {
    camera.getWorldPosition(ray.origin); camera.getWorldDirection(ray.direction);
    for (const y of [0.45, 0.9, 1.35, 1.75]) { pt.set(mon.position.x, y, mon.position.z); if (ray.distanceSqToPoint(pt) < 0.30 * 0.30 && pt.clone().sub(ray.origin).dot(ray.direction) > 0) return true; }
    return false;
  };

  K.mon = mon;
  K.begin = async (kind, text, from) => {
    K.kind = kind; K.text = text; K.active = true; K.state = 'fight'; K.t = 0; K.hits = 0; K.ammo = 6; K.D = 13; K.stepT = 1.5; K.said = false; K.turnedOnce = false;
    if (!K.armed) K.give();
    await K.setMonster(kind); K.from = from.clone();           // punto da cui il mostro si avvicina (verso il giocatore)
    mon.visible = true; pose = 'ready'; player.speedMul = 0; ui.show(true); instab.set(0.9, 60);
    audio.duck(0.3, 0.5);
  };
  const monPlace = () => { const d = new THREE.Vector3(player.pos.x - K.from.x, 0, player.pos.z - K.from.z).normalize(); mon.position.set(player.pos.x - d.x * K.D, 0, player.pos.z - d.z * K.D); mon.rotation.y = Math.atan2(d.x, d.z); K.axis = d; };

  K.fire = () => {
    if (!K.active || K.state !== 'fight' || !K.armed) return;
    if (K.ammo <= 0) { audio.dry(); return; }
    K.ammo--; audio.shot(1); K.recoil += 0.055; K.kick = 1; player.pitch += 0.05; player.yaw += (Math.random() - 0.5) * 0.022; player.addShake(0.3);
    muzzle.material.opacity = 1; muzzle.rotation.z = Math.random() * 6; K.flashT = 0.07; flash.intensity = 160; flash.position.copy(camera.position).add(fwd.set(0, 0, -0.4).applyQuaternion(camera.quaternion));
    try { navigator.vibrate?.(30); } catch (_) {}
    if (hitTest()) {
      K.hits++; instab.push(0.8, 3);
      if (K.hits <= 3) { K.D += 1.2; K.stepT = 2.2; }                    // incassa e arretra: sembra funzionare
      else { K.D -= 0.5; K.stepT = 0.6; }                                // dal quarto colpo non si ferma più
    } else { K.D -= 0.6; K.stepT = Math.min(K.stepT, 1.0); }
  };
  K.setAim = (on) => { K.aiming = on; };

  K.update = (dt, time) => {
    // viewmodel (anche fuori dal combattimento: arma bassa)
    if (gun.visible) {
      K.aim += ((K.aiming && K.active && K.state === 'fight' ? 1 : 0) - K.aim) * Math.min(1, dt * 9);
      const base = poses[pose]; const a = K.aim;
      const tp = pz.set(...base.p).lerp(new THREE.Vector3(...poses.ads.p), a);
      const sway = Math.sin(time * 1.7) * 0.002 * (1 - a * 0.7);
      K.kick = Math.max(0, K.kick - dt * 7);
      gun.position.set(tp.x + sway, tp.y + Math.cos(time * 1.3) * 0.0015, tp.z + K.kick * 0.05);
      gun.rotation.set(THREE.MathUtils.lerp(base.r[0], 0, a) + K.kick * 0.22, 0, base.r[2] * (1 - a));
      if (knocked > 0) { knocked += dt; kv.y -= dt * 9; gun.position.addScaledVector(kv, knocked); gun.rotation.z += dt * 9; if (knocked > 0.9) { gun.visible = false; knocked = 0; K.armed = false; } }
      if (K.flashT > 0) { K.flashT -= dt; if (K.flashT <= 0) muzzle.material.opacity = 0; }
      flash.intensity *= Math.pow(0.0005, dt);                          // il lampo svanisce in un attimo
      // mirare = più zoom e più precisione
      const baseFov = camera.userData.baseFov ?? 68; camera.fov += (baseFov - a * 14 - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix();
      player.lookMul = 1 - a * 0.55;
    }
    // recupero del rinculo
    if (K.recoil > 0) { const r = Math.min(K.recoil, dt * 0.25); K.recoil -= r; player.pitch -= r * 0.8; }
    if (!K.active) return;
    K.t += dt;
    if (K.state === 'fight') {
      // il mostro avanza a scatti (rumore di passi pesanti dietro di te)
      K.stepT -= dt;
      if (K.stepT <= 0) { K.D -= K.hits > 3 ? 1.2 : 0.9; K.stepT = K.hits > 3 ? 0.9 : 1.7 + Math.random() * 0.5; monPlace(); audio.heavyStep(mon.position, 1); }
      monPlace();
      mon.position.x += Math.sin(time * 2.2) * 0.03; mon.visible = K.D < 16;
      // se non ti sei ancora girato
      fwd.set(player.forward.x, 0, player.forward.z); const facing = fwd.dot(K.axis ? K.axis.clone().multiplyScalar(-1) : fwd) > 0.3;
      K.turnedOnce ||= facing;
      if (!K.turnedOnce && K.t > 5 && !K.said) { K.said = true; say('girati.', 4500); }
      if (K.D <= 1.5) { K.state = 'disarm'; K.t = 0; }
    } else if (K.state === 'disarm') {
      // ti afferra la mano e ti strappa la pistola: l'arma vola via
      if (K.t < 0.02 && !K.knock) { K.knock = true; knocked = 0.0001; kv.set(0.5, 0.5, 0.3); audio.heavyStep(mon.position, 1.2); audio.clatter(); player.addShake(1.1); player.yaw += 0.35; player.pitch -= 0.25; pose = 'low'; lights.torchStutter(0.3); ui.show(false); try { navigator.vibrate?.([80, 30, 120]); } catch (_) {} }
      if (K.t > 1.0) { K.state = 'over'; K.active = false; mon.visible = false; player.speedMul = 1; scare.trigger(K.kind, K.text); }
    }
  };
  return K;
}
