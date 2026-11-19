// OCCHIO GIGANTE (entita' nello spazio, riutilizzabile in altri progetti): un occhio enorme e lontanissimo, fatto di gas e nebbia, quasi invisibile.
// Si nota solo se lo si cerca: fuori dallo sguardo resta un'ombra appena percettibile; appena ci si guarda in direzione, si apre piano, la pupilla ti segue e le sue iridi si accendono.
// Se lo si fissa a lungo si sfalda in nebbia e si richiude; torna a formarsi solo quando si distoglie lo sguardo.
// Uso: const eye = createGiantEye({ dir: new THREE.Vector3(-0.55, 0.3, 0.78), size: 520, distance: 850 }); scene.add(eye.mesh);  eye.update(dt, camera);  (e togliere dopo: eye.dispose())
// Un solo piano con uno shader leggero (due texture disegnate in canvas, niente rumore per pixel oltre a una soglia di dissolvenza).
import * as THREE from 'three';

function eyeTextures(seed = 3) {
  const rnd = (() => { let s = seed * 9973 + 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const N = 512, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  // ---- A: bulbo oculare + palpebre: forma a mandorla, sclera nebbiosa con vene sottili, palpebre scure con pieghe ----
  const A = mk(), a = A.getContext('2d'); a.clearRect(0, 0, N, N);
  const almond = (hgt) => { a.beginPath(); a.moveTo(N * 0.04, N / 2); a.bezierCurveTo(N * 0.28, N / 2 - hgt, N * 0.72, N / 2 - hgt, N * 0.96, N / 2); a.bezierCurveTo(N * 0.72, N / 2 + hgt * 0.92, N * 0.28, N / 2 + hgt * 0.92, N * 0.04, N / 2); a.closePath(); };
  a.save(); almond(N * 0.42); a.clip();
  { const g = a.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N * 0.5); g.addColorStop(0, 'rgba(170,185,200,.55)'); g.addColorStop(0.6, 'rgba(110,125,150,.5)'); g.addColorStop(1, 'rgba(40,50,75,.7)'); a.fillStyle = g; a.fillRect(0, 0, N, N); }
  for (let i = 0; i < 70; i++) { const x0 = N * (rnd() < 0.5 ? 0.06 + rnd() * 0.12 : 0.82 + rnd() * 0.12), y0 = N * (0.38 + rnd() * 0.24); a.strokeStyle = `rgba(120,50,70,${0.1 + rnd() * 0.25})`; a.lineWidth = 0.6 + rnd() * 1.2; a.beginPath(); a.moveTo(x0, y0); let x = x0, y = y0; const dir = x0 < N / 2 ? 1 : -1; for (let k = 0; k < 6; k++) { x += dir * (14 + rnd() * 26); y += (rnd() - 0.5) * 22; a.lineTo(x, y); } a.stroke(); }   // vene verso gli angoli
  for (let i = 0; i < 260; i++) { a.fillStyle = `rgba(${200 + rnd() * 50 | 0},${210 + rnd() * 40 | 0},255,${rnd() * 0.07})`; a.beginPath(); a.arc(rnd() * N, N * (0.25 + rnd() * 0.5), 3 + rnd() * 18, 0, 7); a.fill(); }   // venature di gas
  a.restore();
  a.save(); a.globalCompositeOperation = 'destination-over';   // palpebre: bordo spesso e scuro con ombre
  almond(N * 0.42); a.lineWidth = N * 0.04; a.strokeStyle = 'rgba(14,12,26,.55)'; a.stroke(); a.restore();
  a.strokeStyle = 'rgba(70,60,95,.7)'; a.lineWidth = 3; for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) { a.beginPath(); a.moveTo(N * 0.1, N / 2 + s * 6); a.bezierCurveTo(N * 0.3, N / 2 + s * (N * (0.43 + k * 0.035)), N * 0.7, N / 2 + s * (N * (0.43 + k * 0.035)), N * 0.9, N / 2 + s * 6); a.globalAlpha = 0.3 - k * 0.07; a.stroke(); }
  a.globalAlpha = 1;
  // ---- B: iride + pupilla, centrate (si spostano nello shader): fibre radiali oro/verde, anello limbale scuro, pupilla a fessura con bordo luminoso ----
  const B = mk(), b = B.getContext('2d'); b.clearRect(0, 0, N, N); const cx = N / 2, cy = N / 2, IR = N * 0.27;
  { const g = b.createRadialGradient(cx, cy, IR * 0.3, cx, cy, IR); g.addColorStop(0, 'rgba(230,170,60,1)'); g.addColorStop(0.55, 'rgba(180,120,35,1)'); g.addColorStop(0.9, 'rgba(70,90,40,1)'); g.addColorStop(1, 'rgba(10,12,8,1)'); b.fillStyle = g; b.beginPath(); b.arc(cx, cy, IR, 0, 7); b.fill(); }
  b.save(); b.beginPath(); b.arc(cx, cy, IR, 0, 7); b.clip();
  for (let i = 0; i < 700; i++) { const an = rnd() * 6.283, r0 = IR * (0.2 + rnd() * 0.15), r1 = IR * (0.55 + rnd() * 0.5), l = rnd(); b.strokeStyle = l < 0.5 ? `rgba(255,${200 + rnd() * 50 | 0},90,${0.08 + rnd() * 0.25})` : `rgba(${60 + rnd() * 60 | 0},${60 + rnd() * 60 | 0},20,${0.1 + rnd() * 0.25})`; b.lineWidth = 0.6 + rnd() * 1.6; b.beginPath(); b.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 1.0); b.lineTo(cx + Math.cos(an + (rnd() - 0.5) * 0.12) * r1, cy + Math.sin(an + (rnd() - 0.5) * 0.12) * r1); b.stroke(); }
  b.restore();
  b.lineWidth = N * 0.022; b.strokeStyle = 'rgba(6,8,6,.92)'; b.beginPath(); b.arc(cx, cy, IR - N * 0.008, 0, 7); b.stroke();
  { const g = b.createRadialGradient(cx, cy, 2, cx, cy, IR * 0.42); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(255,180,70,.9)'); b.save(); b.translate(cx, cy); b.scale(0.42, 1); b.translate(-cx, -cy); b.fillStyle = g; b.beginPath(); b.arc(cx, cy, IR * 0.42, 0, 7); b.fill(); b.restore(); }   // pupilla verticale
  const t = (c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; return x; };
  return [t(A), t(B)];
}

