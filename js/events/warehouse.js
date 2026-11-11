// STANZA 3 — IL MAGAZZINO BRUCIATO: lunga sala di scaffali e pilastri. In fondo, su un carrello, una pistola e un caricatore.
// Prenderla cambia l'atmosfera: la luce se ne va, passi pesanti si avvicinano da dietro, poi si apre la porta d'uscita.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';
import { kitMesh, kitObject } from '../world/props.js';
import { decorWarehouse } from '../world/decor.js';
import { unseenMover } from './ambient.js';
import { redLight, doorGlow } from '../world/redlight.js';

export const WH = { z0: -400, w: 12, l: 36, h: 6.5 };

export function createWarehouse({ scene, mats, player, camera, audio, lights, instab, say, hall, combat, story, flags = {}, actBtn }) {
  const W = { group: new THREE.Group(), taken: false, state: 'idle', t: 0, near: false };
  W.group.visible = false; scene.add(W.group);
  const room = buildRoom(mats, { z0: WH.z0, w: WH.w, l: WH.l, h: WH.h, wall: 'brick', floor: 'floorB', ceil: 'stone', pillarEvery: 6, dark: 0.8, seed: 41 });
  W.group.add(room.group); const entry = decorWarehouse(W.group, WH.z0); W.bounds = [room.bounds[0], room.bounds[1], WH.z0 - WH.l + 1.5, WH.z0 - 0.6];
  const zFar = WH.z0 - WH.l, loader = new GLTFLoader();
  const prop = (url, h, x, y, z, ry, cb) => loader.load(url, (g) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x - x, b.min.y - y, c.z - z)); o.rotation.y = ry; W.group.add(o); cb?.(o); });

  // scaffali e cestini lungo i muri, un po' sparsi (non una fila perfetta)
  [-9, -13.5, -19, -24, -31, -33.5].forEach((dz, i) => { prop('assets/models/rack.glb', 1.9, i % 2 ? 5.2 : -5.2, 0, WH.z0 + dz - 0.4, (i % 2 ? -1 : 1) * Math.PI / 2 + (i % 3) * 0.05); });
  prop('assets/models/bin.glb', 0.9, -4.2, 0, WH.z0 - 5, 0.4); prop('assets/models/bin.glb', 0.9, 4.4, 0, WH.z0 - 21, 1.9); prop('assets/models/tank.glb', 0.55, -4.6, 0, WH.z0 - 28, 0.3);
  prop('assets/models/rim.glb', 0.5, 3.4, 0, WH.z0 - 12, 0.7); prop('assets/models/can.glb', 0.12, -2.1, 0, WH.z0 - 15, 1.1); prop('assets/models/stool.glb', 0.46, 1.8, 0, WH.z0 - 7.5, 0.2, (o) => { W.stool = o; });
  // lo sgabello, quando non lo guardi, si sposta verso il centro della sala (al massimo 2 volte)
  const stoolMove = unseenMover({ camera, getObj: () => W.stool, max: 2, gap: 8, move: () => { W.stool.position.x -= 0.5; W.stool.position.z -= 0.45; W.stool.rotation.y += 0.7; audio.squeak?.(0.4, W.stool.position.clone()); } });
  // il carrello con la pistola e le munizioni
  const cartZ = WH.z0 - 26.5;
  prop('assets/models/cart.glb', 0.97, 0, 0, cartZ, Math.PI / 2);
  let pistol = null, ammo = null;
  prop('assets/models/pistol.glb', 0.13, 0.12, 0.97, cartZ + 0.15, 0.6, (o) => { o.traverse((m) => { if (m.isMesh && /(_b$|magazine_empty|bullet)/.test(m.name)) m.visible = false; if (m.isMesh && m.visible) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.18); m.material.metalnessMap = null; m.material.metalness = 0.2; m.material.roughnessMap = null; m.material.roughness = 0.7; } }); o.rotation.x = -Math.PI / 2 + 0.0; pistol = o; });
  prop('assets/models/ammo.glb', 0.18, -0.2, 0.97, cartZ - 0.1, 0.3, (o) => { ammo = o; });
  // lampada sopra il carrello (è l'unica luce forte della sala)
  const lampPos = [[0, 5.0, WH.z0 - 6], [0, 5.0, WH.z0 - 16], [0, 5.0, cartZ], [5.5, 3.9, WH.z0 - 22]];   // l'ultima: faro con sensore di movimento
  loader.load('assets/models/hlamp.glb', (g) => { for (const [x, , z] of lampPos.slice(0, 3)) { const o = g.scene.clone(true); o.position.set(x, WH.h, z); W.group.add(o); } });
  // faro di sicurezza con sensore (si accende da solo quando passi, poi si spegne)
  let sec = null; const secMats = [];
  loader.load('assets/models/seclight.glb', (g) => { sec = g.scene; sec.position.set(5.85, 4.1, WH.z0 - 22); sec.rotation.y = Math.PI / 2; sec.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material = m.material.clone(); m.material.emissive.set(0xdfe8d8); secMats.push(m.material); } }); W.group.add(sec); });
  // lampade a muro industriali lungo le pareti
  [[-5.85, -8, Math.PI / 2], [5.85, -18, -Math.PI / 2], [-5.85, -24, Math.PI / 2], [5.85, -31, -Math.PI / 2]].forEach(([x, dz, ry]) => prop('assets/models/wlamp.glb', 0.43, x, 2.7, WH.z0 + dz, ry));
  // porta d'uscita
  const door = new THREE.Group(); door.position.set(0, 0, zFar + 0.15); W.group.add(door); let L = null, R = null;
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; L = m.getObjectByName('large_castle_door_left'); R = m.getObjectByName('large_castle_door_right'); L?.rotation.set(0, 0, 0); R?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; door.add(m); });
  { // l'oltre-porta è buio: sagoma ad arco nera davanti al muro, dietro i battenti (si vede solo oscurità, mai il muro)
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.95, 1.92); sh.absarc(0, 1.92, 0.95, 0, Math.PI, false); sh.lineTo(-0.95, 0);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    cap.position.set(0, 0, zFar + 0.05); cap.rotation.y = 0; W.group.add(cap);
  }

  // cancello a rete con chiavistello: sbarra la sala prima della porta; si sblocca quando hai preso la pistola
  const gz = zFar + 6.5, gate = new THREE.Group(); gate.position.set(0, 0, gz); W.group.add(gate); let leaf = null;
  W.box = [W.bounds[0], W.bounds[1], gz + 0.5, W.bounds[3]];
  (async () => {
    const frame = await kitObject('fence', 'Cylinder184'); if (frame) { frame.position.set(0, 1.26, 0); gate.add(frame); }
    const lf = await kitObject('fence', 'Cylinder140');
    if (lf) { leaf = new THREE.Group(); leaf.position.set(-0.45, 0, 0); lf.position.set(0.47, 0.93, 0); leaf.add(lf); gate.add(leaf);
      const parts = await Promise.all(['gate_latch_01_frame', 'gate_latch_01_latch', 'gate_latch_01_hook'].map(() => null)); }
    new GLTFLoader().load('assets/models/gate.glb', (g) => { const o = g.scene; o.scale.setScalar(1.7); o.position.set(0.9, 0.95, 0.05); (leaf || gate).add(o); });
    // recinzione CONTINUA dai bordi del cancello fino ai muri laterali (nessun varco): pannelli da 1.91 m che partono esattamente dal telaio (±0.955)
    const side = []; for (const sx of [-1, 1]) { for (let x = 0.955 + 0.955; x < 6.4; x += 1.91) side.push({ n: 'Plane020', p: [sx * x, 1.19, 0], r: [0, 0, 0] }); for (let x = 0.955; x < 6.1; x += 1.91) side.push({ n: 'post', p: [sx * x, 1.26, 0], r: [0, 0, 0] }); }
    const m = await kitMesh('fence', side); if (m) { m.position.z = gz; m.traverse((o) => { o.userData.decor = true; }); W.group.add(m); }
  })();
  // porta ROSSA (scelta nell'obitorio): luce d'emergenza rossa, due lampade rosse alle pareti; porta del RESPIRO: luce fredda normale, ma ogni tanto un respiro dietro di te
  const reds = [redLight(W.group, { x: WH.w / 2 - 0.1, y: 2.9, z: WH.z0 - 11, dir: 1 }), redLight(W.group, { x: -WH.w / 2 + 0.1, y: 2.9, z: WH.z0 - 27, dir: -1 })]; reds.forEach((r) => (r.root.visible = false));
  // entrando dal CANCELLO ROSSO, alle spalle trovi il cancello (non la porta di legno): chiuso, con il chiavistello e un po' di rosso dietro
  const gateIn = new THREE.Group(); gateIn.position.set(0, 0, WH.z0 - 0.22); gateIn.rotation.y = Math.PI; gateIn.visible = false; W.group.add(gateIn);
  { const back = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 2.95), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); back.position.set(0, 1.5, -0.09); gateIn.add(back); }
  const inGlow = doorGlow(gateIn, { x: 0, z: -0.06, w: 2.2, h: 2.8 });
  (async () => {
    const fr = await kitObject('fence', 'Cylinder184'); if (fr) { fr.position.set(0, 1.26, 0); gateIn.add(fr); }
    const lf2 = await kitObject('fence', 'Cylinder140'); let lf3 = null; if (lf2) { lf3 = new THREE.Group(); lf3.position.set(-0.45, 0, 0); lf2.position.set(0.47, 0.93, 0); lf3.add(lf2); gateIn.add(lf3); }
    new GLTFLoader().load('assets/models/gate.glb', (g) => { const o = g.scene; o.scale.setScalar(1.7); o.position.set(0.9, 0.95, 0.05); (lf3 || gateIn).add(o); });
  })();
  let gateT = 0;
  const shade = hall.silhouette(5); shade.visible = false; W.group.add(shade);

  W.enter = () => {
    W.group.visible = true; W.taken = false; W.state = 'walk'; W.t = 0; W.beat = false; gateT = 0; if (leaf) leaf.rotation.y = 0;
    player.box = W.box; player.pos.set(0.3, 1.62, WH.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    const red = flags.door === 'red'; lights.setLamps(lampPos, red ? 1.7 : 2.2, red ? 0xff5a44 : 0xaec8ff); reds.forEach((r) => (r.root.visible = red)); W.nearGate = false; W.red = red; entry.visible = !red; gateIn.visible = red; W.br = 6 + Math.random() * 4; W.brN = 0; lights.lamp(3, 'off'); W.sec = 0; scene.fog.density = 0.032; audio.duck(1, 1.5); instab.set(0.08, 6);
  };
  W.leave = () => { W.group.visible = false; };

  const dv = new THREE.Vector3(), fw = new THREE.Vector3(), tmp = new THREE.Vector3(); let steps = 0, stepT = 0, doorT = 0; const STEPS = flags.turned ? 5.6 : 7.4;   // chi si e' girato ha meno tempo prima che arrivi
  W.update = (dt) => {
    if (!W.group.visible) return; const P = player.pos; W.t += dt;
    // faro con sensore: passi nel suo raggio e si accende con un tonfo; qualcuno è già lì, fermo, nella luce. Poi si spegne.
    if (W.sec === 0 && P.z < WH.z0 - 12) { W.sec = 1; W.secT = 0; lights.lamp(3, 'flicker', 0.5); shade.position.set(flags.turned ? 2.5 : 3.6, 0, WH.z0 - 22.5); shade.rotation.y = Math.PI / 2 + 0.2; shade.visible = true; audio.lightOn(); audio.whisper(1.6, 0.12); instab.push(0.7, 5); player.addShake(0.15); }
    if (W.sec === 1) { W.secT += dt; secMats.forEach((m) => (m.emissiveIntensity = 2.2 * (lights.lamps[3]?.level ?? 0)));
      if (W.secT > 0.55 && W.secT < 0.6) lights.lamp(3, 'on');
      if ((W.secT > 4.2 || P.z < WH.z0 - 19) && W.secT > 1.2) { W.sec = 2; shade.visible = false; lights.lamp(3, 'off'); audio.lightOn(); secMats.forEach((m) => (m.emissiveIntensity = 0)); } }
    stoolMove(dt, W.state === 'walk');
    if (W.red) { reds.forEach((r) => r.update(dt)); inGlow.update(dt); }
    else if (W.state === 'walk' && W.brN < 4) { W.br -= dt; if (W.br <= 0) { W.br = 11 + Math.random() * 6; W.brN++; audio.breath?.(); } }   // il respiro dietro la porta scelta ti ha seguito
    // pulsante PRENDI vicino al carrello
    dv.set(0 - P.x, 0, cartZ - P.z); const dd = dv.length(); dv.normalize(); fw.set(player.forward.x, 0, player.forward.z).normalize();
    const near = !W.taken && dd < 2.1 && fw.dot(dv) > 0.5; if (near !== W.near) { W.near = near; actBtn.textContent = 'PRENDI'; actBtn.classList.toggle('hidden', !near); }
    if (W.state === 'taken') {
      // al buio: passi pesanti da dietro, sempre più vicini; poi la porta si apre
      steps += dt; stepT -= dt;
      if (stepT <= 0 && steps < STEPS) { stepT = 1.15; const k = steps / STEPS; fw.set(player.forward.x, 0, player.forward.z); const back = tmp.set(P.x, 0, P.z).addScaledVector(fw, -(15 - 10 * k)); audio.heavyStep(back, 0.6 + 0.5 * k); player.addShake(0.08 * k); }
      if (steps > STEPS + 0.2 && W.state === 'taken') { W.state = 'ready'; doorT = 0; lights.lamp(2, 'on'); lights.lamp(0, 'off'); lights.lamp(1, 'off'); }   // il cancello ora si apre con APRI
    }
    if (W.state === 'ready') {   // vicino al cancello: APRI (come le altre porte)
      const ng = Math.abs(P.x) < 1.7 && Math.abs(P.z - gz) < 2.8 && player.forward.z < -0.35; if (ng !== W.nearGate) { W.nearGate = ng; actBtn.textContent = 'APRI'; actBtn.classList.toggle('hidden', !ng); }
    }
    if (W.state === 'open') { if (gateT === 0) { audio.clatter(); player.box = W.bounds; } gateT += dt; if (leaf) leaf.rotation.y = -Math.min(1.7, gateT * 1.1); doorT += dt; const a = Math.min(1.5, doorT * 0.5); if (L) L.rotation.y = a; if (R) R.rotation.y = -a; }
    if (W.taken && W.state === 'open' && P.z < zFar + 2.4 && !W.leaving) { W.leaving = true; story.goto('tower'); }
  };

  W.openGate = () => { if (W.state !== 'ready') return; W.state = 'open'; W.nearGate = false; actBtn.classList.add('hidden'); };
  W.take = () => {
    if (W.taken) return; W.taken = true; W.near = false; actBtn.classList.add('hidden'); W.leaving = false;
    if (pistol) pistol.visible = false; if (ammo) ammo.visible = false; combat.give(); audio.clatter(); instab.set(0.9, 12);
    // la luce se ne va; ti accorgi che non sei solo
    lights.lamp(0, 'off'); lights.lamp(1, 'off'); lights.lamp(2, 'flicker', 2.5); audio.duck(0.05, 0.4); steps = 0; stepT = 2.0; W.state = 'taken';
    setTimeout(() => lights.lamp(2, 'off'), 2500);
  };
  return W;
}
