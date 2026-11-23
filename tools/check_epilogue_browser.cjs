// EPILOGUE_BASE_URL=http://127.0.0.1:8194/ node tools/check_epilogue_browser.cjs
// Run against a local server; Chromium mobile emulation does not measure Android FPS.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EPILOGUE_BASE_URL || 'http://127.0.0.1:8194/';
const evidence = process.env.EPILOGUE_EVIDENCE || '/tmp/horror-epilogue-evidence';
fs.mkdirSync(evidence, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1,
      hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], bad = [], endings = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
    for (const turned of [false, true]) {
      await page.goto(base + '?debug=1&start=epilogo&piega=0' + (turned ? '&turned=1' : ''), { waitUntil: 'networkidle', timeout: 90000 });
      await page.locator('#enter').click({ timeout: 90000 });
      await page.waitForFunction(() => window.__g?.dawn?.active && document.getElementById('intro').classList.contains('hidden'), null, { timeout: 90000 });
      const snapshot = await page.evaluate(() => {
        const g = window.__g; g.hold = true; g.sim(Math.max(0, 9 - g.dawn.t), 1 / 60);
        // Face the place where the floating passage used to appear.
        g.player.yaw = -.35; g.player.pitch = -.05; g.sim(1 / 60, 1 / 60);
        return { t: g.dawn.t, passage: g.sideFold.group.visible,
          tunnel: g.scene.children.find(o => o.userData.plugs).visible,
          // The debug shortcut can attach the lazy dust Points on its first tick.
          // No room mesh or group may survive alongside the panorama.
          roots: g.scene.children.filter(o => o.visible && !o.isLight && !o.isPoints && o !== g.camera).map(o => o.type),
          far: g.camera.far, controllerReleased: g.player.constrainMove === null,
          position: g.player.pos.toArray(), yaw: g.player.yaw, pitch: g.player.pitch };
      });
      assert.equal(snapshot.passage, false); assert.equal(snapshot.tunnel, false);
      assert.deepEqual(snapshot.roots, ['Mesh'], 'only the outdoor panorama remains in the world');
      assert.equal(snapshot.far, 60); assert.equal(snapshot.controllerReleased, true);
      assert.deepEqual(snapshot.position, [0, 1.62, 0]);
      await page.waitForTimeout(4100); // Original wake-up fade, in wall-clock time.
      await page.screenshot({ path: path.join(evidence, `outdoors-${Number(turned)}.png`), timeout: 90000 });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 85, y: 700 }, { id: 2, x: 310, y: 350 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 85, y: 654 }, { id: 2, x: 345, y: 365 }] });
      await page.evaluate(() => window.__g.sim(.3, 1 / 60));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const look = await page.evaluate(() => ({ yaw: __g.player.yaw, pitch: __g.player.pitch, position: __g.player.pos.toArray() }));
      assert.notEqual(look.yaw, snapshot.yaw); assert.notEqual(look.pitch, snapshot.pitch);
      assert.deepEqual(look.position, snapshot.position, 'joystick cannot invoke the previous room controller');
      // A full turn cannot resurrect the arch; the breath, blackout and ending still complete.
      await page.evaluate(() => { for (let i = 0; i < 8; i++) { __g.player.yaw += Math.PI / 4; __g.sim(.05); } __g.sim(17); });
      const final = await page.evaluate(() => ({ ended: __g.dawn.ended, passage: __g.sideFold.group.visible,
        far: __g.camera.far, fov: __g.camera.fov, position: __g.player.pos.toArray(), text: document.getElementById('endtext').textContent }));
      assert.equal(final.ended, true); assert.equal(final.passage, false); assert.equal(final.far, 60); assert.equal(final.fov, 68);
      assert.deepEqual(final.position, [0, 1.62, 0]);
      assert.ok(final.text.startsWith(turned ? 'ti sei girato.' : 'non ti sei girato.'), JSON.stringify(final));
      await page.waitForFunction(() => !document.getElementById('end').classList.contains('hidden'), null, { timeout: 10000 });
      endings.push({ turned, snapshot, look, final });
      await cdp.detach();
    }
    assert.deepEqual(errors, []); assert.deepEqual(bad, []);
    const result = { result: 'PASS', endings, errors, bad, performance: 'software Chromium; real Android FPS not measured' };
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
