// DRAIN_BASE_URL=http://127.0.0.1:8212/ node tools/check_drain_presence_browser.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.DRAIN_BASE_URL || 'http://127.0.0.1:8212/', out = process.env.DRAIN_EVIDENCE || '/tmp/horror-drain-presence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('ng_quality', 'mid'));
    const page = await context.newPage(), errors = [], bad = [], requests = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
    page.on('request', r => requests.push(r.url()));
    await page.goto(base + '?base=1&debug=1', { waitUntil: 'networkidle', timeout: 90000 });
    assert.equal(await page.locator('#intro .credits').count(),0,'no credits on initial page');
    await page.evaluate(() => __g.hold = true);
    await page.locator('#enter').click({ timeout: 90000 });
    await page.waitForFunction(() => __g.story && __g.drainPresence.ready && document.getElementById('intro').classList.contains('hidden'), null, { timeout: 120000 });
    await page.evaluate(() => {
      const g = __g; g.glassEvent.done = true; g.glassEvent.state = 'done';
      if (g.glassEvent.entity) g.glassEvent.entity.visible = false;
      g.player.pos.set(.1, 1.62, -31.2); g.player.yaw = 0; g.player.pitch = .03;
      g.say.reset(); g.sim(.1);
    });
    const start = await page.evaluate(() => ({ state: __g.drainPresence.state, formed: __g.drainPresence.formed, ready: __g.drainPresence.ready }));
    assert.equal(start.state, 'rising'); assert.ok(start.formed > 0 && start.formed < .1);
    const eyeTiming=await page.evaluate(()=>{
      const g=__g,d=g.drainPresence,eyes=d.group.getObjectByName('occhi-nel-fumo');g.sim(2.7);
      const rising={form:d.formed,eye:eyes.material.opacity};
      for(let i=0;i<20&&d.formed<1;i++)g.sim(.05);
      const atTop={form:d.formed,eye:eyes.material.opacity};g.sim(.1);const afterTop=eyes.material.opacity;
      return {rising,atTop,afterTop};
    });
    assert.ok(eyeTiming.rising.form<1);assert.equal(eyeTiming.rising.eye,0);
    assert.equal(eyeTiming.atTop.form,1);assert.equal(eyeTiming.atTop.eye,0);assert.equal(eyeTiming.afterTop,0);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.screenshot({path:path.join(out,'00-fumo-completo-senza-occhi.png')});
    await page.evaluate(()=>__g.sim(.75));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const formed = await page.evaluate(() => {
      const g = __g, d = g.drainPresence, before = g.renderer.info.render;
      d.group.visible = false; g.renderer.render(g.scene, g.camera); const plain = { calls: before.calls, triangles: before.triangles };
      d.group.visible = true; g.renderer.render(g.scene, g.camera);
      return { state: d.state, visible: d.group.visible, opacity: d.group.getObjectByName('occhi-nel-fumo').material.opacity,
        metrics: d.metrics, extraCalls: before.calls - plain.calls, extraTriangles: before.triangles - plain.triangles, position: d.group.position.toArray() };
    });
    assert.equal(formed.state, 'formed'); assert.equal(formed.visible, true); assert.ok(formed.opacity > .2);
    assert.ok(formed.extraCalls <= 2); assert.ok(formed.extraTriangles <= 258);
    await page.screenshot({ path: path.join(out, '01-presenza.png') });
    await page.evaluate(() => { const g = __g; g.player.yaw = -Math.PI / 2; g.player.pitch = 0; g.player.pos.z = -28.5; g.sim(.05); });
    await page.screenshot({ path: path.join(out, '02-murale.png') });
    const anchored = await page.evaluate(() => ({ position: __g.drainPresence.group.position.toArray(), hold: __g.drainPresence.holdNarration }));
    assert.deepEqual(anchored.position, formed.position); assert.equal(anchored.hold, false, 'looking at the mural leaves narration free');
    const mural = await page.evaluate(() => {
      const m = __g.scene.getObjectByName('murale-infernale-del-tunnel'), size = m.geometry.parameters;
      return { width: size.width, height: size.height, aspect: size.width / size.height, bottom: m.position.y - size.height / 2, top: m.position.y + size.height / 2,
        loaded: m.material.map.image?.complete, wornEdge: !!m.material.alphaMap };
    });
    assert.ok(mural.loaded && mural.wornEdge); assert.ok(Math.abs(mural.aspect - 1280 / 692) < 1e-6);
    assert.ok(mural.bottom > 0 && mural.top < 2.1, 'the complete artwork fits below the brick vault');
    await page.evaluate(() => { const g = __g; g.player.yaw = 0; g.player.pitch = .03; g.player.pos.z = -33.1; g.sim(.05); });
    const grate = await page.evaluate(()=>({position:__g.drainPresence.grate.position.toArray(),rotation:__g.drainPresence.grate.rotation.toArray()}));
    const fade = [];
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => __g.sim(.5));
      fade.push(await page.evaluate(() => ({ state: __g.drainPresence.state, dissolved: __g.drainPresence.dissolved, visible: __g.drainPresence.group.visible, eye: __g.drainPresence.group.getObjectByName('occhi-nel-fumo').material.opacity,eyeY:__g.drainPresence.group.getObjectByName('occhi-nel-fumo').position.y,distance:Math.hypot(__g.player.pos.x-.3,__g.player.pos.z+45) })));
      if (i === 1 || i === 4) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: path.join(out, `03-dissolvenza-${i}.png`) }); }
    }
    assert.ok(fade.every((f, i) => !i || f.dissolved > fade[i - 1].dissolved));
    assert.ok(fade.every((f, i) => !i || f.eye < fade[i - 1].eye));
    assert.ok(fade.every(f=>f.state==='dissolving'&&f.eyeY>1.88&&f.distance>6),'the entity dissolves in place while the player is still far away');
    assert.ok(fade.every(f => f.visible), 'the cloud stays drawn throughout its fade');
    await page.evaluate(() => __g.sim(.9));
    await page.keyboard.up('KeyW');
    assert.deepEqual(await page.evaluate(()=>({position:__g.drainPresence.grate.position.toArray(),rotation:__g.drainPresence.grate.rotation.toArray()})),grate,'grate never moves');
    const gone = await page.evaluate(() => ({ state: __g.drainPresence.state, visible: __g.drainPresence.group.visible, dissolved: __g.drainPresence.dissolved,distance:Math.hypot(__g.player.pos.x-.3,__g.player.pos.z+45) }));
    assert.equal(gone.state, 'gone'); assert.equal(gone.visible, false); assert.equal(gone.dissolved, 1);
    assert.ok(gone.distance>6,'already gone around seven metres away, before a close encounter');
    await page.screenshot({ path: path.join(out, '04-grata-libera.png') });
    await page.evaluate(() => { __g.player.pos.z = -30; __g.sim(2); });
    assert.equal(await page.evaluate(() => __g.drainPresence.state), 'gone', 'it does not respawn when walking backwards');
    const modes = await page.evaluate(async () => {
      const { createDrainPresence } = await import('/js/events/drain-presence.js'), T = __g.THREE;
      const scene = new T.Scene(), player = { pos: new T.Vector3(0, 1.62, -30), forward: new T.Vector3(0, 0, -1) };
      let active = true, sounds = 0, stops = 0;
      const d = createDrainPresence({ scene, player, glass: { done: true }, reduced: true, isActive: () => active,
        lights: { lamps: [{}, {}, {}, {}], lamp() {} }, audio: { wind() { sounds++; return { stop() { stops++; } }; } } });
      const box = player.box; for (let i = 0; i < 40; i++) d.update(.1);
      const cloud = d.group.getObjectByName('fumo-istanzato'), fixed = cloud.material.uniforms.uTime.value;
      d.update(1); const still = cloud.material.uniforms.uTime.value === fixed;
      globalThis.__lowQ = true; d.update(.1); const fallback = d.grate.visible;
      active = false; d.update(.1); d.update(.1);
      return { still, fallback, hidden: !d.group.visible && !d.grate.visible, sounds, stops, unchangedController: player.box === box };
    });
    assert.deepEqual(modes, { still: true, fallback: true, hidden: true, sounds: 1, stops: 1, unchangedController: true });
    assert.ok(!requests.some(url => /hound|mural_dog/.test(url)), 'no old model, sound or painting is downloaded');
    assert.deepEqual(errors, []); assert.deepEqual(bad, []);
    const debug = await page.evaluate(() => ({ camera: __g.camera.position.toArray(), pos: __g.player.pos.toArray(), door: __g.door.state, fade: document.getElementById('fade').style.opacity, override: __g.lights.override, lamps: __g.lights.lamps.map(l => ({ mode: l.mode, level: l.level })) }));
    const result = { result: 'PASS', start, eyeTiming, formed, anchored, mural, fade, gone, modes, errors, bad, debug, realAndroid: 'FPS and appearance still require a device' };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
