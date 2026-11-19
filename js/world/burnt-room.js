// L'AMBIENTE NELLO SPECCHIO: una versione bruciata e annerita della cantina, vista solo attraverso il vetro. Non e' la stanza vera ridisegnata: e' una scena minuscola
// (circa 40 disegni, tutti materiali senza luci, luce e fuoco "dipinti" nelle texture) con fiamme quasi spente nei bracieri, braci che pulsano e fumo lento.
// Stessi limiti della cantina (x, z, altezza): vista da chi e' riflesso, ha la stessa parallasse di una stanza vera.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/utils/BufferGeometryUtils.js';

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(0.25, 'rgba(255,140,50,.6)'); r.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(90,84,78,.55)'); r.addColorStop(0.5, 'rgba(70,64,60,.25)'); r.addColorStop(1, 'rgba(60,56,52,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export function createBurntRoom({ z0, w, l, h }) {
  const R = { scene: new THREE.Scene() }, S = R.scene; S.background = new THREE.Color(0x060302); S.fog = new THREE.FogExp2(0x0b0604, 0.045);
  const rnd = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const xl = -w / 2, xr = w / 2, z1 = z0 - l, B = [[-2.1, z0 - 5.5], [2.4, z0 - 9.5], [-1.4, z0 - 14.5], [2.1, z0 - 19]];   // posizioni dei bracieri
  const tl = new THREE.TextureLoader(), brick = tl.load('assets/tex/brick_c.jpg'); brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.colorSpace = THREE.SRGBColorSpace;
  const dark = (c) => new THREE.MeshBasicMaterial({ color: c }), canvasTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const glowAt = (g, x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,140,50,${a})`); gr.addColorStop(0.5, `rgba(200,80,25,${a * 0.4})`); gr.addColorStop(1, 'rgba(120,40,10,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };

  // ---- pavimento: assi bruciate, cenere, crepe di brace, chiazze di fuliggine; la luce dei bracieri e' cotta nella texture ----
  { const W = 256, H = Math.round(256 * l / w), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#1e1511'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${20 + rnd() * 20 | 0},${14 + rnd() * 10 | 0},10,${0.5 + rnd() * 0.4})`; g.fillRect(0, i * H / 90, W, H / 90 - 1); }                                  // assi
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${70 + rnd() * 50 | 0},${64 + rnd() * 40 | 0},${58 + rnd() * 30 | 0},${rnd() * 0.18})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 5, 1 + rnd() * 3); } // cenere
    for (let i = 0; i < 36; i++) { const x = rnd() * W, y = rnd() * H; g.strokeStyle = `rgba(255,${90 + rnd() * 60 | 0},30,${0.12 + rnd() * 0.25})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 22); g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40); g.stroke(); }  // brace nelle crepe
    for (const [bx, bz] of B) glowAt(g, (bx - xl) / w * W, (z0 - bz) / l * H, 60, 0.9);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: canvasTex(c) })); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, (z0 + z1) / 2); S.add(f); }

  // ---- pareti di mattoni anneriti + velo di fuliggine e luce dei bracieri (un'unica texture trasparente per parete) ----
  const wall = (len, x, z, ry, brazierAxis) => {
    const b = brick.clone(); b.needsUpdate = true; b.repeat.set(len / 1.6, h / 1.6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: b, color: 0x7a6252 })); m.position.set(x, h / 2, z); m.rotation.y = ry; S.add(m);
    const W = Math.round(len * 40), H = Math.round(h * 40), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.3, 'rgba(4,2,1,.28)'); gr.addColorStop(0.7, 'rgba(4,2,1,.3)'); gr.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);   // annerimento: soffitto e base
    for (let i = 0; i < 70; i++) { const x0 = rnd() * W, y0 = rnd() * H * 0.5, ln = 40 + rnd() * H * 0.7, gg = g.createLinearGradient(0, y0, 0, y0 + ln); gg.addColorStop(0, 'rgba(0,0,0,.6)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x0, y0, 2 + rnd() * 8, ln); }   // fiamme che hanno leccato il muro
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.3})`; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 6 + rnd() * 30, 4 + rnd() * 18, rnd() * 3, 0, 7); g.fill(); }
    if (brazierAxis === 'z') for (const [bx, bz] of B) glowAt(g, W - (z0 - bz) / l * W, H * 0.88, 70, 0.5 * Math.max(0.25, bx / (w / 2)));   // la luce dei bracieri sulla parete destra
    const o = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false })); o.position.copy(m.position); o.rotation.y = ry; o.translateZ(0.01); S.add(o); };
  wall(l, xr, (z0 + z1) / 2, -Math.PI / 2, 'z'); wall(w, 0, z1, 0, 'x'); wall(w, 0, z0, Math.PI, 'x');

  // ---- soffitto crollato: due lastre con un varco al centro, travi cadute e pilastri carbonizzati ----
  const charred = dark(0x0e0a08);
  for (const [cx, cw] of [[xl + 1.2, 2.4], [xr - 0.9, 1.8]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(cw, l), dark(0x0d0907)); s.rotation.x = Math.PI / 2; s.position.set(cx, h, (z0 + z1) / 2); S.add(s); }
  { const parts = [], bx = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
    for (let k = 0; k < 7; k++) bx(0.26, 0.28, 2.6 + rnd() * 2.8, -1.8 + rnd() * 3.6, h - 0.15 - rnd() * 0.4, z0 - 2 - k * 3.2, 0, 0, 0);                                  // travi trasversali
    bx(0.28, 0.3, 4.6, 0.6, 2.2, z0 - 11.5, 0.5, 0.1, 0.3); bx(0.3, 0.3, 3.4, -1.9, 1.5, z0 - 17.5, -0.7, 0.2, -0.2); bx(0.26, 0.26, 3.0, 1.2, 0.7, z0 - 6.5, 1.3, 0.4, 0);   // travi cadute
    for (const sz of [0.5, 1, 1.5, 2, 2.5].map((k) => z0 - 1 - k * 4.4)) { bx(0.5, h, 0.5, xr - 0.25, h / 2, sz); }                                                          // pilastri a destra
    S.add(new THREE.Mesh(mergeGeometries(parts), charred)); }

  // ---- detriti: sedia rovesciata, mucchi di macerie ----
  { const parts = [], bx = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
    bx(0.45, 0.05, 0.45, 0.7, 0.28, z0 - 8.2, 1.2, 0.5, 0.2); bx(0.05, 0.5, 0.45, 0.78, 0.5, z0 - 8.5, 1.2, 0.5, 0.2); for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) bx(0.05, 0.42, 0.05, 0.7 + dx * 1.1, 0.12, z0 - 8.2 + dz * 1.1, 0.7, 0.3, 0.5);   // sedia caduta
    S.add(new THREE.Mesh(mergeGeometries(parts), dark(0x0a0706)));
    const rub = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2, 0), dark(0x15100d), 22), d = new THREE.Object3D(); for (let i = 0; i < 22; i++) { const k = i % 4, [bx0, bz0] = B[k]; d.position.set(bx0 + (rnd() - 0.5) * 2.2, 0.07, bz0 + (rnd() - 0.5) * 2.2); d.scale.set(0.5 + rnd() * 1.4, 0.3 + rnd() * 0.5, 0.5 + rnd() * 1.4); d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); d.updateMatrix(); rub.setMatrixAt(i, d.matrix); } S.add(rub); }

  // ---- bracieri con fiamme quasi spente, braci che pulsano, fumo lento e alone sul pavimento ----
  const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uT: { value: 0 }, uK: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uK;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() { vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y); float n = n2(vec2(p.x * 3.0, p.y * 4.0 - uT * 2.6)) * 0.6 + n2(vec2(p.x * 7.0, p.y * 9.0 - uT * 4.4)) * 0.4;
        float wd = (1.0 - p.y) * (0.55 + 0.35 * n) * uK + 0.02, shape = smoothstep(wd, wd * 0.35, abs(p.x + (n - 0.5) * 0.35)) * smoothstep(1.0, 0.1, p.y + (1.0 - uK) * 0.5 + n * 0.25) * smoothstep(0.0, 0.08, p.y);
        vec3 col = mix(vec3(0.9, 0.25, 0.04), vec3(1.0, 0.7, 0.25), pow(1.0 - p.y, 2.0) * n) * shape * (0.55 + 0.6 * n); gl_FragColor = vec4(col, 1.0); }` });
  const anim = [];
  B.forEach(([bx, bz], i) => {
    const bowl = new THREE.LatheGeometry([[0, 0], [0.16, 0.0], [0.24, 0.1], [0.3, 0.2], [0.31, 0.22], [0.27, 0.22], [0.2, 0.12], [0, 0.1]].map(([r, y]) => new THREE.Vector2(r, y + 0.5)), 14); const parts = [bowl];
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4, leg = new THREE.CylinderGeometry(0.018, 0.026, 0.55, 5); leg.rotateZ(0.18); leg.rotateY(a); leg.translate(Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15); parts.push(leg); }
    const m = new THREE.Mesh(mergeGeometries(parts), dark(0x16120f)); m.position.set(bx, 0, bz); S.add(m);
    const fl = new THREE.Group(); for (let k = 0; k < 2; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), flameMat); p.position.y = 0.62; p.rotation.y = k * Math.PI / 2; fl.add(p); } fl.position.set(bx, 0, bz); S.add(fl);
    const NE = 26, ep = new Float32Array(NE * 3); for (let k = 0; k < NE; k++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.25; ep[k * 3] = bx + Math.cos(a) * r; ep[k * 3 + 1] = 0.66 + rnd() * 0.03; ep[k * 3 + 2] = bz + Math.sin(a) * r; }
    const em = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({ map: glowTex, size: 0.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); em.frustumCulled = false; S.add(em);
    const NS = 14, sp = new Float32Array(NS * 3), sd = []; for (let k = 0; k < NS; k++) sd.push({ ph: rnd(), dx: (rnd() - 0.5) * 0.5, dz: (rnd() - 0.5) * 0.5 });
    const sm = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ map: smokeTex, size: 0.9, transparent: true, depthWrite: false, fog: true, opacity: 0.8 })); sm.frustumCulled = false; S.add(sm);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 })); gl.rotation.x = -Math.PI / 2; gl.position.set(bx, 0.03, bz); S.add(gl);
    anim.push({ bx, bz, em, ep, sm, sp, sd, gl, ph: i * 1.7 });
  });
  { const NE = 60, ep = new Float32Array(NE * 3); for (let k = 0; k < NE; k++) { const [bx, bz] = B[k % 4]; ep[k * 3] = bx + (rnd() - 0.5) * 4.5; ep[k * 3 + 1] = 0.03; ep[k * 3 + 2] = bz + (rnd() - 0.5) * 4.5; }
    R.floorEmbers = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({ map: glowTex, size: 0.07, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 })); S.add(R.floorEmbers); }   // braci sparse a terra
  // un raggio freddo dal varco del soffitto (polvere nell'aria)
  { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(120,140,170,.35)'); gr.addColorStop(1, 'rgba(120,140,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
    for (const ry of [0, Math.PI / 2]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, h), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); sh.position.set(0.1, h / 2, z0 - 12); sh.rotation.y = ry; S.add(sh); } }

  R.update = (t) => {
    R.floorEmbers.material.opacity = 0.55 + 0.35 * Math.sin(t * 1.7); flameMat.uniforms.uT.value = t; flameMat.uniforms.uK.value = 0.62 + 0.16 * Math.sin(t * 1.3) + 0.07 * Math.sin(t * 5.1);
    for (const a of anim) { const f = 0.7 + 0.3 * Math.sin(t * 2.2 + a.ph) * Math.sin(t * 3.7 + a.ph * 2); a.gl.material.opacity = 0.35 + 0.25 * f; a.em.material.opacity = 0.55 + 0.45 * f; a.em.material.size = 0.09 + 0.03 * f;
      for (let k = 0; k < a.sd.length; k++) { const s = a.sd[k], u = (t * 0.16 + s.ph) % 1; a.sp[k * 3] = a.bx + s.dx * u * 2 + Math.sin(t * 0.7 + k) * 0.1 * u; a.sp[k * 3 + 1] = 0.75 + u * 2.6; a.sp[k * 3 + 2] = a.bz + s.dz * u * 2; }
      a.sm.geometry.attributes.position.needsUpdate = true; a.sm.material.size = 0.9; }
  };
  return R;
}
