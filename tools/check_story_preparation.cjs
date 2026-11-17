// node tools/check_story_preparation.cjs
// Durante la preparazione della stanza resta il nero; note e comandi partono dopo.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/story.js'),'utf8').replace(/^import .*;$/m,'').replace('export function','function');
 const tasks=[],messages=[],saved=[],personal=[],controls={enabled:true},fade={style:{}},camera={updateProjectionMatrix(){}},player={},scene={children:[]};let clock=0,release;
 const timers=(fn,ms)=>tasks.push({fn,at:clock+ms});
 const advance=async ms=>{const until=clock+ms;for(;;){tasks.sort((a,b)=>a.at-b.at);if(!tasks.length||tasks[0].at>until)break;const task=tasks.shift();clock=task.at;task.fn();await Promise.resolve();await Promise.resolve();}clock=until;};
 const factory=new Function('P','personalRoom','document','setTimeout',source+';return createStory;')(null,n=>personal.push(n),{getElementById:()=>fade},timers);
 const room=()=>{const r={group:{visible:false,position:{z:0},userData:{}},enter(){r.group.visible=true;},leave(){r.group.visible=false;}};scene.children.push(r.group);return r;};
 const cellar=room(),tower=room(),wh=room(),morgue=room(),ward=room();
 const story=factory({scene,camera,controls,player,audio:{duck(){}},hall:{group:{visible:false}},getCellar:()=>cellar,getTower:()=>tower,getWh:()=>wh,getMorgue:()=>morgue,getWard:()=>ward,say:msg=>messages.push(msg),lights:{torchKill(){}},onRoom:n=>saved.push(n),prepare:()=>new Promise(r=>release=r)});
 story.goto('cellar',true);assert.equal(controls.enabled,false);assert.equal(fade.style.opacity,1);
 await advance(320);assert.equal(story.current(),'cellar');assert.equal(story.busy(),true);assert.deepEqual(saved,['cellar']);
 await advance(5000);assert.equal(fade.style.opacity,1);assert.equal(controls.enabled,false);assert.deepEqual(messages,[]);assert.deepEqual(personal,[]);
 release();await Promise.resolve();await Promise.resolve();assert.deepEqual(personal,['cellar']);
 await advance(350);assert.equal(fade.style.opacity,0);assert.equal(controls.enabled,true);assert.equal(story.busy(),false);
 await advance(3000);assert.equal(messages.length,1);assert.ok(messages[0].includes('specchio'),'Le note non si perdono durante una compilazione lenta');
 console.log('Story: dissolvenza, checkpoint, comandi e note dopo preparazione lenta verificati.');
})().catch(e=>{console.error(e);process.exit(1);});
