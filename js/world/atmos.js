// Atmosfera per le stanze: fasci di luce sotto le lampade, pozzanghere che riflettono, macchie e colature sui muri.
// Tutto procedurale (nessun file in più): coni additivi, decal con alphaMap disegnata su canvas. Costo: ~10-20 mesh per stanza.
import * as THREE from 'three';

const rnd0 = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); return t; }

let blobT = null, streakT = null;
const blobTex = () => blobT ??= canvasTex(128, 128, (g, w, h) => {      // pozzanghera: macchia irregolare dai bordi morbidi
  const r = rnd0(5), n = 9; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * 22, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d, rad = 22 + r() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
});
const streakTex = () => streakT ??= canvasTex(64, 256, (g, w, h) => {   // colatura d'umidità: strisce verticali che sfumano in basso
  const r = rnd0(9); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { const x = 8 + r() * (w - 16), len = 90 + r() * 160, ww = 2 + r() * 7; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - ww / 2, 0, ww, len); g.beginPath(); g.arc(x, len * 0.94, ww * 0.9, 0, 7); g.fill(); }
  const gr2 = g.createLinearGradient(0, 0, 0, 40); gr2.addColorStop(0, 'rgba(255,255,255,.6)'); gr2.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr2; g.fillRect(0, 0, w, 40);
});

const shaftMat = (color, opacity) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: opacity } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 uC; uniform float uO; varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ float edge = pow(abs(dot(normalize(vN), normalize(-vP))), 2.2); float along = pow(vUv.y, 1.7); float near = smoothstep(0.15, 1.2, length(vP)); gl_FragColor = vec4(uC * (uO * edge * along * near), 1.0); }',
});

// o: { xl, xr, z0, z1, h, seed, lamps:[[x,y,z]], shaft:colore, shaftOpacity, stains, puddles, wallInset, avoid:[{side,z0,z1}], stainColor }
export function addAtmosphere(group, o) {
  const r = rnd0(o.seed || 1), cz = (o.z0 + o.z1) / 2, len = Math.abs(o.z0 - o.z1), inset = o.wallInset ?? 0.03;
  const avoidHit = (side, z) => (o.avoid || []).some((a) => a.side === side && z < a.z0 + 0.8 && z > a.z1 - 0.8);
  // Nel riflesso dello specchio (render target a bassa precisione di profondità) i piani sottili sovrapposti al pavimento/muro
  // sfarfallano a trattini neri: lì vengono resi invisibili (opacità 0), nella vista normale restano come sono.
  const add = (m) => { m.userData.decor = true; if (m.material.transparent && !m.material.isShaderMaterial) { const base = m.material.opacity; m.onBeforeRender = (renderer, scene, cam, geo, mat) => { mat.opacity = renderer.getRenderTarget() ? 0 : mat.userData.base ?? base; }; m.material.userData.base = base; } group.add(m); return m; };
  // fasci di luce sotto le lampade
  if (o.shaft != null) for (const [x, y, z] of o.lamps || []) {
    const rad = Math.min(1.7, y * 0.36), cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, rad, y - 0.02, 28, 1, true), shaftMat(o.shaft, o.shaftOpacity ?? 0.085));
    cone.position.set(x, y / 2, z); cone.renderOrder = 4; add(cone);
  }
  // macchie e colature sui muri (sotto al soffitto, scendono)
  const stainMat = (side) => new THREE.MeshBasicMaterial({ color: o.stainColor ?? 0x050403, alphaMap: streakTex(), transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (let i = 0; i < (o.stains ?? 8); i++) {
    const side = i % 2 ? 1 : -1, z = o.z0 - 1.5 - r() * (len - 3); if (avoidHit(side, z)) continue;
    const w = 0.7 + r() * 1.3, hh = Math.min(o.h * 0.75, 1.4 + r() * 2.4), m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), stainMat(side));
    m.position.set(side * ((o.xr - o.xl) / 2 - inset) + (o.xl + o.xr) / 2, o.h - hh / 2 - 0.02, z); m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; add(m);
  }
  // pozzanghere sul pavimento: riflettono le lampade e l'ambiente
  const pm = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.06, metalness: 0.9, alphaMap: blobTex(), transparent: true, opacity: 0.85, depthWrite: false, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (let i = 0; i < (o.puddles ?? 4); i++) {
    const s = 0.9 + r() * 1.6, m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (0.6 + r() * 0.6)), pm);
    m.rotation.x = -Math.PI / 2; m.rotation.z = r() * 6.28; m.position.set(o.xl + 1.2 + r() * (o.xr - o.xl - 2.4), 0.012, o.z0 - 2 - r() * (len - 4)); add(m);
    // un velo chiaro additivo sopra: finge il riflesso della luce, così non sembra un buco nero
    const gl = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: o.shaft ?? 0x8899aa, alphaMap: blobTex(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    gl.rotation.copy(m.rotation); gl.position.copy(m.position); gl.position.y += 0.002; add(gl);
  }
}
