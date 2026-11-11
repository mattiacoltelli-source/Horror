// STANZA 3 — LA TORRE: calma apparente (stufa, mobili, sedia a rotelle) e la porta d'uscita. Qui si decide il finale:
//   specchio completato → C (esci)   ·   ti sei girato nella sala → B   ·   altrimenti → A.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';
import { decorTower } from '../world/decor.js';

export const TOWER = { z0: -300, w: 14, l: 18, h: 8.5 };
const TEXT = { A: 'non ti sei girato.\nera già davanti a te.\nnon volevi ricordare.', B: 'ti sei girato.\nlei non se n\'è mai andata.\nl\'incendio l\'hai acceso tu.', C: 'sei uscito.\nlo specchio no.\nuna parte di te è rimasta qui.', D: 'ricordi tutto.\nl\'incendio l\'hai acceso tu.\nresti con lei. l\'hai scelto tu.' };

export function createTower({ scene, mats, player, camera, audio, lights, instab, say, flags, scare, finish, warm, actBtn, combat }) {
  const T = { group: new THREE.Group(), opened: false, near: false };
  T.group.visible = false; scene.add(T.group);
  const room = buildRoom(mats, { z0: TOWER.z0, w: TOWER.w, l: TOWER.l, h: TOWER.h, wall: 'stone', floor: 'floorA', ceil: 'brick', pillarEvery: 6, dark: 0.95, seed: 31 });
  T.group.add(room.group); decorTower(T.group, TOWER.z0); T.bounds = [room.bounds[0], room.bounds[1], TOWER.z0 - TOWER.l + 1.6, TOWER.z0 - 0.6];
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
  { // l'oltre-porta è buio: sagoma ad arco nera davanti al muro, dietro i battenti (si vede solo oscurità, mai il muro)
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.95, 1.92); sh.absarc(0, 1.92, 0.95, 0, Math.PI, false); sh.lineTo(-0.95, 0);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    cap.position.set(0, 0, zFar + 0.05); cap.rotation.y = 0; T.group.add(cap);
  }

  loader.load('assets/models/gate.glb', (g) => { const o = g.scene; o.scale.setScalar(2.2); o.position.set(-0.08, 1.02, 0.13); o.rotation.y = Math.PI; door.add(o); });
  // luce che filtra sotto la porta: ventaglio morbido sul pavimento che sfuma su tutti i lati + sottile riga luminosa nella fessura
  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 128; const lg = lc.getContext('2d');
  const img = lg.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const u = (x - 128) / 128, v = y / 127;                                   // v=0 sotto la porta, v=1 lontano da essa
    const fan = Math.max(0, 1 - Math.hypot(u * (0.55 + v * 0.9), v * 1.05));    // si allarga allontanandosi
    const a = Math.pow(fan, 1.7) * Math.min(1, v * 14) * (1 - Math.pow(Math.abs(u), 3));
    const i = (y * 256 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
  }
  lg.putImageData(img, 0, 0);
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), color: new THREE.Color(0.55, 0.66, 0.6), transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
  leak.rotation.x = -Math.PI / 2; leak.rotation.z = Math.PI; leak.position.set(0, 0.015, zFar + 0.95); leak.visible = false;   // tolto: sembrava finto; resta la sola fessura
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.6, 1.5), toneMapped: false, fog: false, transparent: true, opacity: 0.22 }));
  gap.position.set(0, 0.012, zFar + 0.17); T.group.add(gap);
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
    wt += dt; warm.intensity = (36 + Math.sin(time * 9) * 3 + Math.sin(time * 23) * 1.6) * (st === 'idle' ? 1 : st === 'opening' ? 0.5 : 0.04);
    // CARROZZINA: quando non la guardi si gira verso di te; quando la guardi (dopo averla persa di vista) può avanzare di ~40 cm
    // piano, per circa un secondo, e si blocca con un cigolio. Al massimo 3 volte, con pause: resta un dubbio, non uno scherzo.
    if (T.chair) {
      const C = T.chair; T.chY ??= C.position.y; ep.set(C.position.x, 1, C.position.z).project(camera); const inView = ep.z < 1 && Math.abs(ep.x) < 0.6 && Math.abs(ep.y) < 0.9;
      const dxp = player.pos.x - C.position.x, dzp = player.pos.z - C.position.z, dist = Math.hypot(dxp, dzp);
      if (!inView) { T.chUnseen = (T.chUnseen || 0) + dt; const a = Math.atan2(dxp, dzp); C.rotation.y += Math.atan2(Math.sin(a - C.rotation.y), Math.cos(a - C.rotation.y)) * Math.min(1, dt * 0.5); }
      else if (!T.chMove && (T.chUnseen || 0) > 4 && (T.chCount || 0) < 3 && dist > 2.6 && dist < 11) { T.chMove = 1; T.chT = 0; T.chCount = (T.chCount || 0) + 1; T.chUnseen = 0; T.chFrom = C.position.clone(); T.chDir = new THREE.Vector3(dxp, 0, dzp).normalize(); }
      if (inView) T.chSeenT = (T.chSeenT || 0) + dt; else T.chSeenT = 0;
      if (T.chMove) {
        T.chT += dt; const k = Math.min(1, T.chT / 1.1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        C.position.copy(T.chFrom).addScaledVector(T.chDir, 0.42 * e); C.position.y = T.chY + Math.sin(T.chT * 38) * 0.003 * (1 - k);
        if (k >= 1) { T.chMove = 0; C.position.y = T.chY; audio.squeak(0.6, C.position); }
      }
    }
    // pulsante contestuale vicino alla porta
    dv.set(0 - player.pos.x, 0, zFar - player.pos.z); const dd = dv.length(); dv.normalize(); fw.set(player.forward.x, 0, player.forward.z).normalize();
    const near = dd < 3.2 && fw.dot(dv) > 0.6 && st === 'idle'; if (near !== T.near) { T.near = near; actBtn.textContent = 'APRI'; actBtn.classList.toggle('hidden', !near); }
    if (st === 'opening') {
      open += dt; const a = Math.min(1.7, open * 0.7); if (L) L.rotation.y = a; if (R) R.rotation.y = -a;   // si aprono verso la luce
      white.material.opacity = Math.min(1, open / 2.4); leak.visible = true; leak.material.opacity = 0.9; gap.material.opacity = 1; player.pos.z -= Math.min(0.5, dt * 0.4) * (open > 1.4 ? 1 : 0);
      if (open > 3.4 && st !== 'end') { st = 'end'; finish(TEXT.C, false, true); }
    }
  };

  // APRI: il finale dipende dalle scelte
  T.open = () => {
    if (T.opened) return; T.opened = true; T.near = false; actBtn.classList.add('hidden');
    if (flags.mirror) { st = 'opening'; open = 0; player.frozen = true; instab.set(0, 10); audio.whisper(3.2, 0.3); say('', 1); return; }
    // la porta è chiusa a chiave: dietro di te, nel buio, qualcosa entra nella stanza. Devi girarti.
    st = 'fight'; actBtn.classList.add('hidden'); audio.doorBang(new THREE.Vector3(0, 1.4, zFar), 0.7); player.addShake(0.5); lights.lamp(0, 'off'); lights.lamp(1, 'off'); audio.duck(0.15, 0.2);
    setTimeout(() => combat.begin(flags.turned ? 'behind' : 'ahead', flags.turned ? TEXT.B : TEXT.A, new THREE.Vector3(0, 0, TOWER.z0 - 1), (flags.turned ? 16 : 21) + ((flags.notes ?? 0) >= 5 ? 6 : 0), (flags.notes ?? 0) >= 5 ? { end: () => finish(TEXT.D) } : null), 1600);
  };
  return T;
}
