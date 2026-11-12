// EVENTO 1 — La sagoma dietro il vetro.
// La stanza dietro il vetro (layer 1) viene renderizzata a bassa risoluzione e mostrata dallo shader del vetro
// in coordinate schermo: sfocatura e opacità sono "gratis" e la sagoma resta credibile perché non è mai nitida.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { GLASS } from '../world/tunnel.js';

const ROOM_LAYER = 1;
const CX = (GLASS.x), CZ = (GLASS.z0 + GLASS.z1) / 2; // centro del vetro

const vert = `varying vec2 vUv; varying vec3 vW;
void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const frag = `precision highp float;
uniform sampler2D tRoom, tFrost, tHands; uniform vec2 uRes, uTexel; uniform float uTime, uShake, uHand, uLight, uBlur, uAmb;
uniform vec3 uCam, uDir; uniform float uHandZ; varying vec2 vUv; varying vec3 vW;
void main(){
  vec2 sc = gl_FragCoord.xy / uRes;
  float n = texture2D(tFrost, vUv*vec2(2.2,1.5)).r;
  float n2 = texture2D(tFrost, vUv*vec2(7.,5.)+3.1).g;
  sc += (vec2(n,n2)-.5)*0.012;
  sc.x += sin(uTime*85.)*0.006*uShake; sc.y += cos(uTime*71.)*0.004*uShake;
  vec3 r = vec3(0.);
  float b = uBlur;
  for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++) r += texture2D(tRoom, sc+vec2(float(i),float(j))*uTexel*b).rgb;
  r /= 25.;
  r *= uLight*1.12;                  // controluce più forte: la sagoma si stacca meglio
  r += r*r*0.9;                      // alone: la luce si espande oltre il suo bordo, come in un vetro smerigliato vero
  vec3 tint = vec3(.30,.36,.34);
  vec3 col = r*.82 + tint*(.07+.13*n)*(.35+uLight*.65);
  col = max(col, tint*0.05);           // anche a stanza spenta il vetro non è nero
  // sporco / colature
  float dirt = smoothstep(.45,.9,texture2D(tFrost, vec2(vUv.x*5., vUv.y*.5)).b);
  col *= 1. - dirt*.35;
  // riflesso della torcia
  vec3 d = normalize(vW-uCam);
  float gl = pow(max(dot(d,uDir),0.),24.);
  col += vec3(.55,.6,.55)*gl*(.15+.25*n)*uAmb;
  // impronte delle mani (macchie scure, bordi morbidi)
  vec2 hu = vec2(.5+(uHandZ-vW.z)/2.3, .5+(vW.y-1.5)/1.15);
  float h0 = texture2D(tHands, hu).a;
  float hb = (h0*2. + texture2D(tHands, hu+vec2(.007,0.)).a + texture2D(tHands, hu-vec2(.007,0.)).a + texture2D(tHands, hu+vec2(0.,.007)).a + texture2D(tHands, hu-vec2(0.,.007)).a)/6.;
  float halo = (texture2D(tHands, hu+vec2(.03,0.)).a + texture2D(tHands, hu-vec2(.03,0.)).a + texture2D(tHands, hu+vec2(0.,.03)).a + texture2D(tHands, hu-vec2(0.,.03)).a)*.25;
  float grain = .78 + .22*texture2D(tFrost, vUv*vec2(9.,6.)).g;
  col += vec3(.05,.06,.055)*halo*uHand*(1.-hb);               // condensa intorno al palmo
  col = mix(col, col*.16, clamp(hb*grain*1.05,0.,1.)*uHand);   // il contatto: scuro ma non nero, con grana
  float dist = length(vW-uCam);
  col *= exp(-dist*.02);
  gl_FragColor = vec4(col,1.);
}`;

function frostTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const im = g.createImageData(256, 256);
  // rumore a più ottave (R: grana, G: grana fine, B: macchie larghe)
  const rnd = () => Math.random();
  const grid = (s) => { const a = []; for (let i = 0; i < s * s; i++) a.push(rnd()); return (x, y) => {
    x = ((x % 1) + 1) % 1 * s; y = ((y % 1) + 1) % 1 * s; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const v = (i, j) => a[((j % s) * s) + (i % s)]; const sm = (t) => t * t * (3 - 2 * t);
    return v(x0, y0) * (1 - sm(fx)) * (1 - sm(fy)) + v(x0 + 1, y0) * sm(fx) * (1 - sm(fy)) + v(x0, y0 + 1) * (1 - sm(fx)) * sm(fy) + v(x0 + 1, y0 + 1) * sm(fx) * sm(fy); }; };
  const g1 = grid(8), g2 = grid(32), g3 = grid(4), g4 = grid(16);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4, u = x / 256, v = y / 256;
    im.data[i] = 255 * (0.6 * g1(u, v) + 0.4 * g4(u, v));
    im.data[i + 1] = 255 * (0.5 * g2(u, v) + 0.5 * rnd());
    im.data[i + 2] = 255 * (0.7 * g3(u, v) + 0.3 * g1(u, v));
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// Impronte di due mani aperte, premute sul vetro dall'altra parte. Se esiste assets/tex/hand.png (sagoma nera su fondo
// chiaro, oppure con trasparenza) viene usata quella; altrimenti ne disegno una più verosimile a mano.
function handsTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const procedural = () => {
    g.clearRect(0, 0, 512, 256);
    const hand = (cx, cy, flip) => {
      g.save(); g.translate(cx, cy); g.scale(flip, 1); g.filter = 'blur(2.5px)'; g.fillStyle = g.strokeStyle = 'rgba(0,0,0,.92)'; g.lineCap = 'round';
      // palmo: forma tozza, più larga alla base delle dita
      g.beginPath(); g.moveTo(-26, 52); g.bezierCurveTo(-40, 30, -38, -8, -30, -24); g.lineTo(30, -26); g.bezierCurveTo(40, -6, 38, 30, 24, 52); g.closePath(); g.fill();
      // dita (angolo, lunghezza, spessore): mignolo, anulare, medio, indice
      for (const [a, l, w, ox] of [[-0.32, 50, 11, -24], [-0.1, 66, 12.5, -8], [0.06, 72, 13, 9], [0.26, 62, 12.5, 25]]) {
        g.save(); g.translate(ox, -24); g.rotate(a); g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -l); g.stroke(); g.restore();
      }
      g.save(); g.translate(-30, 14); g.rotate(-1.05); g.lineWidth = 15; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -44); g.stroke(); g.restore();   // pollice
      // strisciate verso il basso sotto i polpastrelli: la mano è scivolata sul vetro
      g.globalAlpha = 0.35; g.lineWidth = 6; for (const dx of [-24, -6, 12, 28]) { g.beginPath(); g.moveTo(dx, 52); g.lineTo(dx + (Math.random() - 0.5) * 6, 120 + Math.random() * 40); g.stroke(); }
      g.restore();
    };
    hand(160, 112, 1); hand(352, 112, -1); tex.needsUpdate = true;
  };
  procedural();
  // mani vere (sagome ricavate da una foto di impronte, licenza Pixabay): A a sinistra, C specchiata a destra
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
  Promise.all([load('assets/tex/handA.png'), load('assets/tex/handC.png')]).then(([A, C]) => {
    if (!A || !C) return;
    g.clearRect(0, 0, 512, 256); g.filter = 'blur(1.4px)';
    const hA = 104, wA = hA * A.width / A.height, hC = 98, wC = hC * C.width / C.height;   // mani grandi (creatura alta), ma non gigantesche
    // pollici verso il centro: a sinistra la sagoma A specchiata, a destra la C com'è
    g.save(); g.translate(196, 0); g.scale(-1, 1); g.drawImage(A, -wA / 2, 128 - hA / 2 - 8, wA, hA); g.restore();
    g.drawImage(C, 330 - wC / 2, 128 - hC / 2, wC, hC);
    g.filter = 'none';
    // sbavatura verso il basso (la mano è scivolata sul vetro) e grana sul contatto
    const snap = document.createElement('canvas'); snap.width = 512; snap.height = 256; snap.getContext('2d').drawImage(c, 0, 0);
    g.globalAlpha = 0.07; for (let i = 1; i <= 9; i++) g.drawImage(snap, 0, 0, 512, 256, (i % 2 ? 1 : -1) * i * 0.35, i * 3.2, 512, 256);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.55})`; g.fillRect(Math.random() * 512, Math.random() * 256, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4); }
    g.globalCompositeOperation = 'source-over'; g.filter = 'blur(1.1px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    tex.needsUpdate = true;
  });
  return tex;
}

