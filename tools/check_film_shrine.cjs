// node --experimental-vm-modules tools/check_film_shrine.cjs
// Verifica chiave, serratura, soglia, anta aperta e ritorno; senza GPU o rete.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
(async () => {
  const THREE = await import(pathToFileURL(path.join(root, 'vendor/three/three.module.min.js')).href);
  const context = vm.createContext({ console });
  const namespace = (values) => new vm.SyntheticModule(Object.keys(values), function () { for (const [k, v] of Object.entries(values)) this.setExport(k, v); }, { context });
  const three = namespace(THREE), cache = new Map();
  async function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context }); cache.set(file, mod);
    await mod.link((specifier) => specifier === 'three' ? three : load(path.resolve(path.dirname(file), specifier)));
    return mod;
  }
  const rooms = await load(path.join(root, 'js/world/rooms.js')); await rooms.evaluate();
  const mats = Object.fromEntries(['brick', 'stone', 'floorA'].map(k => [k, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })]));
  const options = { z0: 0, w: 8, l: 20, h: 4.4, seed: 23 };
  const closed = rooms.namespace.buildRoom(mats, options);
  const cut = rooms.namespace.buildRoom(mats, { ...options, sideDoors: [{ side: 1, z: -7, w: 2, h: 3.1 }, { side: 1, z: -11, w: 1.2, h: 2.3, panel: 'secret' }] });
  const ray = (g, p, d) => { g.updateMatrixWorld(true); return new THREE.Raycaster(new THREE.Vector3(...p), new THREE.Vector3(...d), 0, 10).intersectObject(g, true); };
  assert.ok(ray(closed.group, [3, 1.5, -11], [1, 0, 0]).length);
  assert.equal(ray(cut.group, [3, 1.5, -11], [1, 0, 0]).length, 0);
  assert.ok(ray(cut.sidePanels.secret, [3, 1.5, -11], [1, 0, 0]).length);
  assert.equal(ray(cut.group, [3, 1.5, -7], [1, 0, 0]).length, 0, 'La cripta resta aperta');
  assert.ok(ray(cut.group, [3, 3, -11], [1, 0, 0]).length, 'Architrave conservato');
  assert.ok(ray(cut.group, [3, 1.5, -12], [1, 0, 0]).length, 'Parete accanto conservata');
  // Aperture non multiple del metro, anche in stanze decentrate.
  const small = rooms.namespace.buildRoom(mats, { z0: 0, cx: 4, w: 3.3, l: 3.4, h: 2.8, door: { w: 1.2, h: 2.3 } });
  for (const x of [3.41, 4, 4.59]) assert.equal(ray(small.group, [x, 1.62, -0.5], [0, 0, 1]).length, 0);
  for (const x of [3.39, 4.61]) assert.ok(ray(small.group, [x, 1.62, -0.5], [0, 0, 1]).length);
  // Il controller riceve una scena leggera, mantenendo i servizi reali di THREE.
  const z = -210.8, flags = {}, player = { pos: new THREE.Vector3(), forward: new THREE.Vector3(), frozen: false };
  const visual = { group: new THREE.Group(), key: new THREE.Group(), hinge: new THREE.Group(), light: { intensity: 0 }, bulb: { material: { color: new THREE.Color() } }, depth: 3.4, width: 3.3 };
  const world = namespace({ FILM_DOOR: { z, w: 1.2, h: 2.3 }, FILM_KEY: [-3.88, 1.3, -212], createFilmShrine: () => visual });
  const mod = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'js/events/film-shrine.js'), 'utf8'), { context });
  await mod.link(s => s === 'three' ? three : world); await mod.evaluate();
  const hidden = new Set(['hidden']); let saves = 0;
  const actBtn = { classList: { add: k => hidden.add(k), remove: k => hidden.delete(k) } };
  const S = mod.namespace.createFilmShrineEvent({ player, flags, actBtn, audio: {}, say() {}, onSave() { saves++; } });
  const look = (p, t) => { player.pos.set(...p); player.forward.set(...t).sub(player.pos).normalize(); S.update(0, true); };
  const bounds = [-3.5, 3.5, -222.6, -200.6];
  const move = (x, zz) => { const next = S.move(x, zz, bounds); player.pos.set(next[0], 1.62, next[1]); return [...next]; };
  S.reset(); look([3, 1.62, z], [4, 1.1, z]); assert.equal(S.near, null); assert.ok(hidden.has('hidden'));
  move(4.5, z); assert.ok(player.pos.x <= 3.5, 'Porta chiusa invalicabile');
  look([-2.8, 1.62, -212], [-3.88, 1.3, -212]); assert.equal(S.near, 'key'); S.act(); assert.ok(flags.filmKey); assert.equal(saves, 1);
  assert.equal(S.key.visible, false);
  look([3, 1.62, z], [3.98, 1.15, z - .45]); assert.equal(S.near, 'door');
  // Un tasto vecchio non puo' aprire da lontano o quando il gioco congela il giocatore.
  player.pos.set(0, 1.62, -202); S.act(); assert.equal(flags.filmDoorOpen, undefined);
  look([3, 1.62, z], [3.98, 1.15, z - .45]); player.frozen = true; S.act(); assert.equal(flags.filmDoorOpen, undefined);
  player.frozen = false; S.update(0, true); S.act(); assert.ok(flags.filmDoorOpen); assert.equal(saves, 2);
  move(4.5, z); assert.ok(player.pos.x <= 3.5, 'Attende l’apertura dell’anta');
  for (let i = 0; i < 120; i++) S.update(.02, true);
  assert.equal(S.angle, 1.55);
  for (let i = 0; i < 45; i++) move(player.pos.x + .05, z);
  assert.ok(player.pos.x > 5, 'Ingresso praticabile');
  for (let i = 0; i < 90; i++) move(player.pos.x - .05, z);
  assert.ok(player.pos.x < 3, 'Ritorno senza teletrasporti');
  player.pos.set(3.4, 1.62, z - 1); for (let i = 0; i < 50; i++) move(player.pos.x + .05, z - 1);
  assert.ok(player.pos.x <= 3.5, 'Non attraversa il muro accanto');
  player.pos.set(4.8, 1.62, z); for (let i = 0; i < 30; i++) move(4.8, player.pos.z + .05);
  assert.ok(player.pos.z < z + .3, 'L’anta aperta ha una collisione');
  player.pos.set(6, 1.62, z); for (let i = 0; i < 100; i++) move(player.pos.x + .05, z);
  assert.ok(player.pos.x <= 7.08, 'Parete di fondo invalicabile');
  S.reset(); assert.equal(S.angle, 1.55); assert.equal(S.key.visible, false);
  S.update(.1, false); assert.equal(S.near, null); assert.equal(S.light.intensity, 0); assert.ok(hidden.has('hidden'));
  console.log('Film shrine: chiave, salvataggio, porta, collisioni, ritorno e aperture verificati.');
})().catch(e => { console.error(e); process.exit(1); });
