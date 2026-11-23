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
  assert.deepEqual(requested,['assets/tex/cosmic_ground.webp','assets/tex/cosmic_galaxy.webp']);
  assert.ok(fs.readFileSync(path.join(root,requested[1])).includes(Buffer.from('ALPH')),'galaxy must have real alpha, not a black rectangle');
  let triangles=0,draws=0;
  landscape.group.traverse(o=>{
    if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws++;}
    else if(o.isPoints)draws++;
    if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));
  });
  assert.equal(draws,4);assert.ok(triangles<6000);
  for(let x=1.8;x<=8.4;x+=.1)for(const z of [-5,-4.5,-4])assert.ok(Math.abs(landscape.height(x,z)+.02)<1e-8,'existing walking lane must remain flat');
  const rocks=landscape.group.getObjectByName('cosmo-massi').geometry.attributes.position;
  for(let i=0;i<rocks.count;i++)assert.ok(Math.abs(rocks.getZ(i)+4.5)>.82,'keep rocks beyond player radius and walking lane');
  const galaxy=landscape.group.getObjectByName('cosmo-galassia');galaxy.geometry.computeBoundingBox();
  const size=galaxy.geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x/size.y-1500/768)<1e-6);
  const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),sky=landscape.group.getObjectByName('cosmo-cielo-infinito');
  scene.add(landscape.group);camera.position.set(4,1.62,-4.5);landscape.followCamera(camera);
  assert.ok(sky.position.distanceTo(camera.position)<1e-8);
  const original=galaxy.quaternion.clone();camera.rotation.set(.3,1.8,0);landscape.followCamera(camera);
  assert.ok(galaxy.quaternion.angleTo(original)<1e-7,'look must not rotate the celestial plate');
  const matVersion=galaxy.material.version;landscape.setSkyBrightness(.2);assert.equal(galaxy.material.color.r,.2);assert.equal(galaxy.material.version,matVersion);
  let uploads=0,compiles=0;
  const renderer={initTexture(){uploads++;},async compileAsync(group,c,s){assert.equal(group,landscape.group);assert.equal(c,camera);assert.equal(s,scene);compiles++;}};
  await Promise.all([landscape.prepare(renderer,scene,camera),landscape.prepare(renderer,scene,camera)]);
  assert.equal(uploads,2);assert.equal(compiles,1);assert.equal(landscape.status.prepared,true);
  // Phase-one contract: preserve the pre-existing movement/state/reset code byte-for-byte.
  const side=fs.readFileSync(path.join(root,'js/events/side-fold.js'),'utf8');
  const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
  assert.equal(digest(side.slice(side.indexOf('  // movimento: dal tunnel'),side.indexOf('  F.applyCamera'))),'0f91b58dc6d2c53df83eff551fd2b8bd4a9962d273acb433dcf8590180525255');
  assert.equal(digest(side.slice(side.indexOf('  F.reset ='),side.indexOf('  // animazioni leggere'))),'8c354af9c943e4dfdca5a8079db57db18f7a4aee1211ecdf28a3121144729815');
  console.log(JSON.stringify({result:'PASS',triangles,draws,assets:requested,walkingLane:'flat and clear',galaxy:'rectilinear, fixed aspect, camera translation only',preparation:'two uploads, one compilation',stateMachine:'unchanged'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
