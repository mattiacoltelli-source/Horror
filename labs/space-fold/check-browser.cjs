// PLAYWRIGHT_MODULE=/path/to/playwright node labs/space-fold/check-browser.cjs
// Starts its own loopback-only server; does not touch production or saved games.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
let chromium;
try {({chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'));}
catch {console.error('Playwright non disponibile. Specifica PLAYWRIGHT_MODULE; nessuna dipendenza viene installata.');process.exit(1);}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(url.startsWith('/Horror/'))url=url.slice(7);
  let target=path.resolve(root,'.'+url);
  if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403).end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  if(!fs.existsSync(target)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res);
});
const artifacts=process.env.SPACE_FOLD_ARTIFACTS||'/tmp/space-fold-artifacts';fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/Horror/';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],bad=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
    page.on('request',r=>requests.push(r.url()));
    await page.addInitScript(()=>{
      localStorage.setItem('ng_ckpt','sentinel');localStorage.setItem('ng_name','sentinel');
      sessionStorage.setItem('space-fold-test','sentinel');
    });
    // Off means zero Three.js, assets, audio context or player/control modules.
    await page.goto(base+'labs/space-fold/?spaceFold=0',{waitUntil:'networkidle'});
    assert.ok(await page.locator('#status').textContent().then(t=>t.includes('disattivato')));
    assert.ok(!requests.some(u=>/\/vendor\/|\/assets\/|\/lab\.js|\/js\/player\//.test(u)));
    assert.equal(await page.evaluate(()=>!!window.__spaceFold),false);
    // The global kill switch wins even when the URL explicitly enables the lab.
    const beforeKill=requests.length;
    await page.route('**/labs/space-fold/config.js',route=>route.fulfill({contentType:'text/javascript',
      body:fs.readFileSync(path.join(__dirname,'config.js'),'utf8').replace('SPACE_FOLD_AVAILABLE = true','SPACE_FOLD_AVAILABLE = false')}));
    await page.goto(base+'labs/space-fold/?spaceFold=1',{waitUntil:'networkidle'});
    assert.match(await page.locator('#status').textContent(),/kill switch/);
    assert.ok(!requests.slice(beforeKill).some(u=>/\/vendor\/|\/assets\/|\/lab\.js/.test(u)));
    await page.unroute('**/labs/space-fold/config.js');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(base+'labs/space-fold/?spaceFold=1&debug=1&roll=0',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__spaceFold,{timeout:90000});
    assert.equal(await page.locator('#reduced').isChecked(),true,'honor OS reduced motion');
    await page.locator('#reduced').uncheck();await page.locator('#start').click();await page.waitForFunction(()=>window.__spaceFold.running);
    const initial=await page.evaluate(async()=>{const g=window.__spaceFold;g.manual=true;await g.audio.pause();document.getElementById('metrics').hidden=true;return g.snapshot();});
    assert.equal(initial.phase,'idle');assert.equal(initial.audio,'suspended');
    const startRequests=requests.length;
    await page.evaluate(()=>{
      const g=window.__spaceFold;
      g.advance(112,.05,{x:0,y:-1}); // trigger, before any appreciable deformation
      window.__floorBefore=g.corridor.deformables[0].geo.attributes.position.array.slice();
      window.__doorBefore=g.corridor.deformables.slice(4).map(d=>d.geo.attributes.position.array.slice());
      window.__stoppedAt=g.walker.s;
      g.advance(200,.05); // parked while the floor bends
    });
    const mid=await page.evaluate(()=>{
      const g=window.__spaceFold;return {...g.snapshot(),stoppedAt:window.__stoppedAt,
        floorDelta:Math.max(...g.corridor.deformables[0].geo.attributes.position.array.map((v,i)=>Math.abs(v-window.__floorBefore[i]))),
        doorDelta:Math.max(...g.corridor.deformables.slice(4).map((d,k)=>Math.max(...d.geo.attributes.position.array.map((v,i)=>Math.abs(v-window.__doorBefore[k][i])))))};
    });
    assert.equal(mid.s,mid.stoppedAt);assert.ok(mid.angle>.5&&mid.angle<Math.PI/2);
    assert.ok(mid.floorDelta>3&&mid.doorDelta>.01,'geometry changes independently of camera');
    await page.screenshot({path:path.join(artifacts,'01-deformazione-da-fermo.png'),timeout:90000});
    // Toggle reduced motion while bending, without changing position/angle on resume.
    await page.evaluate(()=>window.__spaceFold.pause());
    const pauseState=await page.evaluate(()=>window.__spaceFold.snapshot());
    await page.waitForTimeout(120);
    assert.deepEqual(await page.evaluate(()=>window.__spaceFold.snapshot()),pauseState);
    await page.locator('#reduced').check();await page.locator('#start').click();await page.waitForFunction(()=>window.__spaceFold.running);
    await page.evaluate(async()=>{await window.__spaceFold.audio.pause();window.__spaceFold.advance(1,.016);});
    const afterToggle=await page.evaluate(()=>window.__spaceFold.snapshot());
    assert.ok(afterToggle.angle>=pauseState.angle&&afterToggle.angle-pauseState.angle<.01);
    await page.evaluate(()=>{const g=window.__spaceFold;g.advance(1200,.016);});
    assert.equal(await page.evaluate(()=>window.__spaceFold.sequence.phase),'stable');
    // Full traversal with the same walker used in RAF, plus real floor raycasts.
    const traversal=await page.evaluate(async()=>{
      const g=window.__spaceFold,THREE=await import(new URL('vendor/three/three.module.min.js',document.baseURI));
      const checks=[];
      for(const s of [12,15,18,21,24,26,28]) {
        g.advance(Math.ceil((s-g.walker.s)/(g.walker.speedLimit*.05)),.05,{x:0,y:-1});g.advance(50,.016);
        const f=g.path.frame(g.walker.s),floor=g.corridor.root.getObjectByName('pavimento-parametrico');
        g.scene.updateMatrixWorld(true);
        const ray=new THREE.Raycaster(g.camera.position.clone(),new THREE.Vector3(0,-f.cos,-f.sin),0,3);
        const hit=ray.intersectObject(floor)[0];
        const up=new THREE.Vector3(0,1,0).applyQuaternion(g.camera.quaternion);
        checks.push({s:g.walker.s,floorDistance:hit?.distance,upDot:up.dot(new THREE.Vector3(0,f.cos,f.sin)),...g.snapshot()});
      }
      return checks;
    });
    for(const point of traversal) {assert.ok(Math.abs(point.floorDistance-1.62)<.003,JSON.stringify(point));assert.ok(point.upDot>.9999);}
    assert.equal(traversal.at(-1).phase,'stable');
    assert.equal(await page.evaluate(()=>window.__spaceFold.sequence.finished),true);
    await page.screenshot({path:path.join(artifacts,'02-approdo-verticale.png'),timeout:90000});
    // Attachments use the same frame; import normals remain finite/unit length.
    const integrity=await page.evaluate(()=>{
      const g=window.__spaceFold;let anchorError=0,normalError=0;
      for(const a of g.corridor.anchors){const p=g.path.point(a.x,a.y,a.s);anchorError=Math.max(anchorError,Math.hypot(a.object.position.x-p.x,a.object.position.y-p.y,a.object.position.z-p.z));}
      for(const d of g.corridor.deformables){const n=d.geo.attributes.normal.array;for(let i=0;i<n.length;i+=3)normalError=Math.max(normalError,Math.abs(1-Math.hypot(n[i],n[i+1],n[i+2])));}
      return {anchorError,normalError};
    });
    assert.ok(integrity.anchorError<1e-8&&integrity.normalError<1e-5);
    await page.evaluate(()=>window.__spaceFold.advance(1400,.05,{x:1,y:1}));
    const back=await page.evaluate(()=>window.__spaceFold.snapshot());
    assert.ok(back.s<2,JSON.stringify(back));assert.equal(back.x,1.3);
    // Return to curve for a gameplay screenshot; no debug camera is used.
    await page.evaluate(()=>{const g=window.__spaceFold;g.advance(180,.05,{x:-.15,y:-1});g.advance(50,.016);document.getElementById('metrics').hidden=true;});
    await page.screenshot({path:path.join(artifacts,'03-camminare-sulla-curva.png'),timeout:90000});
    assert.equal(requests.length,startRequests,'no network requests during deformation/traversal');
    // Touch: two simultaneous fingers, then release without drift.
    await page.evaluate(()=>{const g=window.__spaceFold;g.manual=false;g.controls.keys.clear();});
    const cdp=await context.newCDPSession(page),touches=[{id:1,x:100,y:650},{id:2,x:310,y:400}];
    const touchStart=await page.evaluate(()=>window.__spaceFold.snapshot());
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:100,y:604},{id:2,x:335,y:420}]});
    await page.waitForFunction(s=>window.__spaceFold.walker.s>s+.03,touchStart.s,{timeout:30000});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>window.__spaceFold.controls.move.y===0);
    const released=await page.evaluate(()=>window.__spaceFold.snapshot());
    assert.notEqual(released.pose.yaw,touchStart.pose.yaw);assert.notEqual(released.pose.pitch,touchStart.pose.pitch);
    await page.waitForTimeout(180);
    const stopped=await page.evaluate(()=>window.__spaceFold.snapshot());assert.equal(stopped.s,released.s);
    // Explicit pointer cancellation and held-input pause/resume.
    await page.evaluate(()=>{
      const c=document.getElementById('gl'),g=window.__spaceFold;
      for(const [type,y] of [['pointerdown',650],['pointermove',600],['pointercancel',600]])
        c.dispatchEvent(new PointerEvent(type,{pointerId:900,pointerType:'touch',clientX:90,clientY:y,bubbles:true}));
      if(g.controls.move.y!==0)throw Error('pointercancel left a held stick');
      g.controls.keys.add('KeyW');g.pause();
    });
    assert.equal(await page.evaluate(()=>window.__spaceFold.controls.keys.size),0);
    await page.locator('#start').click();await page.waitForFunction(()=>window.__spaceFold.running);
    const resumed=await page.evaluate(()=>window.__spaceFold.walker.s);
    await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.__spaceFold.walker.s),resumed);
    // Resize keeps the transport frame and bounded controller intact.
    await page.setViewportSize({width:915,height:412});
    await page.waitForFunction(()=>window.__spaceFold.camera.fov===58);
    assert.equal(await page.evaluate(()=>window.__spaceFold.camera.fov),58);
    await page.setViewportSize({width:412,height:915});
    await page.waitForFunction(()=>window.__spaceFold.camera.fov===68);
    assert.equal(await page.evaluate(()=>window.__spaceFold.camera.fov),68);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    assert.equal(await page.evaluate(()=>window.__spaceFold.running),false);
    await page.locator('#start').click();await page.waitForFunction(()=>window.__spaceFold.running);
    assert.equal(await page.evaluate(()=>window.__spaceFold.running),true,'BFCache return must keep a resumable renderer');
    // Walk while the geometry is still moving, not only after it has settled.
    await page.evaluate(()=>window.__spaceFold.pause());await page.locator('#restart').click();await page.waitForFunction(()=>window.__spaceFold.running);
    const moving=await page.evaluate(async()=>{
      const g=window.__spaceFold,THREE=await import(new URL('vendor/three/three.module.min.js',document.baseURI));
      g.manual=true;await g.audio.pause();g.walker.reduced=g.sequence.reduced=false;
      const result=[];
      for(let i=0;i<65;i++) {
        g.advance(10,.05,{x:0,y:-1});g.scene.updateMatrixWorld(true);
        const f=g.path.frame(g.walker.s),ray=new THREE.Raycaster(g.camera.position.clone(),new THREE.Vector3(0,-f.cos,-f.sin),0,3);
        const hit=ray.intersectObject(g.corridor.root.getObjectByName('pavimento-parametrico'))[0];
        result.push({s:g.walker.s,angle:g.sequence.angle,phase:g.sequence.phase,distance:hit?.distance});
      }
      return result;
    });
    assert.ok(moving.some(p=>p.phase==='folding'&&p.s>8&&p.angle>.2));
    for(const p of moving)assert.ok(Math.abs(p.distance-1.62)<.003,JSON.stringify(p));
    assert.equal(moving.at(-1).phase,'stable');
    // CPU-only update cost is diagnostic; software WebGL FPS is not Android FPS.
    const cpu=await page.evaluate(()=>{
      const g=window.__spaceFold;g.manual=true;const samples=[];
      for(let i=0;i<100;i++){g.path.setAngle((.5+.5*Math.sin(i/20))*Math.PI/2);const t=performance.now();g.corridor.update();samples.push(performance.now()-t);}
      g.path.setAngle(g.sequence.angle);g.corridor.update();g.render();samples.sort((a,b)=>a-b);
      return {p50Ms:samples[50],p95Ms:samples[95],scope:'CPU deformation only; desktop Chromium, not Android'};
    });
    assert.equal(await page.evaluate(()=>localStorage.getItem('ng_ckpt')),'sentinel');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ng_name')),'sentinel');
    assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
    const report={result:'PASS',renderer:'Chromium SwiftShader (not a real Android device)',initial,mid,traversal,moving,integrity,cpu,
      checks:['flag off: no engine/assets','project-subpath URLs','OS reduced motion','stop during fold','pause/resume','accessibility toggle','real geometry','floor raycasts','complete traversal','backwards','attached fixtures','two-finger touch','pointercancel','held input reset','resize','no runtime loading','unchanged save keys','no WebGL/JS errors'],artifacts};
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
