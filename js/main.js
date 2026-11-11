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
import { createHall } from './events/hall.js';
import { createDawn } from './events/dawn.js';
import { createCellar } from './events/cellar.js';
import { createTower } from './events/tower.js';
import { createStory } from './story.js';
import { createDust } from './world/dust.js';
import { decorTunnel } from './world/decor.js';
import { createWarehouse } from './events/warehouse.js';
import { createMorgue } from './events/morgue.js';
import { createAmbient } from './events/ambient.js';
import { createCombat } from './events/combat.js';

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
{ const tg = buildTunnel(mats); scene.add(tg); decorTunnel(tg); }

// riflessi: panorama scurito come environment (leggero, solo per metallo/umido)
new THREE.TextureLoader().load('assets/tex/bath_bg.jpg', (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(t).texture; scene.environmentIntensity = 0.18;
  pm.dispose();
});

const lights = createLights(scene, camera);
const dust = createDust(camera);
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
place('assets/models/slamp2.glb', 0.9, 1.15, 1.55, -17, -Math.PI / 2); place('assets/models/slamp2.glb', 0.9, 1.15, 1.55, -39, -Math.PI / 2);
place('assets/models/can.glb', 0.12, -0.7, 0, -4.5, 0.6);
place('assets/models/can.glb', 0.12, 0.55, 0, -29, 2.1);
place('assets/models/tank.glb', 0.55, -W + 0.3, 0, -36, 0.3);
place('assets/models/rim.glb', 0.5, 0.75, 0, -41, 1.2);
place('assets/models/cam.glb', 0.3, -W + 0.12, 2.0, -12, Math.PI - 0.55);   // punta avanti nel corridoio, leggermente verso il centro: guarda alle spalle chi l'ha appena superata

// ---------- evento ----------
const glassEvent = createGlassEvent({ scene, renderer, camera, player, audio, lights, instab });

// grana della pellicola (leggerissima, generata una volta)
try {
  const nc = document.createElement('canvas'); nc.width = nc.height = 128; const nx = nc.getContext('2d'), im = nx.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  nx.putImageData(im, 0, 0); $('grain').style.backgroundImage = `url(${nc.toDataURL('image/png')})`;
} catch (_) {}
// ---------- flusso ----------
let dawn = null, doorEvent = null, scare = null, hall = null, cellar = null, tower = null, story = null, wh = null, morgue = null, ambient = null, combat = null;
const flags = { turned: false, mirror: false, door: null };
const warm = new THREE.PointLight(0xff9a50, 0, 15, 1.7); scene.add(warm);
const flash = new THREE.PointLight(0xffd9a0, 0, 28, 1.6); scene.add(flash);   // lampo dello sparo
let state = 'loading', last = 0, time = 0, paused = false, fpsAcc = 0, fpsN = 0, ended = false;
let started = false;
const hint = $('subtitle');
function say(txt, ms = 4000) {
  hint.textContent = txt; hint.style.opacity = 1;
  clearTimeout(say.t); say.t = setTimeout(() => (hint.style.opacity = 0), ms);
}

