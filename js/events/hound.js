// IL CANE NELLA PENOMBRA (tunnel): in fondo, oltre la luce, si intravede appena una sagoma bassa e ferma (un cane scorticato, respira piano).
// Quando ti avvicini la luce in fondo sfarfalla e, quando torna, lui non c'e' piu'. Succede una sola volta. Modello: "Grimhound Rig" di DM-913 (CC-BY 4.0).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { aged } from '../world/aged.js';

export function createHound({ scene, player, lights, audio, glass }) {
  const H = { state: 'wait', t: 0, obj: null }, lampIdx = 3, ZD = -45.6, ZT = -33.5;   // dove sta, e a che punto del tunnel parte lo scherzo
  let mixer = null;
  new GLTFLoader().load('assets/models/hound.glb', (g) => {
    const o = g.scene; aged(o, 0.7);
    o.traverse((m) => { if (!m.isMesh) return; for (const mat of [].concat(m.material)) { if (mat.map && !mat.alphaTest) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(0.008, 0.007, 0.007); mat.emissiveIntensity = 1; } } });   // un chiarore minimo: da lontano resta solo il dubbio di una sagoma, mai una cosa che si vede chiaramente
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const grp = new THREE.Group(); grp.add(o); grp.position.set(0.15, 0, ZD); grp.rotation.y = 0; grp.scale.setScalar(1.1); grp.visible = false; scene.add(grp); H.obj = grp;
    // occhi: due punti rossi appena accesi (come un demone), che seguono le ossa degli occhi; ogni tanto sbattono
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,22,8,1)'); gr.addColorStop(0.3, 'rgba(255,40,10,0.95)'); gr.addColorStop(0.65, 'rgba(255,20,0,0.35)'); gr.addColorStop(1, 'rgba(255,10,0,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const gt = new THREE.CanvasTexture(gc);
    H.eyes = []; o.traverse((n) => { if (/^Eye[LR]/.test(n.name)) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(1.1, 0.0, 0.0), transparent: true, opacity: 0.097, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, depthTest: false })); sp.scale.setScalar(0.087); sp.visible = false; scene.add(sp); H.eyes.push({ bone: n, sp }); } });
    if (g.animations?.length) { mixer = new THREE.AnimationMixer(o); mixer.clipAction(g.animations[0]).play(); }
  });
  H.update = (dt) => {
    mixer?.update(dt);
    if (!H.obj || H.state === 'gone') { H.eyes?.forEach((e) => { e.sp.visible = false; }); return; }
    if (H.eyes) { H.blink = (H.blink ?? 3) - dt; const closed = H.blink < 0 && H.blink > -0.14; if (H.blink < -0.14) H.blink = 2.5 + Math.random() * 4; H.eyes.forEach((e) => { e.bone.getWorldPosition(e.sp.position); e.sp.visible = H.obj.visible && !closed; }); }
    const z = player.pos.z;
    // respiro del cane: quasi un sottofondo, parte ~1 m (0,65 s) prima che compaiano gli occhi e si ferma di colpo al flash
    if (H.state === 'wait' && !H.snd && !H.sndDone && glass?.state === 'vanish' && glass.t > 0.9) { H.snd = audio.sfx?.('hound_breath', { level: 0.02, loop: true, fade: 3 }); if (H.snd) H.snd.setLevel(0.05, 6); else H.sndDone = true; }
    if (H.state === 'flash' && H.snd) { H.snd.stop(0.15); H.snd = null; H.sndDone = true; }
    if (H.state === 'wait') {
      if (!lights.lamps[lampIdx]) return;
      if (!H.armed) { H.armed = true; lights.lamp(lampIdx, 'off'); }   // l'ultima lampada resta spenta: in fondo c'e' solo penombra
      H.obj.visible = (!!glass?.done || (glass?.state === 'vanish' && glass.t > 2.2)) && z < -8 && z > ZT - 0.5;   // compare ~1,3 s prima della fine della scena del vetro (~2 m di cammino in anticipo)   // compare solo dopo la scena del vetro (le mani sul vetro)
      H.obj.rotation.y = Math.atan2(player.pos.x - H.obj.position.x, z - H.obj.position.z);   // guarda verso di te
      if (z < ZT) { H.state = 'flash'; H.t = 0; lights.lamp(lampIdx, 'flicker', 0.9); audio.swell?.(1.2, 0.35); }
    } else if (H.state === 'flash') {
      H.t += dt; if (H.t > 0.2) H.obj.visible = false;   // alla prima luce e' sparito
      if (H.t > 1.0) { lights.lamp(lampIdx, 'on'); H.state = 'gone'; }
    }
  };
  return H;
}
