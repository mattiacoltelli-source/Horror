import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { makeMaterials, setAnisotropy } from './world/materials.js';
import { buildTunnel, LAMPS, W, Z_END, H0 } from './world/tunnel.js';
import { createLights } from './world/lights.js';
import { createControls } from './player/controls.js';
import { createPlayer } from './player/player.js';
import { createAudio } from './audio/audio.js';
import { createInstability } from './ui/instability.js';
import { createGlassEvent } from './events/glass.js';
import { createDoorEvent } from './events/door.js';
import { createScare } from './events/scare.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance', alpha: false });
let pr = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
setAnisotropy(Math.min(4, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x030405, 0.085);
const camera = new THREE.PerspectiveCamera(68, 9 / 16, 0.05, 60);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.userData.baseFov = w / h < 0.8 ? 68 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- mondo ----------
const mats = makeMaterials();
scene.add(buildTunnel(mats));

// riflessi: panorama scurito come environment (leggero, solo per metallo/umido)
new THREE.TextureLoader().load('assets/tex/bath_bg.jpg', (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(t).texture; scene.environmentIntensity = 0.18;
  pm.dispose();
});

const lights = createLights(scene, camera);
const audio = createAudio();
const controls = createControls();
const player = createPlayer(camera, controls, audio);
const instab = createInstability(audio);

// ---------- oggetti di scena ----------
const gl = new GLTFLoader();
function normalize(obj, h) {
  const b = new THREE.Box3().setFromObject(obj), s = h / (b.max.y - b.min.y);
  obj.scale.multiplyScalar(s); b.setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3()); obj.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  const g = new THREE.Group(); g.add(obj); return g;
}
function place(url, h, x, y, z, ry, cb) {
  gl.load(url, (g) => {
    const o = normalize(g.scene, h); o.position.set(x, y, z); o.rotation.y = ry;
    o.traverse((m) => { if (m.isMesh) { m.material.envMapIntensity = 0.6; } });
    scene.add(o); cb?.(o);
  }, undefined, (e) => console.warn(url, e));
}
// lampade a gabbia appese alla volta
LAMPS.forEach((z, i) => place('assets/models/lamp.glb', 0.32, 0, H0 + W - 0.62, z, 0, (o) => {
  const emis = []; o.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material = m.material.clone(); m.material.emissive.set(0xcfe0ff); emis.push(m.material); } });
  o.userData.setGlow = (l) => emis.forEach((m) => (m.emissiveIntensity = 2.4 * l));
  lights.lamps[i].mesh = o;
  // cavo
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 5), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  cord.position.set(0, H0 + W - 0.2, z); scene.add(cord);
}));
place('assets/models/can.glb', 0.12, -0.7, 0, -4.5, 0.6);
place('assets/models/can.glb', 0.12, 0.55, 0, -29, 2.1);
place('assets/models/tank.glb', 0.55, -W + 0.3, 0, -36, 0.3);
place('assets/models/rim.glb', 0.5, 0.75, 0, -41, 1.2);
place('assets/models/cam.glb', 0.3, -W + 0.12, 2.0, -12, Math.PI / 2 + 0.25);

// ---------- evento ----------
const glassEvent = createGlassEvent({ scene, renderer, camera, player, audio, lights, instab });

// ---------- flusso ----------
let doorEvent = null, scare = null;
let state = 'loading', last = 0, time = 0, paused = false, fpsAcc = 0, fpsN = 0, ended = false;
let started = false;
const hint = $('subtitle');
function say(txt, ms = 4000) {
  hint.textContent = txt; hint.style.opacity = 1;
  clearTimeout(say.t); say.t = setTimeout(() => (hint.style.opacity = 0), ms);
}

async function enter() {
  scare ??= createScare({ scene, camera, player, audio, lights, instab, finish });
  doorEvent ??= createDoorEvent({ scene, player, audio, lights, instab, say, camera, scare });
  $('enter').disabled = true;
  try { await audio.start(); } catch (_) {}
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) {}
  try { await screen.orientation?.lock?.('portrait'); } catch (_) {}
  $('intro').classList.add('hidden');
  controls.enabled = true; started = true; state = 'play';
  $('fade').style.opacity = 0;
  setTimeout(() => instab.show(), 4000);
  setTimeout(() => say('sinistra: muoviti   ·   destra: guarda', 5000), 1800);
  last = performance.now();
}
$('enter').addEventListener('click', enter);

THREE.DefaultLoadingManager.onLoad = () => { $('loadmsg').textContent = ''; $('enter').disabled = false; };
$('enter').disabled = true;
setTimeout(() => { $('enter').disabled = false; $('loadmsg').textContent = ''; }, 9000);

function setPaused(p) {
  if (!started || ended) return;
  paused = p; $('pause').classList.toggle('hidden', !p);
  controls.enabled = !p; p ? audio.suspend() : (audio.resume(), (last = performance.now()));
}
document.addEventListener('visibilitychange', () => document.hidden && setPaused(true));
$('resume').addEventListener('click', () => setPaused(false));

function finish(msg, fast = false) {
  if (ended) return; ended = true; controls.enabled = false; instab.hide();
  $('endtext').innerText = msg || 'fine del prototipo';
  $('fade').style.transition = fast ? 'opacity .25s' : 'opacity 3s'; $('fade').style.opacity = 1;
  setTimeout(() => $('end').classList.remove('hidden'), fast ? 1800 : 3200);
}
$('again').addEventListener('click', () => location.reload());

function tick(dt) {
  doorEvent?.update(dt);
  scare?.update(dt);
  time += dt;
  player.update(dt, time);
  audio.setListener(camera);
  lights.update(dt, time, player.pos.z);
  glassEvent.update(dt, time);
  instab.update(dt);
  if (doorEvent?.ended) finish();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (paused || state === 'loading') { if (state === 'loading') renderer.render(scene, camera); return; }
  if (!(window.__g && window.__g.hold)) tick(dt);
  glassEvent.preRender();
  renderer.render(scene, camera);

  // qualità adattiva: se i frame calano, scala la risoluzione
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (fps < 38 && pr > 0.7) { pr = Math.max(0.7, pr - 0.15); renderer.setPixelRatio(pr); resize(); }
  }
}
requestAnimationFrame((n) => { last = n; frame(n); });

// debug/test: ?debug=1 espone il gioco e permette di saltare avanti
if (q.has('debug')) {
  window.__g = { get scare() { return scare; }, get door() { return doorEvent; }, THREE, scene, camera, player, glassEvent, lights, instab, audio, renderer, enter,
    sim(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) tick(dt); },
    tp(z, yaw = 0) { player.pos.set(0.1, 1.62, z); player.yaw = yaw; player.pitch = 0; } };
}
