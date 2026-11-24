// BRIDGE_BASE_URL=http://127.0.0.1:8205/ node tools/check_warehouse_bridge_browser.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.BRIDGE_BASE_URL||'http://127.0.0.1:8205/',out=process.env.BRIDGE_EVIDENCE||'/tmp/horror-warehouse-bridge';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('ng_quality','mid'));
  const page=await context.newPage(),errors=[],bad=[],requests=[];
  page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('ERROR',e.stack||e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});page.on('request',r=>requests.push(r.url()));
  async function enter(extra=''){
   await page.goto(base+'?debug=1&per=mati&start=magazzino'+extra,{waitUntil:'networkidle',timeout:90000});
   await page.evaluate(()=>__g.hold=true);await page.locator('#enter').click({timeout:90000});
   await page.waitForFunction(()=>__g.wh.group.visible&&!__g.story.busy(),null,{timeout:180000});
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0');
   await page.waitForLoadState('networkidle');
  }
  async function shot(name,pitch=0,yaw=0){
   await page.evaluate(({pitch,yaw})=>{const g=__g;g.player.pitch=pitch;g.player.yaw=yaw;g.sim(.05);g.renderer.setPixelRatio(1);globalThis.__lowQ=false;g.scene.traverse(o=>{if(o.userData.decor)o.visible=true;});},{pitch,yaw});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.screenshot({path:path.join(out,name+'.png'),timeout:90000});
  }
  await enter();await page.evaluate(async()=>{__g.sim(.1);await __g.wh.bridge.prepare();});await shot('01-magazzino-prima',-.1);
  const before=await page.evaluate(()=>({stats:__g.wh.bridge.stats,programs:__g.renderer.info.programs.length,images:__g.renderer.info.memory.textures,pitch:__g.player.pitch}));
  const preparedPresence=await page.evaluate(()=>{const e=__g.wh.bridge.group.userData.presence;return{loaded:e.status.loaded,error:e.status.error,visible:e.mesh.visible,age:e.age};});assert.ok(preparedPresence.loaded&&!preparedPresence.error&&!preparedPresence.visible&&preparedPresence.age===0,'presence is prepared and hidden below the closed floor');
  const imageRequests=()=>requests.filter(u=>/\.(webp|jpg|png)(?:\?|$)/.test(u)).length,loadedImages=imageRequests();
  await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(4.3,1/60));await page.keyboard.up('KeyW');
  const beginning=await page.evaluate(()=>({z:__g.player.pos.z,state:__g.wh.bridge.state,pitch:__g.player.pitch,left:__g.wh.bridge.left}));
  assert.equal(beginning.state,'opening');assert.ok(beginning.z<-406.2&&beginning.left>0);assert.equal(beginning.pitch,before.pitch);
  await shot('02-pavimento-scende',-.25);
  await page.evaluate(()=>{for(let i=0;i<120&&__g.wh.bridge.left<2.7;i++)__g.sim(1/60,1/60);});await shot('02b-pavimento-si-consuma',-.65,.7);
  await page.evaluate(()=>{for(let i=0;i<120&&__g.wh.bridge.left<4;i++)__g.sim(1/60,1/60);});await shot('02c-fratture-nel-vuoto',-.65,.7);
  await page.evaluate(()=>__g.sim(4.8,1/60));
  const open=await page.evaluate(()=>({left:__g.wh.bridge.left,right:__g.wh.bridge.right,state:__g.wh.bridge.state,sister:__g.wh.sorella.state,stats:__g.wh.bridge.stats}));
  assert.equal(open.state,'open');assert.equal(open.left,8);assert.equal(open.right,8);assert.equal(open.sister,'idle','apparitions wait for the spatial event');
  const stars=await page.evaluate(()=>{const s=__g.wh.bridge.group.getObjectByName('abisso-stelle');return{count:s.geometry.attributes.position.count,opacity:s.material.opacity,map:!!s.material.map};});
  assert.ok(stars.count<=700&&stars.opacity>.8&&!stars.map,'the void uses one static starfield and no new image');
  await shot('03-ponte-aperto',-.30);await shot('04-abisso-sinistro',-.80,.85);await shot('05-abisso-destro',-.75,-.85);
  const nebula=await page.evaluate(()=>{const e=__g.wh.bridge.group.userData.presence;return{age:e.age,life:e.uniforms.uPresenceLife.value,opacity:e.mesh.material.opacity,visible:e.mesh.visible,depth:e.mesh.position.y};});assert.ok(nebula.visible&&nebula.opacity>0&&nebula.depth<-17&&nebula.life<.5,'initially a faint, distant nebula');
  const after=await page.evaluate(()=>({programs:__g.renderer.info.programs.length,images:__g.renderer.info.memory.textures}));
  assert.equal(imageRequests(),loadedImages,'no image loading during the transformation');
  assert.equal(after.programs,before.programs,'no first-use shader compilation during the transformation');
  assert.equal(after.images,before.images,'no first-use texture uploads during the transformation');
  await page.evaluate(()=>{__g.player.yaw=0;__g.player.pitch=0;__g.sim(.05);});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:85,y:700}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:85,y:654}]});
  await page.waitForTimeout(100);const touchStart=await page.evaluate(()=>__g.player.pos.z);await page.evaluate(()=>__g.sim(2.4,1/60));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const middle=await page.evaluate(()=>({z:__g.player.pos.z,y:__g.player.pos.y}));assert.ok(middle.z<touchStart-2);assert.equal(middle.y,1.62);
  await shot('07-profondita',-.85,.95);
  await page.evaluate(()=>__g.player.pos.x=-.55);await shot('08-vuoto-stellato',-1.02,Math.PI/2);
  async function rawFaceShot(name){const png=await page.evaluate(()=>{const g=__g;g.renderer.setPixelRatio(1);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld(true);g.renderer.render(g.scene,g.camera);return g.renderer.domElement.toDataURL('image/png').split(',')[1];});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));}
  const anchoring=await page.evaluate(()=>{
   const g=__g,e=g.wh.bridge.group.userData.presence,u=g.wh.bridge.group.userData.universe,yaw=g.player.yaw,pitch=g.player.pitch;
   g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld(true);const matrix=e.mesh.matrixWorld.toArray(),age=e.age,point=new g.THREE.Vector3().setFromMatrixPosition(e.mesh.matrixWorld),before=point.clone().project(g.camera);
   g.player.yaw+=.35;g.player.pitch+=.12;g.player.update(0,0);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld(true);const after=point.clone().project(g.camera),delta=Math.max(...e.mesh.matrixWorld.toArray().map((v,i)=>Math.abs(v-matrix[i])));
   g.player.yaw=yaw;g.player.pitch=pitch;g.player.update(0,0);g.scene.updateMatrixWorld(true);
   return{worldDelta:delta,projectionShift:before.distanceTo(after),ageDelta:e.age-age,stellarParent:e.mesh.parent===u,faceStrength:e.uniforms.uFaceShadow.value};
  });
  assert.equal(anchoring.worldDelta,0);assert.equal(anchoring.ageDelta,0);assert.ok(anchoring.projectionShift>.05&&anchoring.stellarParent,'camera look changes projection while the cloud stays in the universe');assert.ok(anchoring.faceStrength>0&&anchoring.faceStrength<=.1);
  await page.evaluate(()=>__g.wh.bridge.group.userData.presence.uniforms.uFaceShadow.value=0);await rawFaceShot('08a-nube-senza-ombre');
  await page.evaluate(v=>__g.wh.bridge.group.userData.presence.uniforms.uFaceShadow.value=v,anchoring.faceStrength);await rawFaceShot('08b-nube-ombre-appena-accennate');
  const motion=await page.evaluate(()=>{const g=__g,universe=g.wh.bridge.group.userData.universe,s=g.wh.bridge.group.getObjectByName('abisso-stelle'),entity=g.wh.bridge.group.userData.presence,life=entity.uniforms.uPresenceLife.value,ev=entity.mesh.geometry.attributes.position.version,em=entity.mesh.material.version,localPose=(entity.mesh.updateMatrix(),entity.mesh.matrix.toArray()),angle=universe.rotation.y,version=s.geometry.attributes.position.version,material=s.material.version,p=g.player.pos.clone(),yaw=g.player.yaw,pitch=g.player.pitch;let min=1,max=0;for(let i=0;i<300;i++){g.sim(1/60,1/60);min=Math.min(min,s.material.color.r);max=Math.max(max,s.material.color.r);}return{angle:universe.rotation.y-angle,min,max,buffersUnchanged:version===s.geometry.attributes.position.version,materialUnchanged:material===s.material.version,presence:{lifeBefore:life,lifeAfter:entity.uniforms.uPresenceLife.value,opacity:entity.mesh.material.opacity,anchored:entity.mesh.parent===universe&&(entity.mesh.updateMatrix(),entity.mesh.matrix.toArray().every((v,i)=>Math.abs(v-localPose[i])<1e-9)),buffersUnchanged:ev===entity.mesh.geometry.attributes.position.version,materialUnchanged:em===entity.mesh.material.version},playerMoved:p.distanceTo(g.player.pos),yawChanged:g.player.yaw-yaw,pitchChanged:g.player.pitch-pitch};});
  assert.ok(motion.angle>.05&&motion.max-motion.min>.05,'visible slow rotation and light pulsation');assert.ok(motion.buffersUnchanged&&motion.materialUnchanged);assert.equal(motion.playerMoved,0);assert.equal(motion.yawChanged,0);assert.equal(motion.pitchChanged,0);
  assert.ok(motion.presence.lifeAfter>motion.presence.lifeBefore&&motion.presence.lifeAfter>.8&&motion.presence.buffersUnchanged&&motion.presence.materialUnchanged&&motion.presence.anchored,'a living silhouette gradually emerges without camera intervention or vertex uploads');
  await shot('09-stelle-dopo-movimento',-1.02,Math.PI/2);await page.evaluate(()=>__g.player.pos.x=.3);
  await page.evaluate(()=>{__g.player.yaw=0;__g.player.pitch=0;__g.sim(.05);});
  await page.evaluate(()=>__g.sim(.2));assert.equal(await page.evaluate(()=>__g.player.pos.z),middle.z,'release stops on the bridge');
  await page.keyboard.down('KeyD');await page.evaluate(()=>__g.sim(1.8,1/60));await page.keyboard.up('KeyD');
  const edge=await page.evaluate(()=>__g.player.pos.x);assert.ok(edge>.5&&edge<=.730001,'touch player cannot walk off the edge');
  await page.keyboard.down('KeyS');await page.evaluate(()=>__g.sim(.7,1/60));await page.keyboard.up('KeyS');assert.ok(await page.evaluate(()=>__g.player.pos.z)>middle.z+.5);
  await shot('06-sul-ponte',-.35,0);
  await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(6,1/60));await page.keyboard.up('KeyW');
  await page.evaluate(()=>__g.sim(4,1/60));
  const restored=await page.evaluate(()=>({state:__g.wh.bridge.state,left:__g.wh.bridge.left,controller:!__g.wh.bridge.ownsController}));
  assert.equal(restored.state,'done');assert.equal(restored.left,0);assert.ok(restored.controller);
  await page.evaluate(()=>{__g.player.pos.set(.3,1.62,-417);__g.player.yaw=0;__g.sim(.05);});
  await page.keyboard.down('KeyA');await page.evaluate(()=>__g.sim(3,1/60));await page.keyboard.up('KeyA');assert.ok(await page.evaluate(()=>__g.player.pos.x)<-3.8,'wall note stays reachable after crossing');
  await page.evaluate(()=>{const g=__g;g.player.pos.set(.3,1.62,-425);g.wh.take('axe');g.wh.openGate();g.sim(.2);});
  assert.equal(await page.evaluate(()=>__g.flags.weapon),'axe');assert.equal(await page.evaluate(()=>__g.wh.state),'open');
  await page.evaluate(()=>{const g=__g;g.player.pos.set(.1,1.62,-435);g.player.yaw=0;g.sim(.1);});
  await page.keyboard.down('KeyW');await page.evaluate(()=>__g.sim(1.8,1/60));await page.keyboard.up('KeyW');
  assert.equal(await page.evaluate(()=>__g.story.current()),'tower');assert.ok(await page.evaluate(()=>!__g.wh.bridge?.ownsController));
  await page.evaluate(()=>__g.story.goto('warehouse',true));await page.waitForFunction(()=>!__g.story.busy(),null,{timeout:180000});
  assert.equal(await page.evaluate(()=>__g.wh.bridge.state),'idle');assert.equal(await page.evaluate(()=>__g.wh.bridge.left),0);
  assert.equal(await page.evaluate(()=>__g.wh.bridge.group.getObjectByName('abisso-stelle').material.opacity),0,'no stars leak through the reset floor');
  assert.equal(await page.evaluate(()=>__g.wh.bridge.group.userData.universe.rotation.y),0,'motion resets at reentry');
  assert.equal(await page.evaluate(()=>__g.wh.bridge.group.userData.presence.mesh.visible),false);assert.equal(await page.evaluate(()=>__g.wh.bridge.group.userData.presence.age),0);
  await enter('&ponte=0');assert.equal(await page.evaluate(()=>__g.wh.bridge),null);
  assert.equal(await page.evaluate(()=>__g.scene.getObjectByName('pozzo-sotto-il-ponte')!=null),false);assert.ok(await page.evaluate(()=>!__g.wh.bridge?.ownsController));
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  const result={result:'PASS',before,preparedPresence,beginning,open,stars,nebula,after,anchoring,motion,middle,edge,restored,errors,bad,checks:['real descending floor and anchored props','starfield and eroding material','preloaded presence pinned to the stellar frame, gaze-independent reveal and subtle shadows','rotation/pulsation without vertex uploads or camera movement','no auto pitch','touch forward, stop, strafe limit and backwards','note, weapon and tower path intact','reset and feature flag'],performance:'Software Chromium; Android FPS not measured'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
