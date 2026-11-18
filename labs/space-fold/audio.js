// Original procedural sound, no downloads and no production audio singleton.
export function createFoldAudio() {
  let context,master,rumble,oscillators=[],muted=false,lastPhase='idle',nextCrack=0,stepDistance=0;
  const api={
    async unlock() {
      if(!context) {
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        context=new Audio();
        const compressor=context.createDynamicsCompressor();
        compressor.threshold.value=-22;compressor.ratio.value=5;compressor.connect(context.destination);
        master=context.createGain();master.gain.value=muted?0:.22;master.connect(compressor);
        rumble=context.createGain();rumble.gain.value=0;rumble.connect(master);
        const noise=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=noise.getChannelData(0);
        let v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()*2-1)*.11)/1.02;data[i]=v;}
        const source=context.createBufferSource();source.buffer=noise;source.loop=true;
        const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=165;
        source.connect(filter);filter.connect(rumble);source.start();oscillators.push(source);
        for(const hz of [43,51.3]) {
          const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=.14;
          o.connect(g);g.connect(rumble);o.start();oscillators.push(o);
        }
      }
      if(context.state!=='running')await context.resume();
    },
    setMuted(value) {muted=value;if(master)master.gain.setTargetAtTime(muted?0:.22,context.currentTime,.12);},
    update(dt,sequence,moved) {
      if(!context||context.state!=='running')return;
      const now=context.currentTime,phase=sequence.phase;
      let level=0;
      if(phase==='warning')level=.10+.30*Math.min(1,sequence.time/1.8);
      if(phase==='folding')level=.4+.25*Math.sin(Math.min(1,sequence.angle/(Math.PI/2))*Math.PI);
      rumble.gain.setTargetAtTime(level,now,.22);
      if(phase!==lastPhase) {
        if(phase==='warning')resonance(61,.8,.45);
        if(phase==='stable')resonance(86,1.8,.28);
        nextCrack=.8;lastPhase=phase;
      }
      if(phase==='folding') {
        nextCrack-=dt;
        if(nextCrack<=0) {
          resonance(67+19*Math.sin(sequence.angle*4),.6,.19);
          nextCrack=1.6-.7*Math.sin(sequence.angle);
        }
      }
      stepDistance+=moved;
      if(stepDistance>.67) {stepDistance%=.67;resonance(95,.13,.12);}
    },
    async pause() {if(context?.state==='running')await context.suspend();},
    reset() {lastPhase='idle';stepDistance=0;nextCrack=0;if(rumble)rumble.gain.setTargetAtTime(0,context.currentTime,.05);},
    dispose() {for(const source of oscillators)source.stop();oscillators=[];context?.close();},
    get state() {return context?.state??'uninitialized';},
  };
  function resonance(hz,duration,gain) {
    const now=context.currentTime;
    for(const [multiple,level] of [[1,1],[1.71,.28],[2.43,.12]]) {
      const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.setValueAtTime(hz*multiple,now);
      o.frequency.exponentialRampToValueAtTime(hz*multiple*.86,now+duration);
      g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain*level,now+.012);
      g.gain.exponentialRampToValueAtTime(.0001,now+duration);
      o.connect(g);g.connect(master);o.start(now);o.stop(now+duration+.02);
      o.onended=()=>{o.disconnect();g.disconnect();};
    }
  }
  return api;
}
