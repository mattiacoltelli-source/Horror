// node --experimental-vm-modules tools/check_cosmic_landscape.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
  const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
  const requested=[];
  class TextureLoader {
    load(url,done) {
      assert.ok(fs.statSync(path.join(root,url)).size>1000,'asset must be in repository');requested.push(url);
      const t=new THREE.Texture({width:url.includes('galaxy')?1500:1024,height:url.includes('galaxy')?768:1024,complete:true});
      queueMicrotask(()=>done(t));return t;
    }
  }
  const context=vm.createContext({console}),exports={...THREE,TextureLoader};
  const three=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context});
  const cache=new Map();
  async function moduleAt(file) {
    if(cache.has(file))return cache.get(file);
    const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
    await m.link(specifier=>specifier==='three'?three:moduleAt(path.resolve(path.dirname(file),specifier)));return m;
  }
  const module=await moduleAt(path.join(root,'js/world/cosmic-landscape.js'));await module.evaluate();
  const landscape=module.namespace.createCosmicLandscape({x:1.4,z:-4.5,uvScale:[1.6,1.6]});
  assert.equal(await landscape.ready,true);assert.equal(landscape.status.loaded,true);
  assert.deepEqual(requested,['assets/tex/cosmic_ground.webp','assets/tex/cosmic_galaxy.webp','assets/tex/cosmic_lava.webp']);
  assert.ok(fs.readFileSync(path.join(root,requested[1])).includes(Buffer.from('ALPH')),'galaxy must have real alpha, not a black rectangle');
  let triangles=0,draws=0;
  landscape.group.traverse(o=>{
    if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.geometry.isInstancedBufferGeometry?o.geometry.instanceCount:1);draws++;}
    else if(o.isPoints)draws++;
    if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));
  });
  assert.equal(draws,8);assert.ok(triangles<9000);
  assert.equal(landscape.lava.fire.count,18,'bounded distant flames');
  const flames=landscape.lava.fire.flames;
  assert.equal(flames.material.depthWrite,false);assert.equal(flames.material.map,undefined,'no extra flame asset');
  assert.ok(flames.geometry.attributes.aShape.getY(0)!==flames.geometry.attributes.aShape.getY(1),'uneven tongues');
  for(let i=0;i<18;i++){assert.ok(flames.geometry.attributes.aShape.getX(i)>=.459);assert.ok(flames.geometry.attributes.aShape.getY(i)>=.399,'taller tongues remain readable at hill distance');}
  // Real geometric relief with normals for the existing vertex-lighting path;
  // the complete player footprint stays flat and free of rocks.
  assert.ok(landscape.groundMaterial.isMeshLambertMaterial&&landscape.groundMaterial.vertexColors);
  assert.equal(landscape.groundMaterial.map,landscape.groundTexture);
  assert.ok(!landscape.groundMaterial.normalMap&&!landscape.groundMaterial.roughnessMap);
  const shader={fragmentShader:THREE.ShaderLib.lambert.fragmentShader};
  landscape.groundMaterial.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('outgoingLight += diffuseColor.rgb'),'starlight reuses sampled albedo');
  assert.equal((shader.fragmentShader.match(/#include <opaque_fragment>/g)||[]).length,1,'valid shader insertion point');
  for(const name of ['cosmo-terreno','cosmo-massi']) {
    const g=landscape.group.getObjectByName(name).geometry,n=g.attributes.normal;
    assert.equal(n.count,g.attributes.position.count);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'valid geometric normals');
  }
  for(let x=1.8;x<=8.4;x+=.1)for(const offset of [-.82,-.5,0,.5,.82])assert.ok(Math.abs(landscape.height(x,-4.5+offset)+.02)<1e-8,'player footprint stays flat');
  const terrainPositions=landscape.group.getObjectByName('cosmo-terreno').geometry.attributes.position;let guardVertices=0;
  for(let i=0;i<terrainPositions.count;i++)if(terrainPositions.getX(i)<10.4&&Math.abs(terrainPositions.getZ(i)+4.5)<=.840001){
    assert.ok(Math.abs(terrainPositions.getY(i)+.02)<1e-6,'rendered walking strip is flat too');
    if(Math.abs(Math.abs(terrainPositions.getZ(i)+4.5)-.84)<1e-6)guardVertices++;
  }
  assert.ok(guardVertices>0,'explicit edge rows protect the full footprint');
  const banks=[];for(let x=3;x<9;x+=.25)banks.push(landscape.height(x,-3),landscape.height(x,-6));
  assert.ok(Math.max(...banks)-Math.min(...banks)>.03,'small real relief along the banks');
  const rocks=landscape.group.getObjectByName('cosmo-massi').geometry.attributes.position;
  for(let i=0;i<rocks.count;i++)if(rocks.getX(i)<=8.72)assert.ok(Math.abs(rocks.getZ(i)+4.5)>.82,'keep rocks beyond the full reachable player footprint');
  const lava=landscape.group.getObjectByName('cosmo-lava-incandescente'),lavaPositions=lava.geometry.attributes.position;
  assert.ok(lava.material.isMeshBasicMaterial&&lava.material.alphaTest>0&&!lava.material.depthWrite);
  assert.ok(lavaPositions.count>0,'real terrain geometry carries the lava overlay');
  for(let i=0;i<lavaPositions.count;i++)if(lavaPositions.getX(i)<10.4)assert.ok(Math.abs(lavaPositions.getZ(i)+4.5)>.84,'lava stays outside the playable strip');
  const ground=landscape.group.getObjectByName('cosmo-terreno');ground.updateMatrixWorld(true);
  const detailModule=await moduleAt(path.join(root,'js/world/cosmic-details.js'));
  const deadwood=detailModule.namespace.createCosmicDeadwood({terrainGeometry:ground.geometry,x:1.4,z:-4.5});deadwood.computeBoundingBox();
  assert.ok(deadwood.boundingBox.min.x>20,'all trunks and roots remain in the distance, beyond the whole playable area');
  assert.ok(deadwood.attributes.position.count/3<1000,'static deadwood triangle budget');deadwood.dispose();
  const moon=landscape.group.getObjectByName('cosmo-luna-laterale');
  assert.equal(moon.material.map,landscape.groundTexture,'moon reuses the existing albedo');
  assert.ok(Math.atan2(moon.position.z,moon.position.x)>Math.PI/3,'sky accent stays to the side of the main galaxy');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const fireAnchors=landscape.lava.fire.anchors;
  for(let i=0;i<fireAnchors.count;i++){
    const x=fireAnchors.getX(i),z=fireAnchors.getZ(i);assert.ok(x>20,'flames stay beyond the walking area');
    ray.set(new THREE.Vector3(x,100,z),down);const hit=ray.intersectObject(ground)[0];
    assert.ok(hit&&Math.abs(fireAnchors.getY(i)-hit.point.y-.013)<1e-5,'each flame rests on its actual terrain triangle');
  }
  const boulderModule=await moduleAt(path.join(root,'js/world/cosmic-boulders.js'));
  const models=boulderModule.namespace.createCosmicBoulders({terrainGeometry:ground.geometry,x:1.4,z:-4.5,groundTint:()=>1,uvScale:[1.6,1.6]});
  for(const model of models){
    model.computeBoundingBox();
    assert.ok(model.boundingBox.max.y-model.boundingBox.min.y>.35,'boulders have real vertical volume');
    const p=model.attributes.position,tex=model.attributes.uv,edges=new Map();
    const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(6)).join(',');
    for(let i=0;i<p.count;i+=3){
      for(let j=0;j<3;j++){
        const pair=[key(i+j),key(i+(j+1)%3)].sort().join('|');edges.set(pair,(edges.get(pair)||0)+1);
      }
      const area=(tex.getX(i+1)-tex.getX(i))*(tex.getY(i+2)-tex.getY(i))-(tex.getY(i+1)-tex.getY(i))*(tex.getX(i+2)-tex.getX(i));
      assert.ok(Math.abs(area)>1e-8,'face UVs retain area even on vertical rock sides');
    }
    for(const uses of edges.values())assert.equal(uses,2,'rock surfaces are closed, without cracks between triangles');
    const center=model.boundingBox.getCenter(new THREE.Vector3());
    ray.set(new THREE.Vector3(center.x,100,center.z),down);
    assert.ok(model.boundingBox.min.y<ray.intersectObject(ground)[0].point.y,'rock base is embedded in the rendered terrain');
    model.dispose();
  }
  for(let i=0;i<lavaPositions.count;i+=Math.max(1,Math.floor(lavaPositions.count/25))){
    // Triangle centroids avoid precision ambiguity at shared edges.
    const k=Math.floor(i/3)*3,p=new THREE.Vector3();
    for(let j=0;j<3;j++)p.add(new THREE.Vector3().fromBufferAttribute(lavaPositions,k+j));p.divideScalar(3);
    ray.set(new THREE.Vector3(p.x,p.y+5,p.z),down);
    const hit=ray.intersectObject(ground)[0];assert.ok(hit&&Math.abs(p.y-hit.point.y-.006)<1e-5,'lava conforms to rendered triangles instead of floating or flickering');
  }
  const galaxy=landscape.group.getObjectByName('cosmo-galassia');galaxy.geometry.computeBoundingBox();
  const size=galaxy.geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x/size.y-1500/768)<1e-6);
  const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),sky=landscape.group.getObjectByName('cosmo-cielo-infinito');
  scene.add(landscape.group);camera.position.set(4,1.62,-4.5);landscape.followCamera(camera);
  assert.ok(sky.position.distanceTo(camera.position)<1e-8);
  const original=galaxy.quaternion.clone();camera.rotation.set(.3,1.8,0);landscape.followCamera(camera);
  assert.ok(galaxy.quaternion.angleTo(original)<1e-7,'look must not rotate the celestial plate');
  const matVersion=galaxy.material.version;landscape.setSkyBrightness(.2);assert.equal(galaxy.material.color.r,.2);assert.equal(galaxy.material.version,matVersion);
  landscape.setSkyBrightness(0);assert.equal(lava.material.color.r,0,'existing blackout also extinguishes lava');
  assert.equal(flames.visible,false,'flames respect the same blackout');
  assert.equal(landscape.group.getObjectByName('cosmo-luna-laterale').material.color.r,0,'side moon follows the same blackout');
  const campfire=landscape.group.getObjectByName('cosmo-falo-lontano');assert.ok(campfire.position.x>20&&campfire.position.z>-4.5+8,'campfire is distant and outside the lane');assert.equal(campfire.material.opacity,0,'fire follows the existing blackout');assert.equal(campfire.material.map,null,'fire adds no texture download');
  let uploads=0,compiles=0;
  const renderer={initTexture(){uploads++;},async compileAsync(group,c,s){assert.equal(group,landscape.group);assert.equal(c,camera);assert.equal(s,scene);compiles++;}};
  await Promise.all([landscape.prepare(renderer,scene,camera),landscape.prepare(renderer,scene,camera)]);
  assert.equal(uploads,3);assert.equal(compiles,1);assert.equal(landscape.status.prepared,true);
  // Guard movement/event timing/reset (including the hidden-tunnel guard);
  // exploration look is controlled only by the player.
  const side=fs.readFileSync(path.join(root,'js/events/side-fold.js'),'utf8');
  const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
  // The only allowed change in this block is removal of the old observation
  // caption. Its complete movement, lighting, timing and state machine remain
  // covered by the normalized byte hash.
  const movement=side.slice(side.indexOf('  // movimento: dal tunnel'),side.indexOf('  F.applyCamera')).replace(" say?.('Un altro mondo.', 2600);",'');
  assert.equal(digest(movement),'b79eb19e02d8e87acbcfae28ce97fb69b70d5927bb190d589427035c3f9f2f34');
  assert.equal(digest(side.slice(side.indexOf('  F.reset ='),side.indexOf('  // animazioni leggere'))),'8c354af9c943e4dfdca5a8079db57db18f7a4aee1211ecdf28a3121144729815');
  console.log(JSON.stringify({result:'PASS',triangles,draws,boulders:models.length,assets:requested,walkingLane:'flat and clear',rocks:'closed volumes, embedded bases, face-projected texture',lava:'fitted to terrain, outside walking strip, follows blackout',galaxy:'rectilinear, fixed aspect, camera translation only',preparation:'three uploads, one compilation',stateMachine:'unchanged'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
