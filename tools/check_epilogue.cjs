// node tools/check_epilogue.cjs
// Actual tunnel updater and dawn/player code, with DOM/audio services simulated.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),root=path.resolve(__dirname,'..');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three/three.module.min.js')));
 const side=fs.readFileSync(path.join(root,'js/events/side-fold.js'),'utf8');
 const updateSource=side.slice(side.indexOf('  F.update = (dt) => {'),side.indexOf('  F.applyCamera ='));
 const camera=new THREE.PerspectiveCamera(68,1,.05,60),tunnel=new THREE.Group(),G=new THREE.Group(),F={enabled:true,state:'done',t:10};
 const update=new Function('F','G','tunnel','player','camera','lights',`let tt=0;const Z_END=-50,ZR=-4.5;${updateSource};return F.update;`)(F,G,tunnel,{pos:new THREE.Vector3()},camera,{lamps:[]});
 tunnel.visible=false;G.visible=false;update(1/60);
 assert.equal(G.visible,false,'a hidden tunnel must not resurrect its side passage');assert.equal(F.t,10,'hidden passage event timers stay paused');assert.equal(camera.far,60,'another scene owns its camera range');
 tunnel.visible=true;update(1/60);assert.equal(G.visible,true,'the original tunnel still shows its passage');assert.ok(F.t>10,'visible passage timers resume');
 F.enabled=false;update(1/60);assert.equal(G.visible,false,'disabled passage stays hidden');
 const source=fs.readFileSync(path.join(root,'js/player/player.js'),'utf8').replace(/^import .*;$/gm,'').replace('export function','function');
 const createPlayer=new Function('THREE','W','Z_START','Z_END',source+';return createPlayer;')(THREE,1.4,6,-50);
 const controls={axes:()=>({x:0,y:-1}),consumeLook:()=>({x:2,y:-1})},player=createPlayer(camera,controls,{step(){}});let staleCalls=0;
 player.speedNow=1.55;player.constrainMove=()=>{staleCalls++;return[12,-250];};
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x000000,.1);scene.add(camera,tunnel,G);const light=new THREE.PointLight();scene.add(light);
 const fade={style:{},offsetWidth:1},timers=[],messages=[],finishes=[];
 const document={getElementById:id=>id==='fade'?fade:{classList:{add(){}}}};
 class TextureLoader{load(){return new THREE.Texture();}}
 const dawnSource=fs.readFileSync(path.join(root,'js/events/dawn.js'),'utf8').replace(/^import .*;$/gm,'').replace('export function','function');
 const createDawn=new Function('THREE','document','setTimeout','navigator',dawnSource+';return createDawn;')({...THREE,TextureLoader},document,(fn,ms)=>timers.push({fn,ms}),{vibrate(){}});
 const handle=()=>({stop(){},setLevel(){},setPos(){}}),audio={duck(){},unmute(){},wind:handle,breath:handle,swell(){},scare(){},cut(){}};
 const dawn=createDawn({scene,camera,player,audio,lights:{setTorch(){},setLamps(){}},instab:{hide(){}},say:msg=>messages.push(msg),finish:text=>finishes.push(text),hall:{silhouette:()=>new THREE.Group()}});
 dawn.start('finale di prova');assert.equal(tunnel.visible,false);assert.equal(G.visible,false);assert.equal(player.constrainMove,null);assert.equal(player.speedNow,0);
 const yaw=player.yaw;dawn.update(.05);player.update(.05,.05);
 assert.equal(staleCalls,0);assert.equal(player.pos.x,0);assert.equal(player.pos.z,0);assert.notEqual(player.yaw,yaw,'free look survives while movement is stopped');
 for(let i=1;i<510;i++){dawn.update(.05);player.update(.05,i*.05);}
 assert.ok(messages.includes('il fumo non si sente più.'));assert.equal(dawn.ended,true);assert.deepEqual(finishes,['finale di prova']);assert.equal(camera.fov,68);
 assert.equal(staleCalls,0);assert.equal(player.pos.x,0);assert.equal(player.pos.z,0);
 console.log('Epilogue: hidden passage, camera range, controller release, stationary free look and complete ending verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
