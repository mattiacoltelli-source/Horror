// node tools/check_reflection_substitute.cjs
// Lo specchio non deve modificare porta, luci o visibilita' del gioco reale.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/world/reflection-substitute.js'), 'utf8');
const factory = new Function(source.replace('export function', 'function') + '; return createReflectionSubstitute;')();
const door = { visible: true, angle: -1.55 }, poster = { visible: true }, oldHidden = { visible: false };
const light = { visible: true, isLight: true, intensity: 1.65 }, substitute = { visible: false };
const room = { visible: true, children: [poster, oldHidden, light] };
const reflect = factory({ room, door, substitute });
const snapshot = () => JSON.stringify({ room, door, substitute });
const before = snapshot();
const check = () => {
  assert.equal(door.visible, false); assert.equal(poster.visible, false); assert.equal(oldHidden.visible, false);
  assert.equal(substitute.visible, true); assert.equal(room.visible, true);
  assert.equal(light.visible, true); assert.equal(light.intensity, 1.65); assert.equal(door.angle, -1.55);
};
assert.equal(reflect(() => { check(); return 42; }), 42);
assert.equal(snapshot(), before, 'Stato ripristinato prima del render principale');
reflect(() => { reflect(check); check(); });
assert.equal(snapshot(), before, 'Anche i render annidati ripristinano lo stato');
assert.throws(() => reflect(() => { check(); throw new Error('render interrotto'); }), /render interrotto/);
assert.equal(snapshot(), before, 'Ripristino garantito anche quando il renderer fallisce');
door.visible = false; room.visible = false; light.visible = false;
const invisible = snapshot(); reflect(() => assert.equal(light.visible, false));
assert.equal(snapshot(), invisible, 'Oggetti gia nascosti restano nascosti');
const altar = { visible: true }, chapelLight = { isLight: true, visible: true, intensity: 2.1 };
const chapel = { visible: true, children: [altar, chapelLight] }, chapelWall = { visible: false };
const reflectChapel = factory({ room: chapel, substitute: chapelWall });
// La cripta non ha anta. Deve comporsi con la porta del santuario senza toccarne lo stato.
reflect(() => reflectChapel(() => {
  assert.equal(altar.visible, false); assert.equal(chapelWall.visible, true);
  assert.equal(chapelLight.visible, true); assert.equal(chapelLight.intensity, 2.1);
  assert.equal(substitute.visible, true);
}));
assert.equal(altar.visible, true); assert.equal(chapelWall.visible, false);
assert.equal(snapshot(), invisible, 'Le due stanze ripristinano i propri stati separatamente');
assert.throws(() => reflect(() => reflectChapel(() => { throw new Error('due stanze'); })), /due stanze/);
assert.equal(altar.visible, true); assert.equal(chapelWall.visible, false); assert.equal(snapshot(), invisible);
const lateChair = { visible: true }; chapel.children.push(lateChair);
reflectChapel(() => assert.equal(lateChair.visible, false, 'Anche gli arredi caricati dopo la creazione dello specchio vengono esclusi'));
assert.equal(lateChair.visible, true);
console.log('Specchio: sostituzione isolata, luci costanti e ripristino dello stato verificati.');
