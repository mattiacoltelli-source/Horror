// Finestra della cantina: cielo sferico di punti, senza piani/fondali o texture
// prospettiche. Una draw call, nessuna luce, MSAA o cottura procedurale.
import * as THREE from 'three';

export function createSpacePreview({ renderer, camera, low = globalThis.__quality === 'low' }) {
  const scene = new THREE.Scene(); scene.name = 'anteprima-spazio'; scene.background = new THREE.Color(0x000004);
  const view = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.1, 1000);
  const count = 900, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  let seed = 29;
  const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const y = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y), b = 0.25 + rnd() * 0.65;
    positions.set([r * Math.cos(a) * 450, y * 450, r * Math.sin(a) * 450], i * 3);
    colors.set([b * 0.8, b * 0.9, b], i * 3);
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)).setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: low ? 1 : 1.3, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false }));
  stars.frustumCulled = false; scene.add(stars);
  const target = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: false, samples: 0, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const res = new THREE.Vector2(2, 2), rotate = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const draw = (_dt, _pos, quat) => {
    renderer.getDrawingBufferSize(res);
    const scale = Math.min(1, (low ? 192 : 256) / Math.max(res.x, res.y));
    const w = Math.max(1, Math.round(res.x * scale)), h = Math.max(1, Math.round(res.y * scale));
    if (w !== target.width || h !== target.height) target.setSize(w, h);
    view.fov = camera.fov; view.aspect = camera.aspect; view.updateProjectionMatrix();
    // Le stelle sono all'infinito: seguono la rotazione, mai la traslazione.
    view.quaternion.copy(quat).premultiply(rotate); view.updateMatrixWorld(true);
    const previous = renderer.getRenderTarget();
    try { renderer.setRenderTarget(target); renderer.render(scene, view); }
    finally { renderer.setRenderTarget(previous); }
    return true;
  };
  return { scene, camera: view, target, tex: target.texture, res, draw,
    async prepare() {
      if (renderer.compileAsync) await renderer.compileAsync(scene, view);
      else renderer.compile(scene, view);
      draw(0, camera.position, camera.quaternion);
    } };
}
