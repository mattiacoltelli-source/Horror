// Una stessa risonanza in luoghi diversi: Fa, Mi, Sib, senza cadenza.
// Solo tre sinusoidi con attacchi lenti; nessun buffer, timer, loop o riverbero
// condiviso, così pausa e silenzi possono interrompere anche le note future.
const CELL = [0, -1, -7];
const CUES = {
  portal:   { register: 1, stretch: 1,    drift: -3, level: .009 },
  fracture: { register: .98, stretch: .94, drift: -6, level: .008 },
  bridge:   { register: .75, stretch: 1.14, drift: -4, level: .0085 },
  sister:   { register: 1.02, stretch: .91, drift: -2, level: .0075 },
  agnese:   { register: 1, stretch: 1.08, drift: -5, level: .009 },
};
const OFFSETS = [0, 1.21, 2.93], LENGTHS = [2.15, 2.35, 2.8];
const COOLDOWN = 20;

export function createMemoryMotif(ctx, output, allowed = () => true) {
  const heard = new Set(); let active = null, nextAt = -Infinity, blockedUntil = -Infinity;

  const stop = (release = .10) => {
    if (!active) return;
    const voice = active, now = ctx.currentTime, fade = Math.max(0, Math.min(.25, release));
    // Le chiamate per frame non prolungano il fade; un cut/pausa puo' invece
    // accorciarlo immediatamente, anche se un dialogo aveva gia' richiesto stop.
    if (now + fade >= voice.stopAt) return;
    voice.stopAt = now + fade;
    // La sorgente rimane posseduta fino a onended, anche se il contesto viene sospeso.
    if (voice.out.gain.cancelAndHoldAtTime) voice.out.gain.cancelAndHoldAtTime(now);
    else {
      voice.out.gain.cancelScheduledValues(now);
      voice.out.gain.setValueAtTime(voice.out.gain.value, now);
    }
    voice.out.gain.linearRampToValueAtTime(0, now + fade);
    for (const source of voice.sources) source.stop(now + fade);
  };

  return {
    get active() { return !!active && ctx.currentTime < active.endAt; },
    // Una richiesta in una pausa registica viene scartata, mai rimandata.
    play(cue, { key = cue, level = 1 } = {}) {
      const sound = CUES[cue], now = ctx.currentTime;
      if (!sound || ctx.state !== 'running' || !allowed() || heard.has(key) ||
          now < nextAt || now < blockedUntil || active || !Number.isFinite(level) || level <= 0) return null;

      const out = ctx.createGain(), sources = [];
      out.gain.value = 1; out.connect(output);
      const at = now + .02, stretch = sound.stretch;
      const duration = .02 + (OFFSETS[2] + LENGTHS[2]) * stretch;
      const voice = { out, sources, endAt: now + duration, stopAt: Infinity };
      active = voice; heard.add(key); nextAt = now + COOLDOWN;
      let remaining = CELL.length;
      CELL.forEach((semitones, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        const start = at + OFFSETS[i] * stretch, length = LENGTHS[i] * stretch;
        const f = 174.614 * sound.register * Math.pow(2, semitones / 12);
        const peak = sound.level * Math.min(1, level) * [1, .73, .58][i];
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * Math.pow(2, sound.drift / 1200), start + length);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + .65 * stretch);
        gain.gain.exponentialRampToValueAtTime(peak * .18, start + length * .76);
        gain.gain.linearRampToValueAtTime(0, start + length);
        osc.connect(gain); gain.connect(out); sources.push(osc);
        osc.onended = () => {
          osc.disconnect(); gain.disconnect();
          if (--remaining === 0) { out.disconnect(); if (active === voice) active = null; }
        };
        osc.start(start); osc.stop(start + length);
      });
      return { duration, stop: () => { if (active === voice) stop(); } };
    },
    stop,
    block(seconds = 0) {
      blockedUntil = Math.max(blockedUntil, ctx.currentTime + Math.max(0, Math.min(60, seconds)));
      stop();
    },
    reset() {
      stop(0); heard.clear(); nextAt = -Infinity; blockedUntil = -Infinity;
    },
  };
}
