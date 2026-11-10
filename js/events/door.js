// EVENTO 4 — La porta. Il portone in fondo al tunnel si spalanca contro il giocatore: dietro c'è solo buio.
// Non succede niente. Poi, nel silenzio, un respiro. Inizio dell'EVENTO 5: «non guardare dietro.»
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END, DOOR } from '../world/tunnel.js';

export function createDoorEvent({ scene, player, audio, lights, instab, say, camera }) {
  const E = { state: 'idle', t: 0, ended: false, loaded: false };
  const grp = new THREE.Group(); grp.position.set(0, 0, Z_END + 0.06); scene.add(grp);
  let left = null, right = null;

  new GLTFLoader().load('assets/models/door.glb', (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 0.5; } });
    grp.add(m); E.loaded = true;
    left = m.getObjectByName('large_castle_door_left'); right = m.getObjectByName('large_castle_door_right');
    left?.rotation.set(0, 0, 0); right?.rotation.set(0, 0, 0);   // chiuso
    // vano buio dietro il portone (evita di intravedere il retro dei muri)
    const void_ = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w + 0.4, DOOR.h + 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    void_.position.set(0, DOOR.h / 2, -0.25); grp.add(void_);
  }, undefined, (e) => console.warn('door.glb', e));

  let breath = null, openT = 0, bounce = 0;
  const doorPos = new THREE.Vector3(0, 1.4, Z_END);
  const tmp = new THREE.Vector3();

  const angle = (t) => {
    // sbatte aperto in ~0.25 s, rimbalza leggermente contro i muri
    const a = 1.9 * (1 - Math.exp(-t * 16));
    const b = t > 0.28 ? 0.2 * Math.exp(-(t - 0.28) * 7) * Math.abs(Math.sin((t - 0.28) * 15)) : 0;
    return Math.max(0, a - b);
  };

  E.update = (dt) => {
    const pz = player.pos.z; E.t += dt;
    switch (E.state) {
      case 'idle':
        if (pz < -43) { E.state = 'hush'; E.t = 0; audio.duck(0.25, 4); }
        break;
      case 'hush':
        // l'ambiente si spegne mano a mano che ci si avvicina
        if (pz < -49.5) { audio.duck(0.04, 1.2); }
        if (pz < -50.8 && E.t > 2) { E.state = 'burst'; E.t = 0; openT = 0; audio.doorBang(doorPos, 1); audio.duck(0.12, 0.2); player.addShake(1.1); lights.lamp(3, 'flicker', 1.4); lights.torchStutter(0.5); instab.set(0.85, 10); }
        break;
      case 'burst':
        openT += dt; const a = angle(openT);
        if (left) left.rotation.y = -a; if (right) right.rotation.y = a;
        if (E.t > 1.6) { E.state = 'void'; E.t = 0; }
        break;
      case 'void':
        // niente: oscurità e silenzio. Il giocatore si aspetta qualcosa.
        if (E.t > 6.5) { E.state = 'breath'; E.t = 0; breath = audio.breath(); breath?.setPos(0, 1.3, Z_END - 1); breath?.setLevel(0.55, 1.2); instab.set(0.45, 8); }
        break;
      case 'breath':
        // il respiro esce dal buio e si avvicina fino a stare dietro di te
        if (breath) {
          const k = Math.min(1, Math.max(0, (E.t - 2) / 22)), e = k * k;
          const back = tmp.copy(player.forward).multiplyScalar(-1.4).add(camera.position); back.y = 1.35;
          const px = THREE.MathUtils.lerp(0, back.x, e), pz2 = THREE.MathUtils.lerp(Z_END - 1, back.z, e);
          breath.setPos(px, 1.3, pz2); breath.setLevel(0.55 + 0.9 * e, 0.8);
        }
        if (E.t > 5.5 && !E.torch) { E.torch = true; lights.torchKill(1.4, 0.1); instab.push(0.9, 5); }
        if (E.t > 11 && !E.said) { E.said = true; say('non guardare dietro.', 6000); instab.push(1, 8); }
        if (E.t > 26 || (E.said && pz < Z_END + 1.1)) { E.state = 'end'; E.t = 0; }
        break;
      case 'end':
        E.ended = true; breath?.stop(); breath = null; E.state = 'over';
        break;
    }
  };
  return E;
}
