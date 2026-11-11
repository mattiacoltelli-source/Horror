// STANZA — L'OBITORIO: sala piastrellata con una sedia da visita con cinghie e un tavolo di strumenti.
// Nessuna meccanica nuova: atmosfera. Quando ti avvicini alla sedia la luce sfarfalla e, tra un guizzo e l'altro, qualcuno è in fondo alla sala.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { buildRoom } from '../world/rooms.js';
import { entryDoor } from '../world/decor.js';
import { unseenMover } from './ambient.js';

export const MORGUE = { z0: -500, w: 9, l: 15, h: 3.0 };

export function createMorgue({ scene, mats, player, camera, audio, lights, instab, say, hall, story, flags = {} }) {
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
  ['mg_tool1', 'mg_tool3', 'mg_tool4'].forEach((n, i) => load(`assets/models/${n}.glb`).then((o) => { if (!o) return; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); const g = new THREE.Group(); g.add(o); g.position.set(-0.12 + i * 0.12, 0.92, -0.5 + i * 0.45); g.rotation.y = [0.4, 1.2, -0.3][i]; tbl.add(g); if (i === 1) M.tool = g; }));
  // lampada sospesa sopra la sedia
  const lampPos = [[0, 2.8, chairZ]];   // una sola lampada, sopra la sedia: gli angoli restano bui
  load('assets/models/hlamp.glb').then((o) => { if (!o) return; for (const [x, , z] of lampPos) { const c = o.clone(true); c.position.set(x, h, z); M.group.add(c); } });
  // porta d'uscita in fondo, aperta sul buio
  const door = new THREE.Group(); door.position.set(0, 0, zFar + 0.15); M.group.add(door);
  load('assets/models/door.glb').then((m) => { if (!m) return; const L = m.getObjectByName('large_castle_door_left'), R = m.getObjectByName('large_castle_door_right'); L?.rotation.set(0, 1.5, 0); R?.rotation.set(0, -1.5, 0); m.rotation.y = Math.PI; door.add(m); });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(2.1, h), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); cap.position.set(0, h / 2, zFar + 0.05); M.group.add(cap);
  // impronte di piedi nudi, rosso scuro e bagnate: dalla sedia alla porta in fondo; compaiono solo dopo lo sfarfallio
  const tl = new THREE.TextureLoader(), fL = tl.load('assets/tex/foot_l.png'), fR = tl.load('assets/tex/foot_r.png'); fL.colorSpace = fR.colorSpace = THREE.SRGBColorSpace; const prints = new THREE.Group(); prints.visible = false; M.group.add(prints);
  for (let i = 0, zz = chairZ - 1.2; zz > zFar + 1.6; i++, zz -= 0.62) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.27), new THREE.MeshLambertMaterial({ map: i % 2 ? fR : fL, color: new THREE.Color(0.055, 0.006, 0.004), transparent: true, opacity: 0.8 - Math.min(0.4, i * 0.03), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.set(-Math.PI / 2, 0, Math.sin(i * 1.7) * 0.18); m.position.set(0.2 + Math.sin(i * 0.5) * 0.35 + (i % 2 ? 0.1 : -0.1), 0.012, zz); prints.add(m);
  }
  // la sedia, quando non la guardi, si gira un po' verso di te (come la sedia a rotelle della torre): al massimo 3 volte
  const chairMove = unseenMover({ camera, getObj: () => M.chair, max: 3, gap: 7, move: (n) => { M.chair.rotation.y += 0.3; audio.squeak?.(0.5, M.chair.position.clone()); } });
  entryDoor(M.group, z0);   // la porta si è chiusa alle tue spalle
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.1, h), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); back.position.set(0, h / 2, z0 + 0.06); back.rotation.y = Math.PI; M.group.add(back);
  const shade = hall.silhouette(5); shade.visible = false; M.group.add(shade);

  M.enter = () => {
    M.trig = chairZ + 3.5 + Math.random() * 2; M.variant = flags.turned ? 'near' : (Math.random() < 0.5 ? 'far' : 'breath');   // l'evento cambia a ogni partita e in base a cosa hai scelto
    M.group.visible = true; M.state = 'walk'; M.t = 0; M.leaving = false; prints.visible = false; M.fall = null; M.dropped = false;
    player.box = M.bounds; player.pos.set(0, 1.62, z0 - 1.4); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos, 1.9, 0xc4d4cc); scene.fog.density = 0.042; audio.duck(1, 1.5); instab.set(0.1, 6);
  };
  M.leave = () => { M.group.visible = false; };
  M.update = (dt) => {
    if (!M.group.visible) return; const P = player.pos; M.t += dt;
    { const dx = P.x - 0.2, dz = P.z - chairZ, d = Math.hypot(dx, dz), R = 1.15; if (d < R) { P.x = 0.2 + dx / Math.max(d, 0.01) * R; P.z = chairZ + dz / Math.max(d, 0.01) * R; }   // la sedia è un ostacolo
      const tx = w / 2 - 0.9; if (Math.abs(P.x - tx) < 0.75 && Math.abs(P.z - (z0 - 5)) < 1.1) P.x = tx - 0.75; }   // il tavolo anche
    // lo strumento cade dal tavolo quando gli dai le spalle
    if (M.tool && !M.dropped) { const tp = M.tool.getWorldPosition(new THREE.Vector3()), dx = tp.x - P.x, dz = tp.z - P.z, dd = Math.hypot(dx, dz), f = player.forward;
      if (dd < 3 && dd > 1.2 && (f.x * dx + f.z * dz) / dd < -0.25) { M.dropped = true; M.group.attach(M.tool); M.fall = { vy: 0.4, vx: (Math.random() - 0.5) * 0.4, spin: 6 + Math.random() * 4 }; } }
    if (M.fall && M.tool) { const F = M.fall, o = M.tool; F.vy -= 9.8 * dt; o.position.y += F.vy * dt; o.position.x -= 0.25 * dt; o.rotation.x += F.spin * dt * (o.position.y > 0.03 ? 1 : 0); if (o.position.y <= 0.02) { o.position.y = 0.02; M.fall = null; o.rotation.x = 0; audio.tinkle?.(); } }
    if (M.state === 'walk' && P.z < M.trig) {
      M.state = 'beat'; M.bt = 0; lights.lamp(0, 'flicker', 1.1); audio.lightOn?.(); instab.push(0.6, 5);
      if (M.variant === 'breath') audio.breath?.(); else audio.whisper?.(1.6, 0.1);
      if (M.variant === 'near') shade.position.set(-1.5, 0, chairZ - 3.2); else shade.position.set(0.4, 0, zFar + 2.2);   // se ti sei girato nella sala della folla, ti sta vicino; altrimenti in fondo o solo il respiro
      shade.rotation.y = 0; shade.visible = M.variant !== 'breath';
    }
    if (M.state === 'beat') { M.bt += dt; shade.visible = M.variant !== 'breath' && M.bt < (M.variant === 'near' ? 1.25 : 0.95) && Math.sin(M.bt * 40) > -0.3; if (M.bt > 0.5) prints.visible = true;   // nel buio tra un guizzo e l'altro ci sono le impronte
      if (M.bt > 1.3) { M.state = 'after'; shade.visible = false; } }
    chairMove(dt, M.state === 'after');
    if (!M.leaving && P.z < zFar + 2.4) { M.leaving = true; story.goto('warehouse'); }
  };
  return M;
}