async function enter() {
  scare ??= createScare({ scene, camera, player, audio, lights, instab, finish: (m, f) => (dawn ? dawn.start(m) : finish(m, f)) });
  hall ??= createHall({ scene, mats, lights });
  dawn ??= createDawn({ scene, camera, player, audio, lights, instab, say, finish, onStart: () => combat?.hideAll(), hall });
  story ??= createStory({ scene, camera, controls, player, audio, hall, getCellar: () => cellar, getTower: () => tower, getWh: () => wh, getMorgue: () => morgue, say, lights, instab });
  combat ??= createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui: { aimAll: (b) => { controls.aimAll = b; if (b) { controls.move.x = controls.move.y = 0; $('stick').style.opacity = 0; } }, cool: (b) => $('fire').classList.toggle('cool', b), show: (b) => { $('fire').classList.toggle('hidden', !b); $('dot').classList.toggle('hidden', !b); } } });
  morgue ??= createMorgue({ scene, mats, player, camera, audio, lights, instab, say, hall, story, flags, actBtn: $('act') });
  ambient ??= createAmbient({ player, audio, story, combat });
  wh ??= createWarehouse({ scene, mats, player, camera, audio, lights, instab, say, hall, combat, story, flags, actBtn: $('act') });
  cellar ??= createCellar({ scene, mats, player, camera, audio, lights, instab, say, hall, flags, story, flash });
  tower ??= createTower({ scene, mats, player, camera, audio, lights, instab, say, flags, scare, finish, warm, actBtn: $('act'), combat });
  doorEvent ??= createDoorEvent({ scene, player, audio, lights, instab, say, camera, hall, onHallDone: (turned) => { flags.turned = turned; story.goto('cellar'); } });
  $('enter').disabled = true;
  try { await audio.start(); } catch (_) {}
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) {}
  try { await screen.orientation?.lock?.('portrait'); } catch (_) {}
  $('intro').classList.add('hidden');
  // ?start=porta → salta il tunnel e parte a ~8 m dal portone (per provare solo la parte finale)
  if (q.get('start') === 'porta') { glassEvent.state = 'done'; glassEvent.done = true; player.pos.set(0.1, 1.62, -46); }
  // scorciatoie di prova: ?start=cantina | torre  (&turned=1 / &mirror=1 per simulare le scelte)
  { const st = q.get('start'); flags.turned = q.get('turned') === '1'; flags.mirror = q.get('mirror') === '1'; flags.door = q.get('door') === 'red' ? 'red' : q.get('door') === 'breath' ? 'breath' : null;
    if (st === 'epilogo') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; dawn.start(q.get('turned') === '1' ? 'ti sei girato.\nlei non se n\'è mai andata.\nl\'incendio l\'hai acceso tu.' : 'non ti sei girato.\nera già davanti a te.\nnon volevi ricordare.'); }
    if (st === 'cantina' || st === 'torre' || st === 'magazzino' || st === 'obitorio') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; story.goto(st === 'cantina' ? 'cellar' : st === 'obitorio' ? 'morgue' : st === 'magazzino' ? 'warehouse' : 'tower'); } }
  controls.enabled = true; started = true; state = 'play';
  $('fade').style.opacity = 0;
  setTimeout(() => instab.show(), 4000);
  setTimeout(() => say('sinistra: muoviti   ·   destra: guarda', 5000), 1800);
  if (!q.get('start')) { setTimeout(() => { if (story?.current() === 'tunnel') say('corridoio di servizio. non fermarti, dicevano.', 5200); }, 9500); setTimeout(() => { if (story?.current() === 'tunnel') say('qualcuno ti segue da prima che entrassi.', 5200); }, 17500); }
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

function finish(msg, fast = false, light = false) {
  if (ended) return; ended = true; controls.enabled = false; instab.hide();
  $('endtext').innerText = msg || 'fine';
  const n = /^non ti sei girato/.test(msg || '') ? 1 : /^ti sei girato/.test(msg || '') ? 2 : /^sei uscito/.test(msg || '') ? 3 : 0;
  $('endsub').textContent = n ? (n === 3 ? 'finale segreto · 3 di 3' : `finale ${n} di 3`) : '';
  setTimeout(() => audio.duck(0, 1.5), 400);
  $('fade').style.background = light ? '#dfe8e2' : '#000'; $('fade').style.transition = fast ? 'opacity .25s' : 'opacity 3s'; $('fade').style.opacity = 1;
  setTimeout(() => $('end').classList.remove('hidden'), fast ? 1800 : 3200);
}
$('again').addEventListener('click', () => location.reload());
$('act').addEventListener('click', () => { if (wh && wh.near) wh.take(); else if (tower && tower.near) tower.open(); else if (morgue && morgue.near) morgue.open(); });
$('fire').addEventListener('pointerdown', (e) => { e.preventDefault(); combat?.fire(); });
addEventListener('keydown', (e) => { if (e.code === 'Space') combat?.fire(); });

function tick(dt) {
  doorEvent?.update(dt);
  scare?.update(dt);
  hall?.update(dt, camera);
  dust.update(dt, time);
  dawn?.update(dt);
  cellar?.update(dt);
  tower?.update(dt, time);
  wh?.update(dt); morgue?.update(dt); ambient?.update(dt);
  combat?.update(dt, time);
  time += dt;
  player.update(dt, time);
  audio.setListener(camera);
  lights.update(dt, time, player.pos.z, player.pos.x);
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
    else if (fps < 28 && pr <= 0.71 && !globalThis.__lowQ) { globalThis.__lowQ = true; scene.traverse((o) => { if (o.userData.decor) o.visible = false; }); }   // ultimo ripiego: via l'arredo modulare
  }
}
requestAnimationFrame((n) => { last = n; frame(n); });

// debug/test: ?debug=1 espone il gioco e permette di saltare avanti
if (q.has('debug')) {
  window.__g = { get dawn() { return dawn; }, flags, get combat() { return combat; }, get wh() { return wh; }, get morgue() { return morgue; }, get story() { return story; }, get cellar() { return cellar; }, get tower() { return tower; }, get hall() { return hall; }, get scare() { return scare; }, get door() { return doorEvent; }, THREE, scene, camera, player, glassEvent, lights, instab, audio, renderer, enter,
    sim(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) tick(dt); },
    tp(z, yaw = 0) { player.pos.set(0.1, 1.62, z); player.yaw = yaw; player.pitch = 0; } };
}
