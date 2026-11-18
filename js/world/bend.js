// PIEGA DEL REPARTO (solo con ?piega=1): per un attimo il corridoio si flette a S sopra e sotto il giocatore, poi torna dritto prima dell'obitorio.
// Il corridoio NON cambia: collisioni, posizioni ed eventi restano quelli di sempre (il giocatore cammina nello "spazio a riposo").
// Cambia soltanto come viene disegnato: ogni vertice del reparto passa da una mappa (x,y,s) -> piega, calcolata nello shader; la camera la segue.
// La mappa e' la stessa del laboratorio SPACE FOLD: un'onda antisimmetrica dell'angolo, quindi l'asse torna alla quota e alla posizione originali alla fine
// (con un leggero allungamento k nel tratto curvo) e il fondo del reparto resta attaccato all'obitorio, che non viene toccato.
import * as THREE from 'three';

const S0 = 2, SL = 13, N = 40, STEP = 0.5, ROLLK = 0.8, CY = 1.25;   // torsione massima = ROLLK x ampiezza della piega (circa 27°), attorno all'asse a 1,25 m      // la piega occupa s da 2 a 15 m dall'ingresso del reparto; campioni ogni 0,5 m su 20 m
const smooth5 = (v) => { const u = Math.max(0, Math.min(1, v)); return u * u * u * (10 + u * (-15 + 6 * u)); };
const smoothstep = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };

