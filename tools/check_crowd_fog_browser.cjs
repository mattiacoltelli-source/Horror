// ATMOSPHERE_BASE_URL=http://127.0.0.1:8214/ node tools/check_crowd_fog_browser.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.ATMOSPHERE_BASE_URL||'http://127.0.0.1:8214/',out=process.env.CROWD_FOG_EVIDENCE||'/tmp/horror-atmosphere-hall';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    await context.addInitScript(()=>localStorage.setItem('ng_quality','mid'));
    const page=await context.newPage(),errors=[],bad=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
    await page.goto(base+'?base=1&debug=1&start=porta',{waitUntil:'networkidle',timeout:90000});
    await page.evaluate(()=>__g.hold=true);await page.locator('#enter').click();
    await page.waitForFunction(()=>__g.hall?.ready&&document.getElementById('intro').classList.contains('hidden'),null,{timeout:120000});
    const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{const g=__g;g.player.pos.set(.1,1.62,-46);g.player.yaw=0;g.player.pitch=-.07;g.say.reset();g.sim(4.9);
      // Cross the doorway before capturing: the door must be behind the player.
      g.player.pos.z=-52.1;g.sim(.1);
    });
    await frame();
    const first=await page.evaluate(()=>({state:__g.door.state,phase:__g.door.getPh(),visible:__g.hall.fog.mesh.visible,count:__g.hall.fog.count,weight:Math.max(...__g.hall.fog.weights),rise:__g.hall.fog.mesh.material.uniforms.uRise.value,ceiling:__g.hall.fog.mesh.material.uniforms.uCeiling.value}));
    assert.equal(first.state,'lit');assert.equal(first.phase,0);assert.ok(first.visible);assert.equal(first.count,192);assert.equal(first.weight,0);
    assert.ok(first.rise>0&&first.rise<.2,'first appearance is still near the floor');assert.equal(first.ceiling,.7);
    await page.screenshot({path:path.join(out,'01-folla-lontana.png')});
    const middle=await page.evaluate(()=>{for(let i=0;i<60&&__g.hall.fog.mesh.material.uniforms.uRise.value<.5;i++)__g.sim(.05);return __g.hall.fog.mesh.material.uniforms.uRise.value;});
    assert.ok(middle>=.5&&middle<.53);await frame();await page.screenshot({path:path.join(out,'01b-nebbia-a-meta-salita.png')});
    const full=await page.evaluate(()=>{for(let i=0;i<60&&__g.hall.fog.mesh.material.uniforms.uRise.value<1;i++)__g.sim(.05);return {rise:__g.hall.fog.mesh.material.uniforms.uRise.value,phase:__g.door.getPh()};});
    assert.equal(full.rise,1);assert.equal(full.phase,0);await frame();await page.screenshot({path:path.join(out,'01c-nebbia-fino-al-ginocchio.png')});
    const move=await page.evaluate(()=>{
      const g=__g,f=g.hall.fog,anchors=Array.from(f.mesh.geometry.attributes.position.array);
      for(let i=0;i<100&&g.door.getPh()===0;i++)g.sim(.1);
      return {state:g.door.state,phase:g.door.getPh(),wake:Math.max(...f.weights),paths:f.paths.map(p=>p.toArray()),fixed:anchors.every((n,i)=>n===f.mesh.geometry.attributes.position.array[i])};
    });
    assert.equal(move.phase,1);assert.equal(move.state,'lit');assert.ok(move.wake>.93);assert.ok(move.fixed,'mist field stays in the room while monsters move');
    assert.ok(move.paths.every(p=>p[3]>p[1]+11.9),'all actual monsters advance through the field');
    await page.evaluate(()=>__g.sim(1.15));await frame();
    await page.screenshot({path:path.join(out,'02-nebbia-dietro-la-folla.png')});
    await page.evaluate(()=>{const g=__g;for(let i=0;i<40&&g.door.getPh()<2;i++)g.sim(.1);g.sim(.7);});await frame();
    assert.equal(await page.evaluate(()=>__g.door.getPh()),2);
    await page.screenshot({path:path.join(out,'02b-folla-vicina.png')});
    // Hold this existing stage only for comparison shots from the same player
    // camera. The unmodified event above has already performed a real approach.
    const render=await page.evaluate(()=>{
      const g=__g,f=g.hall.fog;g.door.state='over';g.hall.flick=0;g.hall.target=1;g.hall.update(.1,g.camera);
      const gl=g.renderer.getContext(),w=g.renderer.domElement.width,h=g.renderer.domElement.height;
      const pixels=()=>{const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
      g.renderer.render(g.scene,g.camera);const withFog={...g.renderer.info.render},a=pixels();
      f.mesh.visible=false;g.renderer.render(g.scene,g.camera);const without={...g.renderer.info.render},b=pixels();f.mesh.visible=true;
      const geometry=f.mesh.geometry,oldRange={...geometry.drawRange};let baseCount=0;
      while(baseCount<geometry.index.count&&geometry.index.getX(baseCount)<f.baseVertices)baseCount++;
      geometry.setDrawRange(0,baseCount);g.renderer.render(g.scene,g.camera);const floorOnly=pixels();
      geometry.setDrawRange(oldRange.start,oldRange.count);
      let changedPixels=0,covered=0,samples=0,floorDifference=0,floorPeak=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4,changed=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>2;
        if(changed)changedPixels++;
        if(y<h*.4&&x>w*.1&&x<w*.9){samples++;if(changed)covered++;
          for(let c=0;c<3;c++){const delta=Math.abs(floorOnly[i+c]-b[i+c]);floorDifference+=delta;floorPeak=Math.max(floorPeak,delta);}
        }
      }
      return {calls:withFog.calls-without.calls,triangles:withFog.triangles-without.triangles,wake:Math.max(...f.weights),changedPixels,floorCoverage:covered/samples,floorTintMean:floorDifference/(samples*3),floorTintPeak:floorPeak};
    });
    assert.equal(render.calls,1);assert.equal(render.triangles,896);
    assert.ok(render.changedPixels>40,'mist is actually visible from the player camera, not occluded behind the door');
    assert.ok(render.floorTintMean>0&&render.floorTintMean<12&&render.floorTintPeak<22,'the floor receives only a light haze, not an opaque white coat');
    await page.screenshot({path:path.join(out,'03-con-foschia.png')});
    await page.evaluate(()=>{__g.hall.fog.mesh.visible=false;__g.renderer.render(__g.scene,__g.camera);});
    await page.screenshot({path:path.join(out,'04-senza-foschia.png')});
    await page.evaluate(()=>{const g=__g;g.player.pitch=-.45;g.sim(.1);});await frame();
    await page.screenshot({path:path.join(out,'05-manto-sul-pavimento.png')});
    await page.evaluate(()=>{const g=__g;g.player.pitch=-.07;g.sim(.1);});await frame();
    const close=await page.evaluate(()=>{const g=__g;g.sim(4);const weight=Math.max(...g.hall.fog.weights);g.hall.lightOff();g.sim(.05);return {weight,dark:!g.hall.fog.mesh.visible,level:g.hall.fog.mesh.material.uniforms.uLevel.value};});
    assert.ok(close.weight<.1);assert.equal(close.dark,true);assert.equal(close.level,0);
    await page.evaluate(()=>{__g.hall.lightOn();__g.hall.flick=0;__g.sim(.2);});await frame();
    const shared=await page.evaluate(()=>__g.hall.fog.mesh.material.uniforms.uMap.value===__g.drainPresence.group.getObjectByName('fumo-istanzato').material.uniforms.uMap.value);
    assert.equal(shared,true);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
    const result={result:'PASS',first,middle,full,move,render,close,sharedTexture:shared,errors,bad,device:'software Chromium portrait; Android FPS requires physical device'};
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
