// Accenti ambientali brevi e bassi: nessun loop permanente o timer esterno.
const SOUNDS = {
  draft: { duration: 6.2, band: 340, cutoff: 850, noise: 0.11, tones: [] },
  pipes: { duration: 3.4, band: 270, cutoff: 720, noise: 0.025, tones: [[147, 0.009], [231, 0.005], [357, 0.002]] },
  vent: { duration: 5.4, band: 190, cutoff: 480, noise: 0.075, tones: [[96, 0.003], [99.1, 0.002]] },
  timber: { duration: 3.6, band: 510, cutoff: 1100, noise: 0.045, tones: [[173, 0.007], [289, 0.003]] },
};

export function createAmbientCue(ctx, noiseBuffer, output, kind, position) {
  const sound = SOUNDS[kind]; if (!sound) return null;
  const now = ctx.currentTime, duration = sound.duration, nodes = [], sources = [];
  const own = (node) => { nodes.push(node); return node; };
  const out = own(ctx.createGain()), pan = own(ctx.createPanner());
  pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 3; pan.rolloffFactor = 1;
  pan.positionX.value = position[0]; pan.positionY.value = position[1]; pan.positionZ.value = position[2];
  out.connect(pan); pan.connect(output);
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(1, now + 0.9);
  out.gain.linearRampToValueAtTime(0.65, now + duration * 0.6);
  out.gain.linearRampToValueAtTime(0, now + duration);

  const noise = own(ctx.createBufferSource()); noise.buffer = noiseBuffer; noise.loop = true;
  noise.playbackRate.value = 0.78 + Math.random() * 0.08;
  const bp = own(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(sound.band, now); bp.frequency.exponentialRampToValueAtTime(sound.band * 0.82, now + duration);
  const lp = own(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = sound.cutoff;
  const ng = own(ctx.createGain()); ng.gain.value = sound.noise;
  noise.connect(bp); bp.connect(lp); lp.connect(ng); ng.connect(out); sources.push(noise);
  for (const [frequency, level] of sound.tones) {
    const osc = own(ctx.createOscillator()), gain = own(ctx.createGain());
    const f = frequency * (0.99 + Math.random() * 0.02);
    osc.frequency.setValueAtTime(f, now); osc.frequency.exponentialRampToValueAtTime(f * (kind === 'timber' ? 0.76 : 0.95), now + duration);
    gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(level * 0.2, now + duration);
    osc.connect(gain); gain.connect(out); sources.push(osc);
  }
  let remaining = sources.length, ended = false, stopping = false;
  for (const source of sources) {
    source.onended = () => { if (--remaining === 0) { ended = true; nodes.forEach((node) => node.disconnect()); } };
    source.start(now); source.stop(now + duration + 0.05);
  }
  return {
    duration,
    stop() {
      if (ended || stopping) return; stopping = true;
      const t = ctx.currentTime;
      if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(t);
      else { const value = out.gain.value; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(value, t); }
      out.gain.linearRampToValueAtTime(0, t + 0.25);
      sources.forEach((source) => source.stop(t + 0.3));
    },
  };
}

// Finestre di esplorazione, lontane dagli attacchi principali. Al massimo un
// accento per ambiente nella partita; si interrompe uscendo o durante i silenzi.
const MOMENTS = {
  tunnel: { from: -10, to: -17, delay: 4, kind: 'draft', position: [-1.2, 2.0, -13] },
  ward: { from: -483, to: -487, delay: 2, kind: 'pipes', position: [-1.8, 2.2, -485] },
  morgue: { from: -509.2, to: -512.5, delay: 4, kind: 'vent', position: [4.2, 2.4, -510] },
  warehouse: { from: -405, to: -410.5, delay: 3, kind: 'timber', position: [-4.8, 2.7, -407] },
};

export function createAmbientMoments({ player, audio, story, combat }) {
  const heard = new Set(); let room = '', elapsed = 0, playing = null, age = 0;
  const stop = () => { playing?.stop(); playing = null; age = 0; };
  return (dt) => {
    const cur = story.current();
    if (cur !== room) { stop(); room = cur; elapsed = 0; }
    if (story.busy() || player.frozen || combat?.active || !audio.ambienceAllowed) { stop(); return; }
    elapsed += dt;
    const moment = MOMENTS[cur]; if (!moment) { stop(); return; }
    const z = player.pos.z, inside = z <= moment.from && z >= moment.to;
    if (playing) { age += dt; if (!inside) stop(); else if (age >= playing.duration) { playing = null; age = 0; } }
    if (!inside || playing || heard.has(cur) || elapsed < moment.delay) return;
    playing = audio.ambientCue(moment.kind, moment.position);
    if (playing) { heard.add(cur); age = 0; }
  };
}
