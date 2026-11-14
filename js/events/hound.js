// IL CANE NELLA PENOMBRA (tunnel): in fondo, oltre la luce, si intravede appena una sagoma bassa e ferma (un cane scorticato, respira piano).
// Quando ti avvicini la luce in fondo sfarfalla e, quando torna, lui non c'e' piu'. Succede una sola volta. Modello: "Grimhound Rig" di DM-913 (CC-BY 4.0).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { aged } from '../world/aged.js';

export function createHound({ scene, player, lights, audio }) {
  const H = { state: 'wait', t: 0, obj: null }, lampIdx = 3, ZD = -45.6, ZT = -33.5;   // dove sta, e a che punto del tunnel parte lo scherzo
  let mixer = null;
  new GLTFLoader().load('assets/models/hound.glb', (g) => {
    const o = g.scene; aged(o, 0.4);
    o.traverse((m) => { if (!m.isMesh) return; for (const mat of [].concat(m.material)) { mat.fog = false; if (mat.map && !mat.alphaTest) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(0.15, 0.135, 0.135); mat.emissiveIntensity = 1; } } });   // un chiarore proprio: da lontano resta una sagoma pallida nel buio (senza, la nebbia e il buio se lo mangiano)
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const grp = new THREE.Group(); grp.add(o); grp.position.set(0.15, 0, ZD); grp.rotation.y = 0; grp.scale.setScalar(1.1); grp.visible = false; scene.add(grp); H.obj = grp;
    if (g.animations?.length) { mixer = new THREE.AnimationMixer(o); mixer.clipAction(g.animations[0]).play(); }
  });
  H.update = (dt) => {
    mixer?.update(dt);
    if (!H.obj || H.state === 'gone') return;
    const z = player.pos.z;
    if (H.state === 'wait') {
      if (!lights.lamps[lampIdx]) return;
      if (!H.armed) { H.armed = true; lights.lamp(lampIdx, 'off'); }   // l'ultima lampada resta spenta: in fondo c'e' solo penombra
      H.obj.visible = z < -8 && z > ZT - 0.5;
      H.obj.rotation.y = Math.atan2(player.pos.x - H.obj.position.x, z - H.obj.position.z);   // guarda verso di te
      if (z < ZT) { H.state = 'flash'; H.t = 0; lights.lamp(lampIdx, 'flicker', 0.9); audio.swell?.(1.2, 0.35); }
    } else if (H.state === 'flash') {
      H.t += dt; if (H.t > 0.2) H.obj.visible = false;   // alla prima luce e' sparito
      if (H.t > 1.0) { lights.lamp(lampIdx, 'on'); H.state = 'gone'; }
    }
  };
  return H;
}
