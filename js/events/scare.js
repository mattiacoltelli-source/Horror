// Suor Agnese compare davanti al giocatore in entrambi i finali.
import * as THREE from 'three';
import { grimeNun } from '../world/nun.js';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';

export function createScare({ scene, camera, player, audio, lights, instab, finish }) {
  const S = { active: false, kind: null, t: 0, ready: false };
  const ent = new THREE.Group(); ent.visible = false; scene.add(ent); S.ent = ent;
  let headMesh = null;
  new GLTFLoader().load('assets/models/c_nurse.glb', ({ scene: model }) => {
    grimeNun(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2 / (bounds.max.y - bounds.min.y);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      addHeadPose(mesh);
      headMesh = mesh;
    });
    ent.add(model);
    S.ready = true;
  }, undefined, (error) => console.warn('c_nurse.glb', error));

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
    if (headMesh) headMesh.morphTargetInfluences[0] = 0.18;
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
      const reach = THREE.MathUtils.smoothstep(e, 0, 0.18);
      const tilt = THREE.MathUtils.smoothstep(e, 0.12, 0.23);
      ent.rotation.set(0.07 + 0.12 * reach, Math.atan2(-dir.x, -dir.z), -0.035 * reach);
      if (headMesh) headMesh.morphTargetInfluences[0] = 0.18 + 0.82 * tilt;
      kick = Math.max(0, kick - dt * 5.5);
      camera.fov = baseFov() + kick * 22; camera.updateProjectionMatrix();
      // il flash di luce dura pochissimo, la torcia balbetta
      lights.override = e < 0.14 ? 26 : (Math.sin(e * 110) > 0 ? 14 : 2);
      if (e > 0.42 && !S.cut) { S.cut = true; ent.visible = false; lights.override = 0; audio.cut(0.03); }
      if (e > 1.6 && !S.done) {
        S.done = true; camera.fov = baseFov(); camera.updateProjectionMatrix();
        finish(S.text || (S.kind === 'behind' ? 'ti sei girato.' : 'non ti sei girato.'), true);
      }
    }
  };
  return S;
}

/** Build a weighted neck-to-head pose from the original static mesh. */
function addHeadPose(mesh) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const height = max.y - min.y;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const pose = new Float32Array(positions.count * 3);
  const normalPose = new Float32Array(normals.count * 3);
  const pivot = new THREE.Vector3();
  let samples = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) < min.y + height * 0.91) continue;
    pivot.x += positions.getX(i);
    pivot.z += positions.getZ(i);
    samples++;
  }
  pivot.x /= Math.max(1, samples);
  pivot.z /= Math.max(1, samples);
  pivot.y = min.y + height * 0.84;

  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const angles = new THREE.Euler();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const weight = THREE.MathUtils.smoothstep((point.y - min.y) / height, 0.82, 0.94);
    rotation.setFromEuler(angles.set(0.09 * weight, -0.12 * weight, 0.19 * weight));
    point.sub(pivot).applyQuaternion(rotation).add(pivot);
    point.toArray(pose, i * 3);
    normal.fromBufferAttribute(normals, i).applyQuaternion(rotation).toArray(normalPose, i * 3);
  }
  geometry.morphAttributes.position = [new THREE.BufferAttribute(pose, 3)];
  geometry.morphAttributes.normal = [new THREE.BufferAttribute(normalPose, 3)];
  mesh.updateMorphTargets();
}
