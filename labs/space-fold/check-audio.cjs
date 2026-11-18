// Native offline Web Audio verification of the *same* production sound graph.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let chromium;
try {({chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'));}
catch {console.error('Specifica PLAYWRIGHT_MODULE per eseguire il test Web Audio.');process.exit(1);}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const source=fs.readFileSync(path.join(__dirname,'audio.js'),'utf8');
    const result=await page.evaluate(async source=>{
      const {createFoldAudio}=await import('data:text/javascript;base64,'+btoa(source));
      const rate=24000,context=new OfflineAudioContext(1,rate*20,rate),original=window.AudioContext;
      // Adapt only the live-context lifecycle; all audio nodes/rendering are native.
      const adapter=new Proxy(context,{get(target,key){
        if(key==='state')return 'running';
        if(key==='resume')return async()=>{};
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      }});
      window.AudioContext=function(){return adapter;};
      const audio=createFoldAudio();await audio.unlock();window.AudioContext=original;
      const waits=[];
      for(let i=1;i<195;i++)waits.push(context.suspend(i*.1).then(async()=>{
        const t=i*.1;
        if(i===180)audio.setMuted(true);
        if(t>=.5&&t<2.3)audio.update(.1,{phase:'warning',time:t-.5,angle:0},0);
        else if(t>=2.3&&t<14.3)audio.update(.1,{phase:'folding',time:t-2.3,angle:(t-2.3)/12*Math.PI/2},.08);
        else audio.update(.1,{phase:t<.5?'idle':'stable',time:t,angle:Math.PI/2},0);
        await context.resume();
      }));
      const buffer=await context.startRendering();await Promise.all(waits);
      const data=buffer.getChannelData(0);
      const rms=(a,b)=>{let sum=0;for(let i=Math.floor(a*rate);i<Math.floor(b*rate);i++)sum+=data[i]*data[i];return Math.sqrt(sum/((b-a)*rate));};
      let peak=0,finite=true;for(const v of data){peak=Math.max(peak,Math.abs(v));if(!Number.isFinite(v))finite=false;}
      return {peak,finite,before:rms(.1,.4),warning:rms(1,2),folding:rms(4,10),muted:rms(19,19.8),samples:Array.from(data),rate};
    },source);
    assert.ok(result.finite&&result.peak>0&&result.peak<.95);
    assert.ok(result.before<1e-7&&result.warning>.001&&result.folding>.001&&result.muted<.0001);
    assert.deepEqual(errors,[]);
    if(process.env.SPACE_FOLD_ARTIFACTS) {
      fs.mkdirSync(process.env.SPACE_FOLD_ARTIFACTS,{recursive:true});
      const wav=Buffer.alloc(44+result.samples.length*2),bytes=wav.length-44;
      wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
      wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(result.rate,24);wav.writeUInt32LE(result.rate*2,28);
      wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
      result.samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
      fs.writeFileSync(path.join(process.env.SPACE_FOLD_ARTIFACTS,'struttura-space-fold.wav'),wav);
    }
    delete result.samples;console.log(JSON.stringify({result:'PASS',...result,errors}));
    if(process.env.SPACE_FOLD_ARTIFACTS)fs.writeFileSync(path.join(process.env.SPACE_FOLD_ARTIFACTS,'audio-results.json'),JSON.stringify(result,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
