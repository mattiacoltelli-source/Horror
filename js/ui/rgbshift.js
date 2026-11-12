// SFASAMENTO RGB (aberrazione cromatica) brevissimo: la vista che si appanna per la paura. Solo in 2 momenti della partita.
// Il gioco disegna direttamente a schermo; il passaggio in piu' (scena su texture + sfasamento dei canali ai bordi) scatta SOLO nei pochi fotogrammi
// in cui l'effetto e' acceso, quindi il resto del tempo non costa nulla. Sincronizzato come due battiti ravvicinati. Rispetta "riduci movimento".
import * as THREE from 'three';

const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let t0 = -1e9, k = 1, now = 0;
export function rgbPulse(strength = 1) { if (!reduce) { t0 = now; k = strength; } }
const env = (t) => { const b = (x) => (x < 0 ? 0 : Math.exp(-x * 6.5) * Math.min(1, x * 28)); return Math.min(1, b(t) + 0.7 * b(t - 0.3)); };   // due battiti: il secondo piu' debole

export function createRgbShift(renderer) {
  const ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  let rt = null, quad = null, cam = null, mat = null, qs = null;
  const init = () => {
    rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 2, depthBuffer: true });
    mat = new THREE.ShaderMaterial({
      uniforms: { tD: { value: rt.texture }, uA: { value: 0 } }, depthTest: false, depthWrite: false, toneMapped: true,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tD; uniform float uA; varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 o = c * uA * (0.3 + 2.4 * r2);   // quasi nulla al centro, piu' forte ai bordi
          vec4 col = vec4(texture2D(tD, vUv + o).r, texture2D(tD, vUv).g, texture2D(tD, vUv - o).b, 1.0);
          gl_FragColor = col;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    qs = new THREE.Scene(); quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; qs.add(quad); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  };
  const size = new THREE.Vector2();
  return {
    update(dt) { now += dt; },
    render(scene, camera) {
      const a = ok ? env(now - t0) * k * 0.0042 : 0;   // ~2-3 px ai bordi al picco: appena percepibile
      if (a < 0.0002) { renderer.render(scene, camera); return; }
      if (!rt) init();
      renderer.getDrawingBufferSize(size); if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
      mat.uniforms.uA.value = a;
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
      renderer.render(qs, cam);
    },
  };
}
