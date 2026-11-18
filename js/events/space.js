// CADUTA NELLO SPAZIO (10 s): dopo ENTRA nel portale della cantina si cade tra le stelle. Non ci si muove, ma ci si guarda intorno (stessa visuale del gioco).
// Si vedono la Via Lattea, galassie lontane, un pianeta roccioso, un mondo con oceani e nuvole, un gigante gassoso con gli anelli, il Sole, un buco nero con il disco
// di accrescimento e, in fondo, un altro portale come quello della cantina. Entrandoci (ultimo istante, lampo bianco) si arriva nella torre.
// Scena a parte (nessuna luce, solo shader), disegnata al posto del gioco finche' dura: leggera per un telefono medio. ?spazio=0 la salta.
import * as THREE from 'three';
import { portalMaterial } from '../world/portal.js';

const NOISE = `
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n3(p); p = p * 2.02 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return s; }
`;
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,235,190,.7)'); r.addColorStop(0.5, 'rgba(255,170,80,.18)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

const SUN = new THREE.Vector3(-46, 13, -64);   // posizione del Sole (illumina i pianeti)

export function createSpaceFall({ renderer, camera, player, audio, say, isBusy }) {
  const S = { active: false, t: 0, phase: 'idle' };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000004); S.scene = scene;
  const sc = new THREE.PerspectiveCamera(68, 1, 0.1, 2000); S.camera = sc;
  const clock = { t: 0 };
  const U = { uT: { value: 0 } };

  // ---- cielo: Via Lattea + stelle + galassie lontane (segue la camera) ----
  const sky = new THREE.Group(); scene.add(sky);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + `
      varying vec3 vD; uniform float uT;
      vec3 stars(vec3 d, float scale, float thr, float size) { vec3 p = d * scale, c = floor(p), f = fract(p); float h = h31(c); if (h < thr) return vec3(0.0);
        vec3 o = vec3(h31(c + 7.1), h31(c + 13.3), h31(c + 29.9)) * 0.7 + 0.15; float r = length(f - o), s = smoothstep(size, 0.0, r), t = h31(c + 3.7);
        return mix(vec3(0.6, 0.75, 1.0), vec3(1.0, 0.82, 0.6), t) * s * (0.35 + 1.4 * h31(c + 1.9)); }
      void main() { vec3 d = normalize(vD);
        vec3 gn = normalize(vec3(0.32, 0.86, 0.4)), gu = normalize(cross(gn, vec3(0.0, 0.0, 1.0))), gv = cross(gn, gu);
        float lat = dot(d, gn), lon = atan(dot(d, gv), dot(d, gu));
        float band = exp(-lat * lat * 16.0), f = fbm3(d * 3.0) * 0.6 + fbm3(d * 9.0) * 0.4;
        float dust = smoothstep(0.5, 0.72, fbm3(d * 5.5 + 7.0)), core = exp(-pow(lon - 0.9, 2.0) * 0.9) * band;
        vec3 col = band * (0.25 + 1.05 * f) * mix(vec3(0.3, 0.42, 0.95), vec3(1.0, 0.72, 0.45), core) * (1.0 - 0.7 * dust * band);
        col += vec3(0.10, 0.03, 0.16) * pow(fbm3(d * 2.0 + 3.0), 2.0) * 1.6 + vec3(0.02, 0.07, 0.16) * pow(fbm3(d * 2.4 + 9.0), 2.0) * 1.6;
        float dens = 0.80 - 0.12 * band;
        col += stars(d, 90.0, dens + 0.08, 0.18) * 1.4 + stars(d, 170.0, dens + 0.05, 0.16) + stars(d, 320.0, dens, 0.14) * 0.8 + stars(d, 40.0, 0.94, 0.2) * 2.0;
        col += vec3(0.5, 0.55, 0.9) * band * 0.12 * stars(d, 700.0, 0.55, 0.22).x * 6.0;
        gl_FragColor = vec4(col, 1.0); }` });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), skyMat); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; sky.add(skyMesh);
  const galaxyMat = (seed, tilt, hue) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uT: U.uT, uSeed: { value: seed }, uTilt: { value: tilt }, uHue: { value: hue } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + `varying vec2 vUv; uniform float uT, uSeed, uTilt; uniform vec3 uHue;
      void main() { vec2 p = (vUv - 0.5) * 2.0; p.y /= uTilt; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
        float arms = 0.5 + 0.5 * cos(2.0 * (a - log(r + 0.06) * 3.4 + uSeed + uT * 0.01)); float disc = exp(-r * 3.4), core = exp(-r * 15.0);
        float spec = step(0.97, h31(vec3(floor(p * 40.0), uSeed))) * 0.7 * disc;
        vec3 col = mix(uHue, vec3(1.0, 0.86, 0.62), core) * (disc * (0.25 + 1.05 * arms * smoothstep(0.08, 0.3, r)) + core * 1.6) + spec;
        float edge = 1.0 - smoothstep(0.75, 1.0, r); col *= edge; gl_FragColor = vec4(col, 1.0); }` });
  const addGalaxy = (dir, size, seed, tilt, hue, roll) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), galaxyMat(seed, tilt, new THREE.Color(...hue))); m.position.copy(dir.clone().normalize().multiplyScalar(700)); m.lookAt(0, 0, 0); m.rotateZ(roll); m.frustumCulled = false; m.renderOrder = -9; sky.add(m); };
  addGalaxy(new THREE.Vector3(-0.6, 0.2, -1), 150, 1.3, 0.45, [0.45, 0.6, 1.0], 0.6);
  addGalaxy(new THREE.Vector3(0.7, 0.45, -0.8), 95, 4.1, 0.7, [1.0, 0.7, 0.5], -0.4);
  addGalaxy(new THREE.Vector3(0.25, -0.5, -1), 70, 2.2, 0.35, [0.7, 0.5, 1.0], 1.2);
  addGalaxy(new THREE.Vector3(-0.9, 0.55, 0.3), 110, 5.6, 0.6, [0.55, 0.75, 1.0], 0.2);

  // ---- pianeti (shader: rocciosi, oceano con nuvole, gigante gassoso), illuminati dal Sole ----
  const planetMat = (kind, a, b, c) => new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uKind: { value: kind }, uSun: { value: SUN.clone() }, uA: { value: new THREE.Color(...a) }, uB: { value: new THREE.Color(...b) }, uC: { value: new THREE.Color(...c) } },
    vertexShader: 'varying vec3 vP, vN, vW; void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: NOISE + `varying vec3 vP, vN, vW; uniform float uT, uKind; uniform vec3 uSun, uA, uB, uC;
      void main() { vec3 n = normalize(vN), p = normalize(vP), L = normalize(uSun - vW), V = normalize(cameraPosition - vW); float ndl = dot(n, L), ndv = max(dot(n, V), 0.0);
        vec3 col;
        if (uKind < 0.5) { float f = fbm3(p * 4.0 + uT * 0.01), cr = smoothstep(0.58, 0.64, fbm3(p * 10.0)); col = mix(uA, uB, f) * (1.0 - 0.35 * cr); }
        else if (uKind < 1.5) { float lat = p.y, warp = fbm3(vec3(p.x * 3.0, lat * 12.0, p.z * 3.0) + uT * 0.03) * 0.4, bands = sin((lat + warp) * 20.0) * 0.5 + 0.5;
          col = mix(uA, uB, bands); col = mix(col, uC, smoothstep(0.62, 0.78, fbm3(vec3(p.x * 6.0, lat * 24.0, p.z * 6.0) + uT * 0.05))); }
        else { float land = smoothstep(0.5, 0.56, fbm3(p * 3.0 + 4.0)); col = mix(uA, uB, land); float cl = smoothstep(0.5, 0.78, fbm3(p * 5.0 + vec3(uT * 0.03, 0.0, 0.0))); col = mix(col, vec3(1.0), cl * 0.85); }
        float rim = pow(1.0 - ndv, 3.0);
        vec3 atm = (uKind > 1.5 ? vec3(0.3, 0.6, 1.0) : (uKind > 0.5 ? vec3(0.95, 0.75, 0.5) : vec3(0.55, 0.3, 0.25))) * rim * (0.1 + 0.9 * smoothstep(-0.2, 0.6, ndl));
        float lit = smoothstep(-0.08, 0.35, ndl);
        gl_FragColor = vec4(col * (0.025 + lit * 1.2) + atm, 1.0); }` });
  const planets = [];
  const addPlanet = (pos, r, mat, spin = 0.04) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); m.position.copy(pos); m.scale.setScalar(r); m.frustumCulled = false; scene.add(m); planets.push({ m, spin }); return m; };
  addPlanet(new THREE.Vector3(-8.5, 1.5, -15), 2.6, planetMat(0, [0.55, 0.22, 0.1], [0.85, 0.5, 0.28], [0, 0, 0]), 0.08);                                   // roccioso rosso, vicino a sinistra
  addPlanet(new THREE.Vector3(10.5, -2.5, -27), 3.4, planetMat(2, [0.03, 0.14, 0.4], [0.2, 0.45, 0.18], [1, 1, 1]), 0.05);                                     // oceani e nuvole, a destra
  const gas = addPlanet(new THREE.Vector3(17, 3.5, -50), 8.5, planetMat(1, [0.78, 0.6, 0.38], [0.45, 0.28, 0.16], [0.9, 0.82, 0.65]), 0.03);                    // gigante gassoso
  // anelli del gigante gassoso (inclinati)
  const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uSun: { value: SUN.clone() } },
    vertexShader: 'varying vec3 vL; varying vec3 vN2; void main() { vL = position; vN2 = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + `varying vec3 vL; varying vec3 vN2; void main() { float t = (length(vL.xy) - 1.25) / 1.05; if (t < 0.0 || t > 1.0) discard;
        float b = 0.5 + 0.5 * sin(t * 70.0 + fbm3(vec3(t * 14.0, 0.0, 1.0)) * 9.0), gap = 1.0 - smoothstep(0.02, 0.0, abs(t - 0.58)) - smoothstep(0.012, 0.0, abs(t - 0.82));
        float a = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.88, t) * (0.25 + 0.55 * b) * gap; vec3 col = mix(vec3(0.85, 0.72, 0.55), vec3(0.6, 0.5, 0.42), b) * 1.1;
        gl_FragColor = vec4(col, a); }` });
  const rings = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.3, 128, 1), ringMat); rings.position.copy(gas.position); rings.scale.setScalar(8.5); rings.rotation.set(-1.25, 0.25, 0.35); rings.frustumCulled = false; rings.renderOrder = 2; scene.add(rings);

  // ---- il Sole ----
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: 'varying vec3 vP, vN, vW; void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: NOISE + `varying vec3 vP, vN, vW; uniform float uT; void main() { vec3 p = normalize(vP), n = normalize(vN), V = normalize(cameraPosition - vW); float g = fbm3(p * 6.0 + uT * 0.15) * 0.6 + fbm3(p * 16.0 - uT * 0.3) * 0.4, ndv = max(dot(n, V), 0.0);
      vec3 col = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.95, 0.72), g) * (0.75 + 0.55 * ndv) + vec3(1.0, 0.5, 0.1) * pow(1.0 - ndv, 2.5) * 0.9; gl_FragColor = vec4(col * 1.35, 1.0); }` }));
  sun.position.copy(SUN); sun.scale.setScalar(11); sun.frustumCulled = false; scene.add(sun);
  for (const [sz, op] of [[38, 0.8], [90, 0.35], [200, 0.16]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: op })); sp.position.copy(SUN); sp.scale.setScalar(sz); sp.renderOrder = 3; scene.add(sp); }

  // ---- buco nero con disco di accrescimento e anello di luce piegata ----
  const BH = new THREE.Vector3(14, 3, -80), BHR = 3.2;
  const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); hole.position.copy(BH); hole.scale.setScalar(BHR); hole.renderOrder = 4; hole.frustumCulled = false; scene.add(hole);
  const diskMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vL; void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + `varying vec3 vL; uniform float uT; void main() { float rr = length(vL.xy), t = (rr - 1.7) / 4.6; if (t < 0.0 || t > 1.0) discard; float a = atan(vL.y, vL.x);
        float u = a + (1.4 / (t * 2.6 + 0.35)) * uT * 0.9; float st = fbm3(vec3(cos(u) * (1.2 + t * 3.0), sin(u) * (1.2 + t * 3.0), t * 9.0));
        float dop = 0.35 + 1.0 * (0.5 + 0.5 * cos(a - 0.9)); float inten = (1.0 - t) * (0.55 + 1.1 * st) * dop * smoothstep(0.0, 0.06, t);
        vec3 col = mix(vec3(1.0, 0.96, 0.85), vec3(1.0, 0.42, 0.1), pow(t, 0.7)) * inten * 1.5; gl_FragColor = vec4(col, 1.0); }` });
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.7, 6.3, 128, 8), diskMat); disk.position.copy(BH); disk.scale.setScalar(BHR); disk.rotation.set(-1.42, 0.0, 0.5); disk.frustumCulled = false; disk.renderOrder = 5; scene.add(disk);
  const haloMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uT; void main() { float d = length(vUv - 0.5) * 2.0; float ring = exp(-pow((d - 0.3) / 0.025, 2.0)) * (1.2 + 0.4 * sin(uT * 2.0)), glow = exp(-pow((d - 0.3) / 0.13, 2.0)) * 0.5; vec3 col = vec3(1.0, 0.78, 0.5) * ring + vec3(1.0, 0.45, 0.12) * glow; gl_FragColor = vec4(col, 1.0); }' });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(BHR * 14, BHR * 14), haloMat); halo.position.copy(BH); halo.renderOrder = 6; halo.frustumCulled = false; scene.add(halo);

  // ---- l'altro portale (come quello della cantina), verticale, in fondo al percorso ----
  const PORTAL = new THREE.Vector3(0, 0, -104), PR = 4.2;
  const pMat = portalMaterial({ r: PR, reach: 9, wallX: 1e5, zMin: -1e6 });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), pMat); portal.position.copy(PORTAL); portal.renderOrder = 8; portal.frustumCulled = false; scene.add(portal);

  // ---- percorso: caduta accelerata verso il portale (la visuale e' libera) ----
  const DUR = 10;
  const pathPos = (t, out) => { const z = -(2.5 * t + 0.7 * t * t); return out.set(0.5 * Math.sin(t * 0.9) + 0.015 * t * t, 0.35 * Math.sin(t * 0.7 + 1.0), z); };
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  let overlay = null;
  const ov = () => overlay ||= (() => { const d = document.createElement('div'); d.id = 'spacefade'; d.style.cssText = 'position:fixed;inset:0;z-index:60;background:#000;opacity:0;pointer-events:none;transition:opacity .5s'; document.body.appendChild(d); return d; })();

  S.start = (onDone) => {
    if (S.phase !== 'idle') return; S.phase = 'in'; S.onDone = onDone; S.t = 0; const o = ov(); o.style.background = '#000'; o.style.transition = 'opacity .5s'; o.style.opacity = '1';
    setTimeout(() => {
      S.active = true; S.phase = 'fall'; S.t = 0; clock.t = 0; player.speedMul = 0; player.yaw = 0; player.pitch = 0;   // da fermo, guardando in avanti
      o.style.transition = 'opacity .9s'; o.style.opacity = '0'; audio.space?.(DUR); say('Non puoi muoverti.\nGuardati intorno.', 3400);
    }, 600);
  };
  S.update = (dt) => {
    if (!S.active) return; S.t += dt; U.uT.value = S.t;
    for (const p of planets) p.m.rotation.y += p.spin * dt; rings.rotation.z += 0.0;
    const t = Math.min(DUR, S.t); pathPos(t, tmp); sc.position.copy(tmp);
    sc.aspect = camera.aspect; sc.fov = camera.fov; sc.updateProjectionMatrix();
    sc.quaternion.copy(camera.quaternion); q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.035 * Math.sin(S.t * 0.8)); sc.quaternion.multiply(q);   // piccolo rollio: sembra di cadere
    sky.position.copy(sc.position);
    halo.quaternion.copy(sc.quaternion);
    pMat.uniforms.uOpen.value = Math.min(1, Math.max(0, (S.t - 5.2) / 3.4)); pMat.uniforms.uT.value = S.t;
    if (S.t > 4.6 && !S.said1) { S.said1 = true; say('Il plasma delle stelle ti attraversa.', 3200); }
    if (S.t > 7.4 && !S.said2) { S.said2 = true; say('Un varco si apre davanti a te.', 3000); }
    if (S.t >= DUR - 0.5 && S.phase === 'fall') { S.phase = 'out'; const o = ov(); o.style.background = '#fff'; o.style.transition = 'opacity .45s'; o.style.opacity = '1'; }
    if (S.t >= DUR) { S.active = false; S.phase = 'idle'; S.said1 = S.said2 = false; player.speedMul = 1; S.onDone?.(); setTimeout(() => { const o = ov(); o.style.transition = 'opacity 1.1s'; o.style.opacity = '0'; }, 1800); }
  };
  S.render = () => renderer.render(scene, sc);
  return S;
}
