// Aspetto della suora: stesso modello di sempre, ma con sporco, sangue sul lembo e sulle mani, un filo di luce fredda sui bordi.
// Tutto nello shader (coordinate dell'oggetto), nessuna texture: il modello non ne ha. Va chiamato PRIMA di scalare il modello.
import * as THREE from 'three';

export function grimeNun(root) {
  const box = new THREE.Box3().setFromObject(root), uBox = new THREE.Vector2(box.min.y, Math.max(0.001, box.max.y - box.min.y));
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material; m.roughness = 0.6; m.metalness = 0; m.color?.multiplyScalar(0.62); m.emissive?.setRGB(0, 0, 0);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uBox = { value: uBox };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vOP; uniform vec2 uBox;
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float sc = uBox.y; vec3 q = vOP / sc; float t = (vOP.y - uBox.x) / uBox.y;
  float g = n3(q * 9.0) * 0.6 + n3(q * 31.0) * 0.4;
  diffuseColor.rgb *= mix(1.0, 0.5, smoothstep(0.42, 0.85, g));                                  // sporco, macchie di umidità
  diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.55, t));                                  // più sudicia verso il lembo
  float bl = smoothstep(0.55, 0.2, t) * smoothstep(0.42, 0.7, n3(q * 7.0 + 3.1));                // sangue rappreso sul lembo
  float dr = smoothstep(0.78, 0.62, t) * smoothstep(0.82, 0.95, n3(vec3(q.x * 26.0, q.y * 2.0, q.z * 26.0)));   // colature sul petto
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.012, 0.01), clamp(bl * 0.85 + dr * 0.8, 0.0, 0.9));`)
        .replace('#include <opaque_fragment>', `float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += vec3(0.05, 0.065, 0.09) * fr;                                                  // bordo freddo: la stacca dal buio
#include <opaque_fragment>`);
    };
    m.needsUpdate = true;
  });
}
