// EVENTO 4 — La porta + sala oltre il portone + EVENTO 5.
// Il portone si spalanca contro il giocatore. Dietro: buio. Poi una luce lontana mostra una folla di sagome ferme che ti fissa.
// Tre apparizioni, due avvicinamenti nel buio. Infine il respiro, «non guardare dietro.» e la scelta.
import * as THREE from 'three';
import { rgbPulse } from '../ui/rgbshift.js';
import { P } from '../personal.js';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Z_END, DOOR } from '../world/tunnel.js';

export function createDoorEvent({ scene, player, audio, lights, instab, say, camera, hall, onHallDone }) {
  const E = { state: 'idle', t: 0, ended: false, loaded: false }; let drone = null, pressure = null;
  const grp = new THREE.Group(); grp.position.set(0, 0, Z_END + 0.06); scene.add(grp);
  let left = null, right = null;

  new GLTFLoader().load('assets/models/door.glb', (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 0.5; o.material.side = THREE.DoubleSide; } });   // visibile anche dal lato interno (prima, da dentro, spariva)
    grp.add(m); E.loaded = true;
    left = m.getObjectByName('large_castle_door_left'); right = m.getObjectByName('large_castle_door_right');
    left?.rotation.set(0, 0, 0); right?.rotation.set(0, 0, 0);   // chiuso
  }, undefined, (e) => console.warn('door.glb', e));

  let breath = null, openT = 0;
  const doorPos = new THREE.Vector3(0, 1.4, Z_END);
  const tmp = new THREE.Vector3();
  const angle = (t) => {
    const a = 1.9 * (1 - Math.exp(-t * 16));
    const b = t > 0.28 ? 0.2 * Math.exp(-(t - 0.28) * 7) * Math.abs(Math.sin((t - 0.28) * 15)) : 0;
    return Math.max(0, a - b);
  };
  // Nei passaggi a tempo si conserva la frazione avanzata: gli FPS bassi non aggiungono attese a ogni fase.
  const go = (st, duration) => { E.state = st; E.t = duration == null ? 0 : Math.max(0, E.t - duration); };
  const TIMING = { burst: 1.2, reveal: 1, warning: 0.6, turn: 0.8, choice: 8.5, breath: 8 };
  // fasi della folla: [distanza, durata luce accesa, durata buio dopo]
  const PHASES = [{ d: 26, hold: 7, dark: 0.7 }, { d: 14, hold: 2.4, dark: 0.7 }, { d: 7.5, hold: 1.5, dark: 0.7 }];   // la prima nota resta leggibile; poi il ritmo accelera
  let ph = 0;

  E.update = (dt) => {
    if (E.state === 'over') stopPressure();
    pressure?.update();
    const pz = player.pos.z; E.t += dt;
    // il portone si richiude alle tue spalle appena sei dentro la sala (come le altre porte: dietro non si torna)
    if (!E.shut && E.curA != null && pz < Z_END - 1.3 && E.state !== 'burst' && E.state !== 'hush' && E.state !== 'idle') { E.shut = true; E.shutT = 0; audio.doorBang(doorPos, 0.9); player.addShake(0.5); instab.push(0.7, 4); }
    if (E.shut && E.shutT < 1) {
      E.shutT += dt * 2.2; const k = Math.min(1, E.shutT), a = E.curA * (1 - k * k) + (k > 0.85 ? 0.08 * Math.sin((k - 0.85) * 40) * (1 - k) : 0);
      if (left) left.rotation.y = -Math.max(0, a); if (right) right.rotation.y = Math.max(0, a);
    }
    switch (E.state) {
      case 'idle':
        if (pz < Z_END + 13) { go('hush'); audio.duck(0.25, 4); }
        break;
      case 'hush':
        if (pz < Z_END + 6.5) audio.duck(0.04, 1.2);
        if (pz < Z_END + 5.2 && E.t > 2) {
          go('burst'); openT = 0; audio.doorBang(doorPos, 1); audio.duck(0.12, 0.2); player.addShake(1.1);
          player.zMin = Z_END - 2.4; lights.lamp(3, 'flicker', 1.4); lights.torchStutter(0.5); instab.set(0.8, 10);
          hall?.enable(); hall?.setDist(PHASES[0].d);
        }
        break;
      case 'burst': {
        openT += dt; const a = angle(openT);
        if (left) left.rotation.y = -a; if (right) right.rotation.y = a; E.curA = a;
        if (E.t > TIMING.burst) go('void', TIMING.burst);
        break;
      }
      case 'void':
        // buio e silenzio: ti aspetti qualcosa
        if (E.t > TIMING.reveal) { ph = 0; go('lit', TIMING.reveal); lightOn(); say('erano qui tutti, quella notte.\nnessuno di loro è uscito.\nnon guardarli in faccia.', 7000, 'note'); rgbPulse(1); drone ??= audio.crowdDrone(0.35, { gaps: false }); drone?.setLevel(0.45, 2.5); pressure ??= audio.hallPressure?.(); pressure?.setStage(0); bells(); }
        break;
      case 'lit': {
        // la sala è illuminata: in fondo, file di sagome ferme che ti fissano
        const P = PHASES[ph];
        if (E.t > P.hold) {
          go('dark', P.hold); hall?.lightOff(); lights.torchKill(P.dark - 0.4, 0.04); audio.duck(0, 0.05);
          if (ph < 2) {
            drone?.setLevel(0.85, 0.15);
            if (pressure) pressure.rush(Z_END - P.d, Z_END - PHASES[ph + 1].d, P.dark);
            else audio.shuffle(P.dark, 0.55);
          } else { stopPressure(); drone?.setLevel(0, 0.08); }
          instab.push(0.9, 4);
        }
        break;
      }
      case 'dark': {
        const P = PHASES[ph];
        // mentre sei al buio si avvicinano (non lo vedi: lo senti)
        if (E.t > P.dark) {
          ph++;
          if (ph >= PHASES.length) { go('choice', P.dark); stopPressure(); drone?.setLevel(0.12, 0.8); hall?.lightDim?.(); startBreath(); }
          else { hall?.setDist(PHASES[ph].d); go('lit', P.dark); pressure?.setStage(ph); drone?.setLevel(0.55 + 0.15 * ph, 0.45); lightOn(); bells(); }
        }
        break;
      }
      case 'choice': {
        // il respiro si avvicina da dietro; «non guardare dietro.»: voltarsi o no
        if (breath) {
          const k = Math.min(1, E.t / TIMING.breath), e = k * k;
          const back = tmp.copy(player.forward).multiplyScalar(-1.4).add(camera.position); back.y = 1.35;
          breath.setPos(THREE.MathUtils.lerp(0, back.x, e), 1.3, THREE.MathUtils.lerp(Z_END - 3, back.z, e)); breath.setLevel(0.5 + 0.9 * e, 0.8);
        }
        if (E.t > TIMING.warning && !E.said) { E.said = true; say(P ? 'non guardare dietro, ' + P.name + '.' : 'non guardare dietro.', 5500); instab.push(1, 10); }
        if (E.t > 5 && !E.torch) { E.torch = true; lights.torchKill(1.2, 0.08); }
        if (E.t > TIMING.turn && E.said && player.forward.z > 0.1) { E.turnT = (E.turnT || 0) + dt; if (E.turnT > 0.12) { go('turned'); drone?.stop(0.5); drone = null; clearTimeout(bellT); breath?.stop(); breath = null; audio.duck(0, 0.05); showShade(); } } else E.turnT = 0;
        if (E.t > TIMING.choice) { go('ignored', TIMING.choice); drone?.stop(0.5); drone = null; clearTimeout(bellT); }
        break;
      }
      case 'turned':
        // ti sei girato: davanti al portone chiuso, a due passi, qualcuno è fermo e ti guarda (sagoma nera nel cono della torcia).
        // La luce balbetta, poi si spegne un istante: quando torna non c'è più.
        if (!E.turnBeat) { E.turnBeat = true; lights.torchStutter(1.0); audio.whisper(1.4, 0.3); player.addShake(0.35); instab.set(1, 8); }
        if (E.t > 1.5 && !E.fl) { E.fl = true; lights.torchKill(0.9, 0); }
        if (E.t > 1.6 && shade && shade.visible) shade.visible = false;
        if (E.t > 3.6) { go('over'); audio.duck(0.2, 1); onHallDone?.(true); }
        break;
      case 'ignored':
        // hai tirato dritto: il respiro è sul collo, la torcia muore
        if (E.t === 0 || !E.k) { E.k = true; breath?.setLevel(1.6, 0.3); lights.torchKill(4, 0.1); instab.set(1, 8); }
        if (E.t > 3.6) { go('over'); breath?.stop(); breath = null; audio.duck(0.2, 1); onHallDone?.(false); }
        break;
    }
  };

  function lightOn() { hall?.lightOn(); audio.lightOn(); instab.set(0.3 + ph * 0.25, 8); }
  let shade = null;
  function showShade() { if (!shade) { shade = hall.silhouette(3); scene.add(shade); } const f = camera.position; shade.position.set(camera.position.x - 0.35, 0, Z_END - 0.45); shade.rotation.y = Math.PI - 0.15; shade.visible = true; }
  function stopPressure() { pressure?.stop(); pressure = null; }
  // Due rintocchi lontani; nella terza apparizione prevale la pulsazione accelerata.
  let bellT = null;
  function bells() { clearTimeout(bellT); if (ph >= 2) return; bellT = setTimeout(() => { if (drone && E.state === 'lit') audio.bell(0.22); }, 1100); }
  function startBreath() { E.torch = false; E.said = false; E.k = false; E.fl = false; E.turnBeat = false; E.turnT = 0; breath = audio.breath(); breath?.setPos(0, 1.3, Z_END - 3); breath?.setLevel(0.5, 1.2); }
  E.getPh = () => ph;
  return E;
}