export function createGlassEvent({ scene, renderer, camera, player, audio, lights, instab, ui, onAbsorb }) {
  const E = { state: 'idle', t: 0, done: false, entity: null, ready: false };

  // --- stanza (layer 1) ---
  const room = new THREE.Group(); scene.add(room);
  const setLayer = (o) => o.traverse((c) => c.layers.set(ROOM_LAYER));
  const bgTex = new THREE.TextureLoader().load('assets/tex/bath_bg.jpg'); bgTex.mapping = THREE.EquirectangularReflectionMapping; bgTex.colorSpace = THREE.SRGBColorSpace;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, color: new THREE.Color(2.2, 2.3, 2.2), toneMapped: false }));
  sphere.position.set(CX + 5.5, 1.6, CZ); sphere.rotation.y = -1.9;
  room.add(sphere);
  // pavimento della stanza (continua col corridoio, riflette il bagliore)
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  // parete luminosa dietro la sagoma: controluce freddo con gradiente (è ciò che rende leggibile la silhouette)
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = 256; const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(0, 0, 2, 0, 0, 128); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.3, 'rgba(255,255,255,.8)'); grd.addColorStop(.55, 'rgba(255,255,255,.34)'); grd.addColorStop(.8, 'rgba(255,255,255,.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  gg.save(); gg.translate(128, 150); gg.scale(0.62, 1.0); gg.fillStyle = grd; gg.fillRect(-128, -150, 256, 256); gg.restore();   // ovale alto: illumina la figura dalla testa ai piedi
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: new THREE.Color(1.1, 0.9, 0.64), transparent: true, toneMapped: false, depthWrite: false }));
  wall.position.set(CX + 6.6, 1.5, CZ); wall.rotation.y = -Math.PI / 2; room.add(wall); E.wall = wall;
  setLayer(room);

  // --- la sagoma ---
  const ent = new THREE.Group(); ent.visible = false; scene.add(ent);
  let mixer = null, actions = {};
  new GLTFLoader().load('assets/models/whisperer.glb', (gltf) => {
    const m = gltf.scene;
    m.traverse((o) => { if (o.isMesh) { o.material = black; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    const s = 2.35 / size.y; m.scale.setScalar(s);
    box.setFromObject(m); const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -box.min.y, -c.z);
    ent.add(m); setLayer(ent); E.model = m; E.ready = true;
    mixer = new THREE.AnimationMixer(m);
    for (const clip of gltf.animations) { actions[clip.name] = mixer.clipAction(clip); }
    actions.Idle?.play(); if (actions.Walk) { actions.Walk.play(); actions.Walk.setEffectiveWeight(0); actions.Walk.timeScale = 0.45; }
  }, undefined, (e) => console.warn('whisperer.glb', e));
  E.entity = ent;

  // --- vetro ---
  const rt = new THREE.WebGLRenderTarget(256, 448, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  const frost = frostTexture(), hands = handsTexture();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: {
      tRoom: { value: rt.texture }, tFrost: { value: frost }, tHands: { value: hands },
      uRes: { value: new THREE.Vector2(1, 1) }, uTexel: { value: new THREE.Vector2(1 / 256, 1 / 448) },
      uTime: { value: 0 }, uShake: { value: 0 }, uHand: { value: 0 }, uHandZ: { value: CZ }, uLight: { value: 0 }, uBlur: { value: 1.6 }, uAmb: { value: 1 },
      uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, -1) },
    },
  });
  const gw = GLASS.z0 - GLASS.z1, gh = GLASS.y1 - GLASS.y0;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat);
  glass.rotation.y = -Math.PI / 2; glass.position.set(GLASS.x, (GLASS.y0 + GLASS.y1) / 2, CZ);
  scene.add(glass);
  E.glass = glass; E.rt = rt; E.mat = mat;
  // cornice in metallo ruggine
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.6, metalness: 0.8 });
  const fr = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), frameMat); m.position.set(x, y, z); scene.add(m); };
  const t = 0.07, fx = GLASS.x - 0.03;
  fr(0.08, t, gw + t, fx, GLASS.y0, CZ); fr(0.08, t, gw + t, fx, GLASS.y1, CZ);
  fr(0.08, gh, t, fx, (GLASS.y0 + GLASS.y1) / 2, GLASS.z0); fr(0.08, gh, t, fx, (GLASS.y0 + GLASS.y1) / 2, GLASS.z1);
  fr(0.06, gh, 0.04, fx, (GLASS.y0 + GLASS.y1) / 2, CZ);   // montante centrale

  const glassPos = new THREE.Vector3(GLASS.x, 1.3, CZ);
  let light = 0, targetLight = 0, hand = 0, handDecay = 0, shake = 0, lunge = 0, sway = 0;
  const PATH = { a: [8.2, CZ - 3.5], b: [4.4, CZ - 0.1], dur: 3.2, contact: CZ + 0.2 };   // tutto a tempo: ~7.5 s dall'avvicinamento alla mano sul vetro, indipendente da dove guardi   // viene da lontano VERSO il vetro (non parallelo al corridoio)
  let walkZ = CZ, walkW = 0, ex = 7, ez = CZ, entScale = 1, blur = 1.8, waitT = 0, silenceFired = false;

  const dir = new THREE.Vector3(), ep = new THREE.Vector3();
  // la sagoma è nell'inquadratura?
  const entSeen = (x, z) => {
    ep.set(x, 1.3, z).project(camera);
    if (!(ep.z < 1 && Math.abs(ep.x) < 0.95 && Math.abs(ep.y) < 0.95)) return false;
    // il raggio camera → sagoma deve attraversare il vetro (non il muro)
    const c = camera.position, t = (GLASS.x - c.x) / (x - c.x);
    if (!(t > 0 && t < 1)) return false;
    const gz = c.z + t * (z - c.z), gy = c.y + t * (1.3 - c.y);
    return gz < GLASS.z0 && gz > GLASS.z1 && gy > GLASS.y0 && gy < GLASS.y1;
  };
  const teleport = () => {
    E.state = 'contact'; E.t = 0; E.sc = 0; E.swelled = false;
    ex = GLASS.x + 0.45; ez = PATH.contact; blur = 0.7;
    instab.set(0.85, 9);
  };
  E.update = (dt, time) => {
    const pz = player.pos.z, dxG = Math.hypot(player.pos.x - GLASS.x, pz - CZ);
    mat.uniforms.uTime.value = time;
    mat.uniforms.uCam.value.copy(camera.position);
    camera.getWorldDirection(dir); mat.uniforms.uDir.value.copy(dir);
    mat.uniforms.uAmb.value = 1;

    E.t += dt;
    switch (E.state) {
      case 'idle':
        if (pz < -17 && E.ready) { E.state = 'walk0'; E.t = 0; lights.lamp(1, 'flicker', 2.2); audio.swell(5, 0.6); targetLight = 1; ex = PATH.a[0]; ez = PATH.a[1]; ent.visible = true; E.gaze = 0; E.away = 0; E.blink = 0; E.unseenT = 0; }
        break;
      case 'walk0': {
        // PERCORSO FISSO, sempre uguale, indipendente da dove guardi o ti trovi: cammina dentro la stanza fino al suo punto
        const k = Math.min(1, E.t / PATH.dur), e = k;
        ex = THREE.MathUtils.lerp(PATH.a[0], PATH.b[0], e); ez = THREE.MathUtils.lerp(PATH.a[1], PATH.b[1], e);
        const wy = Math.atan2(PATH.b[0] - PATH.a[0], PATH.b[1] - PATH.a[1]), fy = -Math.PI / 2, m = THREE.MathUtils.smoothstep(k, 0.78, 1);
        E.yaw = wy + Math.atan2(Math.sin(fy - wy), Math.cos(fy - wy)) * m; blur = 1.5; sway = Math.sin(E.t * 2.0) * 0.012;
        if (k >= 1) { E.state = 'stare'; E.t = 0; waitT = 0; instab.set(0.5, 14); E.yaw = fy; }
        break;
      }
      case 'stare': {
        // ferma un attimo, lontana, a fissarti. SOLO A TEMPO (1.3 s): non dipende da dove guardi; poi un battito di buio e te la trovi attaccata al vetro.
        ex = PATH.b[0]; ez = PATH.b[1]; E.yaw = -Math.PI / 2 + Math.sin(E.t * 0.4) * 0.12; blur = 1.3;
        sway = Math.sin(E.t * 0.55) * 0.12 + Math.sin(E.t * 1.3) * 0.03;
        if (E.blink > 0) { E.blink -= dt; if (E.blink <= 0) { targetLight = 1; teleport(); } break; }
        if (E.t > 1.3) { E.blink = 0.35; targetLight = 0; }
        break;
      }
      case 'contact': {
        // attaccata al vetro, ferma 1.5 s (si sente salire il suono), qualunque cosa tu guardi; poi il silenzio e il colpo
        sway = Math.sin(E.t * 1.3) * 0.006;
        if (!E.swelled) { E.swelled = true; audio.swell(2.2, 0.4); }
        if (E.t > 1.5) { E.state = 'silence'; E.t = 0; audio.duck(0.03, 0.3); instab.set(0.7, 4); }
        break;
      }
      case 'silence':
        // silenzio totale: la lampada vicino si spegne un attimo, poi il colpo
        if (E.t > 0.35 && !silenceFired) { silenceFired = true; lights.lamp(1, 'off'); }
        if (E.t > 0.95) { E.state = 'slam'; E.t = 0; lights.lamp(1, 'flicker', 1.2); audio.glassHit(glassPos, 1); audio.duck(0.15, 0.2); player.addShake(0.9); shake = 1; ent.visible = false; hand = 1; handDecay = 0; lunge = 1; mat.uniforms.uHandZ.value = ez; instab.set(1, 9); }
        break;
      case 'slam':
        entScale = 1 + 0.06 * lunge; ex = GLASS.x + 0.13 + 0.32 * (1 - lunge);
        lunge = Math.max(0, lunge - dt * 7);
        shake = Math.max(0, shake - dt * 1.2);
        if (E.t > 0.55) { E.state = 'vanish'; E.t = 0; ent.visible = false; targetLight = 0; lights.lamp(1, 'on'); }
        break;
      case 'vanish':
        shake = Math.max(0, shake - dt * 1.2);
        if (E.t > 3.5) { audio.duck(1, 4); E.state = 'done'; E.t = 0; E.done = true; onAbsorb?.(); }
        break;
      case 'done':
        hand = Math.max(0.0, hand - dt * 0.04); // le impronte restano a lungo
        shake = 0;
        break;
    }
    light += (targetLight - light) * Math.min(1, dt * (targetLight > light ? 0.5 : 6));
    // la lampada dietro il vetro respira (onda lenta + tremolio) e ogni tanto cala: la sagoma si vede, poi non più
    E.dip = (E.dip || 0) - dt; let pf = 0.62 + 0.26 * Math.sin(time * 1.7) + 0.07 * Math.sin(time * 6.3 + 1) + 0.03 * Math.sin(time * 47);
    if (E.dip > 0) pf = 0.1 + Math.random() * 0.08; else if (Math.random() < dt * 0.2) E.dip = 0.08 + Math.random() * 0.16;
    if (E.state === 'slam') pf = 1.25;
    mat.uniforms.uLight.value = light * pf; wall.material.opacity = Math.min(1, pf * 1.05) * light;
    mat.uniforms.uShake.value = shake;
    mat.uniforms.uHand.value = hand;
    mat.uniforms.uBlur.value = blur;
    if (mixer) {
      const w = E.state === 'walk0' ? 1 : 0; walkW += (w - walkW) * Math.min(1, dt * 3);
      actions.Walk?.setEffectiveWeight(walkW); actions.Idle?.setEffectiveWeight(1 - walkW); mixer.update(dt);
    }
    ent.position.set(ex, 0, ez + sway);
    wall.position.set(ex + 0.9, 2.4, ez + 0.55 + sway * 0.5);
    ent.rotation.y = (E.yaw ?? -Math.PI / 2) + Math.sin(time * 0.7) * 0.03; // di fronte al corridoio (verso -x)
    ent.scale.setScalar(entScale);
  };

  // render della stanza nella render target a bassa risoluzione, solo se il vetro è davanti alla camera
  const vp = new THREE.Vector3();
  E.preRender = () => {
    if (E.state === 'idle' || E.state === 'done' && light < 0.01) return;
    vp.copy(glassPos).project(camera);
    if (vp.z > 1 || Math.abs(vp.x) > 1.6 || Math.abs(vp.y) > 1.6) return;
    const size = renderer.getSize(new THREE.Vector2());
    mat.uniforms.uRes.value.set(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
    // la RT ha lo stesso aspetto dello schermo (sampling in coordinate schermo)
    const w = 256, h = Math.max(64, Math.round(256 * size.y / size.x));
    if (rt.width !== w || rt.height !== h) { rt.setSize(w, h); mat.uniforms.uTexel.value.set(1 / w, 1 / h); }
    const prevMask = camera.layers.mask, prevBg = scene.background, prevFog = scene.fog;
    camera.layers.set(ROOM_LAYER); scene.background = null; scene.fog = null;
    const prevRT = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(prevRT);
    camera.layers.mask = prevMask; scene.background = prevBg; scene.fog = prevFog;
  };
  E.reset = () => { E.state = 'idle'; E.t = 0; E.done = false; E.gaze = 0; E.away = 0; E.blink = 0; ent.visible = false; light = targetLight = 0; hand = 0; silenceFired = false; ex = 7; };
  return E;
}
