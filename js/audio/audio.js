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
        loadSteps();
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
      if (steps.length) {
        // campione reale (CC0): variazione di campione, intonazione e lato; leggermente ovattato e con coda di riverbero
        let i; do { i = Math.floor(Math.random() * steps.length); } while (i === lastStep && steps.length > 1); lastStep = i;
        const src = ctx.createBufferSource(); src.buffer = steps[i]; src.playbackRate.value = 0.9 + Math.random() * 0.14;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        const g = ctx.createGain(); g.gain.value = 0.34 * (0.7 + 0.3 * speed) * (0.9 + Math.random() * 0.2);
        const pn = ctx.createStereoPanner(); pn.pan.value = (stepSide = -stepSide) * 0.12;
        src.connect(lp); lp.connect(g); g.connect(pn); pn.connect(master);
        const rs = ctx.createGain(); rs.gain.value = 0.55; g.connect(rs); rs.connect(verbSend);
        src.start(t);
        // corpo: tonfo del tallone, che dà peso al passo su un pavimento di pietra
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.14);
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.16 * (0.6 + 0.4 * speed), t + 0.008); og.gain.exponentialRampToValueAtTime(0.0006, t + 0.2);
        o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.25);
        return;
      }
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
    // JUMP SCARE (organico, niente toni elettrici): colpo del corpo + ruggito di rumore formantico + respiro a scatto
    scare() {
      if (!ok) return; const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0.95, t);
      // colpo sub
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(24, t + 0.9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.95, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.1);
      // impatto del corpo: rumore filtrato in basso (niente sibilo)
      const s1 = ctx.createBufferSource(); s1.buffer = noiseBuf; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4;
      const g1 = ctx.createGain(); g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.9, t + 0.004); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      s1.connect(lp); lp.connect(g1); g1.connect(master); g1.connect(verbSend); s1.start(t, 0.3, 0.5);
      // ruggito: rumore → due formanti che scendono, modulato in ampiezza (raucedine ~26 Hz)
      const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true;
      const mix = ctx.createGain(); mix.gain.value = 1;
      for (const [f0, f1, q, v] of [[820, 430, 7, 1], [1550, 980, 8, 0.7], [2600, 1700, 6, 0.3]]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + 0.95);
        const gv = ctx.createGain(); gv.gain.value = v; s2.connect(bp); bp.connect(gv); gv.connect(mix);
      }
      const am = ctx.createGain(); am.gain.value = 0.55; const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 26; lg.gain.value = 0.45; lf.connect(lg); lg.connect(am.gain);
      const env = ctx.createGain(); env.gain.setValueAtTime(0, t + 0.02); env.gain.linearRampToValueAtTime(1.15, t + 0.08); env.gain.setValueAtTime(1.0, t + 0.45); env.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
      const sh = ctx.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) cv[i] = Math.tanh((i / 128 - 1) * 2.2); sh.curve = cv;
      mix.connect(am); am.connect(sh); sh.connect(env); env.connect(master); env.connect(verbSend);
      s2.start(t, 0.5); lf.start(t); s2.stop(t + 1.2); lf.stop(t + 1.2);
    },
    // luce della sala: clack + ronzio breve
    lightOn() {
      if (!ok) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(master); g.connect(verbSend); o.start(t); o.stop(t + 0.35);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.28, t + 0.002); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      s.connect(f); f.connect(g2); g2.connect(master); s.start(t, 0.4, 0.2);
    },
    // passi di una folla nel buio: tanti passi lontani, morbidi, sparsi nel tempo
    shuffle(dur = 3, level = 0.4) {
      if (!ok || !steps.length) return; const t = ctx.currentTime, n = Math.round(dur * 7);
      for (let i = 0; i < n; i++) {
        const t0 = t + Math.random() * dur, src = ctx.createBufferSource(); src.buffer = steps[Math.floor(Math.random() * steps.length)]; src.playbackRate.value = 0.7 + Math.random() * 0.25;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800 + Math.random() * 500;
        const g = ctx.createGain(); g.gain.value = level * (0.25 + Math.random() * 0.5); const pn = ctx.createStereoPanner(); pn.pan.value = (Math.random() - 0.5) * 1.6;
        src.connect(lp); lp.connect(g); g.connect(pn); pn.connect(master); const rs = ctx.createGain(); rs.gain.value = 0.8; g.connect(rs); rs.connect(verbSend); src.start(t0);
      }
    },
    // taglio netto: tutto muto
    cut(time = 0.04) { if (!ok) return; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, time); },
    unmute() { if (!ok) return; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.2); },
    // passaggio fulmineo di una presenza da sinistra a destra: spostamento d'aria + tonfo sordo
    dash(dur = 0.5) {
      if (!ok) return; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(380, t); bp.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.45); bp.frequency.exponentialRampToValueAtTime(450, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
      const pn = ctx.createStereoPanner(); pn.pan.setValueAtTime(-0.95, t); pn.pan.linearRampToValueAtTime(0.95, t + dur);
      s.connect(bp); bp.connect(g); g.connect(pn); pn.connect(master); const rs = ctx.createGain(); rs.gain.value = 0.7; pn.connect(rs); rs.connect(verbSend);
      s.start(t); s.stop(t + dur + 0.2);
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + dur * 0.4); o.frequency.exponentialRampToValueAtTime(28, t + dur * 0.4 + 0.5);
      og.gain.setValueAtTime(0, t + dur * 0.4); og.gain.linearRampToValueAtTime(0.9, t + dur * 0.4 + 0.01); og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.4 + 0.7);
      o.connect(og); og.connect(master); o.start(t + dur * 0.4); o.stop(t + dur * 0.4 + 0.8);
    },
    // sussurro senza parole (rumore aspirato filtrato), per i momenti dello specchio
    whisper(dur = 2.2, level = 0.35) {
      if (!ok) return; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(1900, t); bp.frequency.linearRampToValueAtTime(1300, t + dur);
      const am = ctx.createGain(); am.gain.value = 0.5; const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 6.5; lg.gain.value = 0.5; lf.connect(lg); lg.connect(am.gain);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(bp); bp.connect(am); am.connect(g); g.connect(master); g.connect(verbSend); s.start(t); lf.start(t); s.stop(t + dur + 0.1); lf.stop(t + dur + 0.1);
    },
    // COLPO DI PISTOLA: schiocco + corpo + tonfo + coda di riverbero lunga; poi fischio nelle orecchie
    shot(power = 1) {
      if (!ok) return; const t = ctx.currentTime;
      const nz = (dur, ftype, f, q, peak, dec, st = Math.random()) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * power, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + dec); s.connect(fl); fl.connect(g); g.connect(master); g.connect(verbSend); s.start(t, st, dur); };
      nz(0.12, 'highpass', 1800, 0.5, 1.0, 0.07);       // schiocco
      nz(0.3, 'lowpass', 900, 0.6, 0.95, 0.2);          // corpo
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.95 * power, t + 0.003); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.35);
      const rv = ctx.createGain(); rv.gain.value = 1.3 * power; og.connect(rv); rv.connect(verbSend);
      // bossolo che rimbalza
      for (const [dt, f] of [[0.28, 3300], [0.36, 2700], [0.41, 3900]]) { const c = ctx.createOscillator(), cg = ctx.createGain(); c.type = 'triangle'; c.frequency.value = f; cg.gain.setValueAtTime(0, t + dt); cg.gain.linearRampToValueAtTime(0.05, t + dt + 0.002); cg.gain.exponentialRampToValueAtTime(0.0004, t + dt + 0.13); c.connect(cg); cg.connect(master); c.start(t + dt); c.stop(t + dt + 0.15); }
      // acufene: si accumula con i colpi
      this._ring = Math.min(1, (this._ring || 0) + 0.28);
      const r = ctx.createOscillator(), rg = ctx.createGain(); r.type = 'sine'; r.frequency.value = 4100; rg.gain.setValueAtTime(0.012 * this._ring, t + 0.05); rg.gain.exponentialRampToValueAtTime(0.0003, t + 3.2); r.connect(rg); rg.connect(master); r.start(t + 0.05); r.stop(t + 3.3);
    },
    // otturatore bloccato: click a vuoto
    dry() {
      if (!ok) return; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400; const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05); s.connect(hp); hp.connect(g); g.connect(master); s.start(t, Math.random(), 0.08);
    },
    // arma che cade sul pavimento di pietra, rimbalza
    clatter() {
      if (!ok) return; const t = ctx.currentTime;
      for (const [dt, v] of [[0, 1], [0.16, 0.6], [0.27, 0.35], [0.34, 0.2]]) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2; const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.7 * v, t + dt + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.12); s.connect(bp); bp.connect(g); g.connect(master); g.connect(verbSend); s.start(t + dt, Math.random(), 0.2);
        for (const fr of [820, 1730, 2900]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = fr * (0.97 + Math.random() * 0.06); og.gain.setValueAtTime(0, t + dt); og.gain.linearRampToValueAtTime(0.06 * v, t + dt + 0.002); og.gain.exponentialRampToValueAtTime(0.0004, t + dt + 0.5); o.connect(og); og.connect(master); o.start(t + dt); o.stop(t + dt + 0.55); }
      }
    },
    // passo pesante e lento (il mostro): tonfo + sfregamento, con posizione 3D
    heavyStep(pos, power = 1) {
      if (!ok) return; const t = ctx.currentTime;
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.refDistance = 2; pan.positionX.value = pos.x; pan.positionY.value = 0.3; pan.positionZ.value = pos.z; pan.connect(master); const rs = ctx.createGain(); rs.gain.value = 0.7; pan.connect(rs); rs.connect(verbSend);
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8 * power, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(pan); o.start(t); o.stop(t + 0.3);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.5 * power, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3); s.connect(lp); lp.connect(g2); g2.connect(pan); s.start(t, Math.random(), 0.35);
    },
    // cigolio metallico di ruote/telaio che si bloccano: sega filtrata con pitch che scende e vibrato lento, + grana
    squeak(dur = 0.7, pos = null) {
      if (!ok) return; const t = ctx.currentTime;
      const out = ctx.createGain(); out.gain.value = 1;
      if (pos) { const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.refDistance = 2; pn.positionX.value = pos.x; pn.positionY.value = 0.6; pn.positionZ.value = pos.z; out.connect(pn); pn.connect(master); pn.connect(verbSend); } else { out.connect(master); out.connect(verbSend); }
      for (const [f0, f1, v] of [[1180, 760, 1], [1790, 1150, 0.5]]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1 * 1.04, t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(f1 * 0.8, t + dur);
        const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 9; lg.gain.value = 38; lf.connect(lg); lg.connect(o.frequency);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.05); g.gain.setValueAtTime(0.07 * v, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(bp); bp.connect(g); g.connect(out); o.start(t); lf.start(t); o.stop(t + dur + 0.05); lf.stop(t + dur + 0.05);
      }
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 2; const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.03, t + 0.08); g2.gain.linearRampToValueAtTime(0, t + dur); s.connect(hp); hp.connect(g2); g2.connect(out); s.start(t); s.stop(t + dur + 0.05);
    },
    // VENTO + silenzio dell'aperto: rumore filtrato con raffiche lente, molto basso; ritorna un controller {stop}
    wind(level = 0.5) {
      if (!ok) return null; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.6;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * level, t + 4);
      const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 0.11; lg.gain.value = 0.07 * level; lf.connect(lg); lg.connect(g.gain);
      const lf2 = ctx.createOscillator(), lg2 = ctx.createGain(); lf2.frequency.value = 0.07; lg2.gain.value = 140; lf2.connect(lg2); lg2.connect(lp.frequency);
      s.connect(lp); lp.connect(bp); bp.connect(g); g.connect(master); g.connect(verbSend); s.start(t); lf.start(t); lf2.start(t);
      return { stop(tc = 1.2) { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, tc); setTimeout(() => { try { s.stop(); lf.stop(); lf2.stop(); } catch (_) {} }, 6000); } };
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

  let dripOn = true, steps = [], lastStep = -1, stepSide = 1;
  async function loadSteps() {
    try {
      const bufs = await Promise.all([0, 1, 2, 3, 4].map(async (i) => {
        const r = await fetch(`assets/audio/step${i}.mp3`); if (!r.ok) throw new Error(r.status);
        return ctx.decodeAudioData(await r.arrayBuffer());
      }));
      steps = bufs;
    } catch (e) { console.warn('passi: uso la sintesi', e); steps = []; }
  }
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
