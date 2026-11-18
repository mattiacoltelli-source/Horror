// ALLUNGAMENTO DEL TUNNEL: per un attimo il primo tunnel diventa lunghissimo (il fondo schizza lontano, le lampade si diradano), poi torna com'era.
// Solo disegno: collisioni e posizioni restano quelle di sempre. Ogni vertice del tunnel che sta DAVANTI al giocatore viene allontanato da lui di un fattore k (1 -> ~3,4 -> 1).
// Il vincolo sulla z nello shader limita l'effetto al tunnel (z da 3,6 a -50,5): le altre stanze, anche se usano gli stessi materiali, non cambiano.
// (file storico: prima conteneva il "respiro delle pareti", sostituito da questo effetto)
import * as THREE from 'three';

const ZA = 3.6, ZB = -50.5;
export function createBreath({ scene, audio, reduced = false }) {
  const B = { state: 'idle', t: 0, ready: false };
  const U = { uStK: { value: 1 }, uStZ: { value: 0 } };
  const KMAX = reduced ? 1.8 : 3.4;
  const meshes = [];
  const inject = (shader) => {
    shader.uniforms.uStK = U.uStK; shader.uniforms.uStZ = U.uStZ;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uStK; uniform float uStZ;')
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  { vec4 bw = modelMatrix * mvPosition;
    if (uStK > 1.0005 && bw.z < uStZ && bw.z < ${ZA.toFixed(1)} && bw.z > ${ZB.toFixed(1)}) bw.z = uStZ + (bw.z - uStZ) * uStK;
    mvPosition = viewMatrix * bw; }
  gl_Position = projectionMatrix * mvPosition;`);
  };
  const patch = (mat) => {
    if (!mat || mat.isShaderMaterial || mat.isPointsMaterial || mat.isSpriteMaterial || mat.userData.stretchPatched) return;
    mat.userData.stretchPatched = true;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
    mat.onBeforeCompile = function (shader, renderer) { prev.call(this, shader, renderer); inject(shader); };
    mat.customProgramCacheKey = () => key + '|allunga';
    mat.needsUpdate = true;
  };
  const box = new THREE.Box3();
  // Prepara le mesh del tunnel (prima della compilazione iniziale, e di nuovo quando arrivano i pezzi asincroni).
  B.refresh = () => {
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.userData.stretchChecked) return;
      box.setFromObject(o); if (box.isEmpty()) return;
      o.userData.stretchChecked = true;
      if (box.max.z < ZA + 0.5 && box.min.z > ZB - 0.5) { meshes.push(o); for (const m of [].concat(o.material || [])) patch(m); }
    });
    B.ready = true;
  };
  const setCull = (on) => { for (const m of meshes) m.frustumCulled = on; };   // il riquadro originale non vale piu' quando i vertici si spostano
  // curva: sale in 0,45 s, resta ~1 s, torna in 0,7 s
  const kAt = (t) => { const up = Math.min(1, t / 0.45), down = Math.min(1, Math.max(0, (t - 1.45) / 0.7)), e = (u) => u * u * (3 - 2 * u); return 1 + (KMAX - 1) * e(up) * (1 - e(down)); };
  B.update = (dt, z) => {
    if (B.state === 'idle' && z < -9 && z > -14) { B.state = 'run'; B.t = 0; setCull(false); audio?.swell?.(2, 0.35); }
    if (B.state !== 'run') return;
    B.t += dt; U.uStZ.value = z - 0.2; U.uStK.value = kAt(B.t);
    if (B.t >= 2.15) { B.state = 'done'; U.uStK.value = 1; setCull(true); }
  };
  B.k = () => U.uStK.value;
  return B;
}
