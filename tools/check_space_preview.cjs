// node tools/check_space_preview.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
  const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
  const source=fs.readFileSync(path.join(root,'js/world/space-preview.js'),'utf8');
  const create=new Function('THREE',source.replace(/^import .*;$/m,'').replace('export function','function')+';return createSpacePreview;')(THREE);
  const camera=new THREE.PerspectiveCamera(68,1080/2400),previous={name:'main target'},renders=[];
  let current=previous,fail=false;
  const renderer={getDrawingBufferSize:v=>v.set(1080,2400),getRenderTarget:()=>current,setRenderTarget:t=>{current=t;},
    compileAsync:async()=>{},render:(scene,view)=>{if(fail)throw Error('interrupted');renders.push({scene,view});}};
  const preview=create({renderer,camera,low:false});await preview.prepare();
  assert.equal(current,previous);assert.equal(preview.target.depthBuffer,false);assert.equal(preview.target.samples,0);
  assert.ok(preview.target.width<=256&&preview.target.height<=256);
  assert.deepEqual(preview.res.toArray(),[1080,2400],'screen UV uses full drawing-buffer size');
  assert.equal(preview.scene.children.length,1);const stars=preview.scene.children[0];
  assert.ok(stars.isPoints);assert.equal(stars.geometry.attributes.position.count,900);
  const positions=stars.geometry.attributes.position;
  for(let i=0;i<positions.count;i++)assert.ok(Math.abs(Math.hypot(positions.getX(i),positions.getY(i),positions.getZ(i))-450)<.001,'stars form a sphere without picture edges');
  assert.equal(stars.material.map,null,'no rectangular backdrop texture');
  camera.rotation.set(-1,.7,.2);preview.draw(0,camera.position,camera.quaternion);
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2).multiply(camera.quaternion);
  assert.ok(preview.camera.quaternion.angleTo(q)<1e-7,'look follows the portal orientation');
  const before=preview.camera.position.clone();camera.position.set(2,1.62,-213);preview.draw(0,camera.position,camera.quaternion);
  assert.ok(preview.camera.position.equals(before),'distant stars do not slide when walking');
  fail=true;assert.throws(()=>preview.draw(0,camera.position,camera.quaternion),/interrupted/);assert.equal(current,previous,'nested render always restores its target');fail=false;
  const low=create({renderer,camera,low:true});await low.prepare();assert.ok(Math.max(low.target.width,low.target.height)<=192);
  console.log('Space preview: one star draw, spherical coverage, 256/192 px limit, no MSAA/depth/backdrop, pose and renderer restoration verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
