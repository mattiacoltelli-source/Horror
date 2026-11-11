// STANZA 3 — IL MAGAZZINO BRUCIATO: lunga sala di scaffali e pilastri. In fondo, su un carrello, una pistola e un caricatore.
// Prenderla cambia l'atmosfera: la luce se ne va, passi pesanti si avvicinano da dietro, poi si apre la porta d'uscita.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';
import { decorWarehouse } from '../world/decor.js';

export const WH = { z0: -400, w: 12, l: 36, h: 6.5 };

export function createWarehouse({ scene, mats, player, camera, audio, lights, instab, say, hall, combat, story, actBtn }) {
  const W = { group: new THREE.Group(), taken: false, state: 'idle', t: 0, near: false };
  W.group.visible = false; scene.add(W.group);
  const room = buildRoom(mats, { z0: WH.z0, w: WH.w, l: WH.l, h: WH.h, wall: 'brick', floor: 'floorB', ceil: 'stone', pillarEvery: 6, dark: 0.8, seed: 41 });
  W.group.add(room.group); decorWarehouse(W.group, WH.z0); W.bounds = [room.bounds[0], room.bounds[1], WH.z0 - WH.l + 1.5, WH.z0 - 0.6];
  const zFar = WH.z0 - WH.l, loader = new GLTFLoader();
  const prop = (url, h, x, y, z, ry, cb) => loader.load(url, (g) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x - x, b.min.y - y, c.z - z)); o.rotation.y = ry; W.group.add(o); cb?.(o); });

  // scaffali e cestini lungo i muri, un po' sparsi (non una fila perfetta)
  [-9, -13.5, -19, -24, -31, -33.5].forEach((dz, i) => { prop('assets/models/rack.glb', 1.9, i % 2 ? 5.2 : -5.2, 0, WH.z0 + dz - 0.4, (i % 2 ? -1 : 1) * Math.PI / 2 + (i % 3) * 0.05); });
  prop('assets/models/bin.glb', 0.9, -4.2, 0, WH.z0 - 5, 0.4); prop('assets/models/bin.glb', 0.9, 4.4, 0, WH.z0 - 21, 1.9); prop('assets/models/tank.glb', 0.55, -4.6, 0, WH.z0 - 28, 0.3);
  prop('assets/models/rim.glb', 0.5, 3.4, 0, WH.z0 - 12, 0.7); prop('assets/models/can.glb', 0.12, -2.1, 0, WH.z0 - 15, 1.1); prop('assets/models/stool.glb', 0.46, 1.8, 0, WH.z0 - 7.5, 0.2);
  // il carrello con la pistola e le munizioni
  const cartZ = WH.z0 - 26.5;
  prop('assets/models/cart.glb', 0.97, 0, 0, cartZ, Math.PI / 2);
  let pistol = null, ammo = null;
  prop('assets/models/pistol.glb', 0.13, 0.12, 0.97, cartZ + 0.15, 0.6, (o) => { o.rotation.x = -Math.PI / 2 + 0.0; pistol = o; });
  prop('assets/models/ammo.glb', 0.18, -0.2, 0.97, cartZ - 0.1, 0.3, (o) => { ammo = o; });
  // lampada sopra il carrello (è l'unica luce forte della sala)
  const lampPos = [[0, 5.6, WH.z0 - 6], [0, 5.6, WH.z0 - 16], [0, 4.2, cartZ]];
  loader.load('assets/models/lamp.glb', (g) => { for (const [x, y, z] of lampPos) { const o = g.scene.clone(true); const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(0.34 / (b.max.y - b.min.y)); b.setFromObject(o); o.position.set(x - (b.max.x + b.min.x) / 2, y - b.max.y, z); W.group.add(o); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 6.5 - y, 5), new THREE.MeshBasicMaterial({ color: 0 })); cord.position.set(x, y + (6.5 - y) / 2, z); W.group.add(cord); } });
  // porta d'uscita
  const door = new THREE.Group(); door.position.set(0, 0, zFar + 0.15); W.group.add(door); let L = null, R = null;
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; L = m.getObjectByName('large_castle_door_left'); R = m.getObjectByName('large_castle_door_right'); L?.rotation.set(0, 0, 0); R?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; door.add(m); });
  const shade = hall.silhouette(5); shade.visible = false; W.group.add(shade);

  W.enter = () => {
    W.group.visible = true; W.taken = false; W.state = 'walk'; W.t = 0; W.beat = false;
    player.box = W.bounds; player.pos.set(0.3, 1.62, WH.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos.slice(0, 2).concat([lampPos[2]]), 2.2); scene.fog.density = 0.032; audio.duck(1, 1.5); instab.set(0.08, 6);
  };
  W.leave = () => { W.group.visible = false; };

  const dv = new THREE.Vector3(), fw = new THREE.Vector3(), tmp = new THREE.Vector3(); let steps = 0, stepT = 0, doorT = 0;
  W.update = (dt) => {
    if (!W.group.visible) return; const P = player.pos; W.t += dt;
    // piccolo presagio a metà sala: sfarfallio e una sagoma lontana tra gli scaffali che sparisce
    if (!W.beat && P.z < WH.z0 - 12) { W.beat = true; lights.lamp(0, 'flicker', 1.2); lights.lamp(1, 'flicker', 1.2); shade.position.set(-4.4, 0, WH.z0 - 24); shade.rotation.y = 0.5; shade.visible = true; audio.whisper(1.8, 0.14); instab.push(0.7, 5); }
    if (shade.visible && P.z < WH.z0 - 18) { shade.visible = false; lights.lamp(0, 'flicker', 0.5); }
    // pulsante PRENDI vicino al carrello
    dv.set(0 - P.x, 0, cartZ - P.z); const dd = dv.length(); dv.normalize(); fw.set(player.forward.x, 0, player.forward.z).normalize();
    const near = !W.taken && dd < 2.1 && fw.dot(dv) > 0.5; if (near !== W.near) { W.near = near; actBtn.textContent = 'PRENDI'; actBtn.classList.toggle('hidden', !near); }
    if (W.state === 'taken') {
      // al buio: passi pesanti da dietro, sempre più vicini; poi la porta si apre
      steps += dt; stepT -= dt;
      if (stepT <= 0 && steps < 7.4) { stepT = 1.15; const k = steps / 7.4; fw.set(player.forward.x, 0, player.forward.z); const back = tmp.set(P.x, 0, P.z).addScaledVector(fw, -(15 - 10 * k)); audio.heavyStep(back, 0.6 + 0.5 * k); player.addShake(0.08 * k); }
      if (steps > 7.6 && W.state === 'taken') { W.state = 'open'; doorT = 0; lights.lamp(2, 'on'); lights.lamp(0, 'off'); lights.lamp(1, 'off'); }
    }
    if (W.state === 'open') { doorT += dt; const a = Math.min(1.5, doorT * 0.5); if (L) L.rotation.y = a; if (R) R.rotation.y = -a; }
    if (W.taken && W.state === 'open' && P.z < zFar + 2.4 && !W.leaving) { W.leaving = true; story.goto('tower'); }
  };

  W.take = () => {
    if (W.taken) return; W.taken = true; W.near = false; actBtn.classList.add('hidden'); W.leaving = false;
    if (pistol) pistol.visible = false; if (ammo) ammo.visible = false; combat.give(); audio.clatter(); instab.set(0.9, 12);
    // la luce se ne va; ti accorgi che non sei solo
    lights.lamp(0, 'off'); lights.lamp(1, 'off'); lights.lamp(2, 'flicker', 2.5); audio.duck(0.05, 0.4); steps = 0; stepT = 2.0; W.state = 'taken';
    setTimeout(() => lights.lamp(2, 'off'), 2500);
  };
  return W;
}
