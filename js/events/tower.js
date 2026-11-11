// STANZA 3 — LA TORRE: calma apparente (stufa, mobili, sedia a rotelle) e la porta d'uscita. Qui si decide il finale:
//   specchio completato → C (esci)   ·   ti sei girato nella sala → B   ·   altrimenti → A.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';

export const TOWER = { z0: -300, w: 14, l: 18, h: 8.5 };
const TEXT = { A: 'non ti sei girato.\nera già davanti a te.', B: 'ti sei girato.\nlei non se n\'è mai andata.', C: 'sei uscito.\nlo specchio no.' };

export function createTower({ scene, mats, player, camera, audio, lights, instab, say, flags, scare, finish, warm, actBtn }) {
  const T = { group: new THREE.Group(), opened: false, near: false };
  T.group.visible = false; scene.add(T.group);
  const room = buildRoom(mats, { z0: TOWER.z0, w: TOWER.w, l: TOWER.l, h: TOWER.h, wall: 'stone', floor: 'floorA', ceil: 'brick', pillarEvery: 6, dark: 0.95, seed: 31 });
  T.group.add(room.group); T.bounds = [room.bounds[0], room.bounds[1], TOWER.z0 - TOWER.l + 1.6, TOWER.z0 - 0.6];
  const zFar = TOWER.z0 - TOWER.l, loader = new GLTFLoader();
  const stovePos = new THREE.Vector3(-2.4, 0, TOWER.z0 - 6.5);

  const prop = (url, h, x, z, ry, cb) => loader.load(url, (g) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x - x, b.min.y, c.z - z)); o.rotation.y = ry; T.group.add(o); cb?.(o); });
  prop('assets/models/stove.glb', 0.9, stovePos.x, stovePos.z, 0.4);
  prop('assets/models/stool.glb', 0.46, -1.0, TOWER.z0 - 6.9, 2.4);
  prop('assets/models/cabinet.glb', 1.15, 6.3, TOWER.z0 - 9, -Math.PI / 2);
  prop('assets/models/shelf.glb', 2.0, -6.4, TOWER.z0 - 12, Math.PI / 2);
  prop('assets/models/can.glb', 0.12, 2.8, TOWER.z0 - 4, 0.9);
  prop('assets/models/chair.glb', 1.0, 2.2, TOWER.z0 - 10.5, Math.PI, (o) => { T.chair = o; });

  // porta d'uscita con bagliore sotto
  const door = new THREE.Group(); door.position.set(0, 0, zFar + 0.15); T.group.add(door);
  let L = null, R = null;
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; L = m.getObjectByName('large_castle_door_left'); R = m.getObjectByName('large_castle_door_right'); L?.rotation.set(0, 0, 0); R?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; door.add(m); });
  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 128; const lg = lc.getContext('2d'); const gr = lg.createRadialGradient(128, 128, 4, 128, 128, 126); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); lg.fillStyle = gr; lg.fillRect(0, 0, 256, 128);
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), color: new THREE.Color(0.7, 0.8, 0.75), transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
  leak.rotation.x = -Math.PI / 2; leak.position.set(0, 0.03, zFar + 1.4); T.group.add(leak);
  const white = new THREE.Mesh(new THREE.PlaneGeometry(4, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 1.95), toneMapped: false, fog: false, transparent: true, opacity: 0 }));
  white.position.set(0, 2.1, zFar - 0.4); T.group.add(white);

  T.enter = () => {
    T.group.visible = true; T.opened = false; player.box = T.bounds; player.pos.set(0.3, 1.62, TOWER.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps([[0, 5.4, TOWER.z0 - 7], [0, 5.4, TOWER.z0 - 13]], 2.4); scene.fog.density = 0.04; audio.duck(1, 1.5); instab.set(0.05, 6);
    warm.position.set(stovePos.x + 0.1, 1.0, stovePos.z + 0.2); warm.intensity = 36;
  };
  T.leave = () => { T.group.visible = false; warm.intensity = 0; };

  const dv = new THREE.Vector3(), fw = new THREE.Vector3(), ep = new THREE.Vector3(); let wt = 0, open = 0, st = 'idle';
  T.update = (dt, time) => {
    if (!T.group.visible) return;
    wt += dt; warm.intensity = (36 + Math.sin(time * 9) * 3 + Math.sin(time * 23) * 1.6) * (st === 'idle' ? 1 : 0.5);
    // la sedia a rotelle si gira verso di te quando non la guardi
    if (T.chair) { ep.set(T.chair.position.x, 1, T.chair.position.z).project(camera); const seen = ep.z < 1 && Math.abs(ep.x) < 1.05;
      if (!seen) { const a = Math.atan2(player.pos.x - T.chair.position.x, player.pos.z - T.chair.position.z); T.chair.rotation.y += Math.atan2(Math.sin(a - T.chair.rotation.y), Math.cos(a - T.chair.rotation.y)) * Math.min(1, dt * 0.5); } }
    // pulsante contestuale vicino alla porta
    dv.set(0 - player.pos.x, 0, zFar - player.pos.z); const dd = dv.length(); dv.normalize(); fw.set(player.forward.x, 0, player.forward.z).normalize();
    const near = dd < 3.2 && fw.dot(dv) > 0.6 && st === 'idle'; if (near !== T.near) { T.near = near; actBtn.classList.toggle('hidden', !near); }
    if (st === 'opening') {
      open += dt; const a = Math.min(1.7, open * 0.7); if (L) L.rotation.y = a; if (R) R.rotation.y = -a;   // si aprono verso la luce
      white.material.opacity = Math.min(1, open / 2.4); leak.material.opacity = 1; player.pos.z -= Math.min(0.5, dt * 0.4) * (open > 1.4 ? 1 : 0);
      if (open > 3.4 && st !== 'end') { st = 'end'; finish(TEXT.C, false, true); }
    }
  };

  // APRI: il finale dipende dalle scelte
  T.open = () => {
    if (T.opened) return; T.opened = true; T.near = false; actBtn.classList.add('hidden');
    if (flags.mirror) { st = 'opening'; open = 0; player.frozen = true; instab.set(0, 10); audio.whisper(3.2, 0.3); say('', 1); return; }
    st = 'scare'; if (flags.turned) scare.trigger('behind', TEXT.B); else scare.trigger('ahead', TEXT.A);
  };
  return T;
}
