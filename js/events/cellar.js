// STANZA 2 — LA CANTINA: lo specchio impossibile (EVENTO 2) e l'apparizione improvvisa (EVENTO 3, primo spavento).
// Specchio: planare reale (Reflector) a bassa risoluzione, renderizzato solo se in vista. La figura "dietro di te" esiste
// solo mentre guardi lo specchio: ogni volta che distogli lo sguardo e torni, è più vicina.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Reflector } from '../../vendor/three/Reflector.js';
import { buildRoom } from '../world/rooms.js';
import { bloodDecals } from '../world/blood.js';
import { decorCellar } from '../world/decor.js';
import { redLight } from '../world/redlight.js';
import { addExtras, pedestal, turnToward } from '../world/extra.js';
import { unseenMover } from './ambient.js';
import { addAtmosphere } from '../world/atmos.js';
import { WARD } from './ward.js';
import { P as PROF, whisperName } from '../personal.js';
import { createFingerWriter } from '../world/fingerwrite.js';
import { rgbPulse } from '../ui/rgbshift.js';

export const CELLAR = { z0: -200, w: 8, l: 24, h: 4.4 };
const MIRROR = new THREE.Vector3(-3.98, 1.45, -210);
const DIST = [7, 4.6, 2.6, 1.3, 0.7];

