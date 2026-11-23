// node --experimental-vm-modules tools/check_crypt_fissures.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
 const requested=[];class TextureLoader{load(url,done){assert.ok(fs.statSync(path.join(root,url)).size<100000);requested.push(url);const t=new THREE.Texture({width:512,height:512,complete:true});queueMicrotask(()=>done(t));return t;}}
 const context=vm.createContext({console}),exports={...THREE,TextureLoader},three=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context}),cache=new Map();
 async function load(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link(spec=>spec==='three'?three:load(path.resolve(path.dirname(file),spec)));return m;}
 const mod=await load(path.join(root,'js/world/crypt-fissures.js'));await mod.evaluate();const scene=new THREE.Scene(),fx=mod.namespace.createCryptFissures({group:scene});assert.equal(await fx.ready,true);
 assert.deepEqual(requested,['assets/tex/crypt_basalt.webp','assets/tex/crypt_fissure.webp']);let draws=0,triangles=0;fx.group.traverse(o=>{assert.ok(!o.isLight,'no dynamic lights');if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});
 assert.equal(draws,2);assert.ok(triangles<100);
 const rocks=fx.group.getObjectByName('frammenti-basaltici').geometry.attributes.position;for(let i=0;i<rocks.count;i++)assert.ok(Math.abs(rocks.getZ(i)+215.5)>1,'3D stones stay clear of the entrance');
 const edges=new Map(),point=i=>[rocks.getX(i),rocks.getY(i),rocks.getZ(i)].join(',');
 for(let i=0;i<rocks.count;i+=3)for(const [a,b]of [[i,i+1],[i+1,i+2],[i+2,i]]){const key=[point(a),point(b)].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2),'stone faces remain joined without holes');
 const floor=fx.group.getObjectByName('brace-nelle-fratture');assert.ok(floor.material.transparent&&floor.material.map);const version=floor.geometry.attributes.position.version;
 assert.ok(fs.readFileSync(path.join(root,requested[1])).includes(Buffer.from('ALPH')),'real transparent decal');
 const shader={uniforms:{},fragmentShader:THREE.ShaderLib.lambert.fragmentShader};floor.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('emberMask'),'glow is selected from the existing albedo sample');
 fx.update(.1,new THREE.Vector3(.4,1.62,-201.6));assert.equal(fx.group.visible,false,'far entrance has no FX draw');fx.update(.1,new THREE.Vector3(3,1.62,-215.5));assert.equal(fx.group.visible,true);
  fx.update(.1,new THREE.Vector3(-3,1.62,-215.5));assert.ok(floor.material.opacity>0&&floor.material.opacity<1,'embers fade in before the visibility boundary');
 for(let i=0;i<100;i++)fx.update(.05,new THREE.Vector3(3,1.62,-215.5));assert.equal(floor.geometry.attributes.position.version,version,'pulse changes only a material uniform');assert.ok(shader.uniforms.uCryptEmber.value>.55&&shader.uniforms.uCryptEmber.value<.65);
 fx.group.visible=false;let uploads=0,compiles=0;const renderer={initTexture(){uploads++;},async compileAsync(group,camera,target){assert.equal(group,fx.group);assert.equal(target,scene);assert.equal(group.visible,true);compiles++;}};
 await Promise.all([fx.prepare(renderer,scene,new THREE.PerspectiveCamera()),fx.prepare(renderer,scene,new THREE.PerspectiveCamera())]);assert.equal(uploads,2);assert.equal(compiles,1);assert.equal(fx.group.visible,false);assert.equal(fx.status.prepared,true);
 console.log(JSON.stringify({result:'PASS',draws,triangles,assetBytes:requested.reduce((sum,p)=>sum+fs.statSync(path.join(root,p)).size,0),walkway:'clear',updates:'uniform only',preload:'two uploads, one compilation'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
