// COSMIC_BASE_URL=http://127.0.0.1:8187/ node tools/check_cosmic_browser.cjs
// Requires an existing HTTP server, Playwright and Chromium. Writes evidence to /tmp.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.COSMIC_BASE_URL||'http://127.0.0.1:8187/';
const evidence=process.env.COSMIC_EVIDENCE||'/tmp/horror-cosmic-evidence';fs.mkdirSync(evidence,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],bad=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'?debug=1&start=piega&piega=0',{waitUntil:'networkidle',timeout:90000});
    await page.locator('#enter').click({timeout:90000});
    await page.waitForFunction(()=>window.__g?.sideFold?.landscape.status.prepared&&document.getElementById('intro').classList.contains('hidden'),null,{timeout:90000});
    const loaded=await page.evaluate(()=>window.__g.sideFold.landscape.status);
    assert.equal(loaded.loaded,true);assert.equal(loaded.error,null);
    await page.evaluate(()=>{
      const g=window.__g;g.hold=true;g.player.pos.set(.1,1.62,-4.5);g.player.yaw=-Math.PI/2;g.player.pitch=0;g.sim(.05);
    });
    const cosmicRequests=()=>requests.filter(u=>/cosmic_(ground|galaxy)\.webp/.test(u));
    assert.equal(cosmicRequests().length,2);const preparedRequests=cosmicRequests().length;
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(evidence,'01-dall-arco.png'),timeout:90000});
    const view=await page.evaluate(()=>{
      const g=window.__g,land=g.sideFold.landscape;
      return{state:g.sideFold.state,x:g.player.pos.x,visible:land.group.visible,
        galaxyImage:[land.group.getObjectByName('cosmo-galassia').material.map.image.width,land.group.getObjectByName('cosmo-galassia').material.map.image.height],
        calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
    });
    assert.equal(view.state,'idle');assert.ok(view.visible&&view.x<1.4);assert.deepEqual(view.galaxyImage,[1500,768]);
    // Two fingers: joystick forward and a simultaneous right-hand look drag.
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:85,y:700},{id:2,x:310,y:350}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:85,y:654},{id:2,x:322,y:344}]});
    await page.evaluate(()=>window.__g.sim(1.15));
    const before=await page.evaluate(()=>({state:__g.sideFold.state,x:__g.player.pos.x,yaw:__g.player.yaw,pitch:__g.player.pitch}));
    assert.ok(before.x>.9&&before.x<2.02);assert.equal(before.state,'idle');assert.notEqual(before.yaw,-Math.PI/2);
    assert.notEqual(before.pitch,0,'right-hand touch changes pitch');
    await page.evaluate(()=>window.__g.sim(.55));
    assert.equal(await page.evaluate(()=>window.__g.sideFold.state),'explore');
    await page.evaluate(()=>window.__g.sim(.9));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const entered=await page.evaluate(()=>({x:__g.player.pos.x,z:__g.player.pos.z,state:__g.sideFold.state,pitch:__g.player.pitch}));
    assert.ok(entered.x>3.3&&entered.x<4.6);assert.equal(entered.state,'explore');
    assert.equal(entered.pitch,before.pitch,'entering the universe must not raise the view');
    await page.evaluate(()=>window.__g.sim(.2));
    assert.equal(await page.evaluate(()=>window.__g.player.pos.x),entered.x,'release stops walking');
    assert.equal(await page.evaluate(()=>window.__g.player.pitch),entered.pitch,'no automatic pitch drift while exploring');
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(evidence,'02-paesaggio.png'),timeout:90000});
    // Free look leaves the galaxy fixed in the sky; it is not a screen overlay.
    const original=await page.evaluate(()=>__g.sideFold.landscape.group.getObjectByName('cosmo-galassia').quaternion.toArray());
    await page.evaluate(()=>{const g=__g;g.player.yaw-=.9;g.sim(.05);});
    assert.deepEqual(await page.evaluate(()=>__g.sideFold.landscape.group.getObjectByName('cosmo-galassia').quaternion.toArray()),original);
    // Return early through the same physical opening, then re-enter.
    await page.evaluate(()=>{__g.player.yaw=-Math.PI/2;});
    await page.keyboard.down('KeyS');await page.evaluate(()=>__g.sim(2.2));await page.keyboard.up('KeyS');
    const back=await page.evaluate(()=>({x:__g.player.pos.x,state:__g.sideFold.state}));
    assert.ok(back.x<1.35);assert.equal(back.state,'idle');
    await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(2.8));await page.keyboard.up('KeyW');
    const eventStart=await page.evaluate(()=>({x:__g.player.pos.x,state:__g.sideFold.state,yaw:__g.player.yaw}));
    assert.equal(eventStart.state,'flicker');
    await page.evaluate(()=>__g.sim(2.3));
    const dark=await page.evaluate(()=>({state:__g.sideFold.state,black:document.getElementById('foldfade').style.opacity}));
    assert.equal(dark.state,'dark');assert.equal(dark.black,'1');
    await page.evaluate(()=>__g.sim(.6));
    const hidden=await page.evaluate(()=>({visible:__g.sideFold.landscape.group.visible,yaw:__g.player.yaw,state:__g.sideFold.state}));
    assert.equal(hidden.visible,false);assert.ok(Math.abs(hidden.yaw-eventStart.yaw-Math.PI)<1e-8);
    await page.evaluate(()=>__g.sim(2));assert.equal(await page.evaluate(()=>__g.sideFold.state),'done');
    await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(3.5,1/60));await page.keyboard.up('KeyW');
    const returned=await page.evaluate(()=>({x:__g.player.pos.x,z:__g.player.pos.z,state:__g.sideFold.state,visible:__g.sideFold.landscape.group.visible}));
    assert.ok(returned.x<.8);assert.equal(returned.visible,false);
    // Regressione della soglia: i passi piccoli non devono restare imprigionati
    // nella fascia tra il corridoio laterale e il limite del tunnel principale.
    const clearance=[];
    for(const fps of [30,60,90,120,240])for(const offset of [-.45,0,.45])for(const angle of [-.3,0,.3]){
      await page.evaluate(({offset,angle})=>{
        const p=__g.player;p.pos.set(1.65,1.62,-4.5+offset);p.yaw=Math.PI/2+angle;p.speedNow=1.55;p.frozen=false;
      },{offset,angle});
      await page.keyboard.down('KeyW');await page.evaluate(fps=>__g.sim(1,1/fps),fps);await page.keyboard.up('KeyW');
      const x=await page.evaluate(()=>__g.player.pos.x);assert.ok(x<.3,`free exit at ${fps} Hz, offset ${offset}, angle ${angle}: ${x}`);
      clearance.push({fps,offset,angle,x});
    }
    await page.evaluate(()=>{const p=__g.player;p.pos.set(1.65,1.62,-4.5);p.yaw=-Math.PI/2;p.speedNow=1.55;});
    await page.keyboard.down('KeyS');await page.evaluate(()=>__g.sim(1,1/120));await page.keyboard.up('KeyS');
    assert.ok(await page.evaluate(()=>__g.player.pos.x)<.3,'backwards exit at 120 Hz');
    for(const x of [1.07,1.08]){
      await page.evaluate(x=>{const p=__g.player;p.pos.set(x,1.62,-3.7);p.yaw=0;p.speedNow=1.55;},x);
      await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(1.3,1/120));await page.keyboard.up('KeyW');
      assert.ok(await page.evaluate(()=>__g.player.pos.z)<-5.5,'walking parallel to the main wall remains free');
    }
    await page.evaluate(()=>{const p=__g.player;p.pos.set(1.08,1.62,-2.5);p.yaw=-Math.PI/2;p.speedNow=1.55;});
    await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(.5,1/60));await page.keyboard.up('KeyW');
    const wall=await page.evaluate(()=>[__g.player.pos.x,__g.player.pos.z]);
    assert.ok(Math.abs(wall[0]-1.08)<1e-8&&Math.abs(wall[1]+2.5)<1e-8,'solid wall beside the opening remains solid');
    assert.equal(cosmicRequests().length,preparedRequests,'no cosmic asset loading during traversal/effects');
    assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
    const result={result:'PASS',base,loaded,view,before,entered,back,eventStart,dark,hidden,returned,clearance,errors,bad,
      checks:['visible before entry','assets preloaded','same touch controls','two simultaneous pointers','two-three steps','stop','look','back out','original flicker/blackout/return','no runtime asset fetches','no JS errors'],
      performance:'software Chromium; real Android FPS not measured'};
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
