// START_ROOMS_BASE_URL=http://127.0.0.1:8213/ node tools/check_start_rooms_browser.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.START_ROOMS_BASE_URL || 'http://127.0.0.1:8213/', out = '/tmp/horror-start-rooms';
fs.mkdirSync(out, { recursive: true });
const expected = ['', 'hall', 'cellar', 'ward', 'morgue', 'warehouse', 'tower'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('ng_quality', 'mid'));
    const page = await context.newPage(), errors = [], bad = [], profiles = [];
    page.on('pageerror', e => errors.push(e.stack || e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
    const open = async query => {
      await page.goto(base + query, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction(() => window.__g && !document.getElementById('ckpt').disabled);
      await page.evaluate(() => __g.hold = true);
    };
    for (const query of ['?base=1&debug=1', '?per=yana&debug=1', '?per=mati&debug=1', '?per=steve&debug=1']) {
      await open(query);
      assert.equal(await page.locator('#ckpt').isVisible(), true);
      const keys = await page.locator('#cmenu button').evaluateAll(nodes => nodes.map(n => n.dataset.room));
      assert.deepEqual(keys, expected); assert.equal(await page.evaluate(() => localStorage.getItem('ng_ckpt')), null);
      const style=await page.locator('#ckpt').evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderTopWidth,background:s.backgroundColor,decoration:s.textDecorationLine};});
      assert.equal(style.border,'0px');assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.ok(style.decoration.includes('underline'));
      await page.locator('#ckpt').click();
      assert.equal(await page.locator('#ckpt').getAttribute('aria-expanded'), 'true');
      await page.locator('#cmenu button[data-room="cellar"]').click();
      assert.ok((await page.locator('#ckpt').textContent()).includes('cantina e cripta'));
      await page.locator('#ckpt').click(); await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.room), 'tower');
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#cmenu').isVisible(), false);
      profiles.push({ query, keys });
    }
    await page.setViewportSize({ width: 360, height: 568 }); await page.locator('#ckpt').click();
    const layout = await page.locator('#cmenu').evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, scroll: el.scrollHeight, client: el.clientHeight, viewport: innerHeight }; });
    assert.ok(layout.top >= 0 && layout.bottom <= layout.viewport); assert.ok(layout.scroll >= layout.client);
    await page.locator('#cmenu button[data-room="tower"]').click();
    await page.screenshot({ path: path.join(out, '01-mobile-menu-closed.png') });
    await page.locator('#ckpt').click(); await page.screenshot({ path: path.join(out, '02-mobile-menu-open.png') });
    await page.keyboard.press('Escape'); await page.setViewportSize({ width: 412, height: 915 });

    // First personalized visit, no checkpoint: choose a room without changing
    // the profile URL or needing to unlock anything.
    await open('?per=yana&debug=1'); await page.locator('#ckpt').click(); await page.locator('#cmenu button[data-room="ward"]').click();
    const url = page.url(); await page.locator('#enter').click({ timeout: 90000 });
    await page.waitForFunction(() => __g.story?.current() === 'ward' && !__g.story.busy(), null, { timeout: 300000 });
    assert.equal(page.url(), url);
    const yana = await page.evaluate(async () => {
      const p = await import('/js/personal.js'), copy = await import('/js/narrative-copy.js');
      return { room: __g.story.current(), name: p.P.name, photo: p.PHOTO, lang: p.P.lang,
        feminine: copy.NOTE_TEXT[3].includes('sopravvissuta: Yana'), smokeLore: copy.NOTE_TEXT[3].includes('dalle grate sale ancora fumo'),
        nurse: copy.NOTE_TEXT[4].includes('добраніч'), presence: !!__g.drainPresence, inactive: !__g.drainPresence.group.visible };
    });
    assert.deepEqual(yana, { room: 'ward', name: 'Yana', photo: 'pic_yana.jpg', lang: 'uk-UA', feminine: true, smokeLore: true, nurse: true, presence: true, inactive: true });
    console.log('PASS Yana: fresh room entry with all personal details and current shared effects');

    const snap = { room: 'tower', turned: true, door: 'breath', weapon: 'axe', noGun: false, notes: [0, 3] };
    await page.evaluate(snap => { localStorage.setItem('ng_ckpt', JSON.stringify(snap)); localStorage.setItem('ng_rooms', JSON.stringify({ tower: snap })); }, snap);
    await open('?per=mati&debug=1');
    assert.deepEqual(await page.locator('#cmenu button').evaluateAll(nodes => nodes.map(n => n.dataset.room)), expected);
    assert.ok((await page.locator('#cmenu button[data-room="tower"]').textContent()).includes('salvato'));
    await page.locator('#ckpt').click(); await page.locator('#cmenu button[data-room="tower"]').click(); await page.locator('#enter').click({ timeout: 90000 });
    await page.waitForFunction(() => __g.story?.current() === 'tower' && !__g.story.busy(), null, { timeout: 300000 });
    const restored = await page.evaluate(() => ({ room: __g.story.current(), turned: __g.flags.turned, door: __g.flags.door, weapon: __g.flags.weapon, notes: [...__g.notes.found] }));
    assert.deepEqual(restored, { room: 'tower', turned: true, door: 'breath', weapon: 'axe', notes: [0, 3] });
    assert.deepEqual(errors, []); assert.deepEqual(bad, []);
    const result = { result: 'PASS', profiles, layout, yana, restored, errors, bad };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
