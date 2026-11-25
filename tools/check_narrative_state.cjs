// node --experimental-vm-modules tools/check_narrative_state.cjs
// Execute real checkpoint/shortcut code and personal ending copy with mocked services.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const ckSource = main.slice(main.indexOf("const CK = 'ng_ckpt'"), main.indexOf('let restoreCk ='));
assert.ok(ckSource.includes('function saveCkpt'), 'checkpoint implementation is extracted from the actual game');
const makeCheckpoint = new Function('localStorage', 'flags', 'notes', ckSource + ';return {saveCkpt,loadCkpt,loadRooms,CK_ST,CK_ORDER};');
function checkpoint(seed = {}) {
  const data = new Map(Object.entries(seed)), flags = { turned: true, door: 'breath', weapon: 'axe', noGun: false, filmKey: true, filmDoorOpen: true }, notes = { found: new Set([0, 2, 4]) };
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  return { ...makeCheckpoint(storage, flags, notes), data, flags, notes };
}
const rooms = ['cellar', 'ward', 'morgue', 'warehouse', 'tower'];
{
  const ck = checkpoint();
  assert.deepEqual(ck.CK_ORDER, rooms);
  for (const room of rooms) {
    ck.saveCkpt(room);
    const saved = ck.loadCkpt(room);
    assert.deepEqual(saved, { room, turned: true, door: 'breath', weapon: 'axe', noGun: false, notes: [0, 2, 4] });
    assert.equal('filmKey' in saved, false); assert.equal('filmDoorOpen' in saved, false);
  }
  assert.deepEqual(Object.keys(ck.loadRooms()), rooms, 'all reached rooms remain selectable');
  assert.equal(ck.loadCkpt().room, 'tower');
  const count = ck.data.size; ck.saveCkpt('unknown'); assert.equal(ck.data.size, count);
}
{
  const old = { room: 'morgue', turned: false, door: null, weapon: null, noGun: true, notes: [1, 3] };
  const ck = checkpoint({ ng_ckpt: JSON.stringify(old) });
  assert.deepEqual(ck.loadCkpt('morgue'), old);
  assert.deepEqual(ck.loadCkpt('ward'), { ...old, room: 'ward' }, 'legacy morgue checkpoint restores the ward option');
  assert.equal(ck.loadCkpt('cellar'), null);
  const broken = checkpoint({ ng_ckpt: '{', ng_rooms: '{' });
  assert.deepEqual(broken.loadRooms(), {}); assert.equal(broken.loadCkpt(), null);
}

