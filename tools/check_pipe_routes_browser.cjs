// PIPE_BASE_URL=http://127.0.0.1:8205/ node tools/check_pipe_routes_browser.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.PIPE_BASE_URL||'http://127.0.0.1:8205/',out=process.env.PIPE_EVIDENCE||'/tmp/horror-pipe-routes';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,serviceWorkers:'block'});await context.addInitScript(()=>localStorage.setItem('ng_quality','mid'));
 const page=await context.newPage(),errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
 await page.goto(base+'?debug=1&start=porta',{waitUntil:'networkidle',timeout:90000});await page.evaluate(()=>__g.hold=true);await page.locator('#enter').click({timeout:90000});await page.waitForFunction(()=>document.getElementById('intro').classList.contains('hidden'));
 await page.waitForLoadState('networkidle');await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0');
 const geometry=await page.evaluate(async()=>{
  const{tunnelPipeReturns}=await import('/js/world/decor.js'),{loadKit}=await import('/js/world/props.js');const THREE=__g.THREE,pcs=await loadKit('pipes'),report=[];
  for(const[len,x,y,thin]of [[1.95,-1.27,2,false],[2,-1.33,1.62,true]]){
   const returns=tunnelPipeReturns(len,x,y,thin);if(returns.length!==2)throw Error('Expected two pipe returns per run');
   for(let i=0;i<returns.length;i++){
    const pl=returns[i],pc=pcs[pl.n],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...pl.r)),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...pl.p),q,new THREE.Vector3().setScalar(pl.s));
    // A is the Z-running mouth, B must be fully buried beyond x=-1.4.
    const a=new THREE.Vector3(thin?-.0828867:-.0716867,thin?-.1159137:-.1263133,0).applyMatrix4(matrix);
    const b=new THREE.Vector3(thin?.1159137:.1263133,thin?.0828867:.0716867,0).applyMatrix4(matrix);
    const box=new THREE.Box3();for(const p of pc.parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox.clone().applyMatrix4(matrix));}
    if(Math.abs(a.x-x)>.001||Math.abs(a.y-y)>.001)throw Error('Return is disconnected from pipe axis');
    if(b.x> -1.41)throw Error('Return mouth is exposed');
    if(box.min.z< -39.5 && box.max.z> -40.9 && box.max.x> -1.4)throw Error('Pipe crosses the side doorway');
    report.push({thin,mouth:a.toArray(),wall:b.toArray(),triangles:pc.parts.reduce((n,p)=>n+(p.geo.index?.count??p.geo.attributes.position.count)/3,0)});
   }
  }
  return report;
 });
 async function shot(name,pos,yaw,pitch){await page.evaluate(({pos,yaw,pitch})=>{const g=__g;g.player.pos.set(...pos);g.player.yaw=yaw;g.player.pitch=pitch;g.sim(.05);g.renderer.setPixelRatio(1);globalThis.__lowQ=false;g.scene.traverse(o=>{if(o.userData.decor)o.visible=true;});},{pos,yaw,pitch});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,name+'.png'),timeout:90000});}
 await shot('01-tubi-tunnel',[.35,1.62,-36.3],.32,.13);
 await page.evaluate(()=>__g.story.goto('cellar',true));await page.waitForFunction(()=>!__g.story.busy(),null,{timeout:180000});await page.waitForLoadState('networkidle');await page.waitForFunction(()=>getComputedStyle(document.getElementById('fade')).opacity==='0');
 const cellar=await page.evaluate(()=>{const result=[];__g.cellar.group.traverse(o=>{if(!o.userData.decor||!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(b.max.x>3.8&&b.min.y>3.1&&b.max.y<3.7)result.push([b.min.z,b.max.z]);});return result;});
 assert.ok(cellar.some(b=>b[0]<=-224&&b[1]>=-216),'rear cellar run reaches the back masonry');assert.ok(cellar.some(b=>b[1]>=-200),'front cellar run reaches entry masonry');
 await shot('02-tubi-cantina',[1,1.62,-219.7],-.6,.37);
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);const result={result:'PASS',geometry,cellar,errors,bad};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
