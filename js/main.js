import * as THREE from 'three';
import { P, PKEY } from './personal.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { makeMaterials, setAnisotropy } from './world/materials.js';
import { buildTunnel, LAMPS, W, Z_END, H0 } from './world/tunnel.js';
import { createLights } from './world/lights.js';
import { createControls } from './player/controls.js';
import { createPlayer } from './player/player.js';
import { createAudio } from './audio/audio.js';
import { createRats } from './events/rats.js';
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
import { createNotes } from './events/notes.js';
import { writingDecals } from './world/blood.js';
import { bloodText } from './world/bloodfont.js';
import { RIBS } from './world/tunnel.js';
import { W as TUNNEL_W } from './world/tunnel.js';
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
const rats = createRats({ camera, player, audio });
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
let dawn = null, doorEvent = null, scare = null, hall = null, cellar = null, tower = null, story = null, wh = null, morgue = null, ambient = null, notes = null, combat = null;
const flags = { turned: false, mirror: false, door: null, notes: 0 };
// CHECKPOINT: a ogni stanza si salva dove sei e le scelte fatte. Dalla schermata iniziale puoi ripartire da lì.
const CK = 'ng_ckpt', CK_ST = { cellar: 'cantina', morgue: 'obitorio', warehouse: 'magazzino', tower: 'torre' }, CK_NAME = { cellar: 'dalla cantina', morgue: "dall'obitorio", warehouse: 'dal magazzino', tower: 'dalla torre' };
const loadCkpt = () => { try { const c = JSON.parse(localStorage.getItem(CK) || 'null'); return c && CK_ST[c.room] ? c : null; } catch (_) { return null; } };
function saveCkpt(room) { if (!CK_ST[room]) return; try { localStorage.setItem(CK, JSON.stringify({ room, turned: !!flags.turned, door: flags.door || null, weapon: flags.weapon || null, noGun: !!flags.noGun, notes: [...(notes?.found || [])] })); } catch (_) {} }
let restoreCk = false;
{ const ck = loadCkpt(), b = document.getElementById('ckpt'); if (ck && b) { b.textContent = 'riparti ' + CK_NAME[ck.room]; b.classList.remove('hidden'); b.addEventListener('click', () => { restoreCk = true; document.getElementById('enter').click(); }); } }
const warm = new THREE.PointLight(0xff9a50, 0, 15, 1.7); scene.add(warm);
const flash = new THREE.PointLight(0xffd9a0, 0, 28, 1.6); scene.add(flash);   // lampo dello sparo
let state = 'loading', last = 0, time = 0, paused = false, fpsAcc = 0, fpsN = 0, ended = false;
let started = false;
const hint = $('subtitle');
// Le note hanno la precedenza: finché una nota è a schermo, gli altri messaggi aspettano (resta in coda solo l'ultimo) e compaiono subito dopo.
function say(txt, ms = 4000, style = '') {
  const now = performance.now();
  if (style !== 'note' && style !== 'urgent' && now < (say.noteUntil || 0)) { clearTimeout(say.q); say.q = setTimeout(() => say(txt, ms, style), say.noteUntil - now + 400); return; }
  if (style === 'note') { say.noteUntil = now + ms; clearTimeout(say.q); }
  hint.classList.toggle('note', style === 'note'); hint.classList.toggle('urgent', style === 'urgent'); hint.textContent = txt; hint.style.opacity = 1;
  clearTimeout(say.t); say.t = setTimeout(() => (hint.style.opacity = 0), ms);
}

// COME SI GIOCA: due anelli con un puntino che si trascina, uno per metà schermo; ognuno sparisce quando tocchi quella metà (o dopo 14 s)
function showHowto() {
  const h = $('howto'); if (!h) return; h.classList.remove('hidden'); requestAnimationFrame(() => h.classList.add('on'));
  const used = { l: false, r: false }, hide = (k) => { if (used[k]) return; used[k] = true; h.querySelector('.ht.' + k)?.classList.add('gone'); if (used.l && used.r) setTimeout(() => h.classList.add('hidden'), 900); };
  const onDown = (e) => { if (e.clientX < innerWidth * 0.5) setTimeout(() => hide('l'), 500); else setTimeout(() => hide('r'), 500); };
  addEventListener('pointerdown', onDown); setTimeout(() => { hide('l'); hide('r'); removeEventListener('pointerdown', onDown); }, 14000);
}

