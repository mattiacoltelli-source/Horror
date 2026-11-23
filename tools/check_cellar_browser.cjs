// CELLAR_BASE_URL=http://127.0.0.1:8189/ node tools/check_cellar_browser.cjs
// Uses real game/controller and WebGL in mobile Chromium; no Android FPS claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.CELLAR_BASE_URL||'http://127.0.0.1:8189/',out=process.env.CELLAR_EVIDENCE||'/tmp/horror-cellar-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],bad=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'?debug=1&start=cantina',{waitUntil:'networkidle',timeout:90000});
  await page.evaluate(()=>{
   const g=__g,render=g.renderer.render.bind(g.renderer);g.hold=true;
   window.__cellarPasses={loadingBakes:0,playingBakes:0,preview:0};
   g.renderer.render=function(s,c){const p=window.__cellarPasses;if(s.name==='preparazione-spazio')p[g.story?.preparing()?'loadingBakes':'playingBakes']++;if(s.name==='anteprima-spazio')p.preview++;return render(s,c);};
  });
  await page.locator('#enter').click();console.log('Preparing cellar behind fade...');
  await page.waitForFunction(()=>__g.cellar?.group.visible&&!__g.story.busy(),null,{timeout:300000});
  const prepared=await page.evaluate(()=>({space:__g.space.prepared,ward:__g.ward.warmed,passes:{...__cellarPasses}}));
  assert.ok(prepared.space&&prepared.ward);assert.ok(prepared.passes.loadingBakes>0);assert.equal(prepared.passes.playingBakes,0);
  assert.equal(requests.filter(u=>u.includes('space_cross')).length,0,'cross backdrop is never loaded');
  console.log('Cellar ready',JSON.stringify(prepared));
  // Move near the crypt and then face the mirror. No procedural bakes during play.
  await page.evaluate(()=>{const g=__g;g.player.pos.set(3,1.62,-215.5);g.player.yaw=-Math.PI/2;g.player.pitch=0;g.sim(.05);});
  await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(1.3,1/60));await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(()=>__g.player.pos.x)>4.5,'crypt approach remains open');
  await page.evaluate(()=>{const g=__g;g.player.pos.set(-2.3,1.62,-210);g.player.yaw=Math.PI/2;g.player.pitch=0;g.sim(.05);});
  await page.screenshot({path:path.join(out,'mirror.png'),timeout:90000});
  // Deterministic scheduler probe: run the actual Reflector callback, intercept
  // only its nested draw so software GPU speed cannot distort rate assertions.
  const reflection=await page.evaluate(()=>{
   const g=__g,m=g.scene.getObjectByName('specchio-cantina'),render=g.renderer.render,now=performance.now;
   let time=1000000,n=0;g.renderer.render=function(s,c){if(c===m.camera){n++;return;}return render.call(this,s,c);};performance.now=()=>time;
   try{
    for(let i=0;i<60;i++){time=1000000+i*1000/60;m.onBeforeRender(g.renderer,g.scene,g.camera);}
    const still=n;n=0;
    for(let i=0;i<60;i++){time=1002000+i*1000/60;g.camera.position.x+=.02;g.camera.updateMatrixWorld(true);m.onBeforeRender(g.renderer,g.scene,g.camera);}
    return{still,moving:n,samples:m.getRenderTarget().samples};
   }finally{performance.now=now;g.renderer.render=render;}
  });
  assert.ok(reflection.still<=12&&reflection.still>=10);assert.ok(reflection.moving<=30&&reflection.moving>=20);assert.equal(reflection.samples,0);
  // The floor aperture always shows a bounded, star-only scene.
  await page.evaluate(()=>{const g=__g;g.player.pos.set(-.5,1.62,-211.8);g.player.yaw=0;g.player.pitch=-1;g.cellar.portal.openIt();g.sim(5,1/60);});
  await page.screenshot({path:path.join(out,'portal.png'),timeout:90000});
  const portal=await page.evaluate(()=>{
   const g=__g,p=g.space.preview;return{use:g.cellar.portal.mat.uniforms.uUse.value,draws:p.scene.children.length,points:p.scene.children[0].geometry.attributes.position.count,size:[p.target.width,p.target.height],msaa:p.target.samples,passes:{...__cellarPasses}};
  });
  assert.ok(portal.use>.999);assert.equal(portal.draws,1);assert.equal(portal.points,900);assert.ok(Math.max(...portal.size)<=256);assert.equal(portal.msaa,0);assert.equal(portal.passes.playingBakes,0);
  // Compare the optimized portal shader against its complete shading path on
  // the GPU. The fast centre must not introduce a visible cut in the glow.
  const shading=await page.evaluate(()=>{
   const g=__g,T=g.THREE,scene=new T.Scene();scene.background=new T.Color(0x393939);
   const view=new T.PerspectiveCamera(68,1,.1,20);view.position.set(-.5,1.62,-211.8);view.lookAt(-.5,0,-213.6);
   const mesh=g.cellar.portal.mesh.clone();mesh.material=mesh.material.clone();mesh.material.uniforms.uUse.value=1;mesh.material.uniforms.uOpen.value=1;mesh.material.uniforms.uRes.value=new T.Vector2(256,256);scene.add(mesh);
   const target=new T.WebGLRenderTarget(256,256,{samples:0}),previous=g.renderer.getRenderTarget(),a=new Uint8Array(256*256*4),b=new Uint8Array(a.length);
   try{g.renderer.setRenderTarget(target);g.renderer.render(scene,view);g.renderer.readRenderTargetPixels(target,0,0,256,256,a);
    mesh.material.fragmentShader=mesh.material.fragmentShader.replace('if (uUse > 0.999','if (false && uUse > 0.999');mesh.material.needsUpdate=true;
    g.renderer.render(scene,view);g.renderer.readRenderTargetPixels(target,0,0,256,256,b);
    let max=0,different=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);if(d>2)different++;}return{max,different};
   }finally{g.renderer.setRenderTarget(previous);mesh.material.dispose();target.dispose();}
  });assert.ok(shading.max<=2&&shading.different===0,'fast shading preserves the continuous glow');
  // Looking down far from the portal no longer renders an offscreen universe.
  const cull=await page.evaluate(()=>{const g=__g;g.player.pos.set(.4,1.62,-201.6);g.player.pitch=-1;g.player.update(0,0);const a=__cellarPasses.preview;g.sim(.2,1/60);return __cellarPasses.preview-a;});assert.equal(cull,0);
  // Actual dive, original fall and completion callback. Pause only the automatic
  // RAF tick so the deterministic checks can advance the existing state machine.
  const fall=await page.evaluate(()=>{
   const g=__g,preparing=g.story.preparing;g.story.preparing=()=>true;
   try{g.player.pos.set(-.5,1.62,-213.3);g.player.pitch=-1;g.player.yaw=0;g.player.frozen=false;g.sim(.8,1/60);
    const entered={active:g.space.active,phase:g.space.phase};g.space.update(.1);g.space.render();
    let completed=false;const done=g.space.onDone;g.space.onDone=()=>{completed=true;g.player.frozen=false;};
    for(let i=0;i<140;i++)g.space.update(.1);
    const result={entered,completed,active:g.space.active,phase:g.space.phase,speed:g.player.speedMul};g.space.onDone=done;return result;
   }finally{g.story.preparing=preparing;}
  });
  assert.equal(fall.entered.active,true);assert.equal(fall.entered.phase,'fall');assert.equal(fall.completed,true);assert.equal(fall.active,false);assert.equal(fall.phase,'idle');assert.equal(fall.speed,1);
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  const result={result:'PASS',prepared,reflection,portal,shading,cull,fall,errors,bad,performance:'Software Chromium: scheduling/render budgets verified; real Android FPS not measured.'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
