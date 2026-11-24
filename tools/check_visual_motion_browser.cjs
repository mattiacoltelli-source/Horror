// VISUAL_BASE_URL=http://127.0.0.1:8204/ node tools/check_visual_motion_browser.cjs
// Software Chromium validates controls/deformation/materials, not Android FPS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.VISUAL_BASE_URL||'http://127.0.0.1:8204/',out=process.env.VISUAL_EVIDENCE||'/tmp/horror-visual-motion';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('ng_quality','mid'));
  const page=await context.newPage(),errors=[],bad=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
  await page.goto(base+'?per=mati&debug=1&start=reparto',{waitUntil:'networkidle',timeout:90000});
  await page.evaluate(()=>__g.hold=true);await page.locator('#enter').click({timeout:90000});
  await page.waitForFunction(()=>__g.ward.loaded&&__g.ward.bend?.prepared&&!__g.story.busy(),null,{timeout:180000});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0');
  const contacts=await page.evaluate(()=>{
   const g=__g,chair=g.ward.chair,shadow=chair.children.find(o=>o.userData.contactShadow),foreign=[];
   if(!shadow)throw Error('Ward chair contact detached during preparation');
   for(const group of [g.cellar.group,g.wh.group,g.tower.group])group.traverse(o=>{if(o.userData.contactShadow&&o.material.userData.bendPatched)foreign.push(o.name);});
   chair.updateWorldMatrix(true,true);shadow.geometry.computeBoundingBox();
   const before=shadow.geometry.boundingBox.getCenter(new g.THREE.Vector3()).applyMatrix4(shadow.matrixWorld);
   chair.position.z+=.3;chair.updateWorldMatrix(true,true);
   const after=shadow.geometry.boundingBox.getCenter(new g.THREE.Vector3()).applyMatrix4(shadow.matrixWorld);chair.position.z-=.3;
   return{foreign,moved:before.distanceTo(after),floorY:before.y,parent:shadow.parent===chair};
  });
  assert.deepEqual(contacts.foreign,[]);assert.ok(contacts.parent&&Math.abs(contacts.moved-.3)<1e-5&&Math.abs(contacts.floorY)<.003);
  await page.evaluate(()=>{const g=__g;g.player.frozen=false;g.player.pos.set(0,1.62,-484);g.player.yaw=0;g.player.pitch=0;g.sim(.05);});
  await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(3.5,1/60));await page.keyboard.up('KeyW');
  const folded=await page.evaluate(()=>({z:__g.player.pos.z,A:__g.ward.bend.A,active:__g.ward.bend.active}));
  assert.ok(folded.z<-488.5&&folded.A>.3&&folded.active,'player advances into the real curved corridor');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:path.join(out,'01-reparto-curvo.png'),timeout:90000});
  await page.evaluate(()=>__g.sim(.1,1/60));assert.equal(await page.evaluate(()=>__g.player.pos.z),folded.z,'release stops during deformation');
  await page.keyboard.down('KeyS');
  const backward=await page.evaluate(()=>{const g=__g;let maxAngle=0;for(let i=0;i<60;i++){const q=g.camera.quaternion.clone();g.sim(1/60,1/60);maxAngle=Math.max(maxAngle,q.angleTo(g.camera.quaternion));}return{z:g.player.pos.z,maxAngle,position:g.camera.position.toArray()};});
  await page.keyboard.up('KeyS');assert.ok(backward.z>folded.z+1,'backwards movement remains available');assert.ok(backward.maxAngle<.12);assert.ok(backward.position.every(Number.isFinite));
  await page.evaluate(()=>__g.sim(10.5,1/60));assert.equal(await page.evaluate(()=>__g.ward.bend.active),false,'bend completes normally');
  await page.evaluate(()=>__g.story.goto('warehouse',true));await page.waitForFunction(()=>!__g.story.busy(),null,{timeout:180000});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0');
  await page.evaluate(()=>{const g=__g;g.player.pos.set(1.5,1.62,-424.8);g.player.yaw=.72;g.player.pitch=-.35;g.sim(.1);});
  const invalid=await page.evaluate(()=>{const names=[];__g.wh.group.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(m.isMeshBasicMaterial&&m.emissive)names.push(o.name);});return names;});
  assert.deepEqual(invalid,[],'furniture contact patches must not enter the weapon material callback');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:path.join(out,'02-carrello.png'),timeout:90000});
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  const result={result:'PASS',contacts,folded,backward,errors,bad,checks:['forward, stop and backward during deformation','camera continuity','bend completes','contacts follow furniture and stay on the floor','ward contact shaders remain local','weapon materials valid'],performance:'Real Android FPS not measured'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
