// PORTALE A TERRA (cantina, fuori dalla cripta): una ferita nel pavimento. Bordo frastagliato che pulsa, dentro il vuoto con stelle e un vortice, e venature di luce nel cemento
// che si diramano tutto intorno e pulsano di continuo, con onde che si allontanano dal centro. Un solo shader senza luci (nessuna ricompilazione degli altri materiali).
import * as THREE from 'three';

export function portalMaterial({ r = 1.05, reach = 2.7, wallX = 3.97, zMin = -223.9 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
    uniforms: { uT: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: 'varying vec2 vP; varying vec3 vW; void main() { vP = position.xy; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vP; varying vec3 vW; uniform float uT, uOpen;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
      void main() {
        if (vW.x > ${wallX.toFixed(2)} || vW.x < -${wallX.toFixed(2)} || vW.z < ${zMin.toFixed(2)}) discard;
        float R = ${r.toFixed(2)}, REACH = ${reach.toFixed(2)};
        float d = length(vP), a = atan(vP.y, vP.x);
        float open = smoothstep(0.0, 1.0, uOpen);
        float pulse = 0.5 + 0.5 * sin(uT * 2.1), pulse2 = 0.5 + 0.5 * sin(uT * 3.7 + 1.3);
        // bordo frastagliato: raggio modulato da rumore sull'angolo (punte e rientranze) che si muove piano
        float jag = fbm(vec2(a * 3.2 + 40.0, uT * 0.35)) * 0.55 + fbm(vec2(a * 9.0, uT * 0.8 + 7.0)) * 0.35 + (h21(vec2(floor(a * 14.0), 3.0)) - 0.5) * 0.25;
        float edgeR = R * open * (0.72 + 0.62 * jag + 0.06 * pulse);
        float inside = 1.0 - smoothstep(edgeR - 0.025, edgeR + 0.02, d);
        // vuoto: nero profondo con vortice e stelle
        float sw = sin(a * 3.0 + d * 7.0 - uT * 1.4) * 0.5 + 0.5;
        float nebula = fbm(vec2(cos(a + d * 1.6 - uT * 0.25), sin(a + d * 1.6 - uT * 0.25)) * 2.2 + d * 1.4);
        vec3 voidCol = vec3(0.01, 0.015, 0.05) + vec3(0.05, 0.09, 0.22) * nebula * (0.5 + 0.5 * sw) * (1.0 - d / (R * 1.2));
        vec2 sp = vP * 7.0 + vec2(uT * 0.05, 0.0); vec2 cell = floor(sp); float st = step(0.965, h21(cell)); float tw = 0.5 + 0.5 * sin(uT * 3.0 + h21(cell + 5.0) * 40.0);
        float star = st * tw * (1.0 - smoothstep(0.0, 0.18, length(fract(sp) - 0.5)));
        voidCol += vec3(0.8, 0.9, 1.0) * star;
        // luce del bordo: sottile, forte, pulsa
        float rim = exp(-pow((d - edgeR) / 0.045, 2.0)) * open, rim2 = exp(-pow((d - edgeR) / 0.2, 2.0)) * open;
        vec3 rimCol = vec3(0.55, 0.8, 1.0) * rim * (1.2 + 0.9 * pulse) + vec3(0.25, 0.45, 1.0) * rim2 * (0.35 + 0.4 * pulse2);
        // venature nel cemento: creste di rumore (linee sottili) che partono dal bordo e si allargano; onde luminose le percorrono verso l'esterno
        float reachNow = (edgeR + (REACH - edgeR) * open);
        float v1 = abs(fbm(vP * 2.4 + 3.1) - 0.5), v2 = abs(fbm(vP * 4.7 + 9.4) - 0.5);
        float cr = 1.0 - smoothstep(0.0, 0.05, v1), cr2 = (1.0 - smoothstep(0.0, 0.036, v2)) * 0.8;
        float vein = max(cr, cr2);
        float fade = (1.0 - smoothstep(reachNow * 0.7, reachNow, d)) * step(edgeR * 0.9, d);
        float wave = 0.5 + 0.5 * sin(d * 7.0 - uT * 2.6 + fbm(vP * 1.7) * 6.0), wave2 = 0.5 + 0.5 * sin(uT * 1.5 + n2(vP * 1.3) * 9.0);
        float vIn = vein * fade * (0.45 + 1.1 * wave * wave) * (0.7 + 0.6 * wave2) * open;
        vec3 veinCol = vec3(0.35, 0.65, 1.0) * vIn + vec3(0.9, 0.95, 1.0) * vIn * vIn * 0.4;
        // anche il cemento attorno si scalda: alone debole
        float glow = (1.0 - smoothstep(edgeR, edgeR + 0.9, d)) * (1.0 - inside) * open * (0.07 + 0.07 * pulse);
        vec3 col = voidCol * inside + rimCol + veinCol + vec3(0.2, 0.4, 1.0) * glow;
        float alpha = clamp(inside * 0.97 + rim * 0.6 + vIn * 0.5 + glow, 0.0, 1.0);
        col = clamp(col, 0.0, 3.0);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(col * min(1.0, alpha * 1.05 + 0.0) / max(alpha, 0.001) * alpha, alpha);
      }`,
  });
}

export function createPortal({ group, x, z, r = 1.05, reach = 2.7, wallX = 3.97, zMin = -223.9 }) {
  const P = { open: false, t: 0, x, z, r, enterR: 0.6, u: 0 };
  const S = reach * 2, mat = portalMaterial({ r, reach, wallX, zMin });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.026, z); mesh.visible = false; mesh.frustumCulled = false; mesh.name = 'portale-a-terra'; group.add(mesh);
  P.mesh = mesh;
  P.openIt = () => { if (P.open) return; P.open = true; P.t = 0; mesh.visible = true; };
  P.close = () => { P.open = false; P.t = 0; P.u = 0; mesh.visible = false; mat.uniforms.uOpen.value = 0; };
  P.update = (dt, t) => { if (!P.open) return; P.t += dt; P.u = Math.min(1, P.t / 3.2); mat.uniforms.uOpen.value = P.u; mat.uniforms.uT.value = t; };
  return P;
}
