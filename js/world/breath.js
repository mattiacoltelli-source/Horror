// RESPIRO DELLE PARETI nel primo tunnel: per ~14 s il tunnel si stringe e si allarga del 5% con un'onda che corre lungo il corridoio, a ritmo di respiro.
// Solo disegno: collisioni e posizioni restano quelle di sempre. Vale per tutti i pezzi del tunnel (pareti, tubi, lampade, scritte); il pavimento resta a terra.
// Il vincolo sulla z nello shader limita l'effetto al tunnel (z da 3,6 a -50,5): le altre stanze, anche se usano gli stessi materiali, non cambiano.
import * as THREE from 'three';

const ZA = 3.6, ZB = -50.5;
export function createBreath({ scene, reduced = false }) {
  const B = { state: 'idle', t: 0, ready: false };
  const U = { uBrA: { value: 0 }, uBrP: { value: 0 } };
  const AMP = reduced ? 0.02 : 0.05, DUR = 14;
  const inject = (shader) => {
    shader.uniforms.uBrA = U.uBrA; shader.uniforms.uBrP = U.uBrP;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBrA; uniform float uBrP;')
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  { vec4 bw = modelMatrix * mvPosition;
    if (uBrA > 0.0 && bw.z < ${ZA.toFixed(1)} && bw.z > ${ZB.toFixed(1)}) { float k = 1.0 + uBrA * sin(uBrP - bw.z * 0.32); bw.x *= k; bw.y *= k; }
    mvPosition = viewMatrix * bw; }
  gl_Position = projectionMatrix * mvPosition;`);
  };
  const patch = (mat) => {
    if (!mat || mat.isShaderMaterial || mat.isPointsMaterial || mat.isSpriteMaterial || mat.userData.breathPatched) return;
    mat.userData.breathPatched = true;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
    mat.onBeforeCompile = function (shader, renderer) { prev.call(this, shader, renderer); inject(shader); };
    mat.customProgramCacheKey = () => key + '|respiro';
    mat.needsUpdate = true;
  };
  const box = new THREE.Box3();
  // Prepara le mesh che stanno nel tunnel (da chiamare prima della compilazione iniziale, e una seconda volta quando arrivano i pezzi asincroni).
  B.refresh = () => {
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!(o.isMesh) || o.isSkinnedMesh || o.userData.breathChecked) return;
      box.setFromObject(o); if (box.isEmpty()) return;
      o.userData.breathChecked = true;
      if (box.max.z < ZA + 0.5 && box.min.z > ZB - 0.5) for (const m of [].concat(o.material || [])) patch(m);
    });
    B.ready = true;
  };
  B.update = (dt, z) => {
    if (B.state === 'idle' && z < -3.5) { B.state = 'run'; B.t = 0; }
    if (B.state !== 'run') return;
    B.t += dt;
    const e = Math.min(1, B.t / 3) * Math.min(1, Math.max(0, (DUR - B.t) / 3)), s = e * e * (3 - 2 * e);
    U.uBrA.value = AMP * s; U.uBrP.value = B.t * (2 * Math.PI / 4.6);
    if (B.t >= DUR) { B.state = 'done'; U.uBrA.value = 0; }
  };
  return B;
}
