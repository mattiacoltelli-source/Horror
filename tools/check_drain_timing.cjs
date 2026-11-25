// node --experimental-vm-modules tools/check_drain_timing.cjs
// Exercise the actual encounter controller with normal walking, stalls,
// backwards movement, reduced motion and direct room entry.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
  const T=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
  const gradient={addColorStop(){}},ctx=new Proxy({createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},createRadialGradient(){return gradient;}},{get(target,key){return target[key]??(()=>{});}});
  const context=vm.createContext({console,document:{createElement(){return {getContext(){return ctx;}};}}});
  const three=new vm.SyntheticModule(Object.keys(T),function(){for(const[k,v]of Object.entries(T))this.setExport(k,v);},{context}),cache=new Map();
  async function load(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link(s=>s==='three'?three:load(path.resolve(path.dirname(file),s)));return m;}
  const module=await load(path.join(root,'js/events/drain-presence.js'));await module.evaluate();
  function encounter(reduced=false,z=-30){
    const player={pos:new T.Vector3(.1,1.62,z),forward:new T.Vector3(0,0,-1)};let sounds=0,stops=0;
    const d=module.namespace.createDrainPresence({scene:new T.Scene(),player,reduced,glass:{done:true},lights:{lamps:[{},{},{},{}],lamp(){}},
      audio:{wind(){sounds++;return {stop(){stops++;}};}}});
    return {d,player,counts:()=>({sounds,stops})};
  }
  const scenarios=[];
  const eyeStages=[];
  for(const reduced of [false,true])for(const fps of [5,10,30,60,120]){
    const {d}=encounter(reduced),eyes=d.group.getObjectByName('occhi-nel-fumo');
    for(let i=0;i<Math.ceil(3.1*fps)+2&&d.formed<1;i++){
      d.update(1/fps);assert.equal(eyes.material.opacity,0,'eyes stay dark through every rising frame');
    }
    assert.equal(d.formed,1);assert.equal(eyes.material.opacity,0);
    d.update(.14);assert.equal(eyes.material.opacity,0,'eyes wait until after the complete cloud');
    d.update(.16);assert.ok(eyes.material.opacity>0&&eyes.material.opacity<.3,'eyes fade in gently');
    d.update(.5);assert.ok(eyes.material.opacity>.3);
    eyeStages.push({fps,reduced});
  }
  for(const reduced of [false,true])for(const fps of [5,10,30,60,120]){
    const {d,player,counts}=encounter(reduced);d.update(3.2);assert.equal(d.state,'formed');
    let onset=null,previous=0,t=0,minVisibleDistance=100;
    while(d.state!=='gone'&&t<12){
      player.pos.z-=1.55/fps;t+=1/fps;d.update(1/fps);
      const distance=Math.hypot(player.pos.x-.3,player.pos.z+45);
      if(d.state==='dissolving'&&onset===null)onset=distance;
      if(d.group.visible)minVisibleDistance=Math.min(minVisibleDistance,distance);
      assert.ok(d.dissolved>=previous);previous=d.dissolved;
      assert.ok(d.group.getObjectByName('occhi-nel-fumo').position.y>1.88,'eyes never sink towards the grate');
    }
    const distance=Math.hypot(player.pos.x-.3,player.pos.z+45);
    assert.equal(d.state,'gone');assert.ok(onset>11.6&&onset<12);
    assert.ok(distance>5.8&&minVisibleDistance>6,'all visible frames remain far beyond two metres');
    assert.deepEqual(counts(),{sounds:1,stops:1});
    scenarios.push({fps,reduced,onset:+onset.toFixed(2),goneAt:+distance.toFixed(2)});
  }
  const stopped=encounter();stopped.d.update(3.2);stopped.player.pos.z=-33.2;stopped.d.update(.05);stopped.d.update(3.3);
  assert.equal(stopped.d.state,'gone','stopping does not stall the fade');
  const back=encounter();back.d.update(3.2);back.player.pos.z=-34;back.d.update(.2);const progress=back.d.dissolved;
  back.player.pos.z=-31;back.d.update(.1);assert.ok(back.d.dissolved>=progress,'walking backwards never reforms it');back.d.update(4);assert.equal(back.d.state,'gone');
  const shortcut=encounter(false,-40);shortcut.d.update(.1);assert.equal(shortcut.d.group.visible,false);assert.equal(shortcut.d.state,'gone');assert.equal(shortcut.counts().sounds,0);
  const jump=encounter();jump.d.update(3.2);jump.player.pos.z=-39.1;jump.d.update(.01);assert.equal(jump.d.state,'gone','a late arrival cannot reveal a nearby entity');
  console.log(JSON.stringify({result:'PASS',scenarios,eyeStages,eyesOnlyAfterFullRise:true,stop:true,backwards:true,shortcut:true,eyesStayHigh:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
