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
import { createRgbShift } from './ui/rgbshift.js';
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
import { createWard } from './events/ward.js';
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
// QUALITA' GRAFICA: alta / media / bassa. Scelta dal menu iniziale e ricordata sul telefono; se manca, si sceglie da soli dalla potenza dichiarata del dispositivo (memoria, core).
// Se i frame calano durante la partita il gioco abbassa da solo la risoluzione (solo per quella partita).
const QK = 'ng_quality', QD = { high: { pr: 1.5, aa: true, an: 4 }, mid: { pr: 1.15, aa: false, an: 2 }, low: { pr: 0.8, aa: false, an: 1 } };
let QUAL; try { QUAL = localStorage.getItem(QK); } catch (_) {}
if (!QD[QUAL]) QUAL = 'high';   // di base: alta (la scelta si cambia dal menu iniziale e resta ricordata)
globalThis.__quality = QUAL; if (QUAL === 'low') globalThis.__lowQ = true;   // bassa: niente arredo modulare (tubi, cavi, recinzioni), specchio piu' piccolo
const QC = QD[QUAL];
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QC.aa && devicePixelRatio < 2, powerPreference: QUAL === 'low' ? 'default' : 'high-performance', alpha: false });
let pr = Math.min(devicePixelRatio || 1, QC.pr);
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
setAnisotropy(Math.min(QC.an, renderer.capabilities.getMaxAnisotropy()));

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
const rgbShift = createRgbShift(renderer);

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
let dawn = null, doorEvent = null, scare = null, hall = null, cellar = null, tower = null, story = null, wh = null, morgue = null, ward = null, ambient = null, notes = null, combat = null;
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
  story ??= createStory({ scene, camera, controls, player, audio, hall, getCellar: () => cellar, getTower: () => tower, getWh: () => wh, getMorgue: () => morgue, getWard: () => ward, say, lights, instab, onRoom: (name) => saveCkpt(name) });
  combat ??= createCombat({ scene, camera, player, audio, lights, instab, say, flash, scare, ui: { aimAll: (b) => { controls.aimAll = b; if (b) { controls.move.x = controls.move.y = 0; $('stick').style.opacity = 0; } }, label: (t) => ($('fire').textContent = t), cool: (b) => $('fire').classList.toggle('cool', b), show: (b) => { $('fire').classList.toggle('hidden', !b); $('dot').classList.toggle('hidden', !b); } } });
  ward ??= createWard({ scene, mats, player, camera, audio, lights, instab, say, getMorgue: () => morgue, get story() { return story; } });
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
    rats.add(morgue.group, { x: -3.95, z: -509.5, ry: -1.9, hide: [[-4.05, -511.6], [-4.05, -513.9]] });                                   // obitorio, contro il muro sinistro
    rats.add(morgue.group, { x: 3.95, z: -509.8, ry: 1.9, hide: [[4.05, -511.4], [4.1, -513.2]] });                                        // obitorio, contro il muro destro
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
  // Letto d'ospedale con le sue texture, nel magazzino contro il muro destro
  if (!window.__bed) { window.__bed = true; gl.load('assets/models/hs_bed.glb', (g) => { const o = g.scene, b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), long = Math.max(sz.x, sz.z), k = 2.0 / long; o.scale.setScalar(k); b.setFromObject(o); const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
      o.traverse((m) => { if (m.isMesh) { m.material.color?.multiplyScalar(0.42).lerp(new THREE.Color(0.3, 0.22, 0.17), 0.15); m.material.roughness = Math.max(0.6, m.material.roughness ?? 0.7); } });
      const h = new THREE.Group(); h.add(o); h.position.set(-5.3, 0, WZ - 12.6); h.rotation.y = (sz.x > sz.z ? Math.PI / 2 : 0) + 0.03; wh.group.add(h); window.__bedObj = h; }); }
  if (!window.__pics) { window.__pics = true;
    writingDecals(cellar.group, [{ img: 'assets/tex/pic_drawing.jpg', aspect: 1.004, p: [3.96, 1.5, CZ - 4.5], wall: '-x', w: 0.9, rot: 0.04, a: 1, plain: true }]);
    // quadri e foto inquietanti (Gemini), uguali in tutte le versioni: ad altezza sguardo, su tratti di muro liberi (aspect = larghezza/altezza dell'immagine)
    const pic = (n, asp, x, y, z, wall, w, rot) => ({ img: 'assets/tex/pic_' + n + '.webp', aspect: asp, p: [x, y, z], wall, w, rot, a: 1, plain: true });
    // GRUPPI (stesso criterio in tutte le versioni): cantina = i due disegni dei bambini vicini; obitorio parete destra = anatomia, uomo a carboncino, famiglia + murale largo;
    // magazzino = corridoio, finestra e santo vicini, sopra il letto
    writingDecals(cellar.group, [pic('drawing2', 1.442, 3.96, 1.5, CZ - 5.9, '-x', 1.0, -0.03)]);
    writingDecals(morgue.group, [pic('anatomy', 0.755, 4.22, 1.5, MZ - 5.8, '-x', 0.6, 0.02), pic('charcoal', 0.756, 4.22, 1.5, MZ - 7.0, '-x', 0.55, -0.02), pic('family', 1.287, 4.22, 1.5, MZ - 8.4, '-x', 0.75, 0.02)]);
    // MURALES GIGANTI (affreschi scrostati), uno per ambiente grande, a riempire una campata intera tra due pilastri (sempre uguali in tutte le versioni)
    writingDecals(scene, [{ ...pic('mural_wide', 3.043, 1.38, 1.1, -28.5, '-x', 5.0, 0), rot: 0, a: 0.94 }]);                    // tunnel, parete destra
    writingDecals(wh.group, [{ ...pic('mural_corridor', 1.2959, -5.96, 3.0, WZ - 18.6, '+x', 4.7, 0), rot: 0, a: 0.94 }]);              // magazzino, parete sinistra
    writingDecals(wh.group, [{ ...pic('mural_demon', 1.1765, 5.94, 3.2, WZ - 12.6, '-x', 4.7, 0), rot: 0, a: 0.94 }]);              // magazzino, parete destra (di fronte al gruppo sopra il letto)
    writingDecals(hall.group, [{ ...pic('mural_ritual', 1.8534, 5.97, 2.6, -62.95, '-x', 4.7, 0), rot: 0, a: 0.94, glow: 0.14 }]);              // sala della folla: un solo murale (rito, sbiadito e usurato), vicino all'ingresso
    // Torre: due murali ai lati della porta in fondo (gli ultimi che vedi) e tre in alto sui muri lunghi, sopra la stufa. Magazzino: due in alto (sopra scaffali e tubi).
    writingDecals(tower.group, [{ ...pic('mural_throne', 1.012, -3.85, 3.6, TZ - 17.97, '+z', 3.8, 0), rot: 0, a: 0.94, glow: 0.2 }]);   // torre, in fondo a sinistra della porta: il trono con la folla in ginocchio
    writingDecals(tower.group, [{ ...pic('mural_skull', 1.0, 3.85, 3.6, TZ - 17.97, '+z', 3.8, 0), rot: 0, a: 0.94, glow: 0.2 },
      { ...pic('mural_inferno', 0.9049, -6.94, 4.6, TZ - 12.6, '+x', 3.07, 0), rot: 0, a: 0.94, glow: 0.2 }, { ...pic('mural_eyes', 2.368, -6.94, 5.0, TZ - 6.6, '+x', 4.7, 0), rot: 0, a: 0.94, glow: 0.2 }, { ...pic('mural_faces', 1.2526, 6.94, 5.0, TZ - 6.6, '-x', 4.2, 0), rot: 0, a: 0.94, glow: 0.2 }]);
    writingDecals(cellar.group, [{ ...pic('mural_angels', 1.0, -3.94, 2.2, CZ - 5.5, '+x', 3.0, 0), rot: 0, a: 0.94, glow: 0.2 }]);   // cantina, parete sinistra prima dello specchio: gli angeli senza volto
    // cantina: la parete in fondo e' un murale intero attorno alla porta d'uscita (il vano della porta e' trasparente nel disegno)
    writingDecals(cellar.group, [{ ...pic('mural_door', 1.8018, 0, 2.22, CZ - 23.985, '+z', 8.0, 0), rot: 0, a: 0.96, glow: 0.16 }]);
    writingDecals(wh.group, [{ ...pic('mural_fire', 1.2373, -5.94, 4.4, WZ - 24.6, '+x', 3.2, 0), rot: 0, a: 0.94, glow: 0.2 }]);
    writingDecals(wh.group, [{ ...pic('mural_angel', 1.808, 5.94, 3.0, WZ - 24.6, '-x', 4.7, 0), rot: 0, a: 0.94 }]);              // magazzino, parete destra
    writingDecals(tower.group, [{ ...pic('mural_cathedral', 1.351, 6.94, 3.2, TZ - 12.6, '-x', 4.7, 0), rot: 0, a: 0.94 }]);       // torre, parete destra
    writingDecals(wh.group, [pic('corridor', 1.369, -5.96, 1.5, WZ - 11.4, '+x', 0.85, 0.02), pic('window', 1.233, -5.96, 1.5, WZ - 12.55, '+x', 0.85, -0.02), pic('saint', 0.789, -5.96, 1.5, WZ - 13.65, '+x', 0.62, 0.02)])
    if (PKEY === 'elisa') writingDecals(morgue.group, [{ img: 'assets/tex/pic_elisa.jpg', aspect: 0.545, p: [4.22, 1.5, MZ - 3.2], wall: '-x', w: 0.5, rot: -0.03, a: 1, plain: true }]);
    if (PKEY !== 'elisa') writingDecals(morgue.group, [{ img: 'assets/tex/pic_yana.jpg', aspect: 0.741, p: [4.22, 1.5, MZ - 3.2], wall: '-x', w: 0.6, rot: -0.03, a: 1, plain: true }]); }
  // SCRITTE DI SANGUE per le versioni personalizzate (frasi con il suo nome; per Yana anche in ucraino), grandi sui muri
  const WRI = {}[PKEY]
    || (P ? null : { t1: ['std_t1', 2.6, 3.1], t3: ['std_t3', 2.361, 3.3], c2: ['std_c2', 1.36, 2.4], w4: ['std_w4', 2.552, 5.0], o: ['std_o', 2.902, 4.6], h: ['std_h', 1.774, 2.65], m: ['std_m', 2.174, 3.7] });   // versione standard: immagini di sangue (Gemini), senza nome
  // chiunque altro: stesse posizioni, frasi scritte al volo con il font di sangue (js/world/bloodfont.js); [testo, _, larghezza massima]
  const GN = P ? P.name.toUpperCase() : '', GF = P?.f !== false;
  // altezza (m) delle scritte al volo in ogni punto: le frasi nuove (la larghezza segue il testo ed e' comunque limitata allo spazio libero, vedi fit)
  const HGT = { t1: 1.2, t3: 1.3, c2: 1.8, w4: 1.5, o: 1.15, h: 1.6, m: 1.5 };   // altezza massima della scritta (lettere come quelle di Yana: ~35% piu' grandi di prima), larghezza = testo, limitata allo spazio libero
  // versione standard: stesse scritte, senza nome (generiche); le altre: con il nome
  const GT = P ? { t1: GN + ',\nTI HANNO VISTO', t3: 'NON È LA TUA\nFACCIA, ' + GN, c2: GN + ',\nGIRATI', w4: 'NON SEI ' + (GF ? 'SOLA' : 'SOLO') + ',\n' + GN, o: GN + ',\nQUI TI HANNO ' + (GF ? 'LEGATA' : 'LEGATO'), h: 'TI STAVANO\nASPETTANDO,\n' + GN, m: 'NON C\'È VIA\nD\'USCITA, ' + GN }
    : { t1: 'NON\nFERMARTI', t3: 'NON È LA TUA\nFACCIA', c2: 'DIETRO\nDI TE', w4: 'NON SEI\nSOLO', o: 'QUI TI HANNO\nLEGATO', h: 'TI STAVANO\nASPETTANDO', m: 'NON C\'È\nUSCITA' };
  if (PKEY === 'yana') { GT.c2 = 'ОБЕРНИСЬ,\nЯНО'; GT.h = 'ТЕБЕ\nЧЕКАЛИ,\nЯНО'; GT.m = 'НЕМАЄ\nВИХОДУ, ЯНО'; }   // Yana e' ucraina: alcune frasi in ucraino (lettere cirilliche vere)
  const WR = WRI || Object.fromEntries(Object.entries(GT).map(([k, t]) => [k, [t, 0, HGT[k] * (P ? 1.35 : 1) * bloodText(t).aspect]]));   // chiunque altro (e la versione standard): stesse posizioni, frasi scritte al volo con il font di sangue (js/world/bloodfont.js)
  { const T1 = P ? GN + ',\nMORIRAI QUI' : 'MORIRAI\nQUI'; WR.t1 = [T1, 0, HGT.t1 * (P ? 1.35 : 1.15) * bloodText(T1).aspect]; }   // prima scritta del tunnel, per tutte le versioni (nome o no): lettere vere di sangue
  const spec = (k) => (WRI && k !== 't1') ? { img: 'assets/tex/wr_' + WR[k][0] + '.png', aspect: WR[k][1] } : { text: WR[k][0], aspect: bloodText(WR[k][0]).aspect };
  if (WR && !window.__writ) { window.__writ = true;
    // CRITERIO: ogni scritta sta al CENTRO dello spazio libero tra due elementi fissi (costoloni del tunnel, pilastri della cantina) e la sua larghezza e' limitata allo spazio, cosi' niente la taglia
    const fit = (a, b, k, thick, maxW) => ({ z: (a + b) / 2, w: Math.min(maxW ?? WR[k][2], Math.abs(a - b) - thick - 0.5) });
    const t1 = fit(RIBS[1], RIBS[2], 't1', 0.5), t3 = fit(RIBS[4], RIBS[5], 't3', 0.5), c2 = fit(CZ - 13, CZ - 18, 'c2', 0.9);   // tunnel: prima e dopo il vetro; cantina: dopo lo specchio
    { const gem = false;   // frasi generate (standard e nomi): stessa dimensione di prima, ma piu' in basso: la cima della scritta sta sotto il tubo sottile (1,62 m) e le colature scendono fino a terra
      const ty = (w, k) => (gem && k !== 't1' ? 1.0 : 1.5 - (w / spec(k).aspect) / 2);
      writingDecals(scene, [{ ...spec('t1'), p: [-1.38, ty(t1.w, 't1'), t1.z], wall: '+x', w: t1.w }, { ...spec('t3'), p: [-1.38, ty(t3.w, 't3'), t3.z], wall: '+x', w: t3.w }]); }
    writingDecals(cellar.group, [{ ...spec('c2'), p: [-3.96, 1.7, c2.z], wall: '+x', w: c2.w }]);
    // obitorio: muro sinistro (parte verde, sopra le piastrelle), al centro della sala
    writingDecals(morgue.group, [{ ...spec('o'), p: [-4.22, 2.1, MZ - 6.6], wall: '+x', w: Math.min(WR.o[2], 6.0) }]);
    // sala dei mostri: sui due muri laterali, tra la porta chiusa e il primo pilastro (e' li' che guardi mentre ti giri); stesso centro, larghezza limitata allo spazio
    { const hz = Z_END - 0.35, hs = fit(hz, hz - 3.15, 'h', 0, WR.h[2] + 1); writingDecals(hall.group, [{ ...spec('h'), p: [-5.99, 1.7, hs.z], wall: '+x', w: hs.w }, { ...spec('h'), p: [5.99, 1.7, hs.z], wall: '-x', w: hs.w }]); }
    // magazzino: muro sinistro, tra due pilastri (sotto la lampada a muro, lontano dagli scaffali)
    { const ws = fit(WZ - 21.6, WZ - 27.6, 'm', 0.9, WR.m[2]); writingDecals(wh.group, [{ ...spec('m'), p: [-5.96, 1.6, ws.z], wall: '+x', w: ws.w }]); }
    // simbolo (occhio) a sangue, riempitivo: 3 volte lungo il percorso, in punti vuoti (tunnel muro destro, cantina muro sinistro, magazzino muro destro)
    { const sg = 'assets/tex/wr_sigil.png', A = 0.844, tz = (RIBS[5] + RIBS[6]) / 2;   // muro destro, tra due costoloni, lontano da lampade e cavi
      writingDecals(scene, [{ img: sg, aspect: A, p: [1.38, 1.45, tz], wall: '-x', w: 1.1 }]);
      writingDecals(cellar.group, [{ img: sg, aspect: A, p: [-3.96, 1.6, CZ - 20.5], wall: '+x', w: 1.6 }]);
      writingDecals(wh.group, [{ img: sg, aspect: A, p: [5.96, 1.9, WZ - 6.6], wall: '-x', w: 1.7 }]); }
    // solo Elisa: scherzo, sul muro destro del tunnel tra due costoloni
    if (PKEY === 'elisa') { const pz = (RIBS[6] + RIBS[7]) / 2, T = 'PAGLIACCINA\nSEXY', ta = bloodText(T).aspect; writingDecals(scene, [{ text: T, aspect: ta, p: [1.38, 1.6, pz], wall: '-x', w: Math.min(0.75 * ta, Math.abs(RIBS[6] - RIBS[7]) - 1.0) }]); }
    // solo Yana: frase piccola e bassa, quasi nascosta, sul muro destro del tunnel (poco in vista)
    if (PKEY === 'yana') { const T = 'Я ТЕБЕ\nБАЧУ', ta = bloodText(T).aspect; writingDecals(scene, [{ text: T, aspect: ta, p: [1.38, 1.4, (RIBS[6] + RIBS[7]) / 2], wall: '-x', w: Math.min(0.7 * ta, 1.7) }]); }   // Yana: frase ucraina piccola («io ti vedo») con le lettere vere
    writingDecals(tower.group, [{ ...spec('w4'), p: [0, 4.3, TZ - 0.05], wall: '-z', w: WR.w4[2] }]);   // torre: muro d'ingresso, sopra la porta: la vedi quando ti giri
  }
  doorEvent ??= createDoorEvent({ scene, player, audio, lights, instab, say, camera, hall, onHallDone: (turned) => { flags.turned = turned; story.goto('cellar', true); } });
  $('enter').disabled = true;
  try { await audio.start(); audio.heartbeat?.(); navigator.vibrate?.(30); } catch (_) {}
  try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) {}
  try { await screen.orientation?.lock?.('portrait'); } catch (_) {}
  $('intro').classList.add('hidden');
  // PRECOMPILA GLI SHADER di tutte le stanze mentre sei ancora nel tunnel: senza, il telefono compila al primo sguardo di ogni stanza nuova e il gioco si blocca per qualche decimo di secondo
  setTimeout(() => { try {
    const gs = [cellar, morgue, wh, tower, ward, hall].map((r) => r?.group).filter(Boolean), was = gs.map((g) => g.visible);
    gs.forEach((g) => { g.visible = true; }); const p = renderer.compileAsync ? renderer.compileAsync(scene, camera) : (renderer.compile(scene, camera), Promise.resolve());
    gs.forEach((g, i) => { g.visible = was[i]; }); p?.catch?.(() => {});
  } catch (_) {} }, 2500);
  // ?start=porta → salta il tunnel e parte a ~8 m dal portone (per provare solo la parte finale)
  if (q.get('start') === 'porta') { glassEvent.state = 'done'; glassEvent.done = true; player.pos.set(0.1, 1.62, Z_END + 10); }
  // scorciatoie di prova: ?start=cantina | torre  (&turned=1 / &mirror=1 per simulare le scelte)
  { const ck = restoreCk ? loadCkpt() : null, st = ck ? CK_ST[ck.room] : q.get('start'); flags.turned = ck ? ck.turned : q.get('turned') === '1'; flags.mirror = q.get('mirror') === '1'; flags.noGun = ck ? ck.noGun : q.get('nogun') === '1'; flags.weapon = ck ? ck.weapon : (q.get('weapon') === 'axe' ? 'axe' : null); flags.door = ck ? ck.door : (q.get('door') === 'red' ? 'red' : q.get('door') === 'breath' ? 'breath' : null);
    if (ck) { ck.notes.forEach((i) => notes.found.add(i)); flags.notes = notes.found.size; }
    if (st === 'epilogo') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; dawn.start(q.get('turned') === '1' ? 'ti sei girato.\nlei non se n\'è mai andata.\nl\'incendio l\'hai acceso tu.' : 'non ti sei girato.\nera già davanti a te.\nnon volevi ricordare.'); }
    if (st === 'reparto') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; story.goto('ward'); }
    if (st === 'cantina' || st === 'torre' || st === 'magazzino' || st === 'obitorio') { glassEvent.state = 'done'; glassEvent.done = true; doorEvent.state = 'over'; if (st === 'torre' && flags.weapon === 'axe') combat.giveAxe(); story.goto(st === 'cantina' ? 'cellar' : st === 'obitorio' ? 'morgue' : st === 'magazzino' ? 'warehouse' : 'tower'); if (st === 'cantina' && q.get('specchio')) setTimeout(() => { player.pos.set(-1.3, 1.62, -210); player.yaw = Math.PI / 2; player.pitch = 0.02; }, 4500); } }   // ?start=cantina&specchio=1: direttamente davanti allo specchio

  controls.enabled = true; started = true; state = 'play';
  $('fade').style.opacity = 0;
  setTimeout(() => instab.show(), 4000);
  if (!q.get('start')) setTimeout(showHowto, 1800);
  if (!q.get('start') && !restoreCk) setTimeout(() => story?.tell('tunnel'), 13500);   // il registro dell'infermiera comincia dal tunnel
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
{ const qb = $('quality'), qm = $('qmenu'); if (qb && qm) {
  const NAMES = { high: 'alta', mid: 'media', low: 'bassa' };
  qb.textContent = 'qualità: ' + NAMES[QUAL] + ' ▾';
  qb.addEventListener('click', (e) => { e.stopPropagation(); qm.classList.toggle('hidden'); });
  qm.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.q === QUAL); b.addEventListener('click', (e) => { e.stopPropagation(); qm.classList.add('hidden'); if (b.dataset.q === QUAL) return; try { localStorage.setItem(QK, b.dataset.q); } catch (_) {} location.reload(); }); });   // si ricarica: l'antialiasing si decide all'avvio
  document.addEventListener('click', () => qm.classList.add('hidden'));
} }
// il telefono puo' togliere la GPU all'app (memoria bassa, schermo bloccato): invece di restare nero/bloccato, mette in pausa e riprende quando il contesto torna
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setPaused(true); });
canvas.addEventListener('webglcontextrestored', () => { last = performance.now(); });

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
$('act').addEventListener('click', () => { if (wh && wh.nearGate) wh.openGate(); else if (wh && wh.near) wh.take(); else if (tower && tower.near) tower.open(); else if (morgue && morgue.near) morgue.open(); else if (combat && combat.canLower) combat.lower(); });
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
  wh?.update(dt); morgue?.update(dt); ward?.update(dt); ambient?.update(dt); notes?.update(dt); rats.update(dt);
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
  rgbShift.update(dt); rgbShift.render(scene, camera);

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
  window.__g = { rats, say, get notes() { return notes; }, get dawn() { return dawn; }, flags, get combat() { return combat; }, get wh() { return wh; }, get morgue() { return morgue; }, get ward() { return ward; }, get story() { return story; }, get cellar() { return cellar; }, get tower() { return tower; }, get hall() { return hall; }, get scare() { return scare; }, get door() { return doorEvent; }, THREE, scene, camera, player, glassEvent, lights, instab, audio, renderer, enter,
    sim(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) tick(dt); },
    tp(z, yaw = 0) { player.pos.set(0.1, 1.62, z); player.yaw = yaw; player.pitch = 0; } };
}
