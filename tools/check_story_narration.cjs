// node tools/check_story_narration.cjs
// Real story scheduler + subtitle track: protected windows and room-scoped callbacks.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^import .*;$/gm, '').replace(/\bexport\s+/g, '');
let now = 0, blocked = false, whispers = 0, whisperStops = 0, motifStops = 0;
const createNarration = new Function('performance', read('js/narration.js') + ';return createNarration;')({ now: () => now });
const element = { textContent: '', style: {}, classList: { toggle() {} } }, say = createNarration({ element, blocked: () => blocked });
const visible = () => Number(element.style.opacity) > 0 ? element.textContent : '';
const roomLines = new Function('P', 'PKEY', 'CITY', read('js/narrative-copy.js') + ';return ROOM_LINES;')(null, '', '');
const createStory = new Function('ROOM_LINES', 'personalRoom', 'stopWhispers', 'document', 'setTimeout', read('js/story.js') + ';return createStory;')(
  roomLines, (name, schedule) => { if (name === 'morgue') schedule(9, () => { assert.equal(visible(), '', 'whisper cannot overlap a subtitle'); whispers++; }); },
  () => whisperStops++, { getElementById: () => ({ style: {} }) }, () => { throw Error('seamless narration cannot create wall timers'); });
const room = () => ({ group: { visible: true, position: { z: 0 }, userData: {} }, enter() {}, leave() {} });
const cellar = room(), ward = room(), morgue = room(), wh = room(), tower = room(), checkpoints = [];
const story = createStory({ scene: { children: [] }, camera: { updateProjectionMatrix() {} }, controls: {}, player: {}, audio: { stopMotif() { motifStops++; } }, hall: {},
  getCellar: () => cellar, getWard: () => ward, getMorgue: () => morgue, getWh: () => wh, getTower: () => tower, say, lights: {}, onRoom: name => checkpoints.push(name) });
function step(seconds) { for (let t = 0; t < seconds - 1e-8; t += .05) { const dt = Math.min(.05, seconds - t); now += dt * 1000; say.update(dt); story.update(dt); } }

story.seamless('morgue'); blocked = true; step(30);
assert.equal(visible(), ''); assert.equal(whispers, 0, 'protected moments delay both registry and speech');
blocked = false; say.update(0); story.update(0);
assert.equal(visible(), roomLines.morgue.join('\n'));
step(6.8); assert.equal(visible(), roomLines.morgue.join('\n')); assert.equal(whispers, 0);
step(1); assert.equal(whispers, 1, 'overdue whisper waits until the register has finished');

story.seamless('morgue'); step(1); story.seamless('ward'); step(30);
assert.equal(whispers, 1, 'a delayed whisper from a previous room is cancelled');
assert.equal(story.current(), 'ward'); assert.ok(checkpoints.includes('morgue') && checkpoints.includes('ward'));
assert.ok(whisperStops >= 3 && motifStops >= 3, 'room boundaries release speech and the motif');

say.reset(); story.seamless('cellar'); say('nota raccolta', 6000, 'note'); step(3.2);
assert.equal(visible(), 'nota raccolta', 'entry register cannot cut a found note');
step(3.4); assert.equal(visible(), roomLines.cellar.join('\n'), 'entry registry survives the reading delay');

story.seamless('tunnel'); story.schedule(2, () => say('vecchio ingresso', 2000)); story.silence(); step(30);
assert.equal(visible(), '', 'hall arrival cancels both tunnel register and pending introductory messages');

console.log('Story narration PASS: game-clock scheduling, quiet windows, sequential notes/speech and room cancellation.');
