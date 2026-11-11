// EVENTO 4 — La porta + sala oltre il portone + EVENTO 5.
// Il portone si spalanca contro il giocatore. Dietro: buio. Poi una luce lontana mostra una folla di sagome ferme che ti fissa.
// La luce si spegne; quando torna, sono più vicine. Tre volte. Infine il respiro, «non guardare dietro.» e la scelta.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END, DOOR } from '../world/tunnel.js';

export function createDoorEvent({ scene, player, audio, lights, instab, say, camera, scare, hall }) {
  const E = { state: 'idle', t: 0, ended: false, loaded: false };
  const grp = new THREE.Group(); grp.position.set(0, 0, Z_END + 0.06); scene.add(grp);
  let left = null, right = null;

  new GLTFLoader().load('assets/models/door.glb', (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 0.5; } });
    grp.add(m); E.loaded = true;
    left = m.getObjectByName('large_castle_door_left'); right = m.getObjectByName('large_castle_door_right');
    left?.rotation.set(0, 0, 0); right?.rotation.set(0, 0, 0);   // chiuso
    // vano buio dietro il portone finché la sala è spenta
    const v = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w + 0.4, DOOR.h + 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    v.position.set(0, DOOR.h / 2, -0.25); grp.add(v); E.voidPlane = v;
  }, undefined, (e) => console.warn('door.glb', e));

  let breath = null, openT = 0;
  const doorPos = new THREE.Vector3(0, 1.4, Z_END);
  const tmp = new THREE.Vector3();
  const angle = (t) => {
    const a = 1.9 * (1 - Math.exp(-t * 16));
    const b = t > 0.28 ? 0.2 * Math.exp(-(t - 0.28) * 7) * Math.abs(Math.sin((t - 0.28) * 15)) : 0;
    return Math.max(0, a - b);
  };
  const go = (st) => { E.state = st; E.t = 0; };
  // fasi della folla: [distanza, durata luce accesa, durata buio dopo]
  const PHASES = [{ d: 26, hold: 7.5, dark: 3.4 }, { d: 14, hold: 5.5, dark: 3.4 }, { d: 7.5, hold: 4.2, dark: 2.2 }];
  let ph = 0;

  E.update = (dt) => {
    const pz = player.pos.z; E.t += dt;
    switch (E.state) {
      case 'idle':
        if (pz < -43) { go('hush'); audio.duck(0.25, 4); }
        break;
      case 'hush':
        if (pz < -49.5) audio.duck(0.04, 1.2);
        if (pz < -50.8 && E.t > 2) {
          go('burst'); openT = 0; audio.doorBang(doorPos, 1); audio.duck(0.12, 0.2); player.addShake(1.1);
          player.zMin = Z_END - 2.4; lights.lamp(3, 'flicker', 1.4); lights.torchStutter(0.5); instab.set(0.8, 10);
          hall?.enable(); hall?.setDist(PHASES[0].d);
        }
        break;
      case 'burst': {
        openT += dt; const a = angle(openT);
        if (left) left.rotation.y = -a; if (right) right.rotation.y = a;
        if (E.t > 1.6) go('void');
        break;
      }
      case 'void':
        // buio e silenzio: ti aspetti qualcosa
        if (E.t > 3.2) { ph = 0; go('lit'); lightOn(); }
        break;
      case 'lit': {
        // la sala è illuminata: in fondo, file di sagome ferme che ti fissano
        const P = PHASES[ph];
        if (E.t > P.hold) { go('dark'); hall?.lightOff(); lights.torchKill(P.dark - 0.4, 0.04); audio.duck(0, 0.05); audio.shuffle(P.dark, 0.55); instab.push(0.9, 4); if (E.voidPlane) E.voidPlane.visible = true; }
        break;
      }
      case 'dark': {
        const P = PHASES[ph];
        // mentre sei al buio si avvicinano (non lo vedi: lo senti)
        if (E.t > P.dark) {
          ph++;
          if (ph >= PHASES.length) { go('breath'); startBreath(); }
          else { hall?.setDist(PHASES[ph].d); go('lit'); lightOn(); }
        }
        break;
      }
      case 'breath':
        // il respiro esce dal buio e si avvicina fino a stare dietro di te
        if (breath) {
          const k = Math.min(1, Math.max(0, (E.t - 1) / 22)), e = k * k;
          const back = tmp.copy(player.forward).multiplyScalar(-1.4).add(camera.position); back.y = 1.35;
          breath.setPos(THREE.MathUtils.lerp(0, back.x, e), 1.3, THREE.MathUtils.lerp(Z_END - 3, back.z, e)); breath.setLevel(0.55 + 0.9 * e, 0.8);
        }
        if (E.t > 2 && !E.torch) { E.torch = true; lights.torchKill(1.4, 0.1); instab.push(0.9, 5); }
        if (E.t > 5 && !E.said) { E.said = true; say('non guardare dietro.', 6000); instab.push(1, 8); }
        // SCELTA: voltarsi (guardare alle spalle) o andare avanti nel buio
        if (E.t > 3 && E.said) {
          const back = player.forward.z > 0.3;
          E.turnT = back ? (E.turnT || 0) + dt : 0;
          if (E.turnT > 0.35) { go('over'); breath?.stop(); breath = null; scare.trigger('behind'); }
        }
        if (E.said && pz < Z_END + 1.2) { go('dark2'); breath?.stop(); breath = null; audio.duck(0, 0.3); lights.torchKill(3.2, 0.1); instab.set(0.2, 12); }
        if (E.t > 30) { go('over'); breath?.stop(); breath = null; scare.trigger('ahead'); }
        break;
      case 'dark2':
        // sei entrato: torcia morta, silenzio. Un attimo di sollievo... poi qualche passo avanti.
        if (E.t > 3.4) audio.duck(0.25, 2);
        if ((E.t > 5 && pz < Z_END - 1.4) || E.t > 20) { go('over'); scare.trigger('ahead'); }
        break;
    }
  };

  function lightOn() { hall?.lightOn(); audio.lightOn(); instab.set(0.3 + ph * 0.25, 8); if (E.voidPlane) E.voidPlane.visible = false; }
  function startBreath() { E.torch = false; E.said = false; breath = audio.breath(); breath?.setPos(0, 1.3, Z_END - 3); breath?.setLevel(0.5, 1.2); }
  E.getPh = () => ph;
  return E;
}
