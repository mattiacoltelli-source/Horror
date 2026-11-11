// STANZA — L'OBITORIO: sala piastrellata con una sedia da visita con cinghie e un tavolo di strumenti.
// Nessuna meccanica nuova: atmosfera. Quando ti avvicini alla sedia la luce sfarfalla e, tra un guizzo e l'altro, qualcuno è in fondo alla sala.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';
import { entryDoor } from '../world/decor.js';

export const MORGUE = { z0: -500, w: 9, l: 15, h: 3.0 };

export function createMorgue({ scene, mats, player, audio, lights, instab, say, hall, story }) {
  const M = { group: new THREE.Group(), state: 'idle', t: 0 };
  M.group.visible = false; scene.add(M.group);
  const { z0, w, l, h } = MORGUE, zFar = z0 - l;
  const room = buildRoom(mats, { z0, w, l, h, wall: 'stone', floor: 'mfloor', ceil: 'stone', dark: 0.5, seed: 57 });
  M.group.add(room.group); M.bounds = [room.bounds[0], room.bounds[1], zFar + 1.4, z0 - 0.6];
  const loader = new GLTFLoader();
  const load = (u) => new Promise((res) => loader.load(u, (g) => res(g.scene), undefined, () => res(null)));

  // pareti piastrellate: 5 moduli da 3 m per lato, 3 per le pareti di testa (la faccia con le piastrelle guarda dentro la sala)
  (async () => {
    const src = await load('assets/models/mg_wall.glb'); if (!src) return;
    const b0 = new THREE.Box3().setFromObject(src), sz = b0.getSize(new THREE.Vector3()), c0 = b0.getCenter(new THREE.Vector3());
    src.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setScalar(0.5); } });   // piu' cupo
    const put = (x, z, ry) => { const o = src.clone(true), g = new THREE.Group(); o.position.set(-c0.x, -b0.min.y, -c0.z); g.add(o); g.position.set(x, 0, z); g.rotation.y = ry; M.group.add(g); };
    const t = sz.z / 2 - 0.02;
    for (let i = 0; i < 5; i++) { const z = z0 - 1.5 - i * 3; put(-w / 2 + t, z, Math.PI / 2); put(w / 2 - t, z, -Math.PI / 2); }
    for (const sx of [-1, 1]) { put(sx * 2.45, zFar + t, 0); put(sx * 4.35, zFar + t - 0.02, 0); }   // parete di testa con il varco della porta (1.9 m)
    for (const sx of [-1, 1]) { put(sx * 2.45, z0 - t, Math.PI); put(sx * 4.35, z0 - t + 0.02, Math.PI); }   // parete d'ingresso con il varco della porta da cui sei arrivato
  })();

  // sedia da visita al centro della sala, con la lampada sopra
  const place = (o, x, y, z, ry, s = 1) => { o.scale.setScalar(s); o.position.set(x, y, z); o.rotation.y = ry; M.group.add(o); };
  const chairZ = z0 - 8;
  load('assets/models/mg_chair.glb').then((o) => { if (!o) return; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); const g = new THREE.Group(); g.add(o); g.position.set(0.2, 0, chairZ); g.rotation.y = -0.15; M.group.add(g); M.chair = g; });
  // tavolo in acciaio con gli strumenti, contro il muro destro
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e9496, metalness: 0.75, roughness: 0.38 });
  const tbl = new THREE.Group(); tbl.position.set(w / 2 - 0.9, 0, z0 - 5);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 1.5), steel); top.position.y = 0.9; tbl.add(top);
  for (const [dx, dz] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), steel); leg.position.set(dx, 0.45, dz); tbl.add(leg); }
  M.group.add(tbl);
  ['mg_tool1', 'mg_tool3', 'mg_tool4'].forEach((n, i) => load(`assets/models/${n}.glb`).then((o) => { if (!o) return; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); const g = new THREE.Group(); g.add(o); g.position.set(-0.12 + i * 0.12, 0.92, -0.5 + i * 0.45); g.rotation.y = [0.4, 1.2, -0.3][i]; tbl.add(g); }));
  // lampada sospesa sopra la sedia
  const lampPos = [[0, 2.8, chairZ]];   // una sola lampada, sopra la sedia: gli angoli restano bui
  load('assets/models/hlamp.glb').then((o) => { if (!o) return; for (const [x, , z] of lampPos) { const c = o.clone(true); c.position.set(x, h, z); M.group.add(c); } });
  // porta d'uscita in fondo, aperta sul buio
  const door = new THREE.Group(); door.position.set(0, 0, zFar + 0.15); M.group.add(door);
  load('assets/models/door.glb').then((m) => { if (!m) return; const L = m.getObjectByName('large_castle_door_left'), R = m.getObjectByName('large_castle_door_right'); L?.rotation.set(0, 1.5, 0); R?.rotation.set(0, -1.5, 0); m.rotation.y = Math.PI; door.add(m); });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(2.1, h), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); cap.position.set(0, h / 2, zFar + 0.05); M.group.add(cap);
  entryDoor(M.group, z0);   // la porta si è chiusa alle tue spalle
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.1, h), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); back.position.set(0, h / 2, z0 + 0.06); back.rotation.y = Math.PI; M.group.add(back);
  const shade = hall.silhouette(5); shade.visible = false; M.group.add(shade);

  M.enter = () => {
    M.group.visible = true; M.state = 'walk'; M.t = 0; M.leaving = false;
    player.box = M.bounds; player.pos.set(0, 1.62, z0 - 1.4); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos, 1.9, 0xc4d4cc); scene.fog.density = 0.042; audio.duck(1, 1.5); instab.set(0.1, 6);
  };
  M.leave = () => { M.group.visible = false; };
  M.update = (dt) => {
    if (!M.group.visible) return; const P = player.pos; M.t += dt;
    { const dx = P.x - 0.2, dz = P.z - chairZ, d = Math.hypot(dx, dz), R = 1.15; if (d < R) { P.x = 0.2 + dx / Math.max(d, 0.01) * R; P.z = chairZ + dz / Math.max(d, 0.01) * R; }   // la sedia è un ostacolo
      const tx = w / 2 - 0.9; if (Math.abs(P.x - tx) < 0.75 && Math.abs(P.z - (z0 - 5)) < 1.1) P.x = tx - 0.75; }   // il tavolo anche
    if (M.state === 'walk' && P.z < chairZ + 4.5) {
      M.state = 'beat'; M.bt = 0; lights.lamp(0, 'flicker', 1.1); audio.lightOn?.(); audio.whisper?.(1.6, 0.1); instab.push(0.6, 5);
      shade.position.set(0.4, 0, zFar + 2.2); shade.rotation.y = 0; shade.visible = true;
    }
    if (M.state === 'beat') { M.bt += dt; shade.visible = M.bt < 0.95 && Math.sin(M.bt * 40) > -0.3; if (M.bt > 1.0) { M.state = 'after'; shade.visible = false; } }
    if (!M.leaving && P.z < zFar + 2.4) { M.leaving = true; story.goto('warehouse'); }
  };
  return M;
}
