// node tools/check_scene_preparation.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')).href);
 const source=fs.readFileSync(path.join(root,'js/render/scene.js'),'utf8');
 const {updateVisibleWorldMatrices:update,createScenePreparation:prepare}=new Function(source.replaceAll('export ', '')+';return {updateVisibleWorldMatrices,createScenePreparation};')();
 const scene=new THREE.Scene(),active=new THREE.Group(),inactive=new THREE.Group(),camera=new THREE.PerspectiveCamera(),light=new THREE.PointLight();
 scene.add(active,inactive,camera);active.add(light);inactive.visible=false;
 const geo=new THREE.BoxGeometry(1,1,1),map=new THREE.Texture({width:4,height:4,complete:true}),unloaded=new THREE.Texture({complete:false,width:4,height:4});
 const rt=new THREE.WebGLRenderTarget(4,4),material=new THREE.MeshStandardMaterial({map,normalMap:map,roughnessMap:unloaded});
 const moving=new THREE.Mesh(geo,material),hiddenChild=new THREE.Mesh(geo,material),off=new THREE.Mesh(geo,material);active.add(moving,hiddenChild);inactive.add(off);hiddenChild.visible=false;
 const glassLayer=new THREE.Mesh(geo,material);glassLayer.layers.set(1);active.add(glassLayer);
 scene.updateMatrixWorld(true);active.position.set(3,1,-200);active.rotation.y=.3;moving.position.set(2,.3,-4);hiddenChild.position.set(-1,1,2);inactive.position.z=-500;
 let inactiveUpdates=0;const native=inactive.updateMatrixWorld.bind(inactive);inactive.updateMatrixWorld=(...a)=>{inactiveUpdates++;native(...a);};
 update(scene);assert.equal(inactiveUpdates,0,'Le stanze inattive non aggiornano le matrici');
 const expected=[moving,hiddenChild,camera,light].map(o=>o.matrixWorld.toArray());
 scene.updateMatrixWorld(true);assert.deepEqual([moving,hiddenChild,camera,light].map(o=>o.matrixWorld.toArray()),expected,'Matrici uguali al percorso nativo, inclusi i figli invisibili degli specchi');
 inactive.visible=true;update(scene);assert.equal(off.matrixWorld.elements[14],-500,'Anteprime e rientri aggiornano subito le nuove coordinate');inactive.visible=false;
 const uploaded=[],compiled=[],parents=[moving.parent,hiddenChild.parent,off.parent];let release;
 const renderer={initTexture:t=>uploaded.push(t),compileAsync:(subset,cam,target)=>{
  assert.equal(target,scene);assert.equal(cam,camera);subset.traverse(o=>compiled.push(o));let extraLights=0;subset.traverseVisible(o=>{if(o.isLight)extraLights++;});assert.equal(extraLights,0,'Le luci non vengono contate due volte');
  return new Promise(resolve=>release=resolve);
 }};
 // Una texture di render target non puo' essere inizializzata come un'immagine.
 moving.material.uniforms={reflection:{value:rt.texture}};
 const run=prepare(renderer,scene,camera),first=run();assert.equal(first,run(),'Preparazioni concorrenti condividono il lavoro');
 assert.deepEqual(compiled,[moving]);assert.deepEqual(uploaded,[map]);assert.deepEqual([moving.parent,hiddenChild.parent,off.parent],parents,'Il warmup non riparenta gli oggetti');release();await first;
 compiled.length=0;uploaded.length=0;unloaded.image.complete=true;hiddenChild.visible=true;
 const second=run();assert.deepEqual(compiled,[moving,hiddenChild]);assert.deepEqual(uploaded,[unloaded],'Una texture caricata in ritardo viene preparata al giro successivo');release();await second;
 assert.equal(scene.children.includes(inactive),true);assert.equal(inactive.visible,false);
 console.log('Scene: matrici visibili, specchi, rientri, luci, texture e warmup concorrente verificati.');
})().catch(e=>{console.error(e);process.exit(1);});
