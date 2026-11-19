// OCCHIO COSMICO GIGANTE (entita' nello spazio, riutilizzabile in altri progetti): un occhio enorme e lontanissimo fatto di gas, tentacoli di buio e luce di stelle, quasi invisibile.
// Ispirato all'immagine di riferimento: iride = una sfera di vetro con dentro un cielo di stelle e galassie, pupilla orizzontale nera come un buco nero, filamenti arancio che partono dalla pupilla,
// sclera grigia piena di crepe nere, e tutt'intorno radici di buio che sfumano in nebulose arancio.
// Si nota solo se lo si cerca: fuori dallo sguardo e' un'ombra appena percettibile; appena ci si guarda in direzione, si apre piano, la pupilla ti segue e i filamenti pulsano.
// Se lo si fissa a lungo si sfalda in nebbia e si richiude; torna a formarsi solo quando si distoglie lo sguardo.
// Uso: const eye = createGiantEye({ dir: new THREE.Vector3(-0.55, 0.3, 0.78), size: 560, distance: 850 }); scene.add(eye.mesh);  eye.update(dt, camera);  (e togliere dopo: eye.dispose())
// Un solo piano con uno shader leggero: quattro texture disegnate in canvas una volta sola (corpo, sclera, iride, filamenti) e una soglia di dissolvenza.
import * as THREE from 'three';