async function enter() {
  scare ??= createScare({ scene, camera, player, audio, lights, instab, finish: (m, f) => (dawn ? dawn.start(m) : finish(m, f)) });
  hall ??= createHall({ scene, mats, lights });
  dawn ??= createDawn({ scene, camera, player, audio, lights, instab, say, finish, onStart: () => combat?.hideAll(), hall });
  story ??= createStory({ scene, camera, controls, player, audio, hall, getCellar: () => cellar, getTower: () => tower, getWh: () => wh, getMorgue: () => morgue, say, lights, instab, onRoom: (name) => saveCkpt(name) });
  combat ??= createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui: { aimAll: (b) => { controls.aimAll = b; if (b) { controls.move.x = controls.move.y = 0; $('stick').style.opacity = 0; } }, label: (t) => ($('fire').textContent = t), cool: (b) => $('fire').classList.toggle('cool', b), show: (b) => { $('fire').classList.toggle('hidden', !b); $('dot').classList.toggle('hidden', !b); } } });
  morgue ??= createMorgue({ scene, mats, player, camera, audio, lights, instab, say, hall, story, flags, actBtn: $('act') });
  ambient ??= createAmbient({ player, audio, story, combat });
  wh ??= createWarehouse({ scene, mats, player, camera, audio, lights, instab, say, hall, combat, story, flags, actBtn: $('act') });
  cellar ??= createCellar({ scene, mats, player, camera, audio, lights, instab, say, hall, flags, story, flash });
  tower ??= createTower({ scene, mats, player, camera, audio, lights, instab, say, flags, scare, finish: (m, f, l) => (dawn ? dawn.start(m) : finish(m, f, l)), warm, actBtn: $('act'), combat });
  // topi: vicino ai muri e alle cose, scappano di scatto quando ti avvicini (una volta sola ciascuno)
  if (!window.__ratsDone) { window.__ratsDone = true;
    rats.add(scene, { x: 1.0, z: -9.5, ry: 0.4, hide: [[1.12, -13], [1.2, -16.5]] });                                                  // tunnel, lungo il muro destro
    rats.add(cellar.group, { x: 2.2, z: -204.5, ry: 2.2, hide: [[3.6, -205.6], [3.75, -208]] });                                         // cantina, vicino ai rottami
    rats.add(cellar.group, { x: -2.4, z: -215.0, ry: 0.9, hide: [[-3.7, -218], [-3.65, -222.8]] });                                      // cantina, lato dello specchio
    rats.add(morgue.group, { x: -2.5, z: -510.5, ry: 1.4, hide: [[-4.05, -512.7], [-4.05, -513.9]] });                                   // obitorio, vicino al cesto
    rats.add(morgue.group, { x: 2.4, z: -507.8, ry: 4.0, hide: [[4.0, -508.6], [4.1, -511.6]] });                                        // obitorio, dietro il tavolo
    rats.add(wh.group, { x: -2.6, z: -416.0, ry: 5.0, hide: [[-5.0, -417.2], [-5.4, -421]] });                                           // magazzino, sotto uno scaffale
    rats.add(wh.group, { x: 2.8, z: -420.0, ry: 1.0, hide: [[5.0, -421.5], [5.3, -424.4]] });
    rats.add(wh.group, { x: -1.2, z: -428.0, ry: 3.3, hide: [[-4.2, -430.5], [-5.2, -431.4]] });
    rats.add(tower.group, { x: -2.6, z: -309.0, ry: 2.6, hide: [[-6.0, -309.6], [-6.4, -312]] });                                        // torre, vicino alla stufa
  }
  combat.actBtn = $('act');
  const WZ = -400, CZ = -200, MZ = -500, TZ = -300;   // z0 delle stanze (vedi i moduli)
  notes ??= createNotes({ camera, player, audio, story, say, instab, flags, defs: [
    { room: 'tunnel', parent: scene, p: [-TUNNEL_W + 0.03, 1.45, -8], ry: Math.PI / 2 },
    { room: 'cellar', parent: cellar.group, p: [3.97, 1.5, CZ - 7], ry: -Math.PI / 2 },
    { room: 'morgue', parent: morgue.group, p: [-4.2, 1.45, MZ - 3.4], ry: Math.PI / 2 },
    { room: 'warehouse', parent: wh.group, p: [-5.96, 1.5, WZ - 17], ry: Math.PI / 2 },
    { room: 'tower', parent: tower.group, p: [-6.96, 1.5, TZ - 5], ry: Math.PI / 2 },
  ] });
  // disegno da bambino (tutte le versioni) in cantina, e foto di Elisa col volto bruciato (solo Elisa) in obitorio: fogli appesi al muro, senza luce propria
  if (!window.__pics) { window.__pics = true;
    writingDecals(cellar.group, [{ img: 'assets/tex/pic_drawing.jpg', aspect: 1.004, p: [3.96, 1.5, CZ - 9.7], wall: '-x', w: 0.9, rot: 0.04, a: 1, plain: true }]);
    if (PKEY === 'elisa') writingDecals(morgue.group, [{ img: 'assets/tex/pic_elisa.jpg', aspect: 0.545, p: [4.22, 1.5, MZ - 3.2], wall: '-x', w: 0.5, rot: -0.03, a: 1, plain: true }]);
    if (PKEY === 'yana') writingDecals(morgue.group, [{ img: 'assets/tex/pic_yana.jpg', aspect: 0.741, p: [4.22, 1.5, MZ - 3.2], wall: '-x', w: 0.6, rot: -0.03, a: 1, plain: true }]); }
  // SCRITTE DI SANGUE per le versioni personalizzate (frasi con il suo nome; per Yana anche in ucraino), grandi sui muri
  const WRI = { yana: { t1: ['yana_1', 5.09, 4.4], t3: ['yana_3', 4.34, 4.2], c2: ['yana_2', 2.42, 3.6], w4: ['yana_4', 4.26, 5.4], o: ['yana_o', 7.05, 4.2], h: ['yana_h', 3.87, 2.65], m: ['yana_m', 6.67, 4.0] }, elisa: { t1: ['elisa_1', 4.89, 4.4], t3: ['elisa_3', 3.89, 4.0], c2: ['elisa_2', 2.63, 3.6], w4: ['elisa_4', 4.78, 5.4], o: ['elisa_o', 6.88, 4.2], h: ['elisa_h', 4.15, 2.65], m: ['elisa_m', 6.83, 4.0] } }[PKEY];
  // chiunque altro: stesse posizioni, frasi scritte al volo con il font di sangue (js/world/bloodfont.js); [testo, _, larghezza massima]
  const GN = P ? P.name.toUpperCase() : '', GF = P?.f !== false;
  // altezza (m) che hanno le scritte di Elisa in ogni punto: le frasi nuove hanno la stessa altezza (la larghezza segue il testo ed e' comunque limitata allo spazio libero, vedi fit)
  const HGT = { t1: 0.90, t3: 1.03, c2: 1.37, w4: 1.13, o: 0.87, h: 0.64, m: 0.59 };
  const GT = P ? { t1: GN + ',\nNON FERMARTI', t3: 'NON È LA TUA\nFACCIA, ' + GN, c2: GN + ',\nGIRATI', w4: 'NON SEI ' + (GF ? 'SOLA' : 'SOLO') + ',\n' + GN, o: GN + ',\nQUI TI HANNO ' + (GF ? 'LEGATA' : 'LEGATO'), h: 'TI STAVANO\nASPETTANDO, ' + GN, m: 'NON C\'È USCITA,\n' + GN } : null;
  const WR = WRI || (P ? Object.fromEntries(Object.entries(GT).map(([k, t]) => [k, [t, 0, HGT[k] * bloodText(t).aspect]])) : null);   // chiunque altro: stesse posizioni, frasi scritte al volo con il font di sangue (js/world/bloodfont.js)
  const spec = (k) => WRI ? { img: 'assets/tex/wr_' + WR[k][0] + '.png', aspect: WR[k][1] } : { text: WR[k][0], aspect: bloodText(WR[k][0]).aspect };
  if (WR && !window.__writ) { window.__writ = true;
    // CRITERIO: ogni scritta sta al CENTRO dello spazio libero tra due elementi fissi (costoloni del tunnel, pilastri della cantina) e la sua larghezza e' limitata allo spazio, cosi' niente la taglia
    const fit = (a, b, k, thick, maxW) => ({ z: (a + b) / 2, w: Math.min(maxW ?? WR[k][2], Math.abs(a - b) - thick - 0.5) });
    const t1 = fit(RIBS[1], RIBS[2], 't1', 0.5), t3 = fit(RIBS[4], RIBS[5], 't3', 0.5), c2 = fit(CZ - 13, CZ - 18, 'c2', 0.9);   // tunnel: prima e dopo il vetro; cantina: dopo lo specchio
    writingDecals(scene, [{ ...spec('t1'), p: [-1.38, 1.0, t1.z], wall: '+x', w: t1.w }, { ...spec('t3'), p: [-1.38, 1.0, t3.z], wall: '+x', w: t3.w }]);   // sotto il tubo sottile (y 1.62)
    writingDecals(cellar.group, [{ ...spec('c2'), p: [-3.96, 1.7, c2.z], wall: '+x', w: c2.w }]);
    // obitorio: muro sinistro (parte verde, sopra le piastrelle), al centro della sala
    writingDecals(morgue.group, [{ ...spec('o'), p: [-4.22, 2.1, MZ - 6.6], wall: '+x', w: WRI ? 6.0 : Math.min(WR.o[2], 6.0) }]);
    // sala dei mostri: sui due muri laterali, tra la porta chiusa e il primo pilastro (e' li' che guardi mentre ti giri); stesso centro, larghezza limitata allo spazio
    { const hz = Z_END - 0.35, hs = fit(hz, hz - 3.15, 'h', 0, WR.h[2] + 1); writingDecals(hall.group, [{ ...spec('h'), p: [-5.99, 1.7, hs.z], wall: '+x', w: hs.w }, { ...spec('h'), p: [5.99, 1.7, hs.z], wall: '-x', w: hs.w }]); }
    // magazzino: muro sinistro, tra due pilastri (sotto la lampada a muro, lontano dagli scaffali)
    { const ws = fit(WZ - 21.6, WZ - 27.6, 'm', 0.9, WR.m[2]); writingDecals(wh.group, [{ ...spec('m'), p: [-5.96, 1.3, ws.z], wall: '+x', w: ws.w }]); }
    // simbolo (occhio) a sangue, riempitivo: 3 volte lungo il percorso, in punti vuoti (tunnel muro destro, cantina muro sinistro, magazzino muro destro)
    { const sg = 'assets/tex/wr_sigil.png', A = 0.844, tz = (RIBS[2] + RIBS[3]) / 2;
      writingDecals(scene, [{ img: sg, aspect: A, p: [1.38, 1.45, tz], wall: '-x', w: 1.1 }]);
      writingDecals(cellar.group, [{ img: sg, aspect: A, p: [-3.96, 1.6, CZ - 20.5], wall: '+x', w: 1.6 }]);
      writingDecals(wh.group, [{ img: sg, aspect: A, p: [5.96, 1.9, WZ - 12.6], wall: '-x', w: 1.7 }]); }
    // solo Yana: frase piccola e bassa, quasi nascosta, sul muro destro del tunnel (poco in vista)
    if (PKEY === 'yana') writingDecals(scene, [{ img: 'assets/tex/wr_yana_soul.png', aspect: 1.164, p: [1.38, 0.95, (RIBS[5] + RIBS[6]) / 2], wall: '-x', w: 1.5, a: 0.8 }]);
    writingDecals(tower.group, [{ ...spec('w4'), p: [0, 3.7, TZ - 0.05], wall: '-z', w: WR.w4[2] }]);   // torre: muro d'ingresso, sopra la porta: la vedi quando ti giri
  }
  doorEvent ??= createDoorEvent({ scene, player, audio, lights, instab, say, camera, hall, onHallDone: (turned) => { flags.turned = turned; story.goto('cellar'); } });
  $('enter').disabled = true;
  try { await audio.start(); audio.heartbeat?.(); navigator.vibrate?.(30); } catch (_) {}
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) {}
  try { await screen.orientation?.lock?.('portrait'); } catch (_) {}
  $('intro').classList.add('hidden');
  // ?start=porta → salta il tunnel e parte a ~8 m dal portone (per provare solo la parte finale)
  if (q.get('start') === 'porta') { glassEvent.state = 'done'; glassEvent.done = true; player.pos.set(0.1, 1.62, -46); }
  // scorciatoie di prova: ?start=cantina | torre  (&turned=1 / &mirror=1 per simulare le scelte)
  { const ck = restoreCk ? loadCkpt() : null, st = ck ? CK_ST[ck.room] : q.get('start'); flags.turned = ck ? ck.turned : q.get('turned') === '1'; flags.mirror = q.get('mirror') === '1'; flags.noGun = ck ? ck.noGun : q.get('nogun') === '1'; flags.weapon = ck ? ck.weapon : (q.get('weapon') === 'axe' ? 'axe' : null); flags.door = ck ? ck.door : (q.get('door') === 'red' ? 'red' : q.get('door') === 'breath' ? 'breath' : null);
    if (ck) { ck.notes.forEach((i) => notes.found.add(i)); flags.notes = notes.found.size; }
    if (st === 'epilogo') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; dawn.start(q.get('turned') === '1' ? 'ti sei girato.\nlei non se n\'è mai andata.\nl\'incendio l\'hai acceso tu.' : 'non ti sei girato.\nera già davanti a te.\nnon volevi ricordare.'); }
    if (st === 'cantina' || st === 'torre' || st === 'magazzino' || st === 'obitorio') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; if (st === 'torre' && flags.weapon === 'axe') combat.giveAxe(); story.goto(st === 'cantina' ? 'cellar' : st === 'obitorio' ? 'morgue' : st === 'magazzino' ? 'warehouse' : 'tower'); } }
  controls.enabled = true; started = true; state = 'play';
  $('fade').style.opacity = 0;
  setTimeout(() => instab.show(), 4000);
  if (!q.get('start')) setTimeout(showHowto, 1800);
  if (!q.get('start')) { setTimeout(() => { if (story?.current() === 'tunnel') say(P ? P.name + '. non fermarti, dicevano.' : 'corridoio di servizio. non fermarti, dicevano.', 5200); }, 9500); setTimeout(() => { if (story?.current() === 'tunnel') say('qualcuno ti segue da prima che entrassi.', 5200); }, 17500); }
  last = performance.now();
}
$('enter').addEventListener('click', enter);

