// NARRATIVE_BASE_URL=http://127.0.0.1:8211/ node tools/check_narrative_windows_browser.cjs
// Small real-scene probes for the normal intro and observation-only windows.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.NARRATIVE_BASE_URL || 'http://127.0.0.1:8211/', out = process.env.NARRATIVE_WINDOWS_EVIDENCE || '/tmp/horror-narrative-windows';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
 try {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('ng_quality', 'mid'));
  const page = await context.newPage(), errors = [], bad = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
  await page.goto(base + '?debug=1', { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(() => __g.hold = true); await page.locator('#enter').click({ timeout: 90000 });
  await page.waitForFunction(() => document.getElementById('intro').classList.contains('hidden'), null, { timeout: 180000 });
  const intro = await page.evaluate(() => { __g.sim(20); const e = document.getElementById('subtitle'); return { text: e.textContent, opacity: Number(e.style.opacity), breathExperiment: __g.breath }; });
  assert.equal(intro.opacity, 1); assert.ok(intro.text.startsWith('registro notturno')); assert.equal(intro.breathExperiment, null, 'rejected experiment remains disabled');
  const cosmic = await page.evaluate(() => {
    const g = __g, e = document.getElementById('subtitle'); g.say.reset(); g.player.pos.set(2.2, 1.62, -4.5); g.player.yaw = -Math.PI / 2; g.sim(.05);
    const explore = g.sideFold.state; g.say('nota dopo il cielo', 7000, 'note'); g.sim(9.2);
    const flicker = { state: g.sideFold.state, opacity: Number(e.style.opacity) };
    g.sim(4.6); return { explore, flicker, returned: { state: g.sideFold.state, text: e.textContent, opacity: Number(e.style.opacity), remaining: g.say.noteUntil - performance.now() } };
  });
  assert.equal(cosmic.explore, 'explore'); assert.equal(cosmic.flicker.state, 'flicker'); assert.equal(cosmic.flicker.opacity, 0);
  assert.equal(cosmic.returned.state, 'done'); assert.equal(cosmic.returned.text, 'nota dopo il cielo'); assert.equal(cosmic.returned.opacity, 1); assert.ok(cosmic.returned.remaining > 6000);
  const hall = await page.evaluate(() => { __g.player.pos.set(.1, 1.62, -38); __g.sim(.05); return { state: __g.door.state, opacity: Number(document.getElementById('subtitle').style.opacity) }; });
  assert.equal(hall.state, 'hush'); assert.equal(hall.opacity, 0, 'hall arrival removes the stale tunnel note');
  // Match the supported room-shortcut setup before jumping forward: an active
  // hall scene is intentionally allowed to keep issuing its urgent prompts.
  await page.evaluate(() => { __g.door.state = 'over'; __g.hall.active = false; __g.story.goto('warehouse', true); });
  await page.waitForFunction(() => __g.story.current() === 'warehouse' && !__g.story.busy(), null, { timeout: 300000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { __g.sim(.1); await __g.wh.bridge.prepare(); });
  const bridge = await page.evaluate(() => {
    const g = __g, e = document.getElementById('subtitle'), b = g.wh.bridge; g.say.reset(); g.say('nota prima del ponte', 7000, 'note'); g.sim(12.4);
    const initialReleased = { hold: b.holdNarration, text: e.textContent, opacity: Number(e.style.opacity) };
    g.say.reset(); g.player.pos.set(.1, 1.62, -406.5); g.sim(.1, 1 / 60); g.say('nota dopo il ponte', 7000, 'note'); g.sim(5, 1 / 60);
    const opened = { state: b.state, hold: b.holdNarration, opacity: Number(e.style.opacity) };
    g.player.pos.z = -402; g.sim(5.2, 1 / 60);
    return { initialReleased, opened, restored: { state: b.state, hold: b.holdNarration, text: e.textContent, opacity: Number(e.style.opacity) } };
  });
  assert.equal(bridge.initialReleased.hold, false); assert.equal(bridge.initialReleased.text, 'nota prima del ponte'); assert.equal(bridge.initialReleased.opacity, 1);
  assert.equal(bridge.opened.state, 'open'); assert.equal(bridge.opened.hold, true); assert.equal(bridge.opened.opacity, 0);
  assert.equal(bridge.restored.state, 'done'); assert.equal(bridge.restored.hold, false); assert.equal(bridge.restored.text, 'nota dopo il ponte'); assert.equal(bridge.restored.opacity, 1);
  console.log('PASS normal intro, cosmic observation and bridge reading windows');
  await page.evaluate(() => { __g.flags.noGun = true; __g.flags.turned = false; __g.flags.bladeEnding = false; __g.story.goto('tower', true); });
  await page.waitForFunction(() => __g.story.current() === 'tower' && !__g.story.busy(), null, { timeout: 180000 });
  await page.evaluate(() => { __g.player.pos.set(.1, 1.62, -315.5); __g.player.yaw = 0; __g.sim(.05); __g.tower.open(); });
  await page.waitForFunction(() => __g.combat.active && __g.combat.M, null, { timeout: 30000 });
  const standard = await page.evaluate(() => {
    const g = __g, e = document.getElementById('subtitle');
    for (let i = 0; i < 1800 && !g.dawn.active; i++) g.sim(1 / 60, 1 / 60);
    const entered = g.dawn.active; g.sim(Math.max(0, 9 - g.dawn.t), 1 / 60);
    return { entered, scareActive: g.scare.active, scareDone: g.scare.done, text: e.textContent, opacity: Number(e.style.opacity), t: g.dawn.t };
  });
  assert.equal(standard.entered, true); assert.equal(standard.scareActive, true); assert.equal(standard.scareDone, true);
  assert.equal(standard.text, 'il fumo non si sente più.'); assert.equal(standard.opacity, 1, 'the real combat/scare handover preserves the epilogue reading slot');
  assert.deepEqual(errors, []); assert.deepEqual(bad, []);
  const result = { result: 'PASS', intro, cosmic, hall, bridge, standard, errors, bad, performance: 'software mobile Chromium; no real Android FPS claim' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
