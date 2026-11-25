// NARRATIVE_BASE_URL=http://127.0.0.1:8211/ node tools/check_narrative_browser.cjs
// Real mobile controller/room preparation/checkpoint menu and alternate ending.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.NARRATIVE_BASE_URL || 'http://127.0.0.1:8211/', out = process.env.NARRATIVE_EVIDENCE || '/tmp/horror-narrative-browser';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('ng_quality', 'mid'));
    const page = await context.newPage(), errors = [], bad = [];
    page.on('pageerror', e => errors.push(e.stack || e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
    const ready = async room => { await page.waitForFunction(room => __g.story?.current() === room && !__g.story.busy(), room, { timeout: 300000 }); await page.waitForFunction(() => getComputedStyle(document.getElementById('fade')).opacity === '0', null, { timeout: 20000 }); };
    await page.goto(base + '?debug=1&per=mati&start=reparto', { waitUntil: 'networkidle', timeout: 90000 });
    await page.evaluate(() => __g.hold = true); await page.locator('#enter').click({ timeout: 90000 }); await ready('ward');
    await page.waitForFunction(() => __g.ward?.bend?.prepared, null, { timeout: 180000 });
    const interrupted = await page.evaluate(() => {
      const g = __g, el = document.getElementById('subtitle');
      g.say.reset(); g.say('nota interrotta: ricorda la porta.', 7000, 'note'); g.player.pos.z = -484.1; g.sim(.2, 1 / 60);
      const quiet = { state: g.ward.bend.state, opacity: el.style.opacity };
      g.sim(11.7, 1 / 60); const resumed = { state: g.ward.bend.state, text: el.textContent, opacity: el.style.opacity, remaining: g.say.noteUntil - performance.now() };
      return { quiet, resumed };
    });
    assert.equal(interrupted.quiet.state, 'run'); assert.equal(Number(interrupted.quiet.opacity), 0);
    assert.equal(interrupted.resumed.state, 'done'); assert.equal(interrupted.resumed.text, 'nota interrotta: ricorda la porta.');
    assert.equal(Number(interrupted.resumed.opacity), 1); assert.ok(interrupted.resumed.remaining > 5500, 'the bend preserves note reading time');
    const beforePause = await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
      __g.hold = false; return { text: document.getElementById('subtitle').textContent, remaining: __g.say.noteUntil - performance.now() };
    });
    await page.waitForTimeout(500);
    const afterPause = await page.evaluate(() => { __g.hold = true; delete document.hidden; return { text: document.getElementById('subtitle').textContent, remaining: __g.say.noteUntil - performance.now(), paused: !document.getElementById('pause').classList.contains('hidden') }; });
    assert.equal(afterPause.paused, true); assert.equal(afterPause.text, beforePause.text); assert.ok(Math.abs(afterPause.remaining - beforePause.remaining) < 10);
    await page.locator('#resume').click();
    console.log('PASS bend reading window and real visibility pause');

    await page.evaluate(() => { const g = __g; Object.assign(g.flags, { turned: true, door: 'breath', weapon: null, noGun: false, notes: 2 }); g.notes.found.add(0); g.notes.found.add(3); });
    const rooms = ['cellar', 'ward', 'morgue', 'warehouse', 'tower'];
    for (const room of rooms) { if (room === 'tower') await page.evaluate(() => __g.wh.take('axe')); await page.evaluate(room => __g.story.goto(room, true), room); await ready(room); console.log('Checkpoint prepared:', room); }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ng_rooms')));
    for (const room of rooms) { assert.equal(saved[room].room, room); assert.equal(saved[room].turned, true); assert.equal(saved[room].door, 'breath'); assert.equal(saved[room].weapon, room === 'tower' ? 'axe' : null); assert.equal(saved[room].noGun, false); assert.deepEqual(saved[room].notes, [0, 3]); }
    await page.goto(base + '?debug=1&per=mati', { waitUntil: 'networkidle', timeout: 90000 });
    const menu = await page.locator('#cmenu button').evaluateAll(nodes => nodes.map(n => n.dataset.room));
    assert.deepEqual(menu, ['', ...rooms]);
    await page.locator('#ckpt').click(); await page.locator('#cmenu button[data-room="tower"]').click();
    await page.evaluate(() => __g.hold = true); await page.locator('#enter').click({ timeout: 90000 }); await ready('tower');
    const restored = await page.evaluate(() => ({ current: __g.story.current(), flags: { ...__g.flags }, notes: [...__g.notes.found] }));
    assert.equal(restored.current, 'tower'); assert.equal(restored.flags.turned, true); assert.equal(restored.flags.door, 'breath'); assert.equal(restored.flags.weapon, 'axe'); assert.equal(restored.flags.noGun, false);
    assert.deepEqual(restored.notes, [0, 3]); assert.equal(restored.flags.filmKey, false); assert.equal(restored.flags.filmDoorOpen, false);
    console.log('PASS five snapshots and personalized tower-menu restore');

    await page.evaluate(() => __g.story.goto('cellar', true)); await ready('cellar');
    const portal = await page.evaluate(() => {
      const g = __g, original = g.story.preparing; g.story.preparing = () => true;
      try { g.cellar.onPortal(); const entered = g.space.active; for (let i = 0; i < 140; i++) g.space.update(.1); return { entered, completed: !g.space.active, blade: g.flags.bladeEnding }; }
      finally { g.story.preparing = original; }
    });
    assert.equal(portal.entered, true); assert.equal(portal.completed, true); assert.equal(portal.blade, true);
    console.log('PASS crypt portal fall; preparing alternate ending');
    await ready('tower'); await page.evaluate(async () => { await __g.tower.blade.load(); __g.sim(3.2, 1 / 60); });
    await page.waitForFunction(() => __g.tower.blade.active && __g.tower.blade.state === 'come', null, { timeout: 30000 });
    await page.evaluate(() => __g.sim(2.6, 1 / 60));
    assert.equal(await page.evaluate(() => __g.tower.blade.state), 'wait');
    assert.equal(await page.locator('#fire').textContent(), 'ONDA'); await page.locator('#fire').dispatchEvent('pointerdown');
    await page.evaluate(() => __g.sim(10, 1 / 60));
    assert.equal(await page.evaluate(() => __g.dawn.active), true, 'existing plasma ending still reaches its epilogue');
    await page.evaluate(() => __g.sim(30, 1 / 60));
    await page.waitForFunction(() => !document.getElementById('end').classList.contains('hidden'), null, { timeout: 10000 });
    const alternate = await page.evaluate(() => ({ ended: __g.dawn.ended, text: document.getElementById('endtext').textContent, label: document.getElementById('endsub').textContent }));
    assert.equal(alternate.ended, true); assert.ok(alternate.text.includes('Agnese è scomparsa nella luce.')); assert.equal(alternate.label, '');
    assert.deepEqual(errors, []); assert.deepEqual(bad, []);
    const result = { result: 'PASS', interrupted, pause: { before: beforePause, after: afterPause }, checkpointRooms: rooms, menu, restored, portal, alternate, errors, bad, performance: 'mobile software Chromium; real Android FPS and listening still require a device' };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
