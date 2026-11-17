// Ritmo della sala: doppi tonfi irregolari e due corse nel buio. Il clock e' quello audio.
export function createHallPressure(ctx, noiseBuffer, output, reverb, getSteps = () => []) {
  const dry = ctx.createGain(), wet = ctx.createGain();
  dry.gain.value = wet.gain.value = 0.85; dry.connect(output); wet.connect(reverb);
  const voices = new Set(), intervals = [0.98, 1.04, 0.95, 1.02, 1, 0.97];
  let alive = true, stage = 0, nextBeat = ctx.currentTime + 0.035, beat = 0, released = false;
  const release = () => { if (!released) { released = true; dry.disconnect(); wet.disconnect(); } };
  const track = (nodes, sources, at, kind) => {
    const voice = { sources, at, kind }; voices.add(voice); let remaining = sources.length;
    sources.forEach(source => { source.onended = () => {
      if (--remaining) return;
      nodes.forEach(node => node.disconnect()); voices.delete(voice);
      if (!alive && !voices.size) release();
    }; });
  };
  const gain = (nodes, value = 1) => { const g = ctx.createGain(); g.gain.value = value; nodes.push(g); return g; };
  const envelope = (param, at, duration, level) => {
    param.setValueAtTime(0, at); param.linearRampToValueAtTime(level, at + 0.012);
    param.exponentialRampToValueAtTime(0.0001, at + duration);
  };
  const spatial = (nodes, fromZ, toZ, at, duration, side, room) => {
    const pan = ctx.createPanner(); nodes.push(pan);
    pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 6; pan.rolloffFactor = 0.8;
    pan.positionX.setValueAtTime(side, at); pan.positionY.setValueAtTime(0.12, at);
    pan.positionZ.setValueAtTime(fromZ, at); pan.positionZ.linearRampToValueAtTime(toZ, at + duration);
    pan.connect(dry); const send = gain(nodes, room); pan.connect(send); send.connect(wet); return pan;
  };
  const pulse = (at, strength) => {
    const nodes = [], sources = [], env = gain(nodes, 0); env.connect(dry);
    envelope(env.gain, at, 0.20, strength);
    for (const [type, from, to, level] of [['sine', 74, 43, 1], ['triangle', 153, 103, 0.23]]) {
      const osc = ctx.createOscillator(), g = gain(nodes, level); nodes.push(osc); sources.push(osc);
      osc.type = type; osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + 0.17);
      osc.connect(g); g.connect(env);
    }
    track(nodes, sources, at, 'pulse'); sources.forEach(source => { source.start(at); source.stop(at + 0.23); });
  };
  const pump = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    if (nextBeat < now - 0.1) nextBeat = now + 0.025; // nessuna raffica di recupero dopo uno stallo
    while (nextBeat < now + 0.30) {
      const level = [0.060, 0.085, 0.115][stage];
      pulse(nextBeat, level); pulse(nextBeat + 0.17, level * 0.58);
      nextBeat += [1.2, 0.76, 0.50][stage] * intervals[beat++ % intervals.length];
    }
  };
  const step = (at, duration, fromZ, toZ, side, near, index) => {
    const nodes = [], sources = [], pan = spatial(nodes, fromZ, toZ, at, duration, side, near ? 0.14 : 0.55);
    const src = ctx.createBufferSource(); nodes.push(src); sources.push(src);
    const clips = getSteps(), clip = clips[index % Math.max(1, clips.length)]; src.buffer = clip || noiseBuffer;
    src.playbackRate.value = near ? 0.88 : 0.78;
    const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(); nodes.push(hp, lp);
    hp.type = 'highpass'; hp.frequency.value = 95; lp.type = 'lowpass'; lp.frequency.value = near ? 2200 : 1050;
    const env = gain(nodes, 0); envelope(env.gain, at, duration - 0.015, near ? 0.22 : 0.17);
    src.connect(hp); hp.connect(lp); lp.connect(env); env.connect(pan);
    const body = ctx.createOscillator(), bg = gain(nodes, 0); nodes.push(body); sources.push(body);
    body.type = 'triangle'; body.frequency.setValueAtTime(116, at); body.frequency.exponentialRampToValueAtTime(67, at + duration * 0.8);
    envelope(bg.gain, at, duration - 0.02, near ? 0.10 : 0.075); body.connect(bg); bg.connect(pan);
    track(nodes, sources, at, 'step'); sources.forEach(source => { source.start(at); source.stop(at + duration); });
  };
  return {
    update: pump,
    setStage(value) {
      if (!alive) return;
      stage = Math.max(0, Math.min(2, value)); const now = ctx.currentTime;
      for (const voice of voices) if (voice.kind === 'pulse' && voice.at > now) voice.sources.forEach(source => source.stop(now));
      nextBeat = now + 0.035; pump();
    },
    rush(fromZ, toZ, duration = 0.7) {
      if (!alive) return;
      const at = ctx.currentTime + 0.015, near = stage > 0, offsets = near ? [0.015, 0.22, 0.43] : [0.025, 0.33];
      offsets.forEach((offset, i) => step(at + offset, Math.min(0.21, duration - offset - 0.025), fromZ + (toZ - fromZ) * offset / duration, toZ, i % 2 ? 0.55 : -0.45, near, i + stage));
      const nodes = [], src = ctx.createBufferSource(); nodes.push(src); src.buffer = noiseBuffer; src.loop = true; src.playbackRate.value = near ? 0.70 : 0.55;
      const bp = ctx.createBiquadFilter(); nodes.push(bp); bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(near ? 610 : 350, at); bp.frequency.linearRampToValueAtTime(near ? 1150 : 620, at + duration);
      const env = gain(nodes, 0); env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(near ? 0.055 : 0.038, at + 0.12); env.gain.linearRampToValueAtTime(0, at + duration - 0.025);
      const pan = spatial(nodes, fromZ, toZ, at, duration, near ? 0.2 : -0.2, near ? 0.14 : 0.55);
      src.connect(bp); bp.connect(env); env.connect(pan); track(nodes, [src], at, 'drag'); src.start(at); src.stop(at + duration - 0.015);
    },
    stop(fade = 0.12) {
      if (!alive) return; alive = false; const now = ctx.currentTime;
      for (const bus of [dry, wet]) {
        if (bus.gain.cancelAndHoldAtTime) bus.gain.cancelAndHoldAtTime(now);
        else { const value = bus.gain.value; bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(value, now); }
        bus.gain.linearRampToValueAtTime(0, now + fade);
      }
      for (const voice of voices) voice.sources.forEach(source => source.stop(now + fade + 0.025));
      if (!voices.size) release();
    },
  };
}
