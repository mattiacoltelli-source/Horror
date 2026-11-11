// JUMP SCARE (evento 5): costruito sulla scelta del giocatore.
//  'behind' = ti sei girato  → buio e silenzio, poi la torcia si riaccende e lei è a un metro da te.
//  'ahead'  = sei entrato nel buio senza girarti → poi la figura compare davanti.
// Dura meno di mezzo secondo di "esposizione": breve, luce instabile, mai a figura intera e ferma.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createScare({ scene, camera, player, audio, lights, instab, finish }) {
  const S = { active: false, kind: null, t: 0, ready: false };
  const ent = new THREE.Group(); ent.visible = false; scene.add(ent);
  // due figure a colori, in posa fissa (infermiera davanti a te se ti giri; incappucciata con tentacoli se vai avanti)
  const figs = {};
  const loader = new GLTFLoader();
  const loadFig = (key, url, h) => loader.load(url, (g) => {
    const m = g.scene; m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.roughness = 0.9; o.material.metalness = 0; o.material.color?.multiplyScalar(0.62); o.material.emissive?.setRGB(0, 0, 0); } });
    m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    m.scale.setScalar(h / size.y); box.setFromObject(m); m.position.set(-c.x, -box.min.y, -c.z);
    const holder = new THREE.Group(); holder.add(m); holder.visible = false; ent.add(holder); figs[key] = holder; S.ready = true;
  }, undefined, (e) => console.warn(url, e));
  loadFig('behind', 'assets/models/c_nurse.glb', 2.0);
  loadFig('ahead', 'assets/models/c_occ.glb', 2.2);
  let mixer = null;

  const baseFov = () => camera.userData.baseFov ?? 68;
  const fwd = new THREE.Vector3(), pos = new THREE.Vector3();
  let kick = 0, dir = new THREE.Vector3();

  S.trigger = (kind) => {
    if (S.active) return; S.active = true; S.kind = kind; S.t = 0;
    player.frozen = true; audio.duck(0, 0.05); lights.torchKill(0.95, 0); lights.lamp(2, 'off'); lights.lamp(3, 'off'); lights.lamp(1, 'off'); instab.set(1, 20);
    fwd.set(player.forward.x, 0, player.forward.z).normalize();
    if (kind === 'ahead') { fwd.set(0, 0, -1); }
    dir.copy(fwd); player.pitch = 0.12;    // sguardo all'altezza del petto (mentre è buio)
    for (const k in figs) figs[k].visible = k === kind;
  };

  S.update = (dt) => {
    if (!S.active) return; S.t += dt;
    const t = S.t;
    // 0 – 0.95 s: buio totale e silenzio (nessuna informazione visiva, il cuore accelera)
    if (t >= 0.95 && !S.fired) {
      S.fired = true; ent.visible = true; kick = 1;
      audio.scare(); player.addShake(1.6); try { navigator.vibrate?.([120, 40, 160]); } catch (_) {}
      lights.override = 26;
    }
    if (S.fired) {
      const e = t - 0.95;
      // la figura "scatta" verso la camera in 0.18 s, poi trema
      const d = THREE.MathUtils.lerp(2.1, 1.15, Math.min(1, e / 0.18) ** 0.6);
      pos.copy(camera.position).addScaledVector(dir, d); pos.y = 0;
      ent.position.copy(pos); ent.position.y = -0.12 + Math.max(0, 0.4 - e) * 0.3;
      ent.rotation.set(0.12, Math.atan2(-dir.x, -dir.z), 0);   // si china verso di te
      ent.position.x += Math.sin(e * 90) * 0.012;
      kick = Math.max(0, kick - dt * 5.5);
      camera.fov = baseFov() + kick * 22; camera.updateProjectionMatrix();
      // il flash di luce dura pochissimo, la torcia balbetta
      lights.override = e < 0.14 ? 26 : (Math.sin(e * 110) > 0 ? 14 : 2);
      if (e > 0.42 && !S.cut) { S.cut = true; ent.visible = false; lights.override = 0; audio.cut(0.03); }
      if (e > 1.6 && !S.done) {
        S.done = true; camera.fov = baseFov(); camera.updateProjectionMatrix();
        finish(S.kind === 'behind' ? 'ti sei girato.' : 'non ti sei girato.\nera già davanti a te.', true);
      }
    }
  };
  return S;
}