export function createGiantEye({ dir = new THREE.Vector3(-0.55, 0.3, 0.78), size = 520, distance = 850, seed = 3, baseVisibility = 0.14 } = {}) {
  const E = { openness: 0, vis: baseVisibility, dissolve: 0, stare: 0 };
  const [texA, texB] = eyeTextures(seed);
  E.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uA: { value: texA }, uB: { value: texB }, uT: { value: 0 }, uVis: { value: baseVisibility }, uOpen: { value: 0 }, uDis: { value: 0 }, uLook: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D uA, uB; uniform float uT, uVis, uOpen, uDis; uniform vec2 uLook;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() { vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        // palpebre: l'apertura verticale cresce con uOpen (prima solo una fessura)
        vec2 q = vec2(p.x, p.y / max(0.12, uOpen)); vec2 auv = vUv; auv.y = 0.5 + (vUv.y - 0.5) / max(0.12, uOpen * 0.9 + 0.1);
        vec4 sc = texture2D(uA, clamp(auv, 0.0, 1.0)) * step(abs(auv.y - 0.5), 0.5);
        // iride e pupilla che seguono lo sguardo: spostamento limitato dentro la mandorla
        vec2 buv = auv - uLook * 0.12; vec4 ir = texture2D(uB, buv); ir.a *= step(0.0, buv.x) * step(buv.x, 1.0) * step(0.0, buv.y) * step(buv.y, 1.0) * sc.a;
        vec3 col = sc.rgb * sc.a * 0.65; col = col * (1.0 - ir.a) + ir.rgb * ir.a; float a = max(sc.a * 0.75, ir.a);
        // nebbia: l'occhio emerge da gas, i bordi si sfaldano; con uDis alto si dissolve del tutto
        float fog = n2(p * 2.4 + vec2(uT * 0.05, 0.0)) * 0.6 + n2(p * 5.0 - vec2(0.0, uT * 0.08)) * 0.4;
        float rim = 1.0 - smoothstep(0.42, 1.0, r), thr = uDis * 1.15;
        a *= rim * smoothstep(thr, thr + 0.18, fog + 0.15 * rim) * uVis; col *= rim * uVis;
        float halo = exp(-r * r * 5.0) * uVis * 0.08; col += vec3(0.25, 0.3, 0.55) * halo; a = max(a, halo * 0.6);
        gl_FragColor = vec4(col, a); }` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), E.mat); mesh.renderOrder = -3; mesh.frustumCulled = false; E.mesh = mesh;
  const d = dir.clone().normalize(); E.dir = d;
  const fwd = new THREE.Vector3(), toEye = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), rx = new THREE.Vector3(), ry = new THREE.Vector3();
  E.update = (dt, camera) => {
    camera.getWorldDirection(fwd); mesh.position.copy(camera.position).addScaledVector(d, distance); mesh.quaternion.copy(camera.quaternion);   // sempre di fronte alla camera, a distanza infinita
    const ang = Math.acos(THREE.MathUtils.clamp(fwd.dot(d), -1, 1));                                   // quanto la visuale e' lontana dall'occhio
    const look = 1 - THREE.MathUtils.smoothstep(ang, 0.12, 0.62);                                       // 1 se lo si guarda
    E.stare = look > 0.6 ? E.stare + dt : Math.max(0, E.stare - dt * 2);
    const targetDis = E.stare > 2.4 ? 1 : 0; E.dissolve += (targetDis - E.dissolve) * Math.min(1, dt * (targetDis ? 0.7 : 0.3));
    E.openness += (look * (1 - E.dissolve * 0.6) - E.openness) * Math.min(1, dt * 1.4);
    E.vis += ((baseVisibility + look * 0.85) * (1 - E.dissolve * 0.5) - E.vis) * Math.min(1, dt * 2.2);
    // lo sguardo: la pupilla va verso il punto in cui guarda il giocatore (se guarda l'occhio, lo ricambia al centro)
    rx.crossVectors(d, up).normalize(); ry.crossVectors(rx, d).normalize(); toEye.copy(fwd).sub(d);
    const lx = THREE.MathUtils.clamp(toEye.dot(rx) * -2.2, -1, 1), ly = THREE.MathUtils.clamp(toEye.dot(ry) * 2.2, -1, 1), u = E.mat.uniforms;
    u.uLook.value.x += (lx - u.uLook.value.x) * Math.min(1, dt * 3); u.uLook.value.y += (ly - u.uLook.value.y) * Math.min(1, dt * 3);
    u.uT.value += dt; u.uVis.value = E.vis; u.uOpen.value = 0.12 + E.openness * 0.88; u.uDis.value = E.dissolve;
  };
  E.dispose = () => { mesh.geometry.dispose(); E.mat.dispose(); texA.dispose(); texB.dispose(); };
  return E;
}