export function createCellar({ scene, mats, player, camera, audio, lights, instab, say, hall, flags, story, flash }) {
  const C = { group: new THREE.Group(), state: 'idle', step: -1, gaze: 0, away: 0, started: false, apDone: false };
  C.group.visible = false; scene.add(C.group);
  const room = buildRoom(mats, { z0: CELLAR.z0, w: CELLAR.w, l: CELLAR.l, h: CELLAR.h, wall: 'brick', floor: 'floorA', ceil: 'stone', pillarEvery: 5, dark: 0.85, seed: 23, exit: { w: 2, h: 2.5 } });
  C.group.add(room.group); decorCellar(C.group, CELLAR.z0); C.bounds = [room.bounds[0], room.bounds[1], CELLAR.z0 - CELLAR.l + 1.4, CELLAR.z0 - 0.6];

  const red = redLight(C.group, { x: CELLAR.w / 2 - 0.1, y: 2.5, z: CELLAR.z0 - 19.5, dir: 1 });   // luce rossa d'emergenza vicino all'uscita
  // specchio
  const mw = 1.7, mh = 2.4;
  const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: 256, textureHeight: 384, color: new THREE.Color(0xffffff), clipBias: 0.003 });
  mirror.position.copy(MIRROR); mirror.rotation.y = Math.PI / 2; C.group.add(mirror);
  // nel riflesso lo z-fighting del pavimento (pozzanghere, veli di luce, tombini incassati) fa comparire "quadratini" neri: durante il render dello specchio quegli oggetti sono nascosti
  { const orig = mirror.onBeforeRender; let flat = null;
    mirror.onBeforeRender = function (...a) {
      flat ??= (() => { const L = []; C.group.traverse((o) => { if (o.isMesh && o !== mirror && o.position.y < 0.035 && ((o.geometry.type === 'PlaneGeometry' && o.position.y > 0.001) || (o.material && /manhole/.test(o.material.name || '')))) L.push(o); }); return L; })();
      const vis = flat.map((o) => o.visible); flat.forEach((o) => (o.visible = false)); orig.apply(this, a); flat.forEach((o, i) => (o.visible = vis[i]));
    }; }
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 384; const dg = dc.getContext('2d');
  for (let i = 0; i < 700; i++) { dg.fillStyle = `rgba(18,20,19,${Math.random() * 0.25})`; dg.beginPath(); dg.arc(Math.random() * 256, Math.random() * 384, 0.5 + Math.random() * 2.2, 0, 7); dg.fill(); }
  for (let i = 0; i < 14; i++) { const x = Math.random() * 256, y = Math.random() * 200, g2 = dg.createLinearGradient(0, y, 0, y + 150 + Math.random() * 150); g2.addColorStop(0, 'rgba(15,18,16,.28)'); g2.addColorStop(1, 'rgba(15,18,16,0)'); dg.fillStyle = g2; dg.fillRect(x, y, 1.5 + Math.random() * 3, 330); }
  const grad = dg.createLinearGradient(0, 0, 0, 384); grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(.3, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.55)'); dg.fillStyle = grad; dg.fillRect(0, 0, 256, 384);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), transparent: true, depthWrite: false }));
  dirt.position.copy(MIRROR).add(new THREE.Vector3(0.004, 0, 0)); dirt.rotation.y = Math.PI / 2; C.group.add(dirt);
  const fm = new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 0.55, metalness: 0.85 });
  const bx = (sx, sy, sz, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), fm); m.position.set(MIRROR.x + 0.04, y, z); C.group.add(m); };
  bx(0.09, 0.1, mw + 0.2, MIRROR.y + mh / 2 + 0.05, MIRROR.z); bx(0.09, 0.1, mw + 0.2, MIRROR.y - mh / 2 - 0.05, MIRROR.z);
  bx(0.09, mh, 0.1, MIRROR.y, MIRROR.z + mw / 2 + 0.05); bx(0.09, mh, 0.1, MIRROR.y, MIRROR.z - mw / 2 - 0.05);

  // nello specchio: mai un modello visibile. Un'ombra scura che compare e scompare (vedo / non vedo) e impronte di sangue
  // che affiorano dall'interno del vetro. L'ombra usa la stessa sagoma nera della folla.
  const fig = hall.silhouette(0); fig.visible = false; C.group.add(fig); C.figReady = true;
  const mdecals = bloodDecals(C.group, [
    { k: 'A', p: [MIRROR.x + 0.012, 1.55, MIRROR.z + 0.28], wall: '+x', h: 0.5, rot: 0.15, flip: true, a: 0.0 },
    { k: 'C', p: [MIRROR.x + 0.012, 1.18, MIRROR.z - 0.34], wall: '+x', h: 0.46, rot: -0.2, a: 0.0 },
  ]); mdecals_fix(); const mdTarget = [0, 0, 0];
  function mdecals_fix() { mdecals.forEach((m) => { const mat = new THREE.MeshBasicMaterial({ map: m.material.map, transparent: true, opacity: 0, color: new THREE.Color(0.36, 0.02, 0.02), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); m.material = mat; }); }
  const wash = (lv, P, d) => { if (!flash) return; flash.color.setHex(0xffcf9a); flash.position.set(P.x - d.x * 3.2, 2.3, P.z - d.z * 3.2 + 1.2); flash.intensity = lv; };
  // PRESENZA: una massa scura INDEFINITA nel vetro (nebbia di ombra, senza testa né braccia): bordi che si sfilacciano, si sposta
  // lentamente, a tratti si addensa. Si capisce che c'è "qualcosa", non cosa. Nessuna figura riconoscibile.
  const NOISE = `float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+1.7;a*=.5;}return v;}`;
  const presMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.42) }, uS: { value: new THREE.Vector2(0.2, 0.34) }, uSeed: { value: Math.random() * 20 }, uHz: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uT, uA, uSeed, uHz; uniform vec2 uC, uS;\n${NOISE}
      void main(){
        vec2 p = (vUv - uC) / uS;
        p.x += 0.55 * (fbm(vec2(p.y * 0.9 + uSeed, uT * 0.22)) - 0.5);                       // la massa ondeggia di lato
        p.y += 0.25 * (fbm(vec2(p.x * 1.1 - uSeed, uT * 0.17)) - 0.5);
        float core = exp(-pow(p.x * 1.05, 2.0)) * smoothstep(-1.15, -0.35, p.y) * (1.0 - smoothstep(0.35, 1.25, p.y));   // alta e vaga
        float cloud = fbm(vUv * vec2(3.2, 2.2) + vec2(uT * 0.09, -uT * 0.13) + uSeed);
        float a = core * smoothstep(0.05, 0.55, cloud + core * 0.55);
        a = pow(a, 0.9) * uA;
        // velo pallido dietro la massa: l'ombra deve stagliarsi su qualcosa (il riflesso è troppo buio da solo)
        float hz = uHz * uA * (0.1 + 0.17 * fbm(vUv * 3.0 + uT * 0.05)) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float m = clamp(a, 0.0, 1.0);
        gl_FragColor = vec4(mix(vec3(0.62, 0.68, 0.66), vec3(0.004, 0.005, 0.005), m), clamp(max(hz, m * 0.94), 0.0, 0.95));
      }` });
  const mkPres = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), presMat()); m.rotation.y = Math.PI / 2; m.position.set(MIRROR.x + 0.017, MIRROR.y, MIRROR.z); C.group.add(m); return m; };
  const shFar = mkPres(), shNear = mkPres();
  shFar.material.uniforms.uS.value.set(0.12, 0.24); shFar.material.uniforms.uHz.value = 0;   // l'occhiata di sbieco: solo ombra, senza velo chiaro shNear.material.uniforms.uS.value.set(0.2, 0.36);
  // CONDENSA + SEGNI: qualcuno respira sul vetro dall'altra parte (chiazza di vapore che pulsa) e poi lo attraversa con le dita
  // (tre solchi che puliscono il vapore dall'alto in basso).
  const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blankTex.needsUpdate = true;   // versione personalizzata: il nome scritto col dito (js/world/fingerwrite.js) arriva qui come maschera
  const fogMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
    uniforms: { uT: { value: 0 }, uM: { value: 0 }, uW: { value: 0 }, uB: { value: new THREE.Vector2(0.47, 0.52) }, uMask: { value: blankTex }, uR: { value: 0.36 }, uTip: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uT, uM, uW; uniform vec2 uB; uniform sampler2D uMask; uniform vec3 uTip; uniform float uR;\n${NOISE}
      void main(){
        vec2 d = (vUv - uB) * vec2(1.0, 1.35);
        float edge = fbm(vUv * 6.0 + vec2(0.0, uT * 0.05)) - 0.5;
        float m = smoothstep(uR + edge * 0.18, 0.02, length(d)) * uM;
        float lines = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float x = uB.x + (fi - 1.0) * 0.085 + 0.016 * sin(vUv.y * 9.0 + fi * 2.1) + 0.02 * (fbm(vec2(vUv.y * 3.0, fi * 4.0)) - 0.5);
          float top = 0.84 - fi * 0.03, bot = 0.16 + fi * 0.045;
          float reach = top - (top - bot) * uW;                                        // il dito scende con uW
          float inside = step(reach, vUv.y) * step(vUv.y, top);
          float w = 0.013 + 0.005 * fbm(vec2(vUv.y * 8.0, fi));
          lines = max(lines, smoothstep(w, w * 0.35, abs(vUv.x - x)) * inside);
        }
        float lip = 0.0;                                                               // bordo più chiaro dove il vapore è stato spinto
        for (int i = 0; i < 3; i++) { float fi = float(i); float x = uB.x + (fi - 1.0) * 0.085 + 0.016 * sin(vUv.y * 9.0 + fi * 2.1) + 0.02 * (fbm(vec2(vUv.y * 3.0, fi * 4.0)) - 0.5); lip = max(lip, smoothstep(0.03, 0.012, abs(abs(vUv.x - x) - 0.026)) * step(0.16, vUv.y)); }
        float mk = texture2D(uMask, vUv).r, mb = texture2D(uMask, vUv, 2.2).r;       // scritta ditata: vapore pulito dove il dito e' passato, bordo piu' chiaro dove e' stato spinto
        lines = max(lines, mk); float lipM = clamp((mb - mk) * 1.8, 0.0, 1.0);
        float a = m * (1.0 - lines * 0.95) * (0.55 + 0.45 * fbm(vUv * 14.0));
        vec3 col = vec3(0.74, 0.8, 0.78);
        float tip = smoothstep(0.045, 0.0, length((vUv - uTip.xy) * vec2(1.7, 2.4))) * uTip.z;   // la punta del dito dall'altra parte del vetro: macchia scura e morbida
        col = mix(col, vec3(0.03, 0.04, 0.045), tip);
        gl_FragColor = vec4(col, clamp(max(a * 0.34 + lip * m * uW * 0.16 + lipM * m * 0.22, tip * 0.5 * uM), 0.0, 0.55));
      }` });
  const fogM = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), fogMat); fogM.rotation.y = Math.PI / 2; fogM.position.set(MIRROR.x + 0.019, MIRROR.y, MIRROR.z); C.group.add(fogM);
  // UOMO NELL'ANGOLO: dopo lo specchio, in fondo alla cantina, un uomo grosso di spalle fissa l'angolo. Lo vedi solo nel guizzo della luce;
  // poi la luce si spegne e, quando torna, non c'è più. Nessun suono.
  const corner = hall.silhouette(5); corner.visible = false; corner.position.set(CELLAR.w / 2 - 0.75, 0, CELLAR.z0 - 21.6); corner.rotation.y = Math.PI / 2; C.group.add(corner); let cornerT = -1, cornerDone = false;
  // PARTICOLARE: in fondo alla stanza, nel riflesso, una piccola sagoma sotto una luce lontana che si accende e si spegne: compare, sparisce,
  // ricompare un po' più in là. Solo mentre guardi lo specchio. Niente suono, niente scatto.
  const far1 = hall.silhouette(5); far1.material = far1.material.clone(); far1.material.transparent = true; far1.material.opacity = 0.58; far1.material.depthWrite = false; far1.scale.setScalar(0.5); far1.visible = false; far1.rotation.y = -Math.PI / 2; C.group.add(far1);
  // SAGOMA CHE CORRE sul muro di fronte allo specchio (vera geometria: si vede nel riflesso, e a volte con la coda dell'occhio)
  const runM = hall.silhouette(1); runM.material = runM.material.clone(); runM.material.transparent = true; runM.material.opacity = 0.32; runM.material.depthWrite = false; runM.scale.setScalar(0.5); runM.visible = false; C.group.add(runM); let runT = -1, runDone = false;
  // velo di luce pallida nello specchio durante l'occhiata: l'ombra deve stagliarsi su qualcosa di più chiaro del riflesso buio
  const mistC = document.createElement('canvas'); mistC.width = 128; mistC.height = 192; { const g = mistC.getContext('2d'); const gr = g.createRadialGradient(64, 90, 4, 64, 96, 100); gr.addColorStop(0, 'rgba(210,225,220,.95)'); gr.addColorStop(.55, 'rgba(170,190,185,.45)'); gr.addColorStop(1, 'rgba(150,170,165,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 192); }
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mistC), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  mist.rotation.y = Math.PI / 2; mist.position.set(MIRROR.x + 0.015, MIRROR.y, MIRROR.z); C.group.add(mist);
  const noise = (t) => Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1.7) + Math.sin(t * 29.0) * 0.5;

  // lampade, oggetti di scena
  const loader = new GLTFLoader(), lampPos = [[0, 3.75, CELLAR.z0 - 6], [0, 3.75, CELLAR.z0 - 18]];
  loader.load('assets/models/lamp.glb', (g) => { for (const [x, y, z] of lampPos) { const o = g.scene.clone(true); const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(0.32 / (b.max.y - b.min.y)); b.setFromObject(o); o.position.set(x - (b.max.x + b.min.x) / 2, y - b.max.y, z); C.group.add(o); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0 })); cord.position.set(x, y + 0.3, z); C.group.add(cord); } });
  const prop = (url, h, x, z, ry) => loader.load(url, (g) => { const o = g.scene; const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / (b.max.y - b.min.y)); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x - x, b.min.y, c.z - z)); o.rotation.y = ry; C.group.add(o); });
  prop('assets/models/can.glb', 0.12, -2.6, CELLAR.z0 - 3, 0.5); prop('assets/models/tank.glb', 0.55, 3.1, CELLAR.z0 - 12.5, 0.4); prop('assets/models/rim.glb', 0.5, 2.4, CELLAR.z0 - 4.2, 1.2);
  prop('assets/models/stool.glb', 0.46, -2.2, CELLAR.z0 - 8.4, 0.3); prop('assets/models/cabinet.glb', 1.1, 3.4, CELLAR.z0 - 17, -Math.PI / 2);
  // atmosfera: fasci freddi sotto le lampade, pozzanghere, colature (non sul muro dello specchio)
  addAtmosphere(C.group, { xl: -CELLAR.w / 2, xr: CELLAR.w / 2, z0: CELLAR.z0, z1: CELLAR.z0 - CELLAR.l, h: CELLAR.h, seed: 3, lamps: lampPos, shaft: 0x9db8ff, shaftOpacity: 0.07, noPuddleNearEnd: 8, stains: 8, puddles: 5, avoid: [{ side: -1, z0: CELLAR.z0 - 8, z1: CELLAR.z0 - 12 }] });
  // extra: l'orologio di fronte allo specchio (si vede nel riflesso), il busto sul mobile, un gnomo fuori posto vicino all'ingresso
  addExtras(C.group, [['x_clock', 2.15, 3.7, 0, CELLAR.z0 - 7.5, -Math.PI / 2], ['x_bust', 0.52, 3.4, 1.1, CELLAR.z0 - 17, -Math.PI / 2 - 0.5, 1, 0, (g) => { C.bust = g; }], ['x_gnome', 0.6, -3.4, 0, CELLAR.z0 - 2.2, 0.7, 0.07], ['bin', 0.85, -3.2, 0, CELLAR.z0 - 18.6, 0.4, 0.4], ['x_basket', 0.3, -3.2, 0, CELLAR.z0 - 21.2, 0.8, 0.12], ['rim', 0.5, 3.3, 0, CELLAR.z0 - 21.6, 0.3, 0.5], ['stool', 0.46, 1.1, 0, CELLAR.z0 - 14.9, 0.6, 0.5, -Math.PI / 2], ['can', 0.12, -1.6, 0, CELLAR.z0 - 4.6, 1.4, 0.5], ['x_gnome', 0.45, 3.4, 0, CELLAR.z0 - 9.4, -2.6, 0.07]]);

  // porta d'uscita in fondo
  const exitDoor = new THREE.Group(); exitDoor.position.set(0, 0, CELLAR.z0 - CELLAR.l + 0.15); C.group.add(exitDoor);
  // soglia: copre i ~25 cm tra il pavimento di questa stanza e quello della successiva (altrimenti si vede il vuoto)
  { const sl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.95, metalness: 0 })); sl.position.set(0, 0.0, CELLAR.z0 - CELLAR.l - 0.05); C.group.add(sl); }
  let exL = null, exR = null, exCap = null, exT = 0;
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; exL = m.getObjectByName('large_castle_door_left'); exR = m.getObjectByName('large_castle_door_right'); exL?.rotation.set(0, 0, 0); exR?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; exitDoor.add(m); });
  { // l'oltre-porta è buio: sagoma ad arco nera davanti al muro, dietro i battenti (si vede solo oscurità, mai il muro)
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.95, 1.92); sh.absarc(0, 1.92, 0.95, 0, Math.PI, false); sh.lineTo(-0.95, 0);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    cap.position.set(0, 0, CELLAR.z0 - CELLAR.l + 0.05); cap.rotation.y = 0; C.group.add(cap); exCap = cap;
  }


  // apparizione: la sagoma nera attraversa il fondo in mezzo secondo
  const shade = hall.silhouette(0); shade.visible = false; C.group.add(shade);
  let ap = -1;

  C.enter = () => {
    C.gone = false; C.exitStarted = false; if (exCap) exCap.visible = true; if (exL) { exL.rotation.y = 0; exR.rotation.y = 0; } C.group.position.z = 0; C.bounds[2] = CELLAR.z0 - CELLAR.l + 1.4; if (C.bx) { C.bounds[0] = C.bx[0]; C.bounds[1] = C.bx[1]; }
    C.group.visible = true; C.state = 'play'; C.step = -1; C.gaze = 0; C.away = 0; C.started = false; C.apDone = false; flags.mirror = false; C.glanced = false; cornerDone = false; cornerT = -1; corner.visible = false; runDone = false; runT = -1; runM.visible = false; C.near0 = false; C.gl = undefined; C.blood0 = false; C.since = 0; C.tt = 0; mdTarget[0] = mdTarget[1] = mdTarget[2] = 0; mdecals.forEach((m) => (m.material.opacity = 0)); fig.visible = false; shFar.material.uniforms.uA.value = 0; mist.material.opacity = 0; shNear.material.uniforms.uA.value = 0; fogMat.uniforms.uM.value = 0; fogMat.uniforms.uW.value = 0; fogMat.uniforms.uMask.value = blankTex; fogMat.uniforms.uTip.value.set(0, 0, 0); fogMat.uniforms.uR.value = 0.36; fogMat.uniforms.uB.value.set(0.47, 0.52); C.wr = null; C.wName = false; C.b1 = C.b2 = C.sw = C.sw2 = C.clean = false; C.farT = -1; C.farN = 0; far1.visible = false;
    player.box = C.bounds; player.pos.set(0.4, 1.62, CELLAR.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos, 2.1, 0x9db8ff); lights.grade({ fog: 0x03050c, hemi: [0x22336a, 0x0a0a14, 0.42] }); scene.fog.density = 0.04; audio.duck(1, 1); instab.set(0.1, 6);
  };

  const mc = new THREE.Vector3(), fw = new THREE.Vector3(), tmp = new THREE.Vector3(), d = new THREE.Vector3();
  // il busto sul mobile, quando non lo guardi, si volta verso di te
  const bustMove = unseenMover({ camera, getObj: () => C.bust, max: 3, gap: 7, move: (n) => { turnToward(C.bust, player.pos, n); audio.shuffle?.(0.5, 0.22); } });
  C.update = (dt) => {
    if (C.group.visible) { red.update(dt); bustMove(dt); }
    if (!C.group.visible || C.gone) return;
    const P = player.pos;
    // --- specchio ---
    d.set(MIRROR.x - P.x, 0, MIRROR.z - P.z); const dm = d.length(); d.normalize();
    fw.set(player.forward.x, 0, player.forward.z).normalize();
    const dotv = fw.dot(d), looking = dotv > 0.82 && dm < 6.5, turnedAway = dotv < 0.6 || dm > 8;
    mirror.visible = dm < 11 && dotv > -0.2;                              // niente render se non serve
    C.tt = (C.tt || 0) + dt;
    // 1) PRIMA OCCHIATA, DI SBIECO E DA LONTANO: qualcosa si muove dietro di te nel riflesso, un'ombra, per un attimo
    if (!C.glanced && !C.started && dm > 3.5 && dm < 11 && dotv > 0.4 && dotv < 0.97 && mirror.visible && C.tt > 3) { C.glanced = true; C.gl = 0; audio.whisper(1.0, 0.1); instab.push(0.5, 5); lights.lamp(0, 'flicker', 1.0); lights.lamp(1, 'flicker', 1.0); }   // la luce ha un guizzo: l'ombra si staglia sui mattoni
    if (C.gl !== undefined && C.gl >= 0) {
      C.gl += dt; const k = C.gl / 0.9;                          // ombra VELOCE: meno di un secondo
      const px = P.x, pz = P.z, side = new THREE.Vector3(-d.z, 0, d.x);
      fig.position.set(px - d.x * 5.2 + side.x * THREE.MathUtils.lerp(-3.4, 3.2, k), 0, pz - d.z * 5.2 + side.z * THREE.MathUtils.lerp(-3.4, 3.2, k));
      fig.rotation.y = Math.atan2(d.x, d.z); fig.visible = k < 1 && noise(C.tt) > -0.7; 
      shFar.material.uniforms.uC.value.set(THREE.MathUtils.lerp(0.97, 0.78, Math.min(1, k)), 0.4);   // attraversa lo specchio in meno di un secondo
      shFar.material.uniforms.uA.value = k < 1 ? 0.5 * Math.sin(Math.min(1, k) * Math.PI) ** 0.5 * (noise(C.tt * 2) > -0.6 ? 1 : 0.5) : 0;
      fig.visible = false;
      if (k >= 1) { fig.visible = false; C.gl = -1; wash(0, P, d); shFar.material.uniforms.uA.value = 0; mist.material.opacity = 0; }
    }
    if (looking) {
      C.away = 0; C.stepped = false; C.gaze += dt;
      if (!C.started && C.gaze > 1.1) { C.started = true; C.step = 0; C.since = 0; instab.push(0.5, 8); }
    } else {
      C.gaze = 0;
      if (turnedAway) {
        C.away += dt;
        // distogli lo sguardo e torni: è più vicina
        if (C.started && !C.stepped && C.away > 0.3 && C.step < 4) { C.step++; C.stepped = true; audio.whisper(1.6, 0.18 + C.step * 0.06); instab.push(0.5 + C.step * 0.13, 6); }
      }
    }
    // appena ti avvicini allo specchio: una sagoma nera corre lungo il muro di fronte (riflessa nello specchio)
    if (!runDone && !C.started && dm < 5.2 && dotv > 0.75 && mirror.visible && (C.gl === undefined || C.gl < 0)) { runDone = true; runT = 0; audio.dash(0.9); instab.push(0.8, 6); }
    if (runT >= 0) {
      runT += dt; const k = Math.min(1, runT / 1.15);
      runM.visible = true; runM.position.set(CELLAR.w / 2 - 0.7, Math.abs(Math.sin(runT * 18)) * 0.07, THREE.MathUtils.lerp(MIRROR.z + 3.0, MIRROR.z + 0.4, k));   // solo ai margini dell'immagine
      runM.rotation.set(0.2, Math.PI, Math.sin(runT * 18) * 0.05);
      if (k >= 1) { runM.visible = false; runT = -1; if (flash) flash.intensity = 0; }
    }
    C.dbg = { runDone, runT, dm, dotv, mv: mirror.visible, tt: C.tt };
    // 2) DA VICINO: dopo ~2 s l'impronta di sangue affiora dall'interno del vetro; poi, a ogni ritorno, qualcosa in più
    if (C.started && looking) C.since += dt;
    if (C.started && !C.near0) { C.near0 = true; lights.lamp(0, 'flicker', 0.9); lights.lamp(1, 'flicker', 0.9); audio.whisper(1.2, 0.16); }
    if (C.started && C.since > 2 && !C.blood0) { C.blood0 = true; mdTarget[0] = 0.9; audio.whisper(1.8, 0.22); lights.lamp(0, 'flicker', 0.5); instab.push(0.8, 6); }
    if (C.step >= 2) mdTarget[1] = 0.85; if (C.step >= 3) mdTarget[2] = 0.7;
    mdecals.forEach((m, i) => { if (i < 2) m.material.opacity += (mdTarget[i] - m.material.opacity) * Math.min(1, dt * 2.2); });
    // DA VICINO, in sequenza (il tempo conta solo mentre guardi): 1) massa d'ombra vaga dietro la spalla · 2) impronta di sangue ·
    // 3) il vetro si appanna (respiro dall'altra parte) due volte · 4) tre dita lo attraversano e lasciano solchi nel vapore
    const shadowOn = looking && C.started && C.step >= 0 && C.state === 'play';
    { const st = Math.max(0, C.step);
      const base = (shadowOn && !C.clean) ? (C.since > 0.35 ? 0.85 + 0.25 * st : 0) : 0;
      const flick = 0.62 + 0.38 * Math.sin(C.tt * 2.3) * Math.sin(C.tt * 0.7 + 1) + 0.2 * noise(C.tt * 0.8);   // vedo / non vedo: si addensa e si dirada
      const target = Math.max(0, Math.min(1.25, base * (0.7 + flick * 0.6)));
      const U = shNear.material.uniforms; U.uA.value += (target - U.uA.value) * Math.min(1, dt * 2.4); U.uT.value = C.tt;
      U.uC.value.set(0.64 - 0.05 * st + Math.sin(C.tt * 0.31) * 0.03, 0.42);                       // dietro la tua spalla, via via più al centro
      U.uS.value.set(0.17 + 0.035 * st, 0.34 + 0.02 * st);
      shFar.material.uniforms.uT.value = C.tt;
      // vapore
      const F = fogMat.uniforms; F.uT.value = C.tt;
      if (shadowOn && C.since > 2.0 && !C.b1) { C.b1 = true; C.b1t = 0; audio.whisper(1.6, 0.14); }
      if (shadowOn && C.since > 2.0 && !C.b2) { C.b2 = true; C.b2t = 0; audio.whisper(1.8, 0.18); instab.push(0.85, 6); }
      let mt = 0;
      if (C.b1) { C.b1t += dt; mt = Math.max(mt, 0.8 * Math.sin(Math.min(1, C.b1t / 2.4) * Math.PI) ** 0.8); }
      if (C.b2) { C.b2t += dt; mt = Math.max(mt, 1.0 * Math.min(1, C.b2t / 0.35)); }
      if (C.sw && (C.wr && C.wr.done && C.wr.hold > 4.5)) { mt = 0; if (!C.clean) { C.clean = true; C.farT = 0; } }          // finita la scena: via vapore, solchi e massa. Resta solo la mano.
      F.uM.value += (mt - F.uM.value) * Math.min(1, dt * (mt === 0 ? 1.1 : 3));
      if (C.b2 && C.b2t > 0.3 && !C.sw) { C.sw = true; C.swt = 0; audio.squeak(1.6); lights.lamp(0, 'flicker', 0.7); }
      if (C.sw) { C.swt += dt; F.uW.value = 0; if (C.swt > 0.3 && !C.sw2) { C.sw2 = true; audio.whisper(1.4, 0.2); } }
      // versione personalizzata: invece dei tre solchi, qualcuno scrive il suo nome nel vapore (il tempo avanza solo mentre guardi)
      if (C.sw && !C.wr) { C.wr = createFingerWriter(PROF ? PROF.name : 'TI VEDO', 384, 542, { cx: 0.47, cy: 0.76, start: 0.2, onStroke: (s) => { if (s.first) audio.squeak(Math.min(0.42, 0.2 + s.dur * 0.5), MIRROR); } }); F.uMask.value = C.wr.tex; F.uR.value = 0.5; F.uB.value.set(0.47, 0.64); }   // la scritta sta ad altezza d'occhi, sopra l'impronta della mano
      if (C.wr) { const r = C.wr.update(dt, shadowOn); F.uTip.value.set(r.tipU, r.tipV, 0); if (r.done && !C.wName) { C.wName = true; whisperName(); lights.lamp(0, 'flicker', 0.8); instab.push(0.9, 6); } }
    }
    if (C.farT >= 0 && shadowOn) {
      C.farT += dt; const cyc = 7.5, ph = C.farT % cyc, n = Math.floor(C.farT / cyc);
      const vis = n < 3 && ph > 1.2 && ph < 2.3 && Math.sin(C.farT * 29) > -0.2;   // un'occhiata: meno di un secondo, a tratti             // un piccolo "tremolio" a metà (la lampadina)
      if (vis && !far1.visible) far1.position.set(CELLAR.w / 2 - 0.9, 0, MIRROR.z + [-2.0, 1.9, -1.6][n % 3]);   // ai margini dell'immagine, mai al centro
      far1.visible = vis;
      if (flash) { flash.color.setHex(0xffd9a8); flash.position.set(CELLAR.w / 2 - 3.2, 2.4, far1.position.z + 0.4); flash.intensity = vis ? 6 : (ph > 1.0 && ph < 2.5 ? 1.2 : 0); }   // una luce lontana che sfarfalla: la sagoma si vede solo quando è accesa 
    } else if (far1.visible || (flash && C.farT >= 0 && flash.intensity > 0 && !shadowOn)) { far1.visible = false; if (flash && C.farT >= 0) flash.intensity = 0; }
    // (il vecchio modello 3D nel riflesso è disattivato: troppo definito)
    fig.visible = false;
    if (shadowOn && C.step >= 2) { C.late = (C.late || 0) + dt; if (C.late > 1.4 && !flags.mirror) { flags.mirror = true; lights.lamp(0, 'flicker', 1.4); lights.lamp(1, 'flicker', 1.4); audio.whisper(2.6, 0.4); say('ci sei anche tu.', 4500); instab.set(1, 6); rgbPulse(1); player.addShake(0.35); } } else if (!shadowOn) C.late = 0;
    if (!cornerDone && C.started && P.z < CELLAR.z0 - 11.5 && P.z > CELLAR.z0 - 14) { cornerDone = true; cornerT = 0; lights.lamp(1, 'flicker', 1.6); instab.push(0.7, 6); }
    if (cornerT >= 0) {
      cornerT += dt;
      if (cornerT > 0.3 && cornerT < 1.7) corner.visible = true;
      if (cornerT >= 1.7 && corner.visible) { corner.visible = false; lights.lamp(1, 'off'); }
      if (cornerT > 2.9) { lights.lamp(1, 'on'); cornerT = -1; }
    }
    // --- apparizione (spavento) ---
    if (!C.apDone && P.z < CELLAR.z0 - 14.2 && (Math.abs(player.forward.z) > 0.35 || P.z < CELLAR.z0 - 17.2)) {   // parte quando guardi lungo la stanza (avanti o indietro), non mentre guardi il muro di lato; se non lo fai, parte comunque poco dopo
      C.apDone = true; ap = 0; C.apBack = player.forward.z > 0.25; shade.visible = true;   // sagoma davanti a te se guardi avanti; se ti sei girato a guardare indietro, passa dietro (davanti alla porta d'ingresso)
      audio.dash(0.5); player.addShake(0.7); lights.torchStutter(0.3); instab.set(1, 8); try { navigator.vibrate?.([60, 30, 90]); } catch (_) {}
    }
    if (ap >= 0) {
      ap += dt; const k = Math.min(1, ap / 0.45);
      shade.position.set(THREE.MathUtils.lerp(-3.2, 3.2, k), 0, C.apBack ? CELLAR.z0 - 1.6 : CELLAR.z0 - 20.2); shade.rotation.y = Math.PI / 2;
      if (ap > 0.5) { shade.visible = false; ap = -1; }
    }
    // --- uscita ---
    // uscita senza stacco: la porta si apre da sola mentre ti avvicini e oltre si vede il reparto; attraversata la soglia sei nel corridoio
    if (C.apDone && P.z < CELLAR.z0 - CELLAR.l + 9 && C.state === 'play') {
      if (!C.exitStarted) { C.exitStarted = true; exT = 0; if (exCap) exCap.visible = false; C.bx = [C.bounds[0], C.bounds[1]]; story.preview('ward', (CELLAR.z0 - CELLAR.l) - WARD.z0); audio.squeak?.(1.4, new THREE.Vector3(0, 1, CELLAR.z0 - CELLAR.l)); }
      { const B = C.bounds, zf = CELLAR.z0 - CELLAR.l; B[2] = Math.abs(P.x) < 0.75 ? zf - 3 : zf + 1.4; if (P.z < zf + 0.3) { B[0] = -0.8; B[1] = 0.8; } else if (C.bx) { B[0] = C.bx[0]; B[1] = C.bx[1]; } }   // si passa solo dal varco (largo 2 m)
      exT += dt; const a = Math.min(1.5, exT * 0.55); if (exL) exL.rotation.y = a; if (exR) exR.rotation.y = -a;
    }
    if (C.exitStarted && P.z < CELLAR.z0 - CELLAR.l - 0.7 && C.state === 'play') { C.state = 'leaving'; story.cross('cellar', 'ward', (CELLAR.z0 - CELLAR.l) - WARD.z0); }
  };
  C.leave = () => { C.group.visible = false; mirror.visible = false; };
  return C;
}
