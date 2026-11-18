import * as THREE from 'three';
import { createControls } from '../../js/player/controls.js';
import { createAdaptiveResolution } from '../../js/render/quality.js';
import { FoldPath,FoldSequence,FoldWalker,FOLD } from './path.js';
import { createCorridor } from './corridor.js';
import { createFoldAudio } from './audio.js';

export async function startLab(flags) {
  const $=id=>document.getElementById(id),canvas=$('gl');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',alpha:false});
  let ratio=Math.min(devicePixelRatio,1.15);
  renderer.setPixelRatio(ratio);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const adaptive=createAdaptiveResolution(ratio,.7);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x050a08);
  scene.fog=new THREE.FogExp2(0x050a08,.047);
  const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.05,42);scene.add(camera);
  const path=new FoldPath(),sequence=new FoldSequence(true,flags.reduced),walker=new FoldWalker(path,flags.reduced);
  const controls=createControls(canvas),audio=createFoldAudio();
  const hemi=new THREE.HemisphereLight(0x6b9988,0x0c100c,.72);scene.add(hemi);
  const torch=new THREE.SpotLight(0xffeed7,29,23,.62,.8,1.8);
  torch.position.set(.12,-.10,0);torch.target.position.set(0,-.18,-4);camera.add(torch,torch.target);
  const pool=[0,1].map(()=>{const l=new THREE.PointLight(0xb5ddc9,0,10,1.8);scene.add(l);return l;});
  const manager=new THREE.LoadingManager();
  manager.onProgress=(_,loaded,total)=>{$('status').textContent=`Preparazione del reparto · ${loaded}/${total}`;};
  const corridor=await createCorridor(scene,path,manager);
  const frame={},floorQuaternion=new THREE.Quaternion(),lookQuaternion=new THREE.Quaternion();
  const xAxis=new THREE.Vector3(1,0,0),euler=new THREE.Euler(0,0,0,'YXZ');
  let running=false,started=false,lost=false,manual=false,last=0,request=0,disposed=false;
  let frames=0,seconds=0,publishedPhase='',audioError=false;
  const timings=[],on=(el,type,handler,options)=>el.addEventListener(type,handler,options);
  function resize() {
    renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;
    camera.fov=camera.aspect<.8?68:58;camera.updateProjectionMatrix();adaptive.reset();
  }
  on(window,'resize',resize);resize();
  function pose() {
    const p=walker.pose;
    camera.position.set(p.x,p.y,p.z);
    floorQuaternion.setFromAxisAngle(xAxis,p.followAngle);
    lookQuaternion.setFromEuler(euler.set(p.pitch,p.yaw,0));
    camera.quaternion.copy(floorQuaternion).multiply(lookQuaternion);
    // Two fixed light slots, selected by floor distance. Positions follow the fold.
    const nearest=[...corridor.lampPositions].sort((a,b)=>Math.abs(a.s-walker.s)-Math.abs(b.s-walker.s));
    nearest.slice(0,2).forEach((a,i)=>{
      path.point(a.x,a.y,a.s,frame);pool[i].position.set(frame.x,frame.y,frame.z);
      pool[i].intensity=6.2;
    });
  }
  function step(dt,axes,look) {
    // One ordered update: shape -> shared path -> walker -> camera -> sound.
    const angle=sequence.update(dt,walker.s),changed=path.setAngle(angle);
    if(changed)corridor.update();
    const moved=walker.update(dt,axes??controls.axes(),look??controls.consumeLook());
    pose();audio.update(dt,sequence,moved);
    const phase=sequence.finished?'complete':sequence.phase;
    if(phase!==publishedPhase) {
      publishedPhase=phase;
      const text={idle:'Avanza nel reparto. Puoi sempre tornare indietro.',warning:'',folding:'',stable:'La struttura si è fermata. Continua.',complete:'Tratto stabile raggiunto. Puoi esplorare o tornare indietro.'};
      $('hint').textContent=text[phase];
    }
  }
  function render() {renderer.render(scene,camera);}
  function loop(now) {
    if(disposed)return;
    request=requestAnimationFrame(loop);
    const elapsed=last?(now-last)/1000:1/60;last=now;
    if(running&&!manual) {
      // No catch-up teleport after suspended tabs or a slow frame.
      const dt=Math.min(.05,Math.max(0,elapsed));step(dt);
      if(flags.debug&&timings.length<3600)timings.push(elapsed*1000);
      const change=adaptive.sample(elapsed);
      if(change?.ratio!=null) {ratio=change.ratio;renderer.setPixelRatio(ratio);resize();}
    }
    if(!lost&&!manual&&(running||!started))render();
    if(flags.debug&&!manual) {
      frames++;seconds+=elapsed;
      if(seconds>1) {
        $('metrics').textContent=`${Math.round(frames/seconds)} fps · ${renderer.info.render.calls} draw · ${renderer.info.render.triangles} tri · DPR ${ratio.toFixed(2)}\ns ${walker.s.toFixed(1)} m · ${(sequence.angle*180/Math.PI).toFixed(1)}° · ${sequence.phase}`;
        frames=seconds=0;
      }
    }
  }
  function clearInput() {
    controls.keys.clear();controls.move.x=controls.move.y=controls.look.x=controls.look.y=0;
    // Reset pointer ownership in the existing controller as well as its axes.
    window.dispatchEvent(new Event('blur'));
    $('stick').style.opacity=0;
  }
  function pause() {
    if(!running)return;
    running=false;controls.enabled=false;clearInput();audio.pause().catch(()=>{});adaptive.reset();
    $('overlay').hidden=false;$('status').textContent='In pausa. Nessun movimento continua in sottofondo.';
    $('start').textContent='Riprendi';$('restart').hidden=false;$('pause').hidden=true;
  }
  async function begin() {
    if(lost||disposed)return;
    $('start').disabled=true;
    walker.reduced=sequence.reduced=$('reduced').checked;audio.setMuted(!$('sound').checked);
    try {await audio.unlock();}catch(error){audioError=true;console.warn('Audio non disponibile',error);}
    clearInput();running=started=true;controls.enabled=true;last=0;
    $('overlay').hidden=true;$('pause').hidden=false;$('crosshair').hidden=false;$('start').disabled=false;
    if(audioError)$('hint').textContent='Audio non disponibile; il movimento resta attivo.';
  }
  on($('start'),'click',begin);on($('pause'),'click',pause);
  on($('restart'),'click',()=>{
    sequence.reset();path.setAngle(0);corridor.update();walker.reset();pose();audio.reset();
    publishedPhase='';begin();
  });
  on(window,'blur',()=>{if(running)pause();});
  on(document,'visibilitychange',()=>{if(document.hidden)pause();});
  on(window,'keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    if(e.code==='Escape')pause();
  });
  on(canvas,'contextmenu',e=>e.preventDefault());
  on(canvas,'webglcontextlost',e=>{
    e.preventDefault();pause();lost=true;
    $('overlay').hidden=false;$('status').textContent='La grafica è stata sospesa dal dispositivo. Ricarica la pagina per riprovare.';
    $('start').hidden=$('restart').hidden=true;
  });
  on(canvas,'webglcontextrestored',()=>{$('status').textContent='Grafica ripristinata. Ricarica la pagina per ricominciare la prova.';});
  pose();
  // Upload and compile everything before allowing entry: no asset loading mid-fold.
  scene.traverse(o=>{
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)
      for(const value of Object.values(m))if(value?.isTexture)renderer.initTexture(value);
  });
  await renderer.compileAsync(scene,camera);render();
  $('status').textContent='Un corridoio reale. Una struttura che non dovrebbe reggere.';
  $('instructions').hidden=false;$('start').hidden=false;$('metrics').hidden=!flags.debug;
  if(flags.debug) {
    window.__spaceFold={renderer,scene,camera,path,walker,sequence,corridor,controls,audio,timings,
      set manual(value){manual=value;},get running(){return running;},
      step(dt,axes={x:0,y:0},look={x:0,y:0}){step(Math.min(.05,dt),axes,look);render();},
      advance(frames,dt,axes={x:0,y:0}) {for(let i=0;i<frames;i++)step(Math.min(.05,dt),axes,{x:0,y:0});render();},
      render,pause,snapshot:()=>({phase:sequence.phase,angle:sequence.angle,s:walker.s,x:walker.x,
        pose:{...walker.pose},ratio,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,audio:audio.state})};
  }
  request=requestAnimationFrame(loop);
  on(window,'pagehide',event=>{
    // BFCache keeps the JS realm: preserve resources and resume through the menu.
    if(event.persisted){pause();return;}
    disposed=true;cancelAnimationFrame(request);audio.dispose();
    const geometries=new Set(),materials=new Set(),maps=new Set();
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of maps)t.dispose();renderer.dispose();
  });
}
