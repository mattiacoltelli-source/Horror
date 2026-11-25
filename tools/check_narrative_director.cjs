// node tools/check_narrative_director.cjs
// Read existing event state; never create, move or reactivate a visual effect.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/narrative-director.js'), 'utf8').replace(/\bexport\s+/g, '');
const { narrativeQuiet, createNarrativeDirector } = new Function(source + ';return {narrativeQuiet,createNarrativeDirector};')();
let current = 'tunnel';
const state = { story: { current: () => current, busy: () => false }, hound: { state: 'wait' }, glassEvent: { state: 'idle' }, doorEvent: { state: 'idle' },
  sideFold: { enabled: true, group: { visible: true }, state: 'idle', t: 0 }, flags: {}, ward: { state: 'walk' }, cellar: {}, wh: {}, tower: {} };
const quiet = () => !!narrativeQuiet(state);
assert.equal(quiet(), false, 'waiting hound must not suppress the whole starting tunnel');
state.hound.state = 'flash'; assert.equal(quiet(), true); state.hound.state = 'gone'; assert.equal(quiet(), false);
for (const phase of ['walk0', 'stare', 'silence', 'slam', 'vanish']) { state.glassEvent.state = phase; assert.equal(quiet(), true, phase); }
state.glassEvent.state = 'done'; assert.equal(quiet(), false);
for (const phase of ['explore', 'flicker', 'dark', 'exit']) { state.sideFold.state = phase; assert.equal(quiet(), true, phase); }
state.sideFold.enabled = false; assert.equal(quiet(), false, 'disabled side anomaly cannot silence narration');
state.sideFold.enabled = true; state.sideFold.state = 'idle';
for (const phase of ['hush', 'burst', 'void', 'dark', 'turned', 'ignored']) { state.doorEvent.state = phase; assert.equal(quiet(), true, phase); }
state.doorEvent.state = 'lit'; assert.equal(quiet(), false, 'the crowd register keeps its established reading window'); state.doorEvent.state = 'over';

current = 'ward'; state.ward.bend = null; assert.equal(quiet(), false, 'piega=0 is supported');
state.ward.bend = { state: 'run', t: 5 }; assert.equal(quiet(), true);
state.ward.bend.state = 'done'; assert.equal(quiet(), false);
state.ward.state = 'beat'; assert.equal(quiet(), true); state.ward.state = 'after';
current = 'cellar'; state.cellar.dbg = { runT: -1, dm: 8, dotv: 0 }; assert.equal(quiet(), false);
state.cellar.dbg.runT = .4; assert.equal(quiet(), true); state.cellar.dbg.runT = -1;
state.cellar.started = true; state.cellar.clean = false; state.cellar.dbg.dm = 2; state.cellar.dbg.dotv = .9; assert.equal(quiet(), true);
state.cellar.clean = true; assert.equal(quiet(), false);
state.cellar.keypad = { padOn: true }; assert.equal(quiet(), true); state.cellar.keypad.padOn = false;
state.cellar.shrine = { entered: true, inside: false };
assert.equal(quiet(), false, 'leaving a previously visited poster shrine releases narration');

current = 'warehouse'; state.wh.bridge = null; assert.equal(quiet(), false, 'ponte=0 is supported');
state.wh.bridge = { holdNarration: true }; assert.equal(quiet(), true); state.wh.bridge.holdNarration = false;
for (const phase of ['show', 'fade', 'gap', 'dash']) { state.wh.sorella = { state: phase }; assert.equal(quiet(), true, phase); }
state.wh.sorella.state = 'done'; assert.equal(quiet(), false);
current = 'tower'; state.flags.bladeEnding = true; assert.equal(quiet(), true); state.flags.bladeEnding = false;
state.tower.opened = true; assert.equal(quiet(), true); state.tower.opened = false;
state.dawn = { active: true, t: 4 }; assert.equal(quiet(), true); state.dawn.t = 9; assert.equal(quiet(), false); state.dawn.t = 13; assert.equal(quiet(), true); state.dawn.active = false;
state.scare = { active: true, done: true }; state.dawn.active = true; state.dawn.t = 9;
assert.equal(quiet(), false, 'completed standard scare cannot suppress the epilogue reading window');
state.dawn.active = false; state.scare.active = false;
for (const flag of ['paused', 'ended']) { state[flag] = true; assert.equal(quiet(), true); state[flag] = false; }

let accepted = false, stops = 0, resets = 0;
const attempts = [], director = createNarrativeDirector({ read: () => state, audio: { motif(name, options) { attempts.push([name, options.key]); return accepted ? { stop() {} } : null; }, stopMotif() { stops++; } }, say: { reset() { resets++; } } });
current = 'tunnel'; state.sideFold.state = 'explore'; state.sideFold.t = 3;
director.update(.05); director.update(.05); assert.equal(attempts.length, 2, 'rejected audio gate does not consume the event');
accepted = true; director.update(.05); for (let i = 0; i < 100; i++) director.update(.05);
assert.equal(attempts.length, 3, 'an accepted event cannot repeat every frame');
state.sideFold.state = 'flicker'; const before = attempts.length; director.update(1); assert.equal(attempts.length, before);
current = 'ward'; state.ward.bend = { state: 'run', t: 5.1 }; director.update(.05);
current = 'warehouse'; state.wh.bridge = { state: 'open', group: { userData: { presence: { age: 5 } } } }; director.update(.05);
state.wh.bridge.state = 'idle'; state.wh.sorella = { state: 'show', t: 1 }; director.update(.05);
current = 'tower'; director.update(3);
assert.deepEqual(attempts.slice(-4).map(c => c[0]), ['fracture', 'bridge', 'sister', 'agnese']);
const snapshot = JSON.stringify(state); director.update(.05); assert.equal(JSON.stringify(state), snapshot, 'director cannot mutate the visual state machine');
state.dawn.active = true; state.dawn.t = 0; director.update(.05); director.update(.05);
assert.equal(resets, 1, 'epilogue clears previous text once'); assert.ok(stops > 0);
console.log('Narrative director PASS: actual states, quiet windows, flags, five motif cues, retry/dedup and visual-state immutability.');
