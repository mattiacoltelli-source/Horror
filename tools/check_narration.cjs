// node tools/check_narration.cjs
// Test the real subtitle arbiter with a deterministic game clock, no DOM/GPU.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/narration.js'), 'utf8');
let wall = 0;
const createNarration = new Function('performance', source.replace(/\bexport\s+/g, '') + ';return createNarration;')({ now: () => wall });
function harness() {
  let blocked = false;
  const classes = new Set(), element = { textContent: '', style: {}, classList: { toggle(k, on) { on ? classes.add(k) : classes.delete(k); }, remove(...names) { names.forEach(k => classes.delete(k)); } } };
  const say = createNarration({ element, blocked: () => blocked });
  const advance = (seconds, dt = .05) => { for (let t = 0; t < seconds - 1e-8; t += dt) { const step = Math.min(dt, seconds - t); wall += step * 1000; say.update(step); } };
  const visible = () => Number(element.style.opacity || 0) > 0 ? element.textContent : '';
  const until = (text, seconds = 2) => {
    for (let t = 0; t < seconds && visible() !== text; t += .05) advance(.05);
    assert.equal(visible(), text);
  };
  return { say, element, classes, advance, visible, until, gate(v) { blocked = v; } };
}

// A discovered note survives ordinary messages; another note starts only after it.
{
  const h = harness();
  assert.equal(h.say('prima nota', 1000, 'note'), true);
  h.say('rumore lontano', 500); h.say('seconda nota', 1000, 'note');
  assert.equal(h.visible(), 'prima nota'); assert.equal(h.say.canRead(), false);
  h.advance(.95); assert.equal(h.visible(), 'prima nota');
  h.until('seconda nota'); h.advance(.95); assert.equal(h.visible(), 'seconda nota', 'queued notes receive a full reading interval');
  h.until('rumore lontano');
  h.advance(1); assert.equal(h.visible(), ''); assert.equal(h.say.canRead(), true);
}

// An observation window hides text and preserves queued notes for afterwards.
{
  const h = harness(); h.gate(true);
  assert.equal(h.say.canRead(), false);
  assert.equal(h.say('nota trovata', 1000, 'note'), true);
  h.advance(25); assert.equal(h.visible(), '', 'no subtitle during a spectacular event');
  h.gate(false); h.say.update(0); assert.equal(h.visible(), 'nota trovata');
  h.advance(.7); assert.equal(h.visible(), 'nota trovata', 'queued notes receive their full reading duration');
  h.advance(.4); assert.equal(h.visible(), '');
}

// Gameplay urgency can interrupt; abandoned messages do not return afterwards.
{
  const h = harness(); h.say('nota precedente', 4000, 'note'); h.say('frase vecchia', 2000);
  h.gate(true); h.say('non guardare dietro.', 1000, 'urgent');
  assert.equal(h.visible(), 'non guardare dietro.'); assert.equal(h.classes.has('urgent'), true);
  h.advance(1.2); h.gate(false); h.advance(8);
  assert.equal(h.visible(), '', 'urgent cues flush the obsolete note and ambient queue');
}

// Changing rooms removes all pending work, even if its quiet gate opens later.
{
  const h = harness(); h.gate(true); h.say('dalla stanza precedente', 7000, 'note');
  h.say.reset(); h.gate(false); h.advance(30);
  assert.equal(h.visible(), ''); assert.equal(h.say.canRead(), true);
  h.say('testo nuovo', 1000); h.say.clear(); assert.equal(h.visible(), '');
}

// Real time passing during pause cannot expire text or run a deferred cue.
{
  const h = harness(); h.say('resta da leggere', 1000, 'note');
  const until = h.say.noteUntil;
  assert.ok(until >= wall + 999, 'compatibility deadline is based on remaining reading time');
  wall += 60000; h.say.update(0);
  assert.equal(h.visible(), 'resta da leggere'); assert.ok(h.say.noteUntil >= wall + 999);
  h.advance(.8); assert.equal(h.visible(), 'resta da leggere');
  h.advance(.3); assert.equal(h.visible(), '');
}

// Repeated incidental cues stay bounded and cannot replay an unbounded backlog.
{
  const h = harness(); h.say('nota', 1000, 'note');
  for (let i = 0; i < 100; i++) h.say('ambientale ' + i, 300);
  const seen = new Set();
  for (let i = 0; i < 120; i++) { h.advance(.05); if (h.visible().startsWith('ambientale')) seen.add(h.visible()); }
  assert.ok(seen.size <= 3, 'one active note plus at most three incidental messages is bounded to four total');
  assert.ok(seen.has('ambientale 99'), 'the most recent incidental cue is retained');
  assert.equal(h.visible(), '');
}

// Protected notes preserve discovery order, and a full note queue reports
// refusal so the caller can retry without marking an unread note as found.
{
  const h = harness(); h.gate(true);
  for (let i = 0; i < 4; i++) assert.equal(h.say('nota ' + i, 300, 'note'), true);
  assert.equal(h.say('nota oltre il limite', 300, 'note'), false);
  h.gate(false); h.say.update(0); assert.equal(h.visible(), 'nota 0');
  assert.equal(h.say('altra nota oltre il limite', 300, 'note'), false, 'active plus queued notes count toward the same capacity');
  for (let i = 1; i < 4; i++) h.until('nota ' + i);
  h.advance(1); assert.equal(h.visible(), '');
}

console.log('Narration PASS: note priority, quiet windows, urgency, room cancellation, pause and bounded backlog.');
