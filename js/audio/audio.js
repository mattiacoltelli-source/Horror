// Audio procedurale (Web Audio): nessun file da scaricare, avvio dopo il tap dell'utente.
// Ambiente: rumore a bassa frequenza + ronzio elettrico + gocce; eventi: passi, battito, impatto sul vetro.
import * as THREE from 'three';

export function createAudio() {
  let ctx = null, master, amb, hum, verb, verbSend, drips = null, noiseBuf, ok = false;
  const A = {
    get ready() { return ok; },
    async start() {
      if (ctx) { await ctx.resume?.(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
        await ctx.resume();
        build();
        ok = true;
      } catch (e) { console.warn('audio non disponibile', e); }
    },
    suspend() { ctx?.suspend?.(); },
    resume() { ctx?.resume?.(); },
    setListener(cam) {
      if (!ok) return;
      const L = ctx.listener, p = cam.position;
      const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z;
        L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
      } else { L.setPosition?.(p.x, p.y, p.z); L.setOrientation?.(fw.x, fw.y, fw.z, up.x, up.y, up.z); }
    },
    // abbassa ambiente + ronzio (silenzio di tensione)
    duck(level, time = 1) {
      if (!ok) return; const t = ctx.currentTime;
      amb.gain.cancelScheduledValues(t); amb.gain.setTargetAtTime(0.5 * level, t, time / 3);
      hum.gain.cancelScheduledValues(t); hum.gain.setTargetAtTime(0.035 * level, t, time / 3);
      dripOn = level > 0.5;
    },
    step(speed = 1) {
      if (!ok) return; const t = ctx.currentTime;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240 + Math.random() * 140; f.Q.value = 0.9;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.3;
      s.connect(f); f.connect(g); g.connect(master); g.connect(verbSend);
      const v = 0.22 * (0.6 + speed * 0.4);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);
      s.start(t, Math.random() * 1.5, 0.25);
      // grana di ghiaia
      const g2 = ctx.createGain(); const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 2500;
      const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.connect(f2); f2.connect(g2); g2.connect(master);
      g2.gain.setValueAtTime(0, t + 0.01); g2.gain.linearRampToValueAtTime(0.05, t + 0.02); g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      s2.start(t, Math.random() * 1.5, 0.2);
    },
    heartbeat(level = 0.5) {
      if (!ok) return; const t = ctx.currentTime;
      for (const [dt, v] of [[0, 1], [0.22, 0.7]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.28 * level * v, t + dt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.2);
        o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.25);
      }
    },
    // swell sub-basso che precede un evento
    swell(dur = 3, level = 0.5) {
      if (!ok) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 38; o2.type = 'sine'; o2.frequency.value = 40.6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * level, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.7); o2.stop(t + dur + 0.7);
    },
    // impatto sul vetro (pos: THREE.Vector3). 2 colpi ravvicinati.
    glassHit(pos, power = 1) {
      if (!ok) return; const t = ctx.currentTime;
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 2.5; pan.rolloffFactor = 0.8;
      pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
      const out = ctx.createGain(); out.gain.value = 1; out.connect(pan); pan.connect(master); pan.connect(verbSend);
      const hit = (t0, p) => {
        // corpo: thump sub
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.28);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.95 * p, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.75);
        // schiocco: rumore filtrato sul vetro
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(0.8 * p, t0 + 0.002); g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        s.connect(f); f.connect(g2); g2.connect(out); s.start(t0, Math.random(), 0.3);
        // risonanza del vetro (modi inarmonici)
        for (const fr of [310, 487, 733, 1140]) {
          const oo = ctx.createOscillator(), gg = ctx.createGain();
          oo.type = 'sine'; oo.frequency.value = fr * (0.98 + Math.random() * 0.04);
          gg.gain.setValueAtTime(0, t0); gg.gain.linearRampToValueAtTime(0.06 * p, t0 + 0.003); gg.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.9);
          oo.connect(gg); gg.connect(out); oo.start(t0); oo.stop(t0 + 1);
        }
      };
      hit(t, power); hit(t + 0.11, power * 0.85);
    },
    // portone di ferro che sbatte contro i muri
    doorBang(pos, power = 1) {
      if (!ok) return; const t = ctx.currentTime;
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 3; pan.rolloffFactor = 0.7;
      pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
      const out = ctx.createGain(); out.connect(pan); pan.connect(master);
      const rv = ctx.createGain(); rv.gain.value = 1.6; pan.connect(rv); rv.connect(verbSend);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.0 * power, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.6;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.9 * power, t + 0.003); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      s.connect(f); f.connect(g2); g2.connect(out); s.start(t, Math.random(), 0.4);
      for (const [fr, d] of [[143, 1.9], [231, 1.6], [389, 1.3], [611, 1.0], [947, 0.7]]) {
        const oo = ctx.createOscillator(), gg = ctx.createGain(); oo.type = 'triangle'; oo.frequency.value = fr * (0.985 + Math.random() * 0.03);
        gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.075 * power, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0004, t + d);
        oo.connect(gg); gg.connect(out); oo.start(t); oo.stop(t + d + 0.1);
      }
      // secondo impatto più morbido (rimbalzo dei battenti)
      const t2 = t + 0.34, o2 = ctx.createOscillator(), g3 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(70, t2); o2.frequency.exponentialRampToValueAtTime(32, t2 + 0.3);
      g3.gain.setValueAtTime(0, t2); g3.gain.linearRampToValueAtTime(0.5 * power, t2 + 0.005); g3.gain.exponentialRampToValueAtTime(0.001, t2 + 0.6);
      o2.connect(g3); g3.connect(out); o2.start(t2); o2.stop(t2 + 0.7);
    },
    // respiro spaziale: ritorna un controller {setPos, setLevel, stop}
    breath() {
      if (!ok) return null;
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.2; pan.rolloffFactor = 1;
      const out = ctx.createGain(); out.gain.value = 0; out.connect(pan); pan.connect(master);
      const rv = ctx.createGain(); rv.gain.value = 0.5; pan.connect(rv); rv.connect(verbSend);
      let alive = true;
      const once = () => {
        if (!alive) return; const t = ctx.currentTime, inh = 1.0 + Math.random() * 0.25, exh = 1.5 + Math.random() * 0.4;
        const mk = (t0, dur, f0, f1, peak) => {
          const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + Math.random() * 0.2;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.setValueAtTime(f0, t0); bp.frequency.linearRampToValueAtTime(f1, t0 + dur);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
          const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.55); g.gain.linearRampToValueAtTime(0, t0 + dur);
          // leggero tremolio rauco
          const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 18 + Math.random() * 8; lg.gain.value = peak * 0.35; lf.connect(lg); lg.connect(g.gain); lf.start(t0); lf.stop(t0 + dur);
          s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out); s.start(t0, Math.random() * 1.2, dur + 0.1);
        };
        mk(t, inh, 900, 1400, 0.55); mk(t + inh + 0.12, exh, 800, 500, 0.8);
        setTimeout(once, (inh + exh + 0.9 + Math.random() * 0.8) * 1000);
      };
      once();
      return {
        setPos(x, y, z) { pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z; },
        setLevel(v, tc = 0.5) { out.gain.setTargetAtTime(v, ctx.currentTime, tc); },
        stop() { alive = false; out.gain.setTargetAtTime(0, ctx.currentTime, 0.3); },
      };
    },
    // gocce
    _drip(pan = 0) {
      if (!ok) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = 'sine'; const f0 = 1400 + Math.random() * 900;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.07);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.18);
      p.pan.value = pan; o.connect(g); g.connect(p); p.connect(master); p.connect(verbSend); o.start(t); o.stop(t + 0.2);
    },
  };

  let dripOn = true;
  function build() {
    const sr = ctx.sampleRate;
    // buffer di rumore bianco condiviso
    noiseBuf = ctx.createBuffer(1, sr * 2, sr);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);

    // riverbero sintetico: impulso di rumore con decadimento (≈2.6 s), filtrato
    const len = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const a = ir.getChannelData(c); for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb = ctx.createConvolver(); verb.buffer = ir;
    const vf = ctx.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 2400;
    verbSend = ctx.createGain(); verbSend.gain.value = 0.35;
    verbSend.connect(vf); vf.connect(verb); verb.connect(master);

    // ambiente: rumore marrone filtrato con lenta modulazione
    const ab = ctx.createBuffer(1, sr * 6, sr), ad = ab.getChannelData(0); let last = 0;
    for (let i = 0; i < ad.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; ad[i] = last * 3.5; }
    const as = ctx.createBufferSource(); as.buffer = ab; as.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    amb = ctx.createGain(); amb.gain.value = 0.5;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    as.connect(lp); lp.connect(amb); amb.connect(master); as.start();

    // ronzio elettrico 50/100/150 Hz
    hum = ctx.createGain(); hum.gain.value = 0.035; hum.connect(master);
    for (const [f, v] of [[50, 1], [100, 0.6], [150, 0.25]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = v * 0.5;
      const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 400;
      o.connect(bp); bp.connect(g); g.connect(hum); o.start();
    }

    // gocce a intervalli irregolari
    (function loop() {
      setTimeout(() => { if (dripOn && ctx.state === 'running') A._drip((Math.random() - 0.5) * 1.6); loop(); }, 2500 + Math.random() * 6500);
    })();
  }
  return A;
}
