// Esegui con: node --experimental-vm-modules tools/check_hall_timing.cjs
// Prova la regia reale con servizi audio/grafici simulati, senza GPU o download.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const copy = fs.readFileSync(path.join(root, 'js/narrative-copy.js'), 'utf8').replace(/^import .*;$/gm, '').replace(/\bexport\s+/g, '');
const ROOM_LINES = new Function('P', 'PKEY', 'CITY', copy + ';return ROOM_LINES;')(null, '', '');

async function scenario(THREE, fps, turn) {
  let now = 0, nextTimer = 0;
  const timers = new Map(), messages = [], distances = [], darks = [], outcomes = [];
  let whispers = 0, nearBreath = 0, pressureStops = 0, pressureStoppedAt = null, breathStartedAt = null;
  const stages = [], rushes = [], arrivals = [], reveals = [];
  const context = vm.createContext({
    console,
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, due: now + ms / 1000 }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const handle = { setLevel() {}, stop() {} };
  const audio = {
    duck() {}, doorBang() {}, lightOn() {}, shuffle() {}, bell() {},
    whisper() { whispers++; }, crowdDrone: () => handle,
    hallPressure: () => ({
      update() {}, setStage(n, z) { stages.push(n); arrivals.push({ n, z, at: now, state: E.state }); },
      rush(from, to, duration) { rushes.push({ from, to, duration, carried: E.t, state: E.state, at: now }); },
      stop() { pressureStops++; pressureStoppedAt = now; },
    }),
    breath: () => { breathStartedAt = now; return { setPos() {}, stop() {}, setLevel(v) { nearBreath = Math.max(nearBreath, v); } }; },
  };
  const hall = {
    enable() {}, setDist(d) { distances.push({ d, at: now }); },
    lightOn() { reveals.push({ at: now, distance: distances.at(-1).d }); }, lightOff() { darks.push(now); }, lightDim() {},
    silhouette: () => new THREE.Group(),
  };
  class Loader {
    load(url, ready) {
      const scene = new THREE.Group();
      for (const name of ['large_castle_door_left', 'large_castle_door_right']) {
        const leaf = new THREE.Group(); leaf.name = name; scene.add(leaf);
      }
      ready({ scene });
    }
  }
  const exports = {
    three: THREE, '../ui/rgbshift.js': { rgbPulse() {} }, '../personal.js': { P: null },
    '../narrative-copy.js': { ROOM_LINES },
    '../../vendor/three/loaders/GLTFLoader.js': { GLTFLoader: Loader },
    '../world/tunnel.js': { Z_END: -50, DOOR: {} },
  };
  const mod = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'js/events/door.js'), 'utf8'), { context });
  await mod.link(specifier => {
    const values = exports[specifier]; assert.ok(values, specifier);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  const player = { pos: new THREE.Vector3(0, 1.62, -52), forward: new THREE.Vector3(0, 0, -1), addShake() {} };
  const camera = { position: player.pos.clone() };
  const E = mod.namespace.createDoorEvent({
    scene: new THREE.Scene(), player, camera, audio, hall,
    lights: { lamp() {}, torchStutter() {}, torchKill() {} },
    instab: { push() {}, set() {} },
    say(text, ms, style) { messages.push({ text, ms, style, at: now }); },
    onHallDone(turned) { outcomes.push({ turned, at: now }); },
  });
  E.update(0); E.update(2.01); // Accesso alla sala: il cronometro parte dallo scatto del portone.
  assert.equal(E.state, 'burst');
  const dt = 1 / fps;
  while (now < 35 && E.state !== 'over') {
    const warning = messages.find(m => m.text.startsWith('non guardare dietro'));
    if (turn && warning && now >= warning.at + 0.3) player.forward.z = 1;
    now += dt; E.update(dt);
    for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
  }
  const note = messages.find(m => m.style === 'note');
  const warning = messages.find(m => m.text.startsWith('non guardare dietro'));
  assert.ok(warning && warning.at >= 15 && warning.at <= 16.2, `Avviso a ${warning?.at}s, ${fps} FPS`);
  assert.deepEqual(distances.map(s => s.d), [26, 14, 7.5], 'Restano i due avvicinamenti');
  assert.deepEqual(stages, [0, 1, 2], 'Il ritmo cresce a ogni apparizione');
  assert.deepEqual(rushes.map(r => [r.from, r.to]), [[-76, -64], [-64, -57.5]]);
  assert.ok(rushes.every(r => r.state === 'dark' && r.duration > 0 && Math.abs(r.duration + r.carried - 0.7) < 1e-9), 'Passi solo nei due bui di movimento');
  assert.deepEqual(arrivals.map(a => a.at), reveals.map(r => r.at), 'I rintocchi coincidono con le tre apparizioni');
  assert.deepEqual(arrivals.map(a => a.z), [-76, -64, -57.5]);
  assert.ok(arrivals.every(a => a.state === 'lit'));
  assert.equal(pressureStops, 1); assert.ok(pressureStoppedAt < breathStartedAt, 'Il crescendo lascia spazio al respiro');
  assert.equal(note.ms, 6000); assert.ok(darks[0] - note.at >= 6.75, 'Tempo per leggere la nota');
  assert.equal(warning.style, 'urgent', 'the survival prompt cannot be deferred behind incidental text');
  assert.equal(outcomes.length, 1); assert.equal(outcomes[0].turned, turn);
  if (turn) assert.equal(whispers, 1, 'Il colpo di scena parte una sola volta anche a FPS bassi');
  else { assert.ok(outcomes[0].at >= 25 && outcomes[0].at <= 28); assert.ok(nearBreath >= 1.39); }
  E.update(5); assert.equal(outcomes.length, 1);
  return { fps, turned: turn, warning: +warning.at.toFixed(2), end: +outcomes[0].at.toFixed(2) };
}

function checkFrameClock() {
  const source = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const tickStart = source.indexOf('function tick('), frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('\nrequestAnimationFrame((n)', frameStart);
  assert.ok(tickStart >= 0 && frameStart > tickStart && frameEnd > frameStart);
  const calls = [], noop = () => {}, update = { update: noop };
  const context = vm.createContext({
    paused: false, state: 'play', last: 0, time: 0, ended: false, space: null, breath: null,
    requestAnimationFrame: noop, window: {}, camera: {}, renderer: {}, scene: {},
    doorEvent: { update: dt => calls.push(['event', dt]) },
    hall: { active: true, update: dt => calls.push(['hall', dt]) },
    lights: { update: dt => calls.push(['lights', dt]) },
    player: { pos: { x: 0, z: 0 }, update: dt => calls.push(['motion', dt]) },
    audio: { setListener: noop }, glassEvent: { update: noop, preRender: noop },
    rgbShift: { update: noop, render: noop },
    narrativeStep: noop,
    updateVisibleWorldMatrices: noop,
    story: { busy: () => false },
    adaptiveResolution: { reset: noop, sample: dt => { calls.push(['quality', dt]); return null; } },
    sideFold: { update: noop, applyCamera: noop },
    scare: update, dust: update, dawn: update, cellar: update, tower: update,
    wh: update, morgue: update, ward: update, ambient: update, notes: update,
    rats: update, combat: update, hound: update, instab: update,
  });
  vm.runInContext(source.slice(tickStart, frameEnd), context);
  context.frame(100); // 10 FPS reali: la fisica resta limitata, la regia no.
  for (const kind of ['event', 'hall', 'lights']) assert.equal(calls.find(c => c[0] === kind)[1], 0.1);
  assert.equal(calls.find(c => c[0] === 'motion')[1], 0.05);
  assert.equal(calls.find(c => c[0] === 'quality')[1], 0.1, 'Anche la qualita adatta i pixel al tempo reale');
  const count = calls.length;
  context.paused = true; context.frame(60100); assert.equal(calls.length, count, 'La pausa ferma i timer');
  context.paused = false; context.frame(60200);
  assert.equal(calls.filter(c => c[0] === 'event').at(-1)[1], 0.1, 'La pausa non viene recuperata al ritorno');
  context.hall.active = false; context.frame(60300);
  assert.equal(calls.filter(c => c[0] === 'lights').at(-1)[1], 0.05, 'Le altre stanze mantengono il loro passo');
}

(async () => {
  const THREE = await import(pathToFileURL(path.join(root, 'vendor/three/three.module.min.js')).href);
  const results = [];
  for (const fps of [60, 20, 10, 5]) for (const turn of [false, true]) results.push(await scenario(THREE, fps, turn));
  checkFrameClock();
  console.log(JSON.stringify({ scenarios: results, frameClock: 'ok', pause: 'ok' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