function eyeTextures(seed = 3, W = 768, H = 480) {
  const rnd = (() => { let s = seed * 9973 + 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }, tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const cx = W / 2, cy = H / 2, IR = H * 0.31, EX = W * 0.29;   // centro, raggio dell'iride, semi-larghezza della mandorla
  const lidY = (x) => { const u = Math.max(0, 1 - ((x - cx) / EX) ** 2); return H * 0.27 * Math.pow(u, 0.85); };   // semi-altezza dell'apertura a quella x
  // ---- A: radici di buio e nebulose arancio attorno all'occhio (fuori dall'apertura) ----
  const A = mk(), a = A.getContext('2d');
  for (let i = 0; i < 46; i++) { const x = cx + (rnd() - 0.5) * W * 0.95, y = cy + (rnd() - 0.5) * H * 0.95, r = 30 + rnd() * 90, g = a.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(6,3,8,${0.28 + rnd() * 0.3})`); g.addColorStop(1, 'rgba(6,3,8,0)'); a.fillStyle = g; a.fillRect(x - r, y - r, 2 * r, 2 * r); }   // masse di fuliggine
  for (let i = 0; i < 44; i++) { const x = cx + (rnd() - 0.5) * W * 0.95, y = cy + (rnd() - 0.5) * H * 0.95, r = 50 + rnd() * 110, g = a.createRadialGradient(x, y, 0, x, y, r); const warm = rnd() < 0.62; g.addColorStop(0, warm ? `rgba(255,${100 + rnd() * 60 | 0},40,${0.2 + rnd() * 0.2})` : `rgba(70,${100 + rnd() * 50 | 0},200,${0.16 + rnd() * 0.16})`); g.addColorStop(1, warm ? 'rgba(255,90,30,0)' : 'rgba(60,90,190,0)'); a.fillStyle = g; a.fillRect(x - r, y - r, 2 * r, 2 * r); }   // nebulose calde
  const roots = [];
  for (let i = 0; i < 150; i++) { const side = rnd(); let ang = rnd() * 6.283; const x0 = cx + Math.cos(ang) * EX * (0.85 + rnd() * 0.2), y0 = cy + Math.sin(ang) * H * 0.22 * (0.8 + rnd() * 0.4); const pts = [[x0, y0]]; let x = x0, y = y0, d = Math.atan2(y0 - cy, (x0 - cx) / 2.6) + (rnd() - 0.5) * 0.8; const n = 5 + (rnd() * 6 | 0);
    for (let k = 0; k < n; k++) { d += (rnd() - 0.5) * 2.3; const st = 20 + rnd() * 46; x += Math.cos(d) * st * 1.4; y += Math.sin(d) * st; pts.push([x, y]); } roots.push({ pts, w: 1 + rnd() * rnd() * 6 }); }
  const path = (pts) => { a.beginPath(); a.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; a.quadraticCurveTo(pts[k][0], pts[k][1], mx, my); } a.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
  // venature cosmiche: filamenti sottili e sfumati (non ciglia) che si diramano come nebulose e fulmini di gas; una passata larga e morbida di buio, una sottile di luce
  a.lineCap = 'round'; a.filter = 'blur(5px)'; for (const r of roots) { path(r.pts); a.strokeStyle = 'rgba(6,3,12,.55)'; a.lineWidth = r.w * 1.6; a.stroke(); } a.filter = 'blur(1.4px)';
  a.globalCompositeOperation = 'lighter'; for (const r of roots) { path(r.pts); const warm = rnd() < 0.6; a.strokeStyle = warm ? `rgba(255,${120 + rnd() * 60 | 0},60,${0.1 + rnd() * 0.22})` : `rgba(110,140,255,${0.08 + rnd() * 0.16})`; a.lineWidth = 0.7 + r.w * 0.18; a.stroke(); }
  a.filter = 'none'; a.globalCompositeOperation = 'source-over';
  // palpebre: pieghe scure e pesanti attorno all'apertura
  for (let k = 0; k < 7; k++) for (const sgn of [-1, 1]) { a.beginPath(); for (let x = cx - EX * 1.08; x <= cx + EX * 1.08; x += 6) { const y = cy + sgn * (lidY(x) + 8 + k * 13 + Math.sin(x * 0.03 + k) * 4); x === cx - EX * 1.08 ? a.moveTo(x, y) : a.lineTo(x, y); } a.filter = 'blur(4px)'; a.strokeStyle = `rgba(5,3,9,${0.45 - k * 0.05})`; a.lineWidth = 10 - k; a.stroke(); a.filter = 'none'; }
  // ---- S: sclera grigia con crepe nere ramificate (dentro l'apertura) ----
  const S = mk(), s = S.getContext('2d');
  { const g = s.createRadialGradient(cx, cy, IR * 0.8, cx, cy, EX); g.addColorStop(0, 'rgba(215,220,230,.9)'); g.addColorStop(0.45, 'rgba(125,134,156,.9)'); g.addColorStop(1, 'rgba(22,26,44,.95)'); s.fillStyle = g; s.fillRect(0, 0, W, H); }
  for (let i = 0; i < 140; i++) { const x = cx + (rnd() - 0.5) * EX * 2, y = cy + (rnd() - 0.5) * H * 0.5, r = 8 + rnd() * 36, g = s.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rnd() < 0.4 ? '230,232,240' : '24,28,48'},${0.12 + rnd() * 0.22})`); g.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = g; s.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const crack = (x, y, ang, len, w, depth) => { s.strokeStyle = `rgba(8,6,14,${0.75 + rnd() * 0.2})`; s.lineWidth = w; s.beginPath(); s.moveTo(x, y); let px = x, py = y; const seg = 7 + (rnd() * 5 | 0); for (let k = 0; k < seg; k++) { ang += (rnd() - 0.5) * 0.9; px += Math.cos(ang) * len / seg; py += Math.sin(ang) * len / seg; s.lineTo(px, py); if (depth > 0 && rnd() < 0.34) crack(px, py, ang + (rnd() - 0.5) * 1.8, len * 0.5, w * 0.65, depth - 1); } s.stroke(); };
  for (const sgn of [-1, 1]) for (let i = 0; i < 8; i++) crack(cx + sgn * IR * (1.0 + rnd() * 0.15), cy + (rnd() - 0.5) * IR * 1.4, sgn > 0 ? (rnd() - 0.5) * 1.2 : Math.PI + (rnd() - 0.5) * 1.2, 40 + rnd() * 60, 2.6 - rnd(), 2);
  // ---- I: iride (texture propria, quadrata, a piena risoluzione). Di partenza una versione disegnata qui; se c'e' l'immagine dell'iride (irisUrl) la sostituisce appena caricata ----
  const N = 512, Ic = document.createElement('canvas'); Ic.width = Ic.height = N; const b = Ic.getContext('2d'), ic = N / 2, IRc = N * 0.46;
  b.save(); b.beginPath(); b.arc(ic, ic, IRc, 0, 7); b.clip();
  { const g = b.createRadialGradient(ic - IRc * 0.2, ic - IRc * 0.2, IRc * 0.1, ic, ic, IRc); g.addColorStop(0, 'rgba(22,26,50,1)'); g.addColorStop(0.7, 'rgba(8,10,24,1)'); g.addColorStop(1, 'rgba(2,3,8,1)'); b.fillStyle = g; b.fillRect(0, 0, N, N); }
  for (let i = 0; i < 700; i++) { const an = rnd() * 6.283, rr = Math.sqrt(rnd()) * IRc, x = ic + Math.cos(an) * rr, y = ic + Math.sin(an) * rr, sz = rnd() < 0.04 ? 1.6 + rnd() * 1.4 : 0.4 + rnd() * 0.9; b.fillStyle = `rgba(${rnd() < 0.3 ? '255,200,150' : rnd() < 0.5 ? '190,210,255' : '255,255,255'},${0.35 + rnd() * 0.65})`; b.beginPath(); b.arc(x, y, sz, 0, 7); b.fill(); }
  b.restore();
  { const t = document.createElement('canvas'); t.width = t.height = N; const c = t.getContext('2d'); c.lineCap = 'round'; c.globalCompositeOperation = 'lighter';
    const bolt = (x, y, ang, len, w, depth) => { let px = x, py = y; const pts = [[x, y]]; const seg = 7 + (rnd() * 6 | 0); for (let k = 0; k < seg; k++) { ang += (rnd() - 0.5) * 1.0; px += Math.cos(ang) * len / seg; py += Math.sin(ang) * len / seg; pts.push([px, py]); if (depth > 0 && rnd() < 0.3) bolt(px, py, ang + (rnd() - 0.5) * 2, len * 0.45, w * 0.7, depth - 1); }
      for (const [wd, al, col] of [[w * 2.6, 0.06, '255,110,30'], [w, 0.85, '255,170,80'], [w * 0.4, 0.9, '255,240,210']]) { c.strokeStyle = `rgba(${col},${al})`; c.lineWidth = wd; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); c.stroke(); } };
    for (let i = 0; i < 46; i++) { const tt = rnd() * 6.283; bolt(ic + Math.cos(tt) * IRc * 0.62, ic + Math.sin(tt) * IRc * 0.2, tt + (rnd() - 0.5) * 0.7, IRc * (0.3 + rnd() * 0.5), 1.4 + rnd() * 1.4, 2); }
    b.drawImage(t, 0, 0); }
  b.save(); b.translate(ic, ic); b.scale(1, 0.27); { const g = b.createRadialGradient(0, 0, IRc * 0.45, 0, 0, IRc * 0.7); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.82, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = g; b.beginPath(); b.arc(0, 0, IRc * 0.7, 0, 7); b.fill(); } b.restore();   // pupilla orizzontale
  return [tex(A), tex(S), tex(Ic), { cx, cy, EX, IR, W, H }];
}

