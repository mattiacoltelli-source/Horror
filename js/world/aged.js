// OGGETTI BRUCIATI E USURATI: scurisce, desatura e annerisce con macchie di fuliggine (piu' fitte in basso, dove il fuoco ha leccato) i materiali di un modello.
// aged(obj, k): k 0..1 = quanto. Un solo shader leggero (rumore in fragment), nessuna texture in piu'.
import * as THREE from 'three';
let rustTex = null;
export function aged(obj, k = 0.7, rust = 0) {
  if (rust > 0 && !rustTex) { rustTex = new THREE.TextureLoader().load('assets/tex/rust_ov.jpg'); rustTex.wrapS = rustTex.wrapT = THREE.RepeatWrapping; rustTex.colorSpace = THREE.SRGBColorSpace; }
  obj.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const mats = [].concat(m.material).map((mat) => {
      const c = mat.clone(); c.roughness = Math.max(c.roughness ?? 0.8, 0.8); if (c.metalness) c.metalness *= 0.5;
      c.onBeforeCompile = (sh) => {
        sh.uniforms.uAge = { value: k }; sh.uniforms.uRust = { value: rust }; sh.uniforms.tRust = { value: rustTex };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAgeW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAgeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vAgeW; uniform float uAge, uRust; uniform sampler2D tRust;
float aH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float aN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(aH(i), aH(i + vec3(1,0,0)), f.x), mix(aH(i + vec3(0,1,0)), aH(i + vec3(1,1,0)), f.x), f.y), mix(mix(aH(i + vec3(0,0,1)), aH(i + vec3(1,0,1)), f.x), mix(aH(i + vec3(0,1,1)), aH(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
  { float gy = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gy) * vec3(1.0, 0.92, 0.82), 0.5 * uAge) * (1.0 - 0.5 * uAge);   // spento e meno nuovo
    float n = aN(vAgeW * 7.0) * 0.55 + aN(vAgeW * 23.0) * 0.3 + aN(vAgeW * 71.0) * 0.15;
    float low = 1.0 - smoothstep(0.0, 1.5, vAgeW.y);                                                                 // piu' bruciato in basso
    float ch = smoothstep(0.30 - 0.22 * low, 0.58 - 0.2 * low, n + low * 0.4) * uAge;                              // macchie di carbone
    float top = smoothstep(1.2, 2.4, vAgeW.y) * 0.25 * uAge;                                                         // fumo in alto
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.02, 0.016), clamp(ch + top * 1.5, 0.0, 0.92));
    if (uRust > 0.0) { vec3 rc = texture2D(tRust, vec2(vAgeW.x + vAgeW.z, vAgeW.y) * 0.9).rgb; float rm = smoothstep(0.38, 0.62, aN(vAgeW * 5.0) * 0.7 + (1.0 - low) * -0.15 + low * 0.25 + 0.15) * uRust;   // ruggine vera (texture) a chiazze, piu' in basso
      diffuseColor.rgb = mix(diffuseColor.rgb, rc * 0.62, clamp(rm, 0.0, 0.85)); }
    float wear = smoothstep(0.78, 0.9, aN(vAgeW * 41.0)) * 0.35 * uAge; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.3, 0.25), wear); }   // vernice saltata`);
      };
      c.customProgramCacheKey = () => 'aged' + k + '_' + rust;
      return c;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
  return obj;
}
