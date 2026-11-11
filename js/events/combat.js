// COMBATTIMENTO (non arcade): pistola compatta con 4 colpi, mira con zoom e sensibilità ridotta, rinculo, lampo che illumina
// la stanza per un istante. Il mostro si vede solo nei lampi e nel cono della torcia e avanza a scatti. I primi colpi lo
// fanno arretrare; finiti i 4 colpi (o dopo ~20 s di teletrasporti) scatta il jump scare finale e il combattimento è perso: è scritto così, ma non si capisce subito.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

const keepSingle = (root) => root.traverse((o) => { if (o.isMesh && /(_b$|magazine_empty|bullet)/.test(o.name)) o.visible = false; });   // il modello ha due versioni sovrapposte: ne tengo una
export function createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui }) {
  const K = { armed: false, active: false, ammo: 4, aim: 0, aiming: false, state: 'off', t: 0, hits: 0, D: 13, recoil: 0, kick: 0, held: false };
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
  K.begin = async (kind, text, from, limit = 20, calm = null, unarmed = false) => {
    K.limit = limit; K.calm = calm; K.unarmed = unarmed;   // unarmed: niente pistola, e dopo 1-2 teletrasporti scatta il jump scare K.canLower = false; K.lowered = false;   // secondi di teletrasporti prima del jump scare (dipende dalle scelte)
    K.kind = kind; K.text = text; K.active = true; K.state = 'fight'; K.t = 0; K.hits = 0; K.shots = 0; K.cool = 0; K.hide = 0; K.lat = 0; K.ammo = 4; K.D = 13; K.stepT = 1.5; K.said = false; K.turnedOnce = false;
    if (!K.armed && !unarmed) K.give();
    await K.setMonster(kind); K.from = from.clone(); K.M = { x: from.x, z: from.z }; K.Dt = null; K.wi = 1; K.sched = 0; K.walked = false; K.fin = false; K.finT = 0; K.side = 1;
    // PERCORSO PRESTABILITO, nel mondo (non dipende da dove sei né da dove guardi): zig-zag dall'ingresso verso il fondo della stanza
    K.W = [[0, 0], [-4, -3], [3.5, -5], [-3, -8], [2, -10.5], [-1, -12.5]].map(([dx, dz]) => ({ x: from.x + dx, z: from.z + dz }));           // punto da cui il mostro si avvicina (verso il giocatore)
    mon.visible = true; pose = 'ready'; player.speedMul = unarmed ? 1 : 0.55; player.lookMul = unarmed ? 1 : 0.8; if (!unarmed) ui.show(true);   // puoi camminare piano; per sparare devi fermarti instab.set(0.9, 60);
    audio.duck(0.3, 0.5);
  };
  // LA SUORA VIVE NEL MONDO: ha una posizione fissa nella stanza (K.M) che non dipende da dove guardi né dagli spostamenti dello schermo.
  // Cambia solo quando cammina (verso di te), quando si sposta di lato, o quando si teletrasporta in un punto prestabilito.
  const bounds = () => { const b = player.box; return b ? [b[0] + 0.5, b[1] - 0.5, b[2] + 0.5, b[3] - 0.5] : [-6, 6, -318, -302]; };
  const clampM = () => { const [x0, x1, z0, z1] = bounds(); K.M.x = Math.min(x1, Math.max(x0, K.M.x)); K.M.z = Math.min(z1, Math.max(z0, K.M.z)); };
  // punti prestabiliti: 12 direzioni fisse (ogni 30°) attorno al giocatore; scelgo tra quelle più vicine alla sua direzione di sguardo AL MOMENTO
  // del teletrasporto (tendenzialmente la vedi comparire), poi la posizione resta ferma nel mondo.
  const spot = (dist) => {
    const yaw = player.yaw, view = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));            // direzione di sguardo nel piano (x = cos, z = sin)
    const [x0, x1, z0, z1] = bounds(), cands = [];
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, px = Math.min(x1, Math.max(x0, player.pos.x + Math.cos(a) * dist)), pz = Math.min(z1, Math.max(z0, player.pos.z + Math.sin(a) * dist));
      const dEff = Math.hypot(px - player.pos.x, pz - player.pos.z), diff = Math.abs(Math.atan2(Math.sin(a - view), Math.cos(a - view)));
      if (dEff >= Math.min(dist * 0.8, dist - 0.4)) cands.push({ diff, px, pz });          // scarto i punti schiacciati contro i muri
    }
    cands.sort((u, v) => u.diff - v.diff); const pool = cands.filter((c) => c.diff < 0.8).slice(0, 3), use = pool.length ? pool : cands.slice(0, 3);
    const c = use[Math.floor(Math.random() * use.length)] ?? { px: K.M.x, pz: K.M.z }; K.M.x = c.px; K.M.z = c.pz; K.Dt = null;
  };
  const monPlace = () => {
    if (!K.M) return; const dx = player.pos.x - K.M.x, dz = player.pos.z - K.M.z; K.D = Math.hypot(dx, dz);
    mon.position.set(K.M.x, 0, K.M.z); mon.rotation.y = Math.atan2(dx, dz);                     // ti guarda sempre; se esce dallo schermo non importa
    K.axis = new THREE.Vector3(-dx, 0, -dz).normalize();
  };
  const HIDE = 0.6;   // durata del farfallio che copre il teletrasporto
  const SHOT_D = [9.8, 6.6, 3.9, 1.3];   // distanza dopo ogni colpo: sempre più vicina, qualunque cosa tu faccia

  // punto "fuori centro": a lato rispetto allo sguardo (30-65 gradi, di solito ai margini o fuori inquadratura), a distanza di sicurezza; alterna destra/sinistra
  const sidePoint = (dist) => {
    const view = Math.atan2(player.forward.z, player.forward.x), [x0, x1, z0, z1] = bounds(); let best = null;
    for (const sg of [K.side = -(K.side || 1), -K.side]) {
      const a = view + sg * (0.55 + Math.random() * 0.5), x = Math.min(x1, Math.max(x0, player.pos.x + Math.cos(a) * dist)), z = Math.min(z1, Math.max(z0, player.pos.z + Math.sin(a) * dist));
      const d = Math.hypot(x - player.pos.x, z - player.pos.z); if (!best || d > best.d + 0.8) best = { x, z, d };
    }
    return best;
  };
  // prossimo punto del percorso; finiti i punti prestabiliti, si sposta di lato a distanza (la chiusura finale avviene solo a colpi finiti)
  K.nextSpot = () => K.wi < K.W.length ? K.W[K.wi++] : sidePoint(5.5);
  K.startFlicker = (tgt) => { K.hide = HIDE; K.moved = false; K.tgt = tgt || K.nextSpot(); lights.torchStutter(HIDE); lights.lamp(0, 'flicker', HIDE); lights.lamp(1, 'flicker', HIDE); audio.lightOn?.(); };
  // JUMP SCARE FINALE: sfarfallio, compare davanti a te a ~5 m (nel buio), poi scatta addosso e sei morto. Nessuna fase intermedia.
  K.beginRush = () => {
    if (K.fin) return; K.fin = true; K.finT = 0; K.sched = 0; K.tx = null; const view = Math.atan2(player.forward.z, player.forward.x), [x0, x1, z0, z1] = bounds(); let pick = null;
    for (const da of [0, 0.3, -0.3, 0.6, -0.6]) {
      let d = 5.5, x, z; do { x = player.pos.x + Math.cos(view + da) * d; z = player.pos.z + Math.sin(view + da) * d; d -= 0.3; } while ((x < x0 || x > x1 || z < z0 || z > z1) && d > 1.5);
      const dd = Math.hypot(x - player.pos.x, z - player.pos.z); if (!pick || dd > pick.dd + 0.5) pick = { x, z, dd }; if (dd >= 4.5) break;
    }
    K.startFlicker({ x: Math.min(x1, Math.max(x0, pick.x)), z: Math.min(z1, Math.max(z0, pick.z)) });
  };
  K.fire = () => {
    if (!K.active || K.state !== 'fight' || !K.armed || K.cool > 0 || K.hide > 0) return;
    if (player.speedNow > 0.18) return;                    // non si spara camminando: molla il joystick, ti fermi, poi spari     // almeno 1 s tra un colpo e l'altro: niente raffica
    if (K.ammo <= 0) { audio.dry(); return; }
    K.ammo--; K.shots = (K.shots || 0) + 1; K.cool = 1.0; ui.cool?.(true); audio.shot(1); K.recoil += 0.055; K.kick = 1; player.pitch += 0.05; player.yaw += (Math.random() - 0.5) * 0.022; player.addShake(0.3);
    muzzle.material.opacity = 1; gunMats.forEach((m) => m.color.setRGB(0.55, 0.5, 0.45)); muzzle.rotation.z = Math.random() * 6; K.flashT = 0.07; flash.intensity = 160; flash.position.copy(camera.position).add(fwd.set(0, 0, -0.4).applyQuaternion(camera.quaternion));
    try { navigator.vibrate?.(30); } catch (_) {}
    // il colpo non la prende mai: nel lampo lei non c'è già più, e riappare più vicina in un altro punto
    K.idle = 0; K.sched = 0; instab.push(0.9, 3); K.tx = null; if (K.ammo <= 0) K.beginRush(); else K.startFlicker(sidePoint(Math.max(5, Math.min(8.5, K.D))));
  };
  // SCELTA FINALE (solo chi ha trovato tutte le note): ABBASSA LA PISTOLA. Smetti di combattere; lei arriva, lenta, senza jump scare. Quarto finale.
  K.lower = () => {
    if (!K.canLower || K.state !== 'fight') return; K.canLower = false; K.lowered = true; K.state = 'calm'; K.hide = 0; lights.override = null; pose = 'low'; ui.show(false); ui.cool?.(false);
    if (K.actBtn) K.actBtn.classList.add('hidden'); audio.duck(0.25, 1.2); K.cd0 = Math.max(1.5, K.D); K.stp = 0;
  };
  K.setAim = (on) => { K.aiming = on; };
  K.hideAll = () => { gun.visible = false; K.active = false; K.armed = false; mon.visible = false; muzzle.material.opacity = 0; ui.show(false); ui.aimAll?.(false); };

  K.update = (dt, time) => {
    // viewmodel (anche fuori dal combattimento: arma bassa)
    if (gun.visible) {
      K.aim = 0; K.moving = player.speedNow > 0.18; if (K.active && K.state === 'fight') { pose = K.moving ? 'low' : 'ready'; ui.cool?.(K.cool > 0 || K.moving); }   // niente mira: il puntino al centro dello schermo indica dove va il colpo
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
    if (K.state === 'fight' && K.calm && !K.fin && K.hide <= 0 && K.t > 3.5) { if (!K.canLower) { K.canLower = true; if (K.actBtn) { K.actBtn.textContent = 'ABBASSA LA PISTOLA'; K.actBtn.classList.remove('hidden'); } } }
    if (K.fin && K.canLower) { K.canLower = false; K.actBtn?.classList.add('hidden'); }
    if (K.state === 'calm') {
      // lei si avvicina piano e ti guarda; la torcia si spegne a poco a poco; nessun colpo, nessuno scatto
      monPlace(); const dx = player.pos.x - K.M.x, dz = player.pos.z - K.M.z, dd = Math.max(0.01, Math.hypot(dx, dz)), prog = 1 - Math.min(1, dd / K.cd0);
      K.M.x += dx / dd * Math.min(dd, 0.75 * dt); K.M.z += dz / dd * Math.min(dd, 0.75 * dt); K.stp += dt; if (K.stp > 1.15) { K.stp = 0; audio.heavyStep(mon.position, 0.7); }
      lights.override = 34 * (1 - 0.82 * prog); mon.visible = true; monPlace();
      if (K.D <= 1.3) { K.state = 'over'; K.hideAll(); lights.override = null; player.speedMul = 1; player.lookMul = 1; K.calm?.end?.(); }
      return;
    }
    if (K.state === 'fight') {
      // cadenza e teletrasporto
      if (K.cool > 0) K.cool -= dt;
      if (K.hide > 0) {
        // FARFALLIO: la luce sfarfalla a raffica; il mostro compare a tratti nel vecchio posto, c'è un vero buio di ~0.1 s in cui si sposta,
        // poi riappare a tratti nel nuovo posto. Non si vede mai il salto: si vede solo che, tra un guizzo e l'altro, è più vicino.
        K.hide -= dt; const el = HIDE - K.hide;
        if (el >= 0.26 && !K.moved) {
          K.moved = true; K.idle = 0; K.M.x = K.tgt.x; K.M.z = K.tgt.z; clampM(); K.walked = false; K.tx = null; K.sched = 0; audio.heavyStep(mon.position, 0.9);
        }
        monPlace();
        const dark = el > 0.2 && el < 0.34, strobe = Math.sin(el * 83) + Math.sin(el * 47 + 1) > -0.6;
        mon.visible = !dark && (el < 0.2 ? strobe : (el < 0.5 ? strobe : true));
        lights.override = dark ? 0 : (strobe ? null : 0.12 * 34);     // la torcia segue il guizzo; fuori dal farfallio torna normale
        if (K.hide <= 0) { mon.visible = true; lights.override = null; K.moved = false; monPlace(); }
      } else {
        if (K.fin) {
          // JUMP SCARE: nel buio quasi totale scatta addosso a te, velocissima; si vede solo una massa chiara che ingrandisce. Mai ferma in vista.
          K.finT += dt; lights.override = 3.5; const sp = 5 + 13 * Math.min(1, K.finT / 0.45), dx = player.pos.x - K.M.x, dz = player.pos.z - K.M.z, dd = Math.max(0.01, Math.hypot(dx, dz));
          K.M.x += dx / dd * Math.min(dd, sp * dt); K.M.z += dz / dd * Math.min(dd, sp * dt); K.stp = (K.stp || 0) + dt; if (K.stp > 0.22) { K.stp = 0; audio.heavyStep(mon.position, 1.1); player.addShake(0.25); }
          monPlace(); mon.visible = true;
        } else {
        if (K.t > K.limit) K.beginRush();   // sono passati 20 s di teletrasporti: jump scare
        // RITMO FISSO, anche se non spari: a 3 s fa un passo verso il punto successivo del percorso (si sente il tonfo); a 4.5 s la luce sfarfalla
        // e si sposta di colpo al punto seguente. Non dipende da te: puoi camminare, guardare dove vuoi, restare fermo.
        K.sched = (K.sched || 0) + dt; monPlace();
        if (K.sched >= 4.5) { K.sched = 0; K.walked = false; K.tx = null; K.startFlicker(); }
        monPlace(); mon.visible = true;
        }
      }
      // se non ti sei ancora girato
      fwd.set(player.forward.x, 0, player.forward.z); const facing = fwd.dot(K.axis ?? fwd) > 0.3;   // (K.axis = dal giocatore verso la creatura)
      K.turnedOnce ||= facing;
      if (!K.turnedOnce && K.t > 5 && !K.said) { K.said = true; say('girati.', 4500); }
      if (K.D <= 1.5 && !(K.hide > 0)) { K.state = 'over'; K.hideAll(); ui.cool?.(false); player.speedMul = 1; player.lookMul = 1; lights.override = null; scare.trigger(K.kind, K.text); }
    } else if (K.state === 'disarm') {
      // ti afferra la mano e ti strappa la pistola: l'arma vola via
      if (K.t < 0.02 && !K.knock) { K.knock = true; knocked = 0.0001; kv.set(0.5, 0.5, 0.3); audio.heavyStep(mon.position, 1.2); audio.clatter(); player.addShake(1.1); player.yaw += 0.35; player.pitch -= 0.25; pose = 'low'; lights.torchStutter(0.3); ui.show(false); try { navigator.vibrate?.([80, 30, 120]); } catch (_) {} }
      if (K.t > 1.0) { K.state = 'over'; K.active = false; mon.visible = false; player.speedMul = 1; player.lookMul = 1; lights.override = null; scare.trigger(K.kind, K.text); }
    }
  };
  return K;
}