export function createGiantEye({ dir = new THREE.Vector3(-0.55, 0.3, 0.78), size = 520, distance = 850, seed = 3, baseVisibility = 0.24, res = 768, irisUrl = new URL('../../assets/tex/eye_iris.webp', import.meta.url).href } = {}) {
  const E = { openness: 0, vis: baseVisibility, dissolve: 0, stare: 0 };
  const H = Math.round(res * 0.625), [tA, tS, tI, M] = eyeTextures(seed, res, H);
  E.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uA: { value: tA }, uS: { value: tS }, uI: { value: tI }, uIr: { value: new THREE.Vector2(M.IR / M.W, M.IR / M.H) }, uT: { value: 0 }, uVis: { value: baseVisibility }, uOpen: { value: 0 }, uDis: { value: 0 }, uLook: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D uA, uS, uI; uniform vec2 uIr; uniform float uT, uVis, uOpen, uDis; uniform vec2 uLook;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() { vec2 p = vUv * 2.0 - 1.0; float rr = length(vec2(p.x * 0.92, p.y * 1.22)); if (rr > 1.0) discard;
        // apertura: mandorla che si schiude con uOpen (prima solo una fessura); sclera, iride e filamenti sono visibili solo dentro
        float hx = max(0.0, 1.0 - pow((p.x - 0.0) / 0.72, 2.0)), hh = 0.54 * pow(hx, 0.85) * uOpen, inside = 1.0 - smoothstep(hh * 0.9, hh + 0.012, abs(p.y));
        vec4 outer = texture2D(uA, vUv); vec4 sc = texture2D(uS, vUv); vec2 buv = vUv - uLook * vec2(0.07, 0.10);
        // iride: texture quadrata a piena risoluzione, mappata sul cerchio di raggio uIr; maschera morbida sul bordo; i filamenti luminosi pulsano
        vec2 iuv = (buv - 0.5) / (2.0 * uIr) + 0.5; float dI = length((iuv - 0.5) * 2.0); vec4 ir = texture2D(uI, iuv); ir.a = max(ir.a, step(0.01, max(ir.r, max(ir.g, ir.b)))) * (1.0 - smoothstep(0.86, 1.0, dI));
        float lum = dot(ir.rgb, vec3(0.3, 0.5, 0.2)); ir.rgb *= 1.0 + 0.5 * sin(uT * 2.3 + n2(iuv * 9.0) * 6.0) * smoothstep(0.35, 0.9, lum) + 0.1 * sin(uT * 0.7);
        float ai = max(sc.a, ir.a); vec3 inCol = sc.rgb * sc.a * 0.75; inCol = inCol * (1.0 - ir.a) + ir.rgb * ir.a;
        float edge = smoothstep(0.0, 0.05, hh) * (1.0 - smoothstep(0.0, 0.07, abs(abs(p.y) - hh)) * 0.5);   // ombra delle palpebre sul bordo
        vec3 col = outer.rgb * outer.a * (1.0 - inside * ai) + inCol * inside; float a = max(outer.a, ai * inside);
        // nebbia: l'occhio emerge dal gas, i bordi si sfaldano; con uDis alto si dissolve del tutto
        float fog = n2(p * 2.4 + vec2(uT * 0.05, 0.0)) * 0.6 + n2(p * 5.0 - vec2(0.0, uT * 0.08)) * 0.4;
        float rim = 1.0 - smoothstep(0.5, 1.0, rr), thr = uDis * 1.15;
        a *= rim * smoothstep(thr, thr + 0.18, fog + 0.15 * rim) * uVis; col *= rim * uVis;
        float halo = exp(-rr * rr * 4.0) * uVis * 0.08; col += vec3(0.3, 0.25, 0.4) * halo; a = max(a, halo * 0.6);
        gl_FragColor = vec4(col, a); }` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size), E.mat); mesh.renderOrder = -3; mesh.frustumCulled = false; E.mesh = mesh;
  const d = dir.clone().normalize(); E.dir = d;
  const fwd = new THREE.Vector3(), toEye = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), rx = new THREE.Vector3(), ry = new THREE.Vector3();
  E.update = (dt, camera) => {
    camera.getWorldDirection(fwd); mesh.position.copy(camera.position).addScaledVector(d, distance); mesh.quaternion.copy(camera.quaternion);   // sempre di fronte alla camera, a distanza infinita
    const ang = Math.acos(THREE.MathUtils.clamp(fwd.dot(d), -1, 1));                                   // quanto la visuale e' lontana dall'occhio
    const look = 1 - THREE.MathUtils.smoothstep(ang, 0.12, 0.7);                                        // 1 se lo si guarda
    E.stare = look > 0.6 ? E.stare + dt : Math.max(0, E.stare - dt * 2);
    const targetDis = E.stare > 3.2 ? 1 : 0; E.dissolve += (targetDis - E.dissolve) * Math.min(1, dt * (targetDis ? 0.6 : 0.3));
    E.openness += (look * (1 - E.dissolve * 0.6) - E.openness) * Math.min(1, dt * 1.2);
    E.vis += ((baseVisibility + look * 0.86) * (1 - E.dissolve * 0.5) - E.vis) * Math.min(1, dt * 2.0);
    // lo sguardo: l'iride va verso il punto in cui guarda il giocatore (se guarda l'occhio, lo ricambia al centro)
    rx.crossVectors(d, up).normalize(); ry.crossVectors(rx, d).normalize(); toEye.copy(fwd).sub(d);
    const lx = THREE.MathUtils.clamp(toEye.dot(rx) * -2.2, -1, 1), ly = THREE.MathUtils.clamp(toEye.dot(ry) * 2.2, -1, 1), u = E.mat.uniforms;
    u.uLook.value.x += (lx - u.uLook.value.x) * Math.min(1, dt * 3); u.uLook.value.y += (ly - u.uLook.value.y) * Math.min(1, dt * 3);
    u.uT.value += dt; u.uVis.value = E.vis; u.uOpen.value = 0.1 + E.openness * 0.9; u.uDis.value = E.dissolve;
  };
  new THREE.TextureLoader().load(irisUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; E.mat.uniforms.uI.value = t; E.irisTex = t; }, undefined, () => {});   // l'immagine dell'iride sostituisce quella disegnata (se manca resta la disegnata)
  E.dispose = () => { mesh.geometry.dispose(); E.mat.dispose(); tA.dispose(); tS.dispose(); tI.dispose(); E.irisTex?.dispose(); };
  return E;
}
