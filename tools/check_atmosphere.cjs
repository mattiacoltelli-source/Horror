// node --experimental-vm-modules tools/check_atmosphere.cjs
// Real Three geometry/materials, deterministic lifecycle, no GPU required.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
  const T=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
  let canvases=0;
  const context=vm.createContext({console,document:{createElement(){canvases++;return {getContext(){return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}}});
  const three=new vm.SyntheticModule(Object.keys(T),function(){for(const[k,v]of Object.entries(T))this.setExport(k,v);},{context}),cache=new Map();
  async function load(file){
    if(cache.has(file))return cache.get(file);
    const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
    await m.link(s=>s==='three'?three:load(path.resolve(path.dirname(file),s)));return m;
  }
  const m=await load(path.join(root,'js/world/crowd-fog.js'));await m.evaluate();
  const normal=m.namespace.createCrowdFog(),reduced=m.namespace.createCrowdFog({reduced:true,lowQuality:true});
  assert.equal(canvases,1,'one shared procedural stamp, including multiple quality modes');
  assert.equal(normal.count,192);assert.equal(reduced.count,128);
  assert.equal(normal.mesh.material.uniforms.uMap.value,reduced.mesh.material.uniforms.uMap.value);
  assert.equal(reduced.mesh.material.uniforms.uMotion.value,0);
  assert.equal(normal.metrics.drawCalls,1);assert.equal(normal.metrics.triangles,896);
  assert.equal(reduced.metrics.triangles,544);
  assert.equal(normal.mesh.material.uniforms.uCeiling.value,.5,'world-space fog ceiling remains half a metre even while looking down');
  const g=normal.mesh.geometry,a=g.attributes.position;
  for(let i=0;i<normal.baseVertices;i++){
    assert.ok(Math.abs(a.getX(i))<5.901&&a.getZ(i)<-50.59&&a.getZ(i)>-90.21);
    assert.ok(Math.abs(a.getY(i)-.025)<1e-6);
    assert.equal(g.attributes.aBase.getX(i),1);
  }
  let area=0;for(let i=0;i<g.index.count;i+=3){const p=g.index.getX(i),q=g.index.getX(i+1),r=g.index.getX(i+2);if(p>=normal.baseVertices)continue;
    area+=Math.abs((a.getX(q)-a.getX(p))*(a.getZ(r)-a.getZ(p))-(a.getX(r)-a.getX(p))*(a.getZ(q)-a.getZ(p)))/2;}
  assert.ok(Math.abs(area-11.8*39.6)<.01,'continuous undercoat fills the whole floor, without gaps between wisps');
  for(let i=normal.baseVertices;i<a.count;i++){
    assert.equal(g.attributes.aBase.getX(i),0);
    assert.ok(g.attributes.aAnchor.getY(i)>.06&&g.attributes.aAnchor.getY(i)<.21);
    assert.ok(g.attributes.aShape.getX(i)>3.39&&g.attributes.aShape.getY(i)>1,'large soft overlaps remove isolated spots');
  }
  normal.track(0,0,-76);normal.update(1/60,1,1);assert.equal(normal.weights[0],0,'first placement creates no false wake');
  normal.track(0,0,-64);normal.update(1/60,1,1);
  assert.deepEqual(normal.paths[0].toArray(),[0,-76,0,-64]);assert.ok(normal.weights[0]>.98&&normal.mesh.visible);
  const wake=normal.weights[0],time=normal.mesh.material.uniforms.uTime.value;
  normal.update(0,1,1);assert.equal(normal.weights[0],wake);assert.equal(normal.mesh.material.uniforms.uTime.value,time,'pause preserves mist state');
  normal.track(0,0,-64);normal.update(4,1,1);assert.ok(normal.weights[0]<.1,'fog closes behind the stopped actor');
  normal.update(.1,0,1);assert.equal(normal.mesh.visible,false,'no luminous mist during blackout');
  normal.reset();normal.track(0,1,-57.5);normal.update(.1,1,1);assert.equal(normal.weights[0],0,'reentry has no stale trail');
  normal.track(15,0,0);normal.update(.1,1,100);assert.equal(normal.mesh.material.uniforms.uCount.value,15,'bounded actor uniforms');
  let uploads=0,compiles=0;const renderer={initTexture(t){assert.equal(t,normal.mesh.material.uniforms.uMap.value);uploads++;},async compileAsync(mesh){assert.equal(mesh,normal.mesh);compiles++;}};
  await normal.prepare(renderer,new T.Camera(),new T.Scene());await normal.prepare(renderer,new T.Camera(),new T.Scene());
  assert.equal(uploads,1);assert.equal(compiles,1,'preparation is reused');
  // This task expressly defers the mural and adds no external asset, renderer,
  // camera, controller, light or collision changes.
  const base='eea175bc42bafee6f2764de5310a6bff43560dc0';
  const protectedPaths=['assets/','vendor/','js/player/','js/render/','js/world/painted-mural.js','js/world/decor.js','js/events/door.js','js/events/side-fold.js','js/pwa.js','css/','index.html'];
  assert.equal(cp.execFileSync('git',['diff',base,'--',...protectedPaths],{cwd:root,encoding:'utf8'}),'');
  for(const file of ['js/events/notes.js','js/story.js','js/narrative-copy.js','index.html'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/\bcane\b|hound|mural_dog/i);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'index.html'),'utf8'),/class="credits"/);
  console.log(JSON.stringify({result:'PASS',fog:{wisps:192,lowQuality:128,baseLayers:1,drawCalls:1,ceiling:.5,continuousArea:area,sharedTexture:true,reactiveTrail:true,blackout:true,reentry:true,reducedMotion:true},scope:'mural, assets, controls, lights, collisions and sequences unchanged; no dog text or initial credits'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
