// node --experimental-vm-modules tools/check_warehouse_bridge.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
 let failNext=false;class TextureLoader{load(url,done,progress,error){assert.ok(url.startsWith('data:image/webp;base64,')&&url.length<150000,'small embedded image, no asset fetch');const texture=new THREE.Texture({width:512,height:512,complete:false}),fail=failNext;failNext=false;queueMicrotask(()=>{if(fail){error?.();return;}texture.image.complete=true;done?.(texture);});return texture;}}
 const api={...THREE,TextureLoader},context=vm.createContext({console}),three=new vm.SyntheticModule(Object.keys(api),function(){for(const[k,v]of Object.entries(api))this.setExport(k,v);},{context}),cache=new Map();
 async function at(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link(s=>s==='three'?three:at(path.resolve(path.dirname(file),s)));return m;}
 async function use(file){const m=await at(path.join(root,file));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
 const {buildRoom}=await use('js/world/rooms.js'),{createWarehouseBridge}=await use('js/events/warehouse-bridge.js');
 const {aged}=await use('js/world/aged.js'),agedProp=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());aged(agedProp);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};agedProp.material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.uAgeFloor,agedProp.material.userData.ageFloor);assert.ok(agedProp.material.uniforms.tRust,'custom maps are discoverable by the existing preparation pass');
 const mats={};for(const n of ['floorB','brick','stone'])mats[n]=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
 function fixture(reduced=false,narrationBusy=()=>false,renderer){
  const group=new THREE.Group(),room=buildRoom(mats,{z0:-400,w:12,l:36,h:6.5,floor:'floorB'});group.add(room.group);
  const p={pos:new THREE.Vector3(.3,1.62,-401.6),box:[-5.5,5.5,-429,-400.6],constrainMove:null},calls=[],lamps=[];
  const lights={addLamp(...args){const l={args};lamps.push(l);return l;},dropLamp(l){lamps.splice(lamps.indexOf(l),1);}};
  const bridge=createWarehouseBridge({group,room,mats,player:p,lights,renderer,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),z0:-400,width:12,reduced,narrationBusy,audio:{swell:(...a)=>calls.push(a),squeak:(...a)=>calls.push(a)}});
  bridge.reset();const floor=room.group.children.find(m=>m.geometry?.attributes.bridgeWing);return{group,room,p,bridge,floor,calls,lamps};
 }
 const f=fixture(),{p,bridge:b,group,floor}=f;
 const prop=(x,z,y=0)=>{const g=new THREE.Group();g.position.set(x,y,z);g.userData.supportHeight=y;const m=new THREE.Mesh(new THREE.BoxGeometry(.8,1.5,.8),mats.stone);m.position.y=.75;g.add(m);group.add(g);return g;};
 const rack=prop(4.8,-410),bed=prop(-4.8,-413),bust=prop(-4,-412,1.1);
 const anchored=mats.stone.clone();anchored.userData.ageFloor={value:0};rack.children[0].material=anchored;
 const poster=new THREE.Mesh(new THREE.PlaneGeometry(1,2),mats.brick);poster.position.set(-5.98,1.6,-410);poster.rotation.y=Math.PI/2;group.add(poster);
 b.update(.1,true);assert.equal(b.state,'idle');assert.ok(b.holdNarration);
 p.pos.set(.3,1.62,-407);b.update(.1,true);assert.equal(b.state,'opening');
 for(let t=0;t<5;t+=1/60)b.update(1/60,true);
 assert.equal(b.state,'open');assert.equal(b.left,8);assert.equal(b.right,8);
 assert.equal(f.lamps.length,0,'the mystical void adds no lights');assert.ok(b.group.getObjectByName('abisso-stelle').material.opacity>.8);assert.equal(anchored.userData.ageFloor.value,-8,'age pattern moves with the supported prop');
 const stars=b.group.getObjectByName('abisso-stelle');assert.equal(stars.material.map,null);assert.ok(stars.geometry.attributes.position.count<=700);
 const edgeGeometry=b.group.children[0].geometry,ep=edgeGeometry.attributes.position,en=edgeGeometry.attributes.normal;
 for(let i=0;i<ep.count;i+=6)if(Math.abs(en.getY(i))<.5){const ys=Array.from({length:6},(_,j)=>ep.getY(i+j));assert.ok(Math.abs(Math.max(...ys))<1e-6&&Math.abs(Math.min(...ys)+.22)<1e-6,'every perimeter and bridge face has the same 22 cm thickness');}
 assert.equal(b.group.children[0].material.map,mats.floorB.map,'rim reuses the floor albedo');assert.equal(stars.position.z,(b.config.start+b.config.end)/2,'rotation is centred under the bridge');
 const buffer=stars.geometry.attributes.position,bufferVersion=buffer.version,materialVersion=stars.material.version,angle=stars.rotation.y,brightness=stars.material.color.r;
 b.update(.37,true);assert.ok(stars.rotation.y>angle&&Math.abs(stars.material.color.r-brightness)>1e-5,'the field rotates and breathes even while floor depth is stable');
 assert.equal(buffer.version,bufferVersion);assert.equal(stars.material.version,materialVersion);assert.ok(stars.material.color.r>=.76&&stars.material.color.r<=1,'subtle continuous light range');
 for(let i=0;i<stars.geometry.attributes.position.count;i++)assert.ok(stars.geometry.attributes.position.getY(i)<-2,'starfield stays below the real floor');
 await b.group.userData.ready;const entity=b.group.userData.presence,vertexVersion=entity.mesh.geometry.attributes.position.version,entityMaterialVersion=entity.mesh.material.version;
 b.update(.1,true);assert.ok(entity.status.loaded&&entity.mesh.visible&&!entity.observed);assert.equal(entity.age,0);
 const playerBefore=p.pos.clone();p.pitch=-.8;b.update(3,true);assert.equal(entity.uniforms.uPresenceLife.value,0,'initially only an ambiguous cloud');p.pitch=0;b.update(9,true);
 assert.ok(entity.uniforms.uPresenceLife.value>.8,'looking starts a gradual living reveal that continues quietly');assert.equal(p.pos.distanceTo(playerBefore),0);assert.equal(p.pitch,0);assert.equal(entity.mesh.geometry.attributes.position.version,vertexVersion);assert.equal(entity.mesh.material.version,entityMaterialVersion);assert.ok(entity.mesh.position.y<-17,'the immense silhouette stays far below the player');
 const voidRay=new THREE.Raycaster(new THREE.Vector3(-.7,1.62,-412),new THREE.Vector3(-.55,-.835,0).normalize());b.group.updateMatrixWorld(true);
 assert.equal(voidRay.intersectObject(b.group.children[0]).length,0,'deep walls do not obstruct the infinite starfield');
 assert.ok(!mats.floorB.uniforms?.uAbyssLeft&&!mats.stone.uniforms?.uAbyssDepth,'void material patches stay local to the warehouse');
 assert.equal(rack.position.y,-8);assert.equal(bed.position.y,-8);assert.ok(Math.abs(bust.position.y+6.9)<1e-8);assert.equal(poster.position.y,1.6);
 group.updateMatrixWorld(true);const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(let z=-409;z>-415.4;z-=.25)for(const x of [-.72,0,.72]){
  ray.set(new THREE.Vector3(x,2,z),down);assert.ok(Math.abs(ray.intersectObject(floor)[0].point.y)<1e-7,'entire player footprint remains on the stable floor');
 }
 for(const x of [-3,3]){ray.set(new THREE.Vector3(x,2,-412),down);assert.ok(Math.abs(ray.intersectObject(floor)[0].point.y+8)<1e-7,'a real floor descends below the bridge');}
 const floorShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};floor.material.onBeforeCompile(floorShader);assert.equal(floorShader.uniforms.uAbyssLeft.value,8);assert.ok(floorShader.fragmentShader.includes('if(abyssFade>.999)discard'),'only dissolved floor wings reveal the depth below');assert.equal(bust.children[0].material.uniforms.uAbyssDepth.value,8);
 const g=floor.geometry,position=g.attributes.position,uv=g.attributes.uv,color=g.attributes.color;
 let area=0;for(let i=0;i<position.count;i+=3){area+=Math.abs((position.getX(i+1)-position.getX(i))*(position.getZ(i+2)-position.getZ(i))-(position.getZ(i+1)-position.getZ(i))*(position.getX(i+2)-position.getX(i)))/2;}
 assert.ok(Math.abs(area-12*36)<1e-5,'partition neither duplicates nor loses floor area');
 for(const a of [position,uv,color])for(const v of a.array)assert.ok(Number.isFinite(v));
 assert.ok(position.count/3<300&&b.stats.pitTriangles<300,'geometry budget stays small');
  const pitUV=b.group.children[0].geometry.attributes.uv;for(let i=0;i<pitUV.count;i+=3){const area=(pitUV.getX(i+1)-pitUV.getX(i))*(pitUV.getY(i+2)-pitUV.getY(i))-(pitUV.getY(i+1)-pitUV.getY(i))*(pitUV.getX(i+2)-pitUV.getX(i));assert.ok(Math.abs(area)>1e-8,'pit/bridge edge faces retain real texture area');}
 const late=prop(-4,-411);b.update(.01,true);assert.equal(late.position.y,-8,'late assets are anchored before their first visible frame');
 const contacts=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());contacts.rotation.x=-Math.PI/2;contacts.position.set(3,.002,-412);group.add(contacts);b.update(.01,true);
 assert.ok(Math.abs(contacts.geometry.attributes.position.getY(0)+7.998)<1e-5,'flat overlays descend with the supporting floor');
 contacts.geometry.dispose();contacts.geometry=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(3,.002,-412);b.update(.01,true);
 assert.ok(Math.abs(contacts.geometry.attributes.position.getY(0)+7.998)<1e-5,'updated shadow batches do not get lowered twice');
 const limit=b.config.halfWidth-.32;
 for(const fps of [20,30,60,120,240])for(const angle of [-.6,0,.6]){
  p.pos.set(0,1.62,-409);
  for(let i=0;i<fps*5;i++){
   const next=p.constrainMove(p.pos.x+Math.sin(angle)*1.55/fps,p.pos.z-Math.cos(angle)*1.55/fps);p.pos.x=next[0];p.pos.z=next[1];
   if(p.pos.z<=b.config.start+.32&&p.pos.z>=b.config.end-.32)assert.ok(Math.abs(p.pos.x)<=limit+1e-8,'no diagonal walk-off at different frame rates');
  }
 }
 p.pos.set(-4,1.62,-408);let next=p.constrainMove(-4,-408.3);assert.deepEqual(Array.from(next),[-4,-408],'side entry stops without snapping onto the bridge');
 p.pos.set(.3,1.62,-412);next=p.constrainMove(.3,-411.9);assert.ok(next[1]>p.pos.z,'backwards movement remains free');
 p.pos.set(.3,1.62,-416.5);b.update(1,true);assert.equal(b.state,'restoring');
 for(let t=0;t<4;t+=1/60)b.update(1/60,true);
 assert.equal(f.lamps.length,0);assert.equal(b.group.getObjectByName('abisso-stelle').material.opacity,0,'stars disappear when the floor closes');assert.equal(anchored.userData.ageFloor.value,0);
 assert.equal(floorShader.uniforms.uAbyssLeft.value,0);assert.equal(bust.children[0].material.uniforms.uAbyssDepth.value,0);
 assert.equal(entity.mesh.visible,false);assert.equal(entity.age,0);
 assert.equal(b.done,true);assert.equal(p.constrainMove,null);assert.equal(rack.position.y,0);assert.equal(late.position.y,0);
 assert.ok([...floor.geometry.attributes.position.array].every(Number.isFinite));
 b.reset();assert.equal(b.state,'idle');assert.equal(b.done,false);p.pos.set(0,1.62,-407);b.update(1,true);b.leave();assert.equal(p.constrainMove,null);assert.equal(rack.position.y,0);
 const slow=fixture(true);slow.p.pos.z=-407;slow.bridge.update(4,true);assert.ok(slow.bridge.left<8&&slow.bridge.state==='opening','reduced motion descends more slowly');
 const still=slow.bridge.group.getObjectByName('abisso-stelle');assert.equal(still.rotation.y,0);assert.equal(still.material.color.r,1);await slow.bridge.group.userData.ready;slow.p.pitch=-.8;slow.bridge.update(15,true);const quiet=slow.bridge.group.userData.presence;assert.ok(quiet.mesh.visible);assert.equal(quiet.uniforms.uPresenceLife.value,0);assert.equal(quiet.uniforms.uPresenceTime.value,0);assert.equal(quiet.mesh.position.y,-18);slow.bridge.leave();
 const held=fixture(false,()=>true);held.p.pos.z=-407;held.bridge.update(5,true);assert.equal(held.bridge.state,'idle','existing narration is not interrupted by the transformation');
 const skipped=fixture();skipped.p.pos.set(-4,1.62,-417);skipped.bridge.update(1,true);assert.equal(skipped.bridge.done,true);assert.equal(skipped.p.constrainMove,null);
 const uploads=[];for(const m of Object.values(mats))m.map.image={complete:false};const prepared=fixture(false,()=>false,{initTexture:t=>uploads.push(t)});
 assert.equal(uploads.length,0);for(const m of Object.values(mats))m.map.image.complete=true;prepared.bridge.update(.1,true);
 assert.equal(new Set(uploads).size,uploads.length);assert.ok(uploads.includes(mats.floorB.map),'textures decoded after initial preparation are uploaded while approaching');
 const uploaded=uploads.length;prepared.bridge.update(.1,true);assert.equal(uploads.length,uploaded,'stable maps are not re-uploaded every frame');
 let compiled=0;const warm=fixture(false,()=>false,{initTexture(){},async compileAsync(subset){const objects=[];subset.traverse(o=>objects.push(o));assert.ok(objects.some(o=>o.isPoints),'stars compile before being revealed');compiled++;}});
 warm.p.pos.z=-407;warm.bridge.update(.1,true);assert.equal(warm.bridge.state,'idle','the reveal waits for shader preparation while movement remains available');
 await warm.bridge.prepare();assert.ok(compiled>0&&!warm.bridge.preparing);warm.bridge.update(.1,true);assert.equal(warm.bridge.state,'opening');
 failNext=true;const failed=fixture();await failed.bridge.prepare();failed.p.pos.z=-407;failed.bridge.update(5,true);assert.equal(failed.bridge.state,'open');assert.ok(failed.bridge.group.userData.presence.status.error);assert.equal(failed.bridge.group.userData.presence.mesh.visible,false,'failed artwork does not block movement or expose a rectangle');
 console.log(JSON.stringify({result:'PASS',floorTriangles:position.count/3,stats:b.stats,physics:'flat bridge, real descending wings, diagonal/side-entry/backwards safe',lifecycle:'late surfaces, restore, reset, leave, reduced motion and narration'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
