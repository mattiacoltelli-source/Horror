// Folla: campane spezzate sulle riapparizioni, ritmo serrato e passi solo nei bui.
// Ogni taglio arriva dalla regia, non da timer indipendenti. Anche il riverbero
// breve appartiene a questo gruppo, per poterlo troncare prima del respiro.
export function createHallPressure(ctx, noiseBuffer, output, _reverb, getSteps = () => []) {
  const system = [], voices = new Set();
  const gain = (nodes, value = 1) => { const g = ctx.createGain(); g.gain.value = value; nodes.push(g); return g; };
  const mix = gain(system, 2.7), dry = gain(system, 0.88), roomIn = gain(system), roomOut = gain(system, 0.5);
  mix.connect(output); dry.connect(mix); roomOut.connect(mix);
  const roomFilter = ctx.createBiquadFilter(); system.push(roomFilter); roomFilter.type = 'lowpass'; roomFilter.frequency.value = 1850; roomIn.connect(roomFilter);
  for (const [time, level] of [[0.047, 0.27], [0.103, 0.15], [0.173, 0.075]]) {
    const delay = ctx.createDelay(0.25), tap = gain(system, level); system.push(delay); delay.delayTime.value = time;
    roomFilter.connect(delay); delay.connect(tap); tap.connect(roomOut);
  }
  let alive = true, released = false, stage = 0, mode = 'idle', started = ctx.currentTime, nextBeat = Infinity, beat = 0;
  const safeStop = (source, at) => { try { source.stop(at); } catch (_) {} };
  const hold = (param, at) => {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(at);
    else { const value = param.value; param.cancelScheduledValues(at); param.setValueAtTime(value, at); }
  };
  const release = () => { if (!released) { released = true; system.forEach(node => node.disconnect()); } };
  const track = (nodes, sources, at, gate, kind) => {
    const voice = { sources, gate, kind, at }; voices.add(voice); let remaining = sources.length;
    for (const source of sources) source.onended = () => {
      if (--remaining) return;
      nodes.forEach(node => node.disconnect()); voices.delete(voice);
      if (!alive && !voices.size) release();
    };
  };
  const choke = (now, fade = 0.008) => {
    for (const voice of voices) {
      hold(voice.gate.gain, now); voice.gate.gain.linearRampToValueAtTime(0, now + fade);
      voice.sources.forEach(source => safeStop(source, now + fade + 0.008));
    }
  };
  const clearRoom = (now, mute) => {
    hold(roomOut.gain, now); roomOut.gain.linearRampToValueAtTime(0, now + 0.004);
    roomOut.gain.setValueAtTime(0, now + mute); roomOut.gain.linearRampToValueAtTime(0.5, now + mute + 0.04);
  };
  const envelope = (param, at, duration, level, attack = 0.004) => {
    param.setValueAtTime(0, at); param.linearRampToValueAtTime(level, at + Math.min(attack, duration * 0.2));
    param.exponentialRampToValueAtTime(0.00001, at + duration);
  };
  const route = (nodes, at, duration, room, fromZ = null, toZ = fromZ, side = 0) => {
    const gate = gain(nodes), send = gain(nodes, room); let out = gate;
    if (fromZ != null) {
      const pan = ctx.createPanner(); nodes.push(pan); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 7; pan.rolloffFactor = 0.75;
      pan.positionX.setValueAtTime(side, at); pan.positionY.setValueAtTime(0.25, at); pan.positionZ.setValueAtTime(fromZ, at); pan.positionZ.linearRampToValueAtTime(toZ, at + duration);
      gate.connect(pan); out = pan;
    }
    out.connect(dry); out.connect(send); send.connect(roomIn); return gate;
  };
  const bell = (at, z) => {
    const nodes = [], sources = [], root = [165, 146.8, 130.8][stage], duration = [1.9, 1.25, 0.82][stage];
    const gate = route(nodes, at, duration, [0.55, 0.30, 0.14][stage], z), filter = ctx.createBiquadFilter(); nodes.push(filter);
    filter.type = 'lowpass'; filter.frequency.value = [1550, 2300, 3200][stage]; filter.Q.value = 0.45; filter.connect(gate);
    // Il bronzo suona in tre frammenti, poi muore. I frammenti si stringono
    // a ogni apparizione; il colpo iniziale coincide con la nuova distanza.
    const speed = [1, 0.78, 0.58][stage]; gate.gain.setValueAtTime(1, at);
    for (const [time, level] of [[0.075,1],[0.095,0.025],[0.15,0.025],[0.17,0.72],[0.225,0.62],[0.245,0.035],[0.30,0.035],[0.32,0.46]]) gate.gain.linearRampToValueAtTime(level, at + time * speed);
    gate.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    const level = [0.062, 0.090, 0.12][stage];
    for (const [ratio, weight, decay] of [[0.5,.8,1],[1,1,.92],[1.183,.64,.72],[1.506,.42,.55],[2.514,.24,.36],[3.011,.12,.24]]) {
      for (const detune of [0.9985, 1.0025]) {
        const osc = ctx.createOscillator(), amp = gain(nodes, 0); nodes.push(osc); sources.push(osc);
        osc.frequency.value = root * ratio * detune; envelope(amp.gain, at, duration * decay, level * weight * 0.5, 0.006);
        osc.connect(amp); amp.connect(filter);
      }
    }
    const strike = ctx.createBufferSource(), hit = gain(nodes, 0); nodes.push(strike); sources.push(strike); strike.buffer = noiseBuffer;
    envelope(hit.gain, at, 0.065, level * 0.7, 0.002); strike.connect(hit); hit.connect(filter);
    track(nodes, sources, at, gate, 'bell'); sources.forEach(s => { s.start(at); s.stop(at + duration + 0.025); });
  };
  const knock = (at, strength, accent) => {
    const nodes = [], sources = [], gate = route(nodes, at, 0.15, 0.08), env = gain(nodes, 0); env.connect(gate);
    envelope(env.gain, at, accent ? 0.16 : 0.09, strength, 0.003);
    for (const [type, from, to, level] of [['sine',77,43,1],['triangle',157,102,0.36],['sine',accent ? 587 : 659,421,0.18]]) {
      const osc = ctx.createOscillator(), amp = gain(nodes, level); nodes.push(osc); sources.push(osc); osc.type = type;
      osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + 0.09); osc.connect(amp); amp.connect(env);
    }
    track(nodes, sources, at, gate, 'knock'); sources.forEach(s => { s.start(at); s.stop(at + 0.18); });
  };
  const step = (at, duration, fromZ, toZ, side, near, index, strength = 1) => {
    const nodes = [], sources = [], gate = route(nodes, at, duration, near ? 0.13 : 0.35, fromZ, toZ, side);
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), env = gain(nodes, 0); nodes.push(src, hp, lp); sources.push(src);
    const clips = getSteps(); src.buffer = clips[index % Math.max(1, clips.length)] || noiseBuffer; src.playbackRate.value = near ? 0.96 : 0.82;
    hp.type = 'highpass'; hp.frequency.value = 90; lp.type = 'lowpass'; lp.frequency.value = near ? 3600 : 1450;
    envelope(env.gain, at, duration - 0.006, (near ? 0.31 : 0.24) * strength, 0.003);
    src.connect(hp); hp.connect(lp); lp.connect(env); env.connect(gate);
    const body = ctx.createOscillator(), bodyAmp = gain(nodes, 0); nodes.push(body); sources.push(body); body.type = 'triangle';
    body.frequency.setValueAtTime(near ? 126 : 108, at); body.frequency.exponentialRampToValueAtTime(57, at + duration * 0.8);
    envelope(bodyAmp.gain, at, duration - 0.005, (near ? 0.13 : 0.09) * strength); body.connect(bodyAmp); bodyAmp.connect(gate);
    track(nodes, sources, at, gate, 'step'); sources.forEach(s => { s.start(at); s.stop(at + duration); });
  };
  return {
    update() {
      if (!alive || mode !== 'lit') return;
      const now = ctx.currentTime;
      if (nextBeat < now - 0.08) nextBeat = now + 0.025; // niente recuperi a raffica dopo uno stallo
      while (nextBeat < now + 0.16) {
        const age = Math.min(1, Math.max(0, (nextBeat - started) / [7, 2.4, 1.5][stage]));
        const period = [1.02 - age * 0.22, 0.55 - age * 0.12, 0.32 - age * 0.065][stage];
        const offsets = stage === 0 ? [0, 0.22] : stage === 1 ? [0, 0.115, 0.23] : [0, 0.075, 0.15];
        offsets.forEach((offset, i) => knock(nextBeat + offset, [0.056,0.085,0.115][stage] * (i ? 0.52 : 1), i === 0));
        nextBeat += period * [1,0.96,1.025,0.985][beat++ % 4];
      }
    },
    setStage(value, z) {
      if (!alive) return;
      const now = ctx.currentTime; choke(now); stage = Math.max(0, Math.min(2, value)); mode = 'lit'; started = now; beat = 0;
      clearRoom(now, [0.34,0.26,0.20][stage]); bell(now + 0.008, z ?? [-76,-64,-57.5][stage]); nextBeat = now + [0.62,0.38,0.24][stage];
    },
    rush(fromZ, toZ, duration = 0.7) {
      if (!alive) return; const now = ctx.currentTime; choke(now, 0.006); mode = 'rush'; nextBeat = Infinity; clearRoom(now, 0.14);
      duration = Math.max(0.08, duration); const at = now + 0.006, near = stage > 0;
      const fractions = near ? [0.02,0.15,0.28,0.41,0.53,0.64,0.75] : [0.035,0.24,0.41,0.57,0.73];
      fractions.forEach((fraction, i) => {
        const offset = fraction * duration, length = Math.min(0.13, duration * 0.91 - offset);
        const start = fromZ + (toZ - fromZ) * fraction;
        step(at + offset, length, start, toZ, i % 2 ? 0.52 : -0.46, near, i + stage);
        if (i % 2 === 0 && duration > 0.3) step(at + offset + 0.025, Math.max(0.025,length - 0.025), start - 1.2, toZ - 0.6, i % 2 ? -0.8 : 0.85, near, i + 2, 0.38);
      });
      const nodes = [], src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = gain(nodes, 0); nodes.push(src, filter); src.buffer = noiseBuffer; src.loop = true; src.playbackRate.value = near ? 0.78 : 0.6;
      const gate = route(nodes, at, duration, 0.16, fromZ, toZ, near ? 0.15 : -0.2);
      filter.type = 'bandpass'; filter.Q.value = 0.7; filter.frequency.setValueAtTime(near ? 480 : 280, at); filter.frequency.linearRampToValueAtTime(near ? 1550 : 820, at + duration * 0.75);
      env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(near ? 0.072 : 0.045, at + duration * 0.22); env.gain.linearRampToValueAtTime(0, at + duration * 0.88);
      src.connect(filter); filter.connect(env); env.connect(gate); track(nodes, [src], at, gate, 'drag'); src.start(at); src.stop(at + duration * 0.91);
    },
    stop(fade = 0.025) {
      if (!alive) return; alive = false; const now = ctx.currentTime; choke(now, fade); hold(mix.gain, now); mix.gain.linearRampToValueAtTime(0, now + fade);
      // Il sentinella silenzioso lascia finire il fade prima di scollegare anche
      // i ritardi, pure se tutti gli altri suoni si sono gia' esauriti.
      const nodes = [], sentinel = ctx.createBufferSource(), gate = gain(nodes, 0); nodes.push(sentinel); sentinel.buffer = noiseBuffer; sentinel.connect(gate); gate.connect(dry);
      track(nodes, [sentinel], now, gate, 'cleanup'); sentinel.start(now); sentinel.stop(now + fade + 0.025);
    },
  };
}
