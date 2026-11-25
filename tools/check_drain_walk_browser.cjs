// DRAIN_WALK_BASE_URL=http://127.0.0.1:8218/ node tools/check_drain_walk_browser.cjs
// Real touch controller and real glass event, without pauses in movement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.DRAIN_WALK_BASE_URL||'http://127.0.0.1:8218/',out='/tmp/horror-drain-continuous-walk';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    await context.addInitScript(()=>localStorage.setItem('ng_quality','mid'));
    const page=await context.newPage(),errors=[],bad=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
    await page.goto(base+'?base=1&debug=1',{waitUntil:'networkidle',timeout:90000});
    await page.evaluate(()=>__g.hold=true);await page.locator('#enter').click();
    await page.waitForFunction(()=>__g.glassEvent.ready&&__g.drainPresence.ready&&document.getElementById('intro').classList.contains('hidden'),null,{timeout:120000});
    await page.evaluate(()=>{
      const g=__g;g.player.yaw=0;g.player.pitch=.03;
      window.__walk={time:0,readable:0,peak:0,stalls:0,earlyEyes:false,trace:[],previousState:g.drainPresence.state};
      window.__walkStep=()=>{
        const w=__walk,d=g.drainPresence,p=g.player,previous=p.pos.z;g.sim(1/60,1/60);w.time+=1/60;
        const eyes=d.group.getObjectByName('occhi-nel-fumo').material.opacity;
        if(w.time>1&&p.pos.z>=previous-.0001)w.stalls++;
        if(d.formed<1&&eyes>0)w.earlyEyes=true;
        if(d.state==='formed'&&eyes>.2)w.readable+=1/60;w.peak=Math.max(w.peak,eyes);
        if(d.state!==w.previousState){w.trace.push({state:d.state,z:p.pos.z,distance:Math.hypot(p.pos.x-.3,p.pos.z+45),glass:g.glassEvent.state,at:w.time});w.previousState=d.state;}
        return eyes;
      };
      window.__walkTouchMoved=false;document.body.addEventListener('pointermove',()=>window.__walkTouchMoved=true,{once:true});
    });
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:85,y:700}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:85,y:654}]});
    await page.waitForFunction(()=>__walkTouchMoved);
    const preview=await page.evaluate(()=>{
      const g=__g,w=__walk;let eyes=0;
      while(w.time<35&&g.drainPresence.state!=='gone'){
        eyes=__walkStep();if(g.drainPresence.state==='formed'&&eyes>.4)break;
      }
      return {state:g.drainPresence.state,eyes,form:g.drainPresence.formed,speed:g.player.speedNow,z:g.player.pos.z,trace:w.trace};
    });
    fs.writeFileSync(path.join(out,'preview.json'),JSON.stringify(preview,null,2));
    assert.equal(preview.state,'formed');assert.ok(preview.eyes>.4);assert.equal(preview.form,1);assert.ok(preview.speed>1.54);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.screenshot({path:path.join(out,'01-occhi-camminando.png')});
    const run=await page.evaluate(()=>{
      const g=__g,w=__walk;while(w.time<40&&g.drainPresence.state!=='gone')__walkStep();
      return {...w,state:g.drainPresence.state,distance:Math.hypot(g.player.pos.x-.3,g.player.pos.z+45),speed:g.player.speedNow,speedMultiplier:g.player.speedMul,frozen:g.player.frozen};
    });
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(run.state,'gone');assert.ok(run.readable>=.75,'eyes are clearly present before the fade during uninterrupted walking');
    assert.equal(run.earlyEyes,false);assert.equal(run.stalls,0);assert.equal(run.speedMultiplier,1);assert.equal(run.frozen,false);
    assert.ok(run.distance>6);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
    const result={result:'PASS',preview,run,errors,bad,device:'portrait Chromium with real touch; Android hardware FPS unmeasured'};
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