const dispatch = main.slice(main.indexOf("  if (requestedStart === 'piega')"), main.indexOf('  controls.enabled = !story.busy(); started'));
assert.ok(dispatch.includes('restoreCk ? loadCkpt'), 'actual main-menu route dispatcher is exercised');
const runDispatch = new Function('restoreCk', 'restoreRoom', 'loadCkpt', 'q', 'CK_ST', 'flags', 'notes', 'glassEvent', 'doorEvent', 'dawn', 'story', 'combat', 'setTimeout', 'player', 'ENDINGS', 'Z_END', 'requestedStart', dispatch);
function route(query, saved = null, override = undefined) {
  const calls = [], flags = { filmKey: true, filmDoorOpen: true }, notes = { found: new Set() }, glass = {}, door = {}, tasks = [];
  const player = { pos: { set: (...p) => calls.push(['position', ...p]) } };
  runDispatch(!!saved, saved?.room, () => saved, new URLSearchParams(query), checkpoint().CK_ST, flags, notes, glass, door,
    { start: t => calls.push(['dawn', t]) }, { goto: name => calls.push(['goto', name]) }, { giveAxe: () => calls.push(['axe']) },
    (fn, ms) => tasks.push({ fn, ms }), player, { A: 'ending-A', B: 'ending-B', BLADE: 'ending-blade' }, -50, override === undefined ? new URLSearchParams(query).get('start') : override);
  return { calls, flags, notes, glass, door, tasks, player };
}
for (const [start, target] of [['cantina', 'cellar'], ['reparto', 'ward'], ['obitorio', 'morgue'], ['magazzino', 'warehouse'], ['torre', 'tower']]) {
  const r = route('start=' + start + '&turned=1&door=red');
  assert.deepEqual(r.calls.find(c => c[0] === 'goto'), ['goto', target]);
  assert.equal(r.glass.done, true); assert.equal(r.door.state, 'over');
  assert.equal(r.flags.turned, true); assert.equal(r.flags.door, 'red');
  assert.equal(r.flags.filmKey, false); assert.equal(r.flags.filmDoorOpen, false);
}
for (const room of rooms) {
  const saved = { room, turned: true, door: 'breath', weapon: 'axe', noGun: true, notes: [0, 3] }, r = route('', saved);
  assert.deepEqual(r.calls.find(c => c[0] === 'goto'), ['goto', room]);
  for (const field of ['turned', 'door', 'weapon', 'noGun']) assert.equal(r.flags[field], saved[field]);
  assert.deepEqual([...r.notes.found], [0, 3]); assert.equal(r.flags.notes, 2);
  assert.equal(r.flags.filmKey, false); assert.equal(r.flags.filmDoorOpen, false);
}
assert.deepEqual(route('start=porta').calls.find(c => c[0] === 'position'), ['position', .1, 1.62, -40]);
assert.deepEqual(route('start=piega').calls.find(c => c[0] === 'position'), ['position', .1, 1.62, .5]);
assert.deepEqual(route('start=epilogo').calls.find(c => c[0] === 'dawn'), ['dawn', 'ending-A']);
assert.deepEqual(route('start=epilogo&turned=1').calls.find(c => c[0] === 'dawn'), ['dawn', 'ending-B']);
assert.deepEqual(route('start=torre', null, 'cantina').calls.find(c => c[0] === 'goto'), ['goto', 'cellar'], 'an explicit room choice overrides a shortcut URL');
assert.equal(route('start=torre', null, null).calls.some(c => c[0] === 'goto'), false, 'choosing the beginning clears a shortcut URL');
for (const start of ['cantina', 'reparto', 'obitorio', 'magazzino', 'torre']) assert.ok(route('', null, start).calls.some(c => c[0] === 'goto'), 'fresh menu entry without any snapshot: ' + start);
assert.ok(route('start=torre&weapon=axe').calls.some(c => c[0] === 'axe'));
const mirror = route('start=cantina&specchio=1'); assert.equal(mirror.tasks.length, 1); mirror.tasks[0].fn();
assert.deepEqual(mirror.calls.at(-1), ['position', -1.3, 1.62, -210]);

(async () => {
  const source = fs.readFileSync(path.join(root, 'js/narrative-copy.js'), 'utf8');
  const endings = [];
  for (const query of ['', '?per=mati', '?per=matilde', '?per=steve', '?per=yana', '?per=alice', '?per=laya', '?per=elisa', '?per=rebecca', '?per=tommy', '?per=gabriele', '?per=Marco&g=m', '?per=Anna', '?per=%3Cbad%3E']) {
    const context = vm.createContext({ URLSearchParams, location: { search: query } });
    const personal = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'js/personal.js'), 'utf8'), { context });
    await personal.link(() => { throw Error('Unexpected personal import'); }); await personal.evaluate();
    const mod = new vm.SourceTextModule(source, { context });
    await mod.link(spec => { assert.equal(spec, './personal.js'); return personal; }); await mod.evaluate();
    const e = mod.namespace.ENDINGS, p = personal.namespace.P;
    assert.ok(e && typeof e.A === 'string' && typeof e.B === 'string' && typeof e.BLADE === 'string');
    const suffix = p?.f === true ? 'a' : 'o';
    assert.ok(e.A.startsWith('non ti sei girat' + suffix), query);
    assert.ok(e.B.startsWith('ti sei girat' + suffix), query);
    assert.notEqual(e.A, e.B); assert.notEqual(e.BLADE, e.A);
    for (const text of Object.values(e)) { assert.ok(!/undefined|\[object Object\]/.test(text)); assert.ok(text.length < 650); }
    endings.push({ query: query || 'standard', gender: suffix, alternate: !!e.BLADE });
  }
  const tower = fs.readFileSync(path.join(root, 'js/events/tower.js'), 'utf8');
  assert.ok(tower.includes('ENDINGS.BLADE'), 'existing alternate ending uses the shared copy');
  const endingAlias = /const TEXT\s*=\s*ENDINGS\s*;/.test(tower) ? 'TEXT' : 'ENDINGS';
  assert.ok(new RegExp('flags\\.turned\\s*\\?\\s*' + endingAlias + '\\.B\\s*:\\s*' + endingAlias + '\\.A').test(tower), 'the crowd choice still selects standard A/B');
  assert.ok(main.includes("q.get('allunga') === '1'"), 'rejected elongation experiment remains opt-in');
  console.log(JSON.stringify({ result: 'PASS', checkpoints: rooms, debugStarts: 8, restorePaths: 5, legacyMigration: true, endings }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
