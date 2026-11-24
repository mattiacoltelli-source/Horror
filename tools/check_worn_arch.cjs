// node --experimental-vm-modules tools/check_worn_arch.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js'))),context=vm.createContext({console});
 const three=new vm.SyntheticModule(Object.keys(THREE),function(){for(const [k,v]of Object.entries(THREE))this.setExport(k,v);},{context}),cache=new Map();
 async function at(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context});cache.set(file,m);await m.link(s=>s==='three'?three:at(path.resolve(path.dirname(file),s)));return m;}
 const module=await at(path.join(root,'js/world/worn-arch.js'));await module.evaluate();
 const stone=new THREE.MeshStandardMaterial(),results=[];
 for(const side of [-1,1]){
  const group=module.namespace.createWornArch({stone,side,wallX:1.4,centerZ:-4.5,radius:.7,spring:1.38,seed:7});group.updateMatrixWorld(true);
  assert.equal(group.children.length,1,'stone and recessed joints remain one batch');
  const mesh=group.children[0],g=mesh.geometry,triangles=g.attributes.position.count/3;
  assert.ok(triangles<2500,'arch triangle budget');
  for(const name of ['position','normal','uv','color'])for(const n of g.attributes[name].array)assert.ok(Number.isFinite(n));
  for(let i=0;i<g.attributes.normal.count;i++){
   const n=g.attributes.normal;assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'valid surface normals');
  }
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(side,0,0);
  for(const y of [.1,.8,1.62])for(const z of [-.48,0,.48]){
   ray.set(new THREE.Vector3(0,y,-4.5+z),direction);assert.equal(ray.intersectObject(group,true).length,0,'walkable opening remains clear');
  }
  for(const [y,z]of [[.6,.88],[.6,-.88],[1.38+.87,0],[1.38+.85*Math.sin(.7),.85*Math.cos(.7)]]){
   ray.set(new THREE.Vector3(0,y,-4.5+z),direction);assert.ok(ray.intersectObject(group,true).length>0,'stone/joint backing has solid visible faces');
  }
  assert.ok(mesh.material.color.r<.7&&mesh.material.roughness===1);
  results.push({side,triangles,draws:group.children.length});mesh.geometry.dispose();mesh.material.dispose();
 }
 console.log(JSON.stringify({result:'PASS',arches:results,opening:'clear',stoneAndJoints:'opaque',normals:'valid'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
