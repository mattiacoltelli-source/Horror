// COMBATTIMENTO (non arcade): pistola compatta con 6 colpi, mira con zoom e sensibilità ridotta, rinculo, lampo che illumina
// la stanza per un istante. Il mostro si vede solo nei lampi e nel cono della torcia e avanza a scatti. I primi colpi lo
// fanno arretrare; poi ti raggiunge, ti disarma e il combattimento è perso: è scritto così, ma non si capisce subito.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const keepSingle = (root) => root.traverse((o) => { if (o.isMesh && /(_b$|magazine_empty|bullet)/.test(o.name)) o.visible = false; });   // il modello ha due versioni sovrapposte: ne tengo una
export function createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui }) {
  const K = { armed: false, active: false, ammo: 6, aim: 0, aiming: false, state: 'off', t: 0, hits: 0, D: 13, recoil: 0, kick: 0, held: false };
  const gunMats = [];
  const gun = new THREE.Group(); camera.add(gun); gun.visible = false;
  const holder = new THREE.Group(); gun.add(holder);
  new GLTFLoader().load('assets/models/pistol.glb', (g) => {
    const m = g.scene; keepSingle(m); m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; const om = o.material; o.material = new THREE.MeshBasicMaterial({ map: om.map, color: new THREE.Color(0.17, 0.17, 0.18), side: THREE.DoubleSide, fog: false }); gunMats.push(o.material); } });
    // la torcia è a pochi centimetri dall'arma e la brucia (decadimento della luce): l'arma non è illuminata dalle luci ma ha un tono fisso, scuro come
    // l'acciaio brunito; si accende solo per un istante col lampo dello sparo (vedi K.fire / K.update)
    m.updateMatrixWorld(true); const b = new THREE.Box3(); m.traverse((o) => { if (o.isMesh && o.visible) b.expandByObject(o); }); const c = b.getCenter(new THREE.Vector3());
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
    K.kind = kind; K.text = text; K.active = true; K.state = 'fight'; K.t = 0; K.hits = 0; K.shots = 0; K.cool = 0; K.hide = 0; K.lat = 0; K.ammo = 4; K.D = 13; K.stepT = 1.5; K.said = false; K.turnedOnce = false;
    if (!K.armed) K.give();
    await K.setMonster(kind); K.from = from.clone();           // punto da cui il mostro si avvicina (verso il giocatore)
    mon.visible = true; pose = 'ready'; player.speedMul = 0; player.lookMul = 0.8; ui.aimAll?.(true); ui.show(true); instab.set(0.9, 60);
    audio.duck(0.3, 0.5);
  };
  const monPlace = () => { const d = new THREE.Vector3(player.pos.x - K.from.x, 0, player.pos.z - K.from.z).normalize(); const lat = K.lat || 0; mon.position.set(player.pos.x - d.x * K.D - d.z * lat, 0, player.pos.z - d.z * K.D + d.x * lat); mon.rotation.y = Math.atan2(d.x + (d.z * lat) / Math.max(1, K.D) * 0.0, d.z); K.axis = d; };
  const HIDE = 0.6;   // durata del farfallio che copre il teletrasporto
  const SHOT_D = [9.8, 6.6, 3.9, 1.3];   // distanza dopo ogni colpo: sempre più vicina, qualunque cosa tu faccia

  K.fire = () => {
    if (!K.active || K.state !== 'fight' || !K.armed || K.cool > 0 || K.hide > 0) return;     // almeno 1 s tra un colpo e l'altro: niente raffica
    if (K.ammo <= 0) { audio.dry(); return; }
    K.ammo--; K.shots = (K.shots || 0) + 1; K.cool = 1.0; ui.cool?.(true); audio.shot(1); K.recoil += 0.055; K.kick = 1; player.pitch += 0.05; player.yaw += (Math.random() - 0.5) * 0.022; player.addShake(0.3);
    muzzle.material.opacity = 1; gunMats.forEach((m) => m.color.setRGB(0.55, 0.5, 0.45)); muzzle.rotation.z = Math.random() * 6; K.flashT = 0.07; flash.intensity = 160; flash.position.copy(camera.position).add(fwd.set(0, 0, -0.4).applyQuaternion(camera.quaternion));
    try { navigator.vibrate?.(30); } catch (_) {}
    // il colpo non la prende mai: nel lampo lei non c'è già più, e riappare più vicina in un altro punto
    K.hide = HIDE; K.moved = false; instab.push(0.9, 3); lights.torchStutter(HIDE); lights.lamp(0, 'flicker', HIDE); lights.lamp(1, 'flicker', HIDE); audio.lightOn?.();
  };
  K.setAim = (on) => { K.aiming = on; };
  K.hideAll = () => { gun.visible = false; K.active = false; K.armed = false; mon.visible = false; muzzle.material.opacity = 0; ui.show(false); ui.aimAll?.(false); };

  K.update = (dt, time) => {
    // viewmodel (anche fuori dal combattimento: arma bassa)
    if (gun.visible) {
      K.aim = 0;   // niente mira: il puntino al centro dello schermo indica dove va il colpo
      const base = poses[pose]; const a = K.aim;
      const tp = pz.set(...base.p).lerp(new THREE.Vector3(...poses.ads.p), a);
      const sway = Math.sin(time * 1.7) * 0.002 * (1 - a * 0.7);
      K.kick = Math.max(0, K.kick - dt * 7);
      gun.position.set(tp.x + sway, tp.y + Math.cos(time * 1.3) * 0.0015, tp.z + K.kick * 0.05);
      gun.rotation.set(THREE.MathUtils.lerp(base.r[0], 0, a) + K.kick * 0.22, 0, base.r[2] * (1 - a));
      if (knocked > 0) { knocked += dt; kv.y -= dt * 9; gun.position.addScaledVector(kv, knocked); gun.rotation.z += dt * 9; if (knocked > 0.9) { gun.visible = false; knocked = 0; K.armed = false; } }
      if (K.flashT > 0) { K.flashT -= dt; if (K.flashT <= 0) muzzle.material.opacity = 0; }
      gunMats.forEach((m) => { m.color.r += (0.17 - m.color.r) * Math.min(1, dt * 9); m.color.g += (0.17 - m.color.g) * Math.min(1, dt * 9); m.color.b += (0.18 - m.color.b) * Math.min(1, dt * 9); });
      flash.intensity *= Math.pow(0.0005, dt);                          // il lampo svanisce in un attimo
      // mirare = più zoom e più precisione
      const baseFov = camera.userData.baseFov ?? 68; camera.fov += (baseFov - a * 14 - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix();
      if (!K.active) player.lookMul = 1;
    }
    // recupero del rinculo
    if (K.recoil > 0) { const r = Math.min(K.recoil, dt * 0.25); K.recoil -= r; player.pitch -= r * 0.8; }
    if (!K.active) return;
    K.t += dt;
    if (K.state === 'fight') {
      // cadenza e teletrasporto
      if (K.cool > 0) { K.cool -= dt; if (K.cool <= 0) ui.cool?.(false); }
      if (K.hide > 0) {
        // FARFALLIO: la luce sfarfalla a raffica; il mostro compare a tratti nel vecchio posto, c'è un vero buio di ~0.1 s in cui si sposta,
        // poi riappare a tratti nel nuovo posto. Non si vede mai il salto: si vede solo che, tra un guizzo e l'altro, è più vicino.
        K.hide -= dt; const el = HIDE - K.hide;
        if (el >= 0.26 && !K.moved) {
          K.moved = true; K.D = Math.min(K.D, SHOT_D[Math.min(3, K.shots - 1)]); K.lat = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.1) * Math.min(1, K.D / 6); K.stepT = 1.6 + Math.random() * 0.5; audio.heavyStep(mon.position, 0.9);
        }
        monPlace();
        const dark = el > 0.2 && el < 0.34, strobe = Math.sin(el * 83) + Math.sin(el * 47 + 1) > -0.6;
        mon.visible = !dark && (el < 0.2 ? strobe : (el < 0.5 ? strobe : true));
        lights.override = dark ? 0 : (strobe ? null : 0.12 * 34);     // la torcia segue il guizzo; fuori dal farfallio torna normale
        if (K.hide <= 0) { mon.visible = true; lights.override = null; K.moved = false; monPlace(); }
      } else {
        // fra un colpo e l'altro avanza lentamente a scatti (passi pesanti dietro di te) e si ferma
        K.stepT -= dt;
        if (K.stepT <= 0) { K.D -= 0.5; K.lat *= 0.8; K.stepT = 1.9 + Math.random() * 0.6; monPlace(); audio.heavyStep(mon.position, 1); }
        monPlace(); mon.position.x += Math.sin(time * 2.2) * 0.02; mon.visible = K.D < 16;
      }
      // se non ti sei ancora girato
      fwd.set(player.forward.x, 0, player.forward.z); const facing = fwd.dot(K.axis ? K.axis.clone().multiplyScalar(-1) : fwd) > 0.3;
      K.turnedOnce ||= facing;
      if (!K.turnedOnce && K.t > 5 && !K.said) { K.said = true; say('girati.', 4500); }
      if (K.D <= 1.5 && !(K.hide > 0)) { K.state = 'disarm'; K.t = 0; ui.cool?.(false); }
    } else if (K.state === 'disarm') {
      // ti afferra la mano e ti strappa la pistola: l'arma vola via
      if (K.t < 0.02 && !K.knock) { K.knock = true; knocked = 0.0001; kv.set(0.5, 0.5, 0.3); audio.heavyStep(mon.position, 1.2); audio.clatter(); player.addShake(1.1); player.yaw += 0.35; player.pitch -= 0.25; pose = 'low'; lights.torchStutter(0.3); ui.show(false); try { navigator.vibrate?.([80, 30, 120]); } catch (_) {} }
      if (K.t > 1.0) { K.state = 'over'; K.active = false; mon.visible = false; player.speedMul = 1; player.lookMul = 1; ui.aimAll?.(false); scare.trigger(K.kind, K.text); }
    }
  };
  return K;
}
