// node tools/check_hall_audio.cjs [anteprima.wav]
// Rendering Web Audio nativo, offline: niente server o rete. Richiede Playwright/Chromium.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
(async () => {
  const source = fs.readFileSync(path.join(root, 'js/audio/hall.js')).toString('base64');
  const samples = [0,1,2,3,4].map(i => fs.readFileSync(path.join(root, 'assets/audio/step'+i+'.mp3')).toString('base64'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    const result = await page.evaluate(async ({ source, samples, preview }) => {
      const { createHallPressure } = await import('data:text/javascript;base64,' + source);
      async function render(fallback) {
        const rate = 24000, ctx = new OfflineAudioContext(2, rate * 15, rate); let seed = 42;
        const rnd = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
        const noise = ctx.createBuffer(1,rate*2,rate); const white = noise.getChannelData(0); for(let i=0;i<white.length;i++)white[i]=rnd()*2-1;
        const clips = fallback ? [] : await Promise.all(samples.map(s => ctx.decodeAudioData(Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer)));
        ctx.listener.positionX.value=0; ctx.listener.positionY.value=1.62; ctx.listener.positionZ.value=-52; ctx.listener.forwardZ.value=-1;
        const out=ctx.createGain(), comp=ctx.createDynamicsCompressor();out.gain.value=.9;comp.threshold.value=-14;comp.ratio.value=5;out.connect(comp);comp.connect(ctx.destination);
        const made=[], disconnected=new Set();
        for(const method of ['createGain','createOscillator','createBufferSource','createBiquadFilter','createPanner','createDelay']) {
          const create=ctx[method].bind(ctx);ctx[method]=(...args)=>{const node=create(...args),disconnect=node.disconnect.bind(node);made.push(node);node.disconnect=(...a)=>{disconnected.add(node);return disconnect(...a);};return node;};
        }
        const score=createHallPressure(ctx,noise,out,null,()=>clips), trace=[],waits=[];let stallNodes=0;
        for(let frame=1;frame<300;frame++) {
          const f=frame;waits.push(ctx.suspend(frame*.05).then(async()=>{
            try {
              if(f===6){score.setStage(0,-76);trace.push({kind:'reveal',stage:0,at:ctx.currentTime});}
              if(f===146){score.rush(-76,-64,.7);trace.push({kind:'rush',at:ctx.currentTime});}
              if(f===160){score.setStage(1,-64);trace.push({kind:'reveal',stage:1,at:ctx.currentTime});}
              if(f===208){score.rush(-64,-57.5,.7);trace.push({kind:'rush',at:ctx.currentTime});}
              if(f===222){score.setStage(2,-57.5);trace.push({kind:'reveal',stage:2,at:ctx.currentTime});}
              if(f===252){score.stop();score.stop();trace.push({kind:'stop',at:ctx.currentTime});}
              const before=made.length;
              if(!fallback || f<=40 || f>=80)score.update();
              if(f===80)stallNodes=made.length-before;
            } finally { await ctx.resume(); }
          }));
        }
        const buffer=await ctx.startRendering();await Promise.all(waits);
        const channels=[buffer.getChannelData(0),buffer.getChannelData(1)];let peak=0,finite=true;
        for(const ch of channels)for(const sample of ch){if(!Number.isFinite(sample))finite=false;peak=Math.max(peak,Math.abs(sample));}
        const rms=(a,b)=>{let total=0,count=0;for(const ch of channels)for(let i=Math.ceil(a*rate);i<Math.floor(b*rate);i++){total+=ch[i]*ch[i];count++;}return Math.sqrt(total/count);};
        const metrics={fallback,peak,finite,stages:[rms(2.5,6.8),rms(8.3,10.2),rms(11.4,12.5)],rushes:[rms(7.32,7.95),rms(10.42,11.05)],strike:rms(.32,.36),chop:rms(.42,.44),before:rms(0,.25),silence:rms(12.75,14.9),made:made.length,disconnected:disconnected.size,stallNodes,trace};
        let wav=null;
        if(preview&&!fallback){
          const data=new ArrayBuffer(44+buffer.length*4),view=new DataView(data);const text=(p,s)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));};
          text(0,'RIFF');view.setUint32(4,data.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.length*4,true);
          let p=44;for(let i=0;i<buffer.length;i++)for(const ch of channels){view.setInt16(p,Math.max(-1,Math.min(1,ch[i]))*32767,true);p+=2;}
          const bytes=new Uint8Array(data),parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));wav=btoa(parts.join(''));
        }
        return {metrics,wav};
      }
      return {real:await render(false),fallback:await render(true)};
    }, { source, samples, preview: !!process.argv[2] });
    if(process.argv[2])fs.writeFileSync(process.argv[2],Buffer.from(result.real.wav,'base64'));
    console.log(JSON.stringify({real:result.real.metrics,fallback:result.fallback.metrics,errors},null,2));
    for(const {metrics:m} of [result.real,result.fallback]) {
      assert.ok(m.finite&&m.peak>.03&&m.peak<.95,'Margine sul picco, niente clipping');
      assert.ok(m.stages[1]>m.stages[0]&&m.stages[2]>m.stages[1],'Pressione crescente');
      assert.ok(m.rushes[1]>m.rushes[0],'Il secondo assalto e’ piu’ vicino');
      assert.ok(m.chop<m.strike*.2,'La campana ha un vero taglio');
      assert.equal(m.before,0);assert.ok(m.silence<1e-8,'Niente code sopra il respiro');
      assert.equal(m.made,m.disconnected,'Nessun nodo residuo');
      if(m.fallback)assert.ok(m.stallNodes<=24,'Niente raffica dopo uno stallo');
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
