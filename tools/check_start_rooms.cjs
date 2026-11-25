// node tools/check_start_rooms.cjs
// Actual menu code: every environment is available without a saved game.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const main = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const source = main.slice(main.indexOf('let restoreCk ='), main.indexOf('\nconst warm ='));
assert.ok(source.includes('startOverride') && source.includes('menu.appendChild'));
const create = new Function('document', 'q', 'loadCkpt', 'loadRooms', 'CK_ST', 'CK_ORDER', source + ';return () => ({restoreCk,restoreRoom,startOverride});');
const labels = { cellar: 'cantina', ward: 'reparto', morgue: 'obitorio', warehouse: 'magazzino', tower: 'torre' };
const order = Object.keys(labels), expected = ['', 'hall', ...order];
function setup(query = '', saved = {}) {
  const document = { activeElement: null, listeners: {}, addEventListener(k, fn) { (this.listeners[k] ??= []).push(fn); } };
  const make = () => ({
    dataset: {}, attributes: {}, listeners: {}, children: [], disabled: true, textContent: '',
    classList: { hidden: true, toggle(k, v) { this[k] = v ?? !this[k]; }, add(k) { this[k] = true; }, remove(k) { this[k] = false; }, contains(k) { return !!this[k]; } },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    addEventListener(k, fn) { (this.listeners[k] ??= []).push(fn); },
    appendChild(child) { this.children.push(child); },
    querySelector() { return this.children.find(c => c.attributes['aria-checked'] === 'true'); },
    get firstElementChild() { return this.children[0]; },
    focus() { document.activeElement = this; }, scrollIntoView() {},
    click() { this.listeners.click?.forEach(fn => fn({ stopPropagation() {} })); },
  });
  const elements = Object.fromEntries(['ckpt', 'cmenu', 'quality', 'qmenu'].map(id => [id, make()]));
  document.getElementById = id => elements[id]; document.createElement = () => make();
  const current = create(document, new URLSearchParams(query), room => room ? saved[room] || null : Object.values(saved).at(-1) || null, () => ({ ...saved }), labels, order);
  return { ...elements, document, current, keys: () => elements.cmenu.children.map(c => c.dataset.room) };
}
for (const query of ['', '?base=1', '?per=yana', '?per=mati', '?per=elisa', '?per=Steve', '?per=Anna']) {
  const h = setup(query);
  assert.deepEqual(h.keys(), expected, query || 'normal'); assert.equal(h.ckpt.disabled, false); assert.equal(h.ckpt.classList.hidden, false);
  assert.ok(h.ckpt.textContent.includes('tunnel (inizio)')); assert.equal(h.current().startOverride, undefined);
  for (const item of h.cmenu.children) {
    h.ckpt.click(); item.click(); const selected = h.current(), room = item.dataset.room;
    assert.equal(selected.startOverride, room === 'hall' ? 'porta' : labels[room] || null);
    assert.equal(selected.restoreCk, order.includes(room)); assert.equal(selected.restoreRoom, order.includes(room) ? room : null);
    assert.equal(h.cmenu.children.filter(c => c.attributes['aria-checked'] === 'true').length, 1);
    assert.equal(h.ckpt.attributes['aria-expanded'], 'false');
  }
}
{
  const h = setup('?per=yana&start=torre'); assert.ok(h.ckpt.textContent.includes('torre')); assert.equal(h.current().restoreCk, false);
  h.cmenu.children[0].click(); assert.equal(h.current().startOverride, null);
  h.ckpt.click(); assert.equal(h.ckpt.attributes['aria-expanded'], 'true');
  const key = name => h.cmenu.listeners.keydown[0]({ key: name, preventDefault() {} });
  key('End'); assert.equal(h.document.activeElement.dataset.room, 'tower'); key('Home'); assert.equal(h.document.activeElement.dataset.room, '');
  h.document.listeners.keydown[0]({ key: 'Escape' }); assert.equal(h.ckpt.attributes['aria-expanded'], 'false');
}
{
  const snap = { room: 'tower', turned: true, weapon: 'axe', notes: [0, 3] }, h = setup('?per=yana', { tower: snap });
  assert.deepEqual(h.keys(), expected); assert.ok(h.cmenu.children.at(-1).textContent.includes('salvato'));
  h.cmenu.children.at(-1).click(); assert.deepEqual(h.current(), { restoreCk: true, restoreRoom: 'tower', startOverride: 'torre' });
  h.ckpt.click(); h.quality.click(); assert.equal(h.ckpt.attributes['aria-expanded'], 'false');
}
console.log('Start rooms PASS: first visit, shared profiles, all seven entries, URL override, saved rooms and keyboard navigation.');
