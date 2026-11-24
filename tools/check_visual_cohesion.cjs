// node --experimental-vm-modules tools/check_visual_cohesion.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
 const gradient=()=>({addColorStop(){}}),ctx={createRadialGradient:gradient,createLinearGradient:gradient,fillRect(){},beginPath(){},arc(){},fill(){}};
 const context=vm.createContext({console,Math:Object.assign(Object.create(Math),{random:()=>.5}),document:{createElement:()=>({width:0,height:0,getContext:()=>ctx})}});
 const three=new vm.SyntheticModule(Object.keys(THREE),function(){for(const[k,v]of Object.entries(THREE))this.setExport(k,v);},{context}),cache=new Map();
 async function at(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link(s=>s==='three'?three:at(path.resolve(path.dirname(file),s)));return m;}
 async function use(file){const m=await at(path.join(root,file));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
 const {buildRoom}=await use('js/world/rooms.js'),mats={};
 for(const k of ['brick','stone','floorA','floorB','mfloor'])mats[k]=new THREE.MeshStandardMaterial();
 const floors=[];
 for(const o of [{z0:-200,w:8,l:24,h:4.4,seed:23,floor:'floorA',dark:.85},{z0:-480,w:4,l:20,h:2.5,seed:61,floor:'mfloor',dark:.5},{z0:0,w:3.3,l:3.4,h:2.8,seed:819,floor:'floorB',dark:.72}]){
  const room=buildRoom(mats,o),g=room.group.children.find(m=>m.material===mats[o.floor]).geometry;
  const p=g.attributes.position,uv=g.attributes.uv,c=g.attributes.color,seen=new Map(),shades=new Set();
  assert.equal(p.count/3,Math.ceil(o.w/4)*Math.ceil(o.l/4)*2,'floor panel/triangle budget unchanged');
  for(let i=0;i<p.count;i++){
   const key=[p.getX(i),p.getY(i),p.getZ(i)].join(','),values=[uv.getX(i),uv.getY(i),c.getX(i),c.getY(i),c.getZ(i)];
   if(seen.has(key))assert.deepEqual(values,seen.get(key),'neighbouring panels share UVs and colour at every corner');
   else seen.set(key,values);
   shades.add(c.getX(i));assert.ok(c.getX(i)>0&&c.getX(i)<1);
  }
  assert.ok(shades.size>=3,'continuous broad floor variation remains visible');floors.push({floor:o.floor,triangles:p.count/3});
 }
 const {createLights}=await use('js/world/lights.js'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),lights=createLights(scene,camera);
 const pool=scene.children.filter(o=>o.isPointLight);assert.equal(pool.length,2);
 lights.setLamps([[0,2.38,0]],1);lights.update(0,0,0,0);
 const l=lights.lamps[0],p=pool[0],original=14*l.level,decay=1.8;
 const floorRatio=(p.intensity/Math.pow(p.position.y,decay))/(original/Math.pow(l.y,decay));
 const ceilingRatio=(p.intensity/Math.pow(2.5-p.position.y,decay))/(original/Math.pow(2.5-l.y,decay));
 assert.ok(Math.abs(floorRatio-1)<.05,'ground illumination remains within 5% of the original');
 assert.ok(ceilingRatio<.1,'near-ceiling hotspot reduced by at least 90%');
 assert.equal(p.castShadow,false);assert.equal(scene.children.filter(o=>o.isPointLight).length,2);
 lights.lamp(0,'off');lights.update(0,0,0,0);assert.equal(pool[0].intensity,0,'scripted blackouts still extinguish the pool');
 lights.setLamps([]);lights.update(0,0,0,0);assert.ok(pool.every(o=>o.intensity===0));
 const {addObjectContactShadow}=await use('js/world/contact-shadows.js');
 const parent=new THREE.Group();parent.position.set(7,0,-230);parent.rotation.y=.6;parent.scale.set(1.5,1,1.5);scene.add(parent);
 const prop=new THREE.Group();prop.position.set(2,0,-4);prop.rotation.y=.3;parent.add(prop);
 const box=new THREE.Mesh(new THREE.BoxGeometry(1,2,.5),mats.stone);box.position.y=1;prop.add(box);
 const shadow=addObjectContactShadow(parent,prop);shadow.geometry.computeBoundingBox();
 const center=shadow.geometry.boundingBox.getCenter(new THREE.Vector3());
 assert.ok(Math.abs(center.x-2)<1e-5&&Math.abs(center.z+4)<1e-5&&Math.abs(center.y-.0018)<1e-6,'room preview transforms do not move the shadow away from its prop');
 const other=prop.clone();other.position.x=-2;parent.add(other);assert.equal(addObjectContactShadow(parent,other),shadow,'static props share the existing room batch');
 const attached=addObjectContactShadow(prop,prop);parent.updateMatrixWorld(true);
 const before=new THREE.Vector3().setFromMatrixPosition(attached.matrixWorld);prop.position.z+=1;parent.updateMatrixWorld(true);
 const after=new THREE.Vector3().setFromMatrixPosition(attached.matrixWorld);assert.ok(Math.abs(after.distanceTo(before)-1.5)<1e-6,'moving props carry their contact shadow');
 assert.equal(attached.material,shadow.material,'no duplicate shadow texture/material');
  const scaled=new THREE.Group();scaled.position.set(0,.3,0);scaled.scale.setScalar(.4);parent.add(scaled);
  scaled.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,.5),mats.stone));
  const scaledShadow=addObjectContactShadow(scaled,scaled,{floorParent:parent});parent.updateMatrixWorld(true);
  scaledShadow.geometry.computeBoundingBox();const local=scaledShadow.geometry.boundingBox.getCenter(new THREE.Vector3());
  local.applyMatrix4(scaledShadow.matrixWorld);assert.ok(local.y>0&&local.y<.003,'normalised furniture scale and pivot must not lift its shadow off the floor');
  const ward=new THREE.Group(),chair=new THREE.Group();chair.position.z=-8;ward.add(chair);scene.add(ward);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.8,.5,1.4),mats.stone.clone());seat.position.y=.5;seat.userData.keepParent=true;chair.add(seat);
  const movingShadow=addObjectContactShadow(chair,chair,{floorParent:ward});
  assert.equal(movingShadow.material,shadow.material);
  const {createBend}=await use('js/world/bend.js'),bend=createBend({group:ward,z0:0,camera,lights:{}});bend.refresh();
  assert.equal(movingShadow.parent,chair,'bend preparation must not detach a moving contact patch');
  assert.equal(seat.parent,chair,'the same preparation preserves the moving furniture itself');
  assert.notEqual(movingShadow.material,shadow.material);assert.equal(movingShadow.material.map,shadow.material.map);
  assert.equal(movingShadow.material.userData.bendPatched,true,'contact patch receives the same geometric bend');
  assert.ok(!shadow.material.userData.bendPatched,'ward shader changes stay out of other rooms');
 shadow.onBeforeRender(null,null,{userData:{planarReflection:true}});assert.equal(shadow.material.opacity,0);
 shadow.onBeforeRender(null,null,{userData:{}});assert.equal(shadow.material.opacity,1);
 const {addAtmosphere}=await use('js/world/atmos.js'),wetGroup=new THREE.Group();
 addAtmosphere(wetGroup,{xl:-4,xr:4,z0:0,z1:-24,h:4.4,seed:3,puddles:5,stains:0,lamps:[]});
 const wet=wetGroup.children.filter(o=>o.userData.wetPatch),alpha=new Set();assert.equal(wet.length,5);
 for(const mesh of wet){assert.equal(mesh.material,wet[0].material);const c=mesh.geometry.attributes.color;assert.equal(c.itemSize,4);for(let i=0;i<c.count;i++){const a=c.getW(i);assert.ok(a>.4&&a<=1);alpha.add(a);}}
 assert.ok(alpha.size>5,'wetness varies without extra materials or texture downloads');
 console.log(JSON.stringify({result:'PASS',floors,illumination:{floorRatio,ceilingRatio,poolLights:2},contacts:'batched, preview-safe, follow furniture and hidden in reflections',wetness:'varied, one shared material'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