export function createBend({ group, z0, length = 20, camera, lights, audio, reduced = false }) {
  const B = { active: false, state: 'idle', t: 0, A: 0, follow: 0, followR: 0, k: 1 };
  const AMAX = reduced ? 0.4 : 0.6, SLOW = reduced ? 2 : 1;
  const U = { uBA: { value: 0 }, uBY: { value: new Float32Array(N + 1) }, uBZ: { value: new Float32Array(N + 1) } };
  const cy = U.uBY.value, cz = U.uBZ.value;
  for (let i = 0; i <= N; i++) cz[i] = -i * STEP;

  const rho = (s, A) => { const u = (s - S0) / SL; return u <= 0 || u >= 1 ? 0 : A * ROLLK * Math.sin(Math.PI * u); };   // torsione: onda a campana, zero agli estremi
  const theta = (s, A) => { const u = (s - S0) / SL; return u <= 0 || u >= 1 ? 0 : A * Math.sin(2 * Math.PI * u); };
  // Ricostruisce la tabella del centro dell'asse per l'ampiezza A: integrazione numerica, k normalizza la lunghezza longitudinale della piega a SL.
  function rebuild(A) {
    U.uBA.value = A;
    let sumC = 0; const n = 260;
    for (let i = 0; i < n; i++) sumC += Math.cos(theta(S0 + (i + 0.5) / n * SL, A)) * (SL / n);
    const k = SL / sumC; B.k = k;
    let y = 0, z = 0; cy[0] = 0; cz[0] = 0;
    for (let i = 1; i <= N; i++) {
      const sa = (i - 1) * STEP, sb = i * STEP, m = 12;
      for (let j = 0; j < m; j++) {
        const s = sa + (j + 0.5) / m * STEP, th = theta(s, A), kk = (s > S0 && s < S0 + SL) ? k : 1;
        y += Math.sin(th) * kk * (STEP / m); z -= Math.cos(th) * kk * (STEP / m);
      }
      cy[i] = y; cz[i] = z;
    }
  }
  rebuild(0);

  // punto del mondo "a riposo" -> punto piegato (stessa formula dello shader)
  B.mapPoint = (v) => {
    const sr = z0 - v.z, s = Math.max(0, Math.min(length, sr)), f = s / STEP, i = Math.min(N - 1, Math.floor(f)), t = f - i;
    const yy = cy[i] + (cy[i + 1] - cy[i]) * t, zz = cz[i] + (cz[i + 1] - cz[i]) * t, th = theta(s, B.A), c = Math.cos(th), sn = Math.sin(th);
    const ro = rho(s, B.A), rc = Math.cos(ro), rs = Math.sin(ro), dx = v.x, dy = v.y - CY;   // prima la torsione della sezione, poi la piega
    const xr = dx * rc - dy * rs, y = CY + dx * rs + dy * rc, rest = v.z - (z0 - s);
    v.x = xr; v.y = yy + y * c; v.z = z0 + zz + y * sn + rest; return v;
  };

  // ---------- shader: vertici piegati, normali ruotate ----------
  const f1 = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const GLSL_FN = `
uniform float uBA; uniform float uBY[${N + 1}]; uniform float uBZ[${N + 1}];
float bRho(float s) { float u = (s - ${f1(S0)}) / ${f1(SL)}; return (u <= 0.0 || u >= 1.0) ? 0.0 : uBA * ${f1(ROLLK)} * sin(3.14159265 * u); }
float bTheta(float s) { float u = (s - ${f1(S0)}) / ${f1(SL)}; return (u <= 0.0 || u >= 1.0) ? 0.0 : uBA * sin(6.2831853 * u); }
vec3 bPos(vec3 w, out float th, out float ro) {
  float s;
  s = clamp(${f1(z0)} - w.z, 0.0, ${f1(length)});
  float f = s * ${f1(1 / STEP)}; int i = int(min(floor(f), ${f1(N - 1)})); float t = f - float(i);
  float yy = mix(uBY[i], uBY[i + 1], t), zz = mix(uBZ[i], uBZ[i + 1], t);
  th = bTheta(s); ro = bRho(s); float c = cos(th), sn = sin(th), cr = cos(ro), sr = sin(ro);
  float dx = w.x, dy = w.y - ${f1(CY)}, xr = dx * cr - dy * sr, y = ${f1(CY)} + dx * sr + dy * cr;
  return vec3(xr, yy + y * c, ${f1(z0)} + zz + y * sn + (w.z - (${f1(z0)} - s)));
}
`;
  function inject(shader, material) {
    shader.uniforms.uBA = U.uBA; shader.uniforms.uBY = U.uBY; shader.uniforms.uBZ = U.uBZ;
    let v = shader.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_FN);
    if (!material.isMeshBasicMaterial && v.includes('#include <defaultnormal_vertex>')) {
      v = v.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  { vec3 bw = (modelMatrix * vec4(position, 1.0)).xyz; float bth, bro; bPos(bw, bth, bro); float bc = cos(bth), bs = sin(bth), rc = cos(bro), rs = sin(bro);
    vec3 vn = transpose(mat3(viewMatrix)) * transformedNormal; vn = vec3(vn.x * rc - vn.y * rs, vn.x * rs + vn.y * rc, vn.z);
    vn = vec3(vn.x, vn.y * bc - vn.z * bs, vn.y * bs + vn.z * bc); transformedNormal = mat3(viewMatrix) * vn; }`);
    }
    v = v.replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
  { vec3 bw = (modelMatrix * mvPosition).xyz; float bth, bro; vec3 bb = bPos(bw, bth, bro); mvPosition = viewMatrix * vec4(bb, 1.0); }
  gl_Position = projectionMatrix * mvPosition;`);
    shader.vertexShader = v;
  }
  function patchMaterial(mat) {
    if (!mat || mat.isShaderMaterial || mat.userData.bendPatched) return;
    mat.userData.bendPatched = true;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
    mat.onBeforeCompile = function (shader, renderer) { prev.call(this, shader, renderer); inject(shader, this); };
    mat.customProgramCacheKey = () => key + '|piega';
    mat.needsUpdate = true;
  }

  // ---------- geometria: i pezzi grandi si dividono ogni 25 cm lungo il corridoio (altrimenti le facce piatte non seguirebbero la curva) ----------
  function bake(mesh, step = 0.25) {
    mesh.updateWorldMatrix(true, false);
    let g = mesh.geometry.clone(); if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(mesh.matrixWorld);
    const names = Object.keys(g.attributes), sizes = names.map((n) => g.attributes[n].itemSize), stride = sizes.reduce((a, b) => a + b, 0), count = g.attributes.position.count;
    const ZI = 2;   // z e' la terza componente dell'attributo position (primo della lista)
    const vertex = (i) => { const a = new Float32Array(stride); let o = 0; names.forEach((n, k) => { const at = g.attributes[n]; for (let c = 0; c < sizes[k]; c++) a[o++] = at.getComponent(i, c); }); return a; };
    const clip = (poly, zc, above) => {
      const out = []; let a = poly[poly.length - 1];
      for (const b of poly) {
        const ain = above ? a[ZI] <= zc : a[ZI] >= zc, bin = above ? b[ZI] <= zc : b[ZI] >= zc;   // "above" = z minore o uguale (verso il fondo)
        if (ain !== bin) { const t = (zc - a[ZI]) / (b[ZI] - a[ZI]), v = new Float32Array(stride); for (let q = 0; q < stride; q++) v[q] = a[q] + (b[q] - a[q]) * t; out.push(v); }
        if (bin) out.push(b); a = b;
      }
      return out;
    };
    const out = [];
    for (let i = 0; i < count; i += 3) {
      const tri = [vertex(i), vertex(i + 1), vertex(i + 2)], zs = tri.map((v) => v[ZI]), hi = Math.max(...zs), lo = Math.min(...zs);
      const j0 = Math.floor((z0 - hi) / step), j1 = Math.floor((z0 - lo) / step);   // fette tra z0 - j*step e z0 - (j+1)*step
      for (let j = j0; j <= j1; j++) {
        let poly = clip(tri, z0 - j * step, true); if (poly.length < 3) continue;
        poly = clip(poly, z0 - (j + 1) * step, false); if (poly.length < 3) continue;
        for (let k = 1; k + 1 < poly.length; k++) out.push(poly[0], poly[k], poly[k + 1]);
      }
    }
    const ng = new THREE.BufferGeometry(); let o = 0;
    names.forEach((n, k) => {
      const arr = new Float32Array(out.length * sizes[k]); let p = 0; out.forEach((v) => { for (let c = 0; c < sizes[k]; c++) arr[p++] = v[o + c]; });
      ng.setAttribute(n, new THREE.BufferAttribute(arr, sizes[k], g.attributes[n].normalized)); o += sizes[k];
    });
    g.dispose(); ng.name = (mesh.geometry.name || mesh.name || 'pezzo') + '-piega';
    mesh.geometry = ng;
    mesh.removeFromParent(); mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1); mesh.updateMatrix();
    group.add(mesh); mesh.userData.bent = true;
  }
  const visibleChain = (o) => { for (let p = o; p && p !== group.parent; p = p.parent) if (p.visible === false) return false; return true; };
  // Prepara tutto il reparto: i pezzi grandi e statici vengono divisi, tutti i materiali ricevono la piega. Si puo' richiamare piu' volte (i pezzi arrivano in asincrono).
  B.refresh = () => {
    const meshes = []; group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) meshes.push(o); });
    const box = new THREE.Box3();
    for (const m of meshes) {
      if (m.userData.bent === undefined && m.geometry && visibleChain(m)) {
        m.updateWorldMatrix(true, false); box.setFromObject(m);
        if (box.max.z - box.min.z > 0.7 && !m.geometry.userData.noBend) { try { bake(m); } catch (e) { console.warn('piega: pezzo non diviso', m.name, e); m.userData.bent = false; } } else m.userData.bent = false;
      }
      m.frustumCulled = false;
      for (const mat of [].concat(m.material || [])) patchMaterial(mat);
    }
  };

  // ---------- sequenza: sale in ~4 s, resta ~2,5 s, torna dritta in ~4,5 s; sparisce comunque man mano che ci si avvicina all'obitorio ----------
  B.reset = () => { B.state = 'idle'; B.t = 0; B.setA(0); B.follow = 0; B.followR = 0; };
  B.setA = (A) => {
    if (Math.abs(A - B.A) < 1e-4 && !(A === 0 && B.A !== 0)) return;
    const was = B.active; B.A = A; rebuild(A); B.active = A > 1e-4;
    if (B.active) lights.mapPoint = B.mapPoint; else if (was) lights.mapPoint = null;
  };
  B.update = (dt, p) => {
    const s = z0 - p.z;
    if (B.state === 'idle' && s > 3) { B.state = 'run'; B.t = 0; audio?.swell?.(4 * SLOW, 0.5); }
    if (B.state === 'run') {
      B.t += dt / SLOW;
      const up = smooth5(B.t / 4), down = 1 - smooth5((B.t - 6.5) / 4.5);
      const env = Math.min(up, down);
      B.setA(AMAX * env * (1 - smoothstep(11, 15, s)));
      if (B.t > 11) { B.state = 'done'; B.setA(0); }
    } else if (B.state === 'done' || B.state === 'idle') { if (B.A !== 0) B.setA(0); }
  };
  // la camera segue il pavimento piegato: posizione mappata, orientamento ruotato dell'angolo locale (con un piccolo ritardo)
  const qx = new THREE.Quaternion(), qz = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0), az = new THREE.Vector3(0, 0, 1);
  B.applyCamera = (dt) => {
    const s = Math.max(0, Math.min(length, z0 - camera.position.z)), th = theta(s, B.A);
    B.follow += (th * 0.5 - B.follow) * (1 - Math.exp(-dt / 0.1));   // segue solo meta' dell'inclinazione: guardando lungo la tangente su una collina si vedrebbe il vuoto sopra la cresta
    B.followR += (rho(s, B.A) * 0.6 - B.followR) * (1 - Math.exp(-dt / 0.1));   // la camera segue il 60% della torsione
    B.mapPoint(camera.position);
    camera.quaternion.premultiply(qz.setFromAxisAngle(az, B.followR)).premultiply(qx.setFromAxisAngle(ax, B.follow));
    if (!reduced) {   // effetto vertigine: il campo visivo si allarga di qualche grado quando la piega e' al massimo
      const base = camera.userData.baseFov ?? 68, fov = base + 6 * (B.A / AMAX);
      if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
  };
  B.restoreFov = () => { if (reduced) return; const base = camera.userData.baseFov ?? 68; if (camera.fov !== base) { camera.fov = base; camera.updateProjectionMatrix(); } };
  return B;
}