THREE.DefaultLoadingManager.onLoad = () => { window.__loadMsgStop?.(); $('loadmsg').textContent = ''; $('enter').disabled = false; };
$('enter').disabled = true;
setTimeout(() => { window.__loadMsgStop?.(); $('enter').disabled = false; $('loadmsg').textContent = ''; }, 9000);

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
  const n = /^non ti sei girat/.test(msg || '') ? 1 : /^ti sei girat/.test(msg || '') ? 2 : 0;
  $('endsub').textContent = (n ? `finale ${n} di 2` : '') + (n && notes ? `\nricordi: ${flags.notes ?? 0} di 5` : '');
  setTimeout(() => audio.duck(0, 1.5), 400);
  $('fade').style.background = light ? '#dfe8e2' : '#000'; $('fade').style.transition = fast ? 'opacity .25s' : 'opacity 3s'; $('fade').style.opacity = 1;
  setTimeout(() => $('end').classList.remove('hidden'), fast ? 1800 : 3200);
}
$('again').addEventListener('click', () => location.reload());
$('act').addEventListener('click', () => { if (wh && wh.near) wh.take(); else if (wh && wh.nearGate) wh.openGate(); else if (tower && tower.near) tower.open(); else if (morgue && morgue.near) morgue.open(); else if (combat && combat.canLower) combat.lower(); });
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
  wh?.update(dt); morgue?.update(dt); ambient?.update(dt); notes?.update(dt); rats.update(dt);
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
  window.__g = { rats, say, get notes() { return notes; }, get dawn() { return dawn; }, flags, get combat() { return combat; }, get wh() { return wh; }, get morgue() { return morgue; }, get story() { return story; }, get cellar() { return cellar; }, get tower() { return tower; }, get hall() { return hall; }, get scare() { return scare; }, get door() { return doorEvent; }, THREE, scene, camera, player, glassEvent, lights, instab, audio, renderer, enter,
    sim(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) tick(dt); },
    tp(z, yaw = 0) { player.pos.set(0.1, 1.62, z); player.yaw = yaw; player.pitch = 0; } };
}
