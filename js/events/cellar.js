// STANZA 2 — LA CANTINA: lo specchio impossibile (EVENTO 2) e l'apparizione improvvisa (EVENTO 3, primo spavento).
// Specchio: planare reale (Reflector) a bassa risoluzione, renderizzato solo se in vista. La figura "dietro di te" esiste
// solo mentre guardi lo specchio: ogni volta che distogli lo sguardo e torni, è più vicina.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Reflector } from '../../vendor/three/Reflector.js';
import { buildRoom } from '../world/rooms.js';

export const CELLAR = { z0: -200, w: 8, l: 24, h: 4.4 };
const MIRROR = new THREE.Vector3(-3.98, 1.45, -210);
const DIST = [7, 4.6, 2.6, 1.3, 0.7];

export function createCellar({ scene, mats, player, camera, audio, lights, instab, say, hall, flags, story }) {
  const C = { group: new THREE.Group(), state: 'idle', step: -1, gaze: 0, away: 0, started: false, apDone: false };
  C.group.visible = false; scene.add(C.group);
  const room = buildRoom(mats, { z0: CELLAR.z0, w: CELLAR.w, l: CELLAR.l, h: CELLAR.h, wall: 'brick', floor: 'floorA', ceil: 'stone', pillarEvery: 5, dark: 0.85, seed: 23 });
  C.group.add(room.group); C.bounds = [room.bounds[0], room.bounds[1], CELLAR.z0 - CELLAR.l + 1.4, CELLAR.z0 - 0.6];

  // specchio
  const mw = 1.7, mh = 2.4;
  const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: 256, textureHeight: 384, color: new THREE.Color(0x9aa2a6), clipBias: 0.003 });
  mirror.position.copy(MIRROR); mirror.rotation.y = Math.PI / 2; C.group.add(mirror);
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 384; const dg = dc.getContext('2d');
  for (let i = 0; i < 700; i++) { dg.fillStyle = `rgba(18,20,19,${Math.random() * 0.25})`; dg.beginPath(); dg.arc(Math.random() * 256, Math.random() * 384, 0.5 + Math.random() * 2.2, 0, 7); dg.fill(); }
  for (let i = 0; i < 14; i++) { const x = Math.random() * 256, y = Math.random() * 200, g2 = dg.createLinearGradient(0, y, 0, y + 150 + Math.random() * 150); g2.addColorStop(0, 'rgba(15,18,16,.28)'); g2.addColorStop(1, 'rgba(15,18,16,0)'); dg.fillStyle = g2; dg.fillRect(x, y, 1.5 + Math.random() * 3, 330); }
  const grad = dg.createLinearGradient(0, 0, 0, 384); grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(.3, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.55)'); dg.fillStyle = grad; dg.fillRect(0, 0, 256, 384);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), transparent: true, depthWrite: false }));
  dirt.position.copy(MIRROR).add(new THREE.Vector3(0.004, 0, 0)); dirt.rotation.y = Math.PI / 2; C.group.add(dirt);
  const fm = new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 0.55, metalness: 0.85 });
  const bx = (sx, sy, sz, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), fm); m.position.set(MIRROR.x + 0.04, y, z); C.group.add(m); };
  bx(0.09, 0.1, mw + 0.2, MIRROR.y + mh / 2 + 0.05, MIRROR.z); bx(0.09, 0.1, mw + 0.2, MIRROR.y - mh / 2 - 0.05, MIRROR.z);
  bx(0.09, mh, 0.1, MIRROR.y, MIRROR.z + mw / 2 + 0.05); bx(0.09, mh, 0.1, MIRROR.y, MIRROR.z - mw / 2 - 0.05);

  // la figura nello specchio: l'infermiera, pallida (così si legge nel buio del riflesso)
  const fig = new THREE.Group(); fig.visible = false; C.group.add(fig);
  new GLTFLoader().load('assets/models/c_nurse.glb', (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.color?.multiplyScalar(0.75); o.material.emissive?.setRGB(0.07, 0.07, 0.08); o.material.roughness = 0.9; } });
    const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    m.scale.setScalar(1.8 / sz.y); b.setFromObject(m); m.position.set(-c.x, -b.min.y, -c.z); fig.add(m); C.figReady = true;
  });

  // lampade, oggetti di scena
  const loader = new GLTFLoader(), lampPos = [[0, 3.75, CELLAR.z0 - 6], [0, 3.75, CELLAR.z0 - 18]];
  loader.load('assets/models/lamp.glb', (g) => { for (const [x, y, z] of lampPos) { const o = g.scene.clone(true); const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(0.32 / (b.max.y - b.min.y)); b.setFromObject(o); o.position.set(x - (b.max.x + b.min.x) / 2, y - b.max.y, z); C.group.add(o); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0 })); cord.position.set(x, y + 0.3, z); C.group.add(cord); } });
  const prop = (url, h, x, z, ry) => loader.load(url, (g) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x - x, b.min.y, c.z - z)); o.rotation.y = ry; C.group.add(o); });
  prop('assets/models/can.glb', 0.12, -2.6, CELLAR.z0 - 3, 0.5); prop('assets/models/tank.glb', 0.55, 3.1, CELLAR.z0 - 12.5, 0.4); prop('assets/models/rim.glb', 0.5, 2.4, CELLAR.z0 - 4.2, 1.2);
  prop('assets/models/stool.glb', 0.46, -2.2, CELLAR.z0 - 8.4, 0.3); prop('assets/models/cabinet.glb', 1.1, 3.4, CELLAR.z0 - 17, -Math.PI / 2);

  // porta d'uscita in fondo
  const exitDoor = new THREE.Group(); exitDoor.position.set(0, 0, CELLAR.z0 - CELLAR.l + 0.15); C.group.add(exitDoor);
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; m.getObjectByName('large_castle_door_left')?.rotation.set(0, 0, 0); m.getObjectByName('large_castle_door_right')?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; exitDoor.add(m); });

  // apparizione: la sagoma nera attraversa il fondo in mezzo secondo
  const shade = hall.silhouette(0); shade.visible = false; C.group.add(shade);
  let ap = -1;

  C.enter = () => {
    C.group.visible = true; C.state = 'play'; C.step = -1; C.gaze = 0; C.away = 0; C.started = false; C.apDone = false; flags.mirror = false;
    player.box = C.bounds; player.pos.set(0.4, 1.62, CELLAR.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos); scene.fog.density = 0.055; audio.duck(1, 1); instab.set(0.1, 6);
  };

  const mc = new THREE.Vector3(), fw = new THREE.Vector3(), tmp = new THREE.Vector3(), d = new THREE.Vector3();
  C.update = (dt) => {
    if (!C.group.visible) return;
    const P = player.pos;
    // --- specchio ---
    d.set(MIRROR.x - P.x, 0, MIRROR.z - P.z); const dm = d.length(); d.normalize();
    fw.set(player.forward.x, 0, player.forward.z).normalize();
    const looking = fw.dot(d) > 0.82 && dm < 6.5, turnedAway = fw.dot(d) < 0.25 || dm > 8;
    mirror.visible = dm < 9 && fw.dot(d) > -0.2;                          // niente render se non serve
    if (looking) {
      C.away = 0; C.stepped = false; C.gaze += dt;
      if (!C.started && C.gaze > 1.1) { C.started = true; C.step = 0; instab.push(0.5, 8); }
    } else {
      C.gaze = 0;
      if (turnedAway) {
        C.away += dt;
        // distogli lo sguardo e torni: è più vicina
        if (C.started && !C.stepped && C.away > 0.45 && C.step < 4) { C.step++; C.stepped = true; audio.whisper(1.6, 0.18 + C.step * 0.06); instab.push(0.5 + C.step * 0.13, 6); }
      }
    }
    // la figura sta dietro di te, vista nel riflesso: dalla posizione dello specchio verso il giocatore, prolungata
    fig.visible = !!(looking && C.started && C.step >= 0 && C.figReady && C.state === 'play');
    if (fig.visible) {
      const dist = DIST[Math.min(4, C.step)];
      fig.position.set(P.x - d.x * dist, 0, P.z - d.z * dist);
      fig.rotation.y = Math.atan2(d.x, d.z);                                 // guarda lo specchio
      if (C.step === 4) { C.late = (C.late || 0) + dt; if (C.late > 4.6 && !flags.mirror) { flags.mirror = true; lights.lamp(0, 'flicker', 1.4); lights.lamp(1, 'flicker', 1.4); audio.whisper(2.6, 0.4); say('ci sei anche tu.', 4500); instab.set(1, 6); player.addShake(0.35); } }
    } else C.late = 0;
    // --- apparizione (spavento) ---
    if (!C.apDone && P.z < CELLAR.z0 - 14.2) {
      C.apDone = true; ap = 0; shade.visible = true; audio.dash(0.5); player.addShake(0.7); lights.torchStutter(0.3); instab.set(1, 8); try { navigator.vibrate?.([60, 30, 90]); } catch (_) {}
    }
    if (ap >= 0) {
      ap += dt; const k = Math.min(1, ap / 0.45);
      shade.position.set(THREE.MathUtils.lerp(-3.2, 3.2, k), 0, CELLAR.z0 - 20.2); shade.rotation.y = Math.PI / 2;
      if (ap > 0.5) { shade.visible = false; ap = -1; }
    }
    // --- uscita ---
    if (C.apDone && P.z < CELLAR.z0 - CELLAR.l + 2.4 && C.state === 'play') { C.state = 'leaving'; story.goto('tower'); }
  };
  C.leave = () => { C.group.visible = false; mirror.visible = false; };
  return C;
}
