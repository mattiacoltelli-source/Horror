// Suor Agnese compare davanti al giocatore in entrambi i finali.
import * as THREE from 'three';
import { grimeNun } from '../world/nun.js';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createScare({ scene, camera, player, audio, lights, instab, finish }) {
  const S = { active: false, kind: null, t: 0, ready: false };
  const ent = new THREE.Group(); ent.visible = false; scene.add(ent); S.ent = ent;
  let mixer = null;
  let apparition = null;
  const loader = new GLTFLoader();
  const original = new URLSearchParams(location.search).get('agnese') === 'original';
  let legacyMaterials = original;
  const load = (url, fallback = false) => new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  }).then(({ scene: model, animations }) => {
    legacyMaterials = fallback || original;
    if (legacyMaterials) grimeNun(model);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(0.001, bounds.max.y - bounds.min.y);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.envMapIntensity = 0.15;
    });
    mixer = new THREE.AnimationMixer(model);
    for (const clip of animations) {
      const action = mixer.clipAction(clip);
      if (clip.name === 'Idle') action.play();
      if (clip.name === 'Apparition') {
        apparition = action;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
    }
    ent.add(model);
    S.model = model;
    S.mixer = mixer;
    S.ready = true;
  });
  S.loading = load(original ? 'assets/models/c_nurse.glb' : 'assets/models/agnese/suor-agnese.glb')
    .catch((error) => {
      console.warn('Agnese asset could not load', error);
      if (original) throw error;
      return load('assets/models/c_nurse.glb', true);
    }).catch((error) => { S.loadError = error; console.error('Agnese fallback failed', error); });

  const baseFov = () => camera.userData.baseFov ?? 68;
  const fwd = new THREE.Vector3(), pos = new THREE.Vector3();
  let kick = 0;
  const dir = new THREE.Vector3();

  S.trigger = (kind, text) => {
    S.text = text;
    if (S.active) return; S.active = true; S.kind = kind; S.t = 0;
    player.frozen = true; audio.duck(0, 0.05); lights.torchKill(0.95, 0); lights.lamp(2, 'off'); lights.lamp(3, 'off'); lights.lamp(1, 'off'); instab.set(1, 20);
    fwd.set(player.forward.x, 0, player.forward.z).normalize();
    // la figura compare SEMPRE nella direzione in cui stai guardando (prima, per 'ahead', era fissa verso -z: se guardavi altrove non la vedevi)
    dir.copy(fwd); player.pitch = 0.12;    // sguardo all'altezza del petto (mentre è buio)

  };

  S.update = (dt) => {
    mixer?.update(dt);
    if (!S.active) return; S.t += dt;
    const t = S.t;
    // 0 – 0.95 s: buio totale e silenzio (nessuna informazione visiva, il cuore accelera)
    if (t >= 0.95 && !S.fired) {
      S.fired = true; ent.visible = true; kick = 1;
      if (apparition) {
        mixer.stopAllAction();
        apparition.reset().setEffectiveTimeScale(1.5).play();
      }
      audio.scare(); player.addShake(1.6); try { navigator.vibrate?.([120, 40, 160]); } catch (_) {}
      lights.override = legacyMaterials ? 26 : 8;
    }
    if (S.fired) {
      const e = t - 0.95;
      // la figura "scatta" verso la camera in 0.18 s, poi trema
      const d = THREE.MathUtils.lerp(2.1, 1.15, Math.min(1, e / 0.18) ** 0.6);
      pos.copy(camera.position).addScaledVector(dir, d); pos.y = 0;
      ent.position.copy(pos); ent.position.y = -0.12 + Math.max(0, 0.4 - e) * 0.3;
      const reach = THREE.MathUtils.smoothstep(e, 0, 0.18);
      ent.rotation.set(0.07 + 0.07 * reach, Math.atan2(-dir.x, -dir.z), -0.035 * reach);
      kick = Math.max(0, kick - dt * 5.5);
      camera.fov = baseFov() + kick * 22; camera.updateProjectionMatrix();
      // il flash di luce dura pochissimo, la torcia balbetta
      const peak = legacyMaterials ? 26 : 8;
      const flicker = legacyMaterials ? 14 : 4;
      const low = legacyMaterials ? 2 : 0.6;
      lights.override = e < 0.14 ? peak : (Math.sin(e * 110) > 0 ? flicker : low);
      if (e > 0.42 && !S.cut) { S.cut = true; ent.visible = false; lights.override = 0; audio.cut(0.03); }
      if (e > 1.6 && !S.done) {
        S.done = true; camera.fov = baseFov(); camera.updateProjectionMatrix();
        finish(S.text || (S.kind === 'behind' ? 'ti sei girato.' : 'non ti sei girato.'), true);
      }
    }
  };
  return S;
}

