// STANZA 2 — LA CANTINA: lo specchio impossibile (EVENTO 2) e l'apparizione improvvisa (EVENTO 3, primo spavento).
// Specchio: planare reale (Reflector) a bassa risoluzione, renderizzato solo se in vista. La figura "dietro di te" esiste
// solo mentre guardi lo specchio: ogni volta che distogli lo sguardo e torni, è più vicina.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/loaders/GLTFLoader.js';
import { Reflector } from '../../vendor/three/Reflector.js';
import { buildRoom } from '../world/rooms.js';
import { bloodDecals } from '../world/blood.js';
import { decorCellar } from '../world/decor.js';

export const CELLAR = { z0: -200, w: 8, l: 24, h: 4.4 };
const MIRROR = new THREE.Vector3(-3.98, 1.45, -210);
const DIST = [7, 4.6, 2.6, 1.3, 0.7];

export function createCellar({ scene, mats, player, camera, audio, lights, instab, say, hall, flags, story, flash }) {
  const C = { group: new THREE.Group(), state: 'idle', step: -1, gaze: 0, away: 0, started: false, apDone: false };
  C.group.visible = false; scene.add(C.group);
  const room = buildRoom(mats, { z0: CELLAR.z0, w: CELLAR.w, l: CELLAR.l, h: CELLAR.h, wall: 'brick', floor: 'floorA', ceil: 'stone', pillarEvery: 5, dark: 0.85, seed: 23 });
  C.group.add(room.group); decorCellar(C.group, CELLAR.z0); C.bounds = [room.bounds[0], room.bounds[1], CELLAR.z0 - CELLAR.l + 1.4, CELLAR.z0 - 0.6];

  // specchio
  const mw = 1.7, mh = 2.4;
  const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: 256, textureHeight: 384, color: new THREE.Color(0xffffff), clipBias: 0.003 });
  mirror.position.copy(MIRROR); mirror.rotation.y = Math.PI / 2; C.group.add(mirror);
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
    { k: 'A', p: [MIRROR.x + 0.012, 1.55, MIRROR.z + 0.28], wall: '+x', h: 0.5, rot: 0.15, a: 0.0 },
    { k: 'C', p: [MIRROR.x + 0.012, 1.18, MIRROR.z - 0.34], wall: '+x', h: 0.46, rot: -0.2, flip: true, a: 0.0 },
  ]); mdecals_fix(); const mdTarget = [0, 0, 0];
  function mdecals_fix() { mdecals.forEach((m) => { const mat = new THREE.MeshBasicMaterial({ map: m.material.map, transparent: true, opacity: 0, color: new THREE.Color(0.36, 0.02, 0.02), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); m.material = mat; }); }
  const wash = (lv, P, d) => { if (!flash) return; flash.color.setHex(0xffcf9a); flash.position.set(P.x - d.x * 3.2, 2.3, P.z - d.z * 3.2 + 1.2); flash.intensity = lv; };
  // PRESENZA: una massa scura INDEFINITA nel vetro (nebbia di ombra, senza testa né braccia): bordi che si sfilacciano, si sposta
  // lentamente, a tratti si addensa. Si capisce che c'è "qualcosa", non cosa. Nessuna figura riconoscibile.
  const NOISE = `float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+1.7;a*=.5;}return v;}`;
  const presMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.42) }, uS: { value: new THREE.Vector2(0.2, 0.34) }, uSeed: { value: Math.random() * 20 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uT, uA, uSeed; uniform vec2 uC, uS;\n${NOISE}
      void main(){
        vec2 p = (vUv - uC) / uS;
        p.x += 0.55 * (fbm(vec2(p.y * 0.9 + uSeed, uT * 0.22)) - 0.5);                       // la massa ondeggia di lato
        p.y += 0.25 * (fbm(vec2(p.x * 1.1 - uSeed, uT * 0.17)) - 0.5);
        float core = exp(-pow(p.x * 1.05, 2.0)) * smoothstep(-1.15, -0.35, p.y) * (1.0 - smoothstep(0.35, 1.25, p.y));   // alta e vaga
        float cloud = fbm(vUv * vec2(3.2, 2.2) + vec2(uT * 0.09, -uT * 0.13) + uSeed);
        float a = core * smoothstep(0.05, 0.55, cloud + core * 0.55);
        a = pow(a, 0.9) * uA;
        // velo pallido dietro la massa: l'ombra deve stagliarsi su qualcosa (il riflesso è troppo buio da solo)
        float hz = uA * (0.1 + 0.17 * fbm(vUv * 3.0 + uT * 0.05)) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float m = clamp(a, 0.0, 1.0);
        gl_FragColor = vec4(mix(vec3(0.62, 0.68, 0.66), vec3(0.004, 0.005, 0.005), m), clamp(max(hz, m * 0.94), 0.0, 0.95));
      }` });
  const mkPres = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), presMat()); m.rotation.y = Math.PI / 2; m.position.set(MIRROR.x + 0.017, MIRROR.y, MIRROR.z); C.group.add(m); return m; };
  const shFar = mkPres(), shNear = mkPres();
  shFar.material.uniforms.uS.value.set(0.16, 0.3); shNear.material.uniforms.uS.value.set(0.2, 0.36);
  // CONDENSA + SEGNI: qualcuno respira sul vetro dall'altra parte (chiazza di vapore che pulsa) e poi lo attraversa con le dita
  // (tre solchi che puliscono il vapore dall'alto in basso).
  const fogMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
    uniforms: { uT: { value: 0 }, uM: { value: 0 }, uW: { value: 0 }, uB: { value: new THREE.Vector2(0.47, 0.52) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uT, uM, uW; uniform vec2 uB;\n${NOISE}
      void main(){
        vec2 d = (vUv - uB) * vec2(1.0, 1.35);
        float edge = fbm(vUv * 6.0 + vec2(0.0, uT * 0.05)) - 0.5;
        float m = smoothstep(0.36 + edge * 0.18, 0.02, length(d)) * uM;
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
        float a = m * (1.0 - lines * 0.95) * (0.55 + 0.45 * fbm(vUv * 14.0));
        vec3 col = vec3(0.74, 0.8, 0.78);
        gl_FragColor = vec4(col, clamp(a * 0.34 + lip * m * uW * 0.16, 0.0, 0.5));
      }` });
  const fogM = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), fogMat); fogM.rotation.y = Math.PI / 2; fogM.position.set(MIRROR.x + 0.019, MIRROR.y, MIRROR.z); C.group.add(fogM);
  // SAGOMA CHE CORRE sul muro di fronte allo specchio (vera geometria: si vede nel riflesso, e a volte con la coda dell'occhio)
  const runM = hall.silhouette(1); runM.visible = false; C.group.add(runM); let runT = -1, runDone = false;
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

  // porta d'uscita in fondo
  const exitDoor = new THREE.Group(); exitDoor.position.set(0, 0, CELLAR.z0 - CELLAR.l + 0.15); C.group.add(exitDoor);
  loader.load('assets/models/door.glb', (g) => { const m = g.scene; m.getObjectByName('large_castle_door_left')?.rotation.set(0, 0, 0); m.getObjectByName('large_castle_door_right')?.rotation.set(0, 0, 0); m.rotation.y = Math.PI; exitDoor.add(m); });
  { // l'oltre-porta è buio: sagoma ad arco nera davanti al muro, dietro i battenti (si vede solo oscurità, mai il muro)
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.95, 1.92); sh.absarc(0, 1.92, 0.95, 0, Math.PI, false); sh.lineTo(-0.95, 0);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    cap.position.set(0, 0, CELLAR.z0 - CELLAR.l + 0.05); cap.rotation.y = 0; C.group.add(cap);
  }


  // apparizione: la sagoma nera attraversa il fondo in mezzo secondo
  const shade = hall.silhouette(0); shade.visible = false; C.group.add(shade);
  let ap = -1;

  C.enter = () => {
    C.group.visible = true; C.state = 'play'; C.step = -1; C.gaze = 0; C.away = 0; C.started = false; C.apDone = false; flags.mirror = false; C.glanced = false; runDone = false; runT = -1; runM.visible = false; C.near0 = false; C.gl = undefined; C.blood0 = false; C.since = 0; C.tt = 0; mdTarget[0] = mdTarget[1] = mdTarget[2] = 0; mdecals.forEach((m) => (m.material.opacity = 0)); fig.visible = false; shFar.material.uniforms.uA.value = 0; mist.material.opacity = 0; shNear.material.uniforms.uA.value = 0; fogMat.uniforms.uM.value = 0; fogMat.uniforms.uW.value = 0; C.b1 = C.b2 = C.sw = C.sw2 = false;
    player.box = C.bounds; player.pos.set(0.4, 1.62, CELLAR.z0 - 1.6); player.yaw = 0; player.pitch = 0; player.frozen = false;
    lights.setLamps(lampPos, 2.1); scene.fog.density = 0.04; audio.duck(1, 1); instab.set(0.1, 6);
  };

  const mc = new THREE.Vector3(), fw = new THREE.Vector3(), tmp = new THREE.Vector3(), d = new THREE.Vector3();
  C.update = (dt) => {
    if (!C.group.visible) return;
    const P = player.pos;
    // --- specchio ---
    d.set(MIRROR.x - P.x, 0, MIRROR.z - P.z); const dm = d.length(); d.normalize();
    fw.set(player.forward.x, 0, player.forward.z).normalize();
    const dotv = fw.dot(d), looking = dotv > 0.82 && dm < 6.5, turnedAway = dotv < 0.25 || dm > 8;
    mirror.visible = dm < 11 && dotv > -0.2;                              // niente render se non serve
    C.tt = (C.tt || 0) + dt;
    // 1) PRIMA OCCHIATA, DI SBIECO E DA LONTANO: qualcosa si muove dietro di te nel riflesso, un'ombra, per un attimo
    if (!C.glanced && !C.started && dm > 3.5 && dm < 11 && dotv > 0.4 && dotv < 0.97 && mirror.visible && C.tt > 3) { C.glanced = true; C.gl = 0; audio.whisper(1.0, 0.1); instab.push(0.5, 5); lights.lamp(0, 'flicker', 1.0); lights.lamp(1, 'flicker', 1.0); }   // la luce ha un guizzo: l'ombra si staglia sui mattoni
    if (C.gl !== undefined && C.gl >= 0) {
      C.gl += dt; const k = C.gl / 0.9;                          // ombra VELOCE: meno di un secondo
      const px = P.x, pz = P.z, side = new THREE.Vector3(-d.z, 0, d.x);
      fig.position.set(px - d.x * 5.2 + side.x * THREE.MathUtils.lerp(-3.4, 3.2, k), 0, pz - d.z * 5.2 + side.z * THREE.MathUtils.lerp(-3.4, 3.2, k));
      fig.rotation.y = Math.atan2(d.x, d.z); fig.visible = k < 1 && noise(C.tt) > -0.7; wash(k < 1 ? 22 * Math.sin(Math.min(1, k * 1.3) * Math.PI) : 0, P, d);
      shFar.material.uniforms.uC.value.set(THREE.MathUtils.lerp(0.9, 0.1, Math.min(1, k)), 0.46);   // attraversa lo specchio in meno di un secondo
      shFar.material.uniforms.uA.value = k < 1 ? 1.3 * Math.sin(Math.min(1, k) * Math.PI) ** 0.5 * (noise(C.tt * 2) > -0.6 ? 1 : 0.5) : 0;
      mist.material.opacity = k < 1 ? 0.55 * Math.sin(Math.min(1, k) * Math.PI) ** 0.7 : 0;
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
        if (C.started && !C.stepped && C.away > 0.45 && C.step < 4) { C.step++; C.stepped = true; audio.whisper(1.6, 0.18 + C.step * 0.06); instab.push(0.5 + C.step * 0.13, 6); }
      }
    }
    // appena ti avvicini allo specchio: una sagoma nera corre lungo il muro di fronte (riflessa nello specchio)
    if (!runDone && !C.started && dm < 5.2 && dotv > 0.75 && mirror.visible && (C.gl === undefined || C.gl < 0)) { runDone = true; runT = 0; audio.dash(0.9); instab.push(0.8, 6); lights.lamp(0, 'flicker', 0.8); }
    if (runT >= 0) {
      runT += dt; const k = Math.min(1, runT / 1.15);
      runM.visible = true; runM.position.set(CELLAR.w / 2 - 1.3, Math.abs(Math.sin(runT * 18)) * 0.07, THREE.MathUtils.lerp(MIRROR.z + 3.6, MIRROR.z - 3.6, k));
      runM.rotation.set(0.2, Math.PI, Math.sin(runT * 18) * 0.05);
      if (flash) { flash.color.setHex(0xffc890); flash.position.set(CELLAR.w / 2 - 2.6, 2.6, MIRROR.z); flash.intensity = 160 * Math.sin(Math.min(1, k) * Math.PI) ** 0.5; }   // illumina il muro di fronte: la sagoma nera si stacca
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
      const base = shadowOn ? (C.since > 0.35 ? 0.85 + 0.25 * st : 0) : 0;
      const flick = 0.62 + 0.38 * Math.sin(C.tt * 2.3) * Math.sin(C.tt * 0.7 + 1) + 0.2 * noise(C.tt * 0.8);   // vedo / non vedo: si addensa e si dirada
      const target = Math.max(0, Math.min(1.25, base * (0.7 + flick * 0.6)));
      const U = shNear.material.uniforms; U.uA.value += (target - U.uA.value) * Math.min(1, dt * 2.4); U.uT.value = C.tt;
      U.uC.value.set(0.64 - 0.05 * st + Math.sin(C.tt * 0.31) * 0.03, 0.42);                       // dietro la tua spalla, via via più al centro
      U.uS.value.set(0.17 + 0.035 * st, 0.34 + 0.02 * st);
      shFar.material.uniforms.uT.value = C.tt;
      // vapore
      const F = fogMat.uniforms; F.uT.value = C.tt;
      if (shadowOn && C.since > 3.2 && !C.b1) { C.b1 = true; C.b1t = 0; audio.whisper(1.6, 0.14); }
      if (shadowOn && C.since > 5.0 && !C.b2) { C.b2 = true; C.b2t = 0; audio.whisper(1.8, 0.18); instab.push(0.85, 6); }
      let mt = 0;
      if (C.b1) { C.b1t += dt; mt = Math.max(mt, 0.8 * Math.sin(Math.min(1, C.b1t / 2.4) * Math.PI) ** 0.8); }
      if (C.b2) { C.b2t += dt; mt = Math.max(mt, 1.0 * Math.min(1, C.b2t / 1.2) * (C.sw ? 1 : 1)); }
      F.uM.value += (mt - F.uM.value) * Math.min(1, dt * 3);
      if (C.b2 && C.b2t > 1.5 && !C.sw) { C.sw = true; C.swt = 0; audio.squeak(1.6); lights.lamp(0, 'flicker', 0.7); }
      if (C.sw) { C.swt += dt; F.uW.value = Math.min(1, C.swt / 1.6); if (C.swt > 0.3 && !C.sw2) { C.sw2 = true; audio.whisper(1.4, 0.2); } }
    }
    // (il vecchio modello 3D nel riflesso è disattivato: troppo definito)
    fig.visible = false;
    if (shadowOn && C.step === 4) { C.late = (C.late || 0) + dt; if (C.late > 4.6 && !flags.mirror) { flags.mirror = true; lights.lamp(0, 'flicker', 1.4); lights.lamp(1, 'flicker', 1.4); audio.whisper(2.6, 0.4); say('ci sei anche tu.', 4500); instab.set(1, 6); player.addShake(0.35); } } else if (!shadowOn) C.late = 0;
    // --- apparizione (spavento) ---
    if (!C.apDone && P.z < CELLAR.z0 - 14.2) {
      C.apDone = true; ap = 0; shade.visible = true; audio.dash(0.5); player.addShake(0.7); lights.torchStutter(0.3); instab.set(1, 8); try { navigator.vibrate?.([60, 30, 90]); } catch (_) {}
    }
    if (ap >= 0) {
      ap += dt; const k = Math.min(1, ap / 0.45);
      shade.position.set(THREE.MathUtils.lerp(-3.2, 3.2, k), 0, CELLAR.z0 - 20.2); shade.rotation.y = Math.PI / 2;
      if (ap > 0.5) { shade.visible = false; ap = -1; }
    }
    // --- uscita ---
    if (C.apDone && P.z < CELLAR.z0 - CELLAR.l + 2.4 && C.state === 'play') { C.state = 'leaving'; story.goto('warehouse'); }
  };
  C.leave = () => { C.group.visible = false; mirror.visible = false; };
  return C;
}
