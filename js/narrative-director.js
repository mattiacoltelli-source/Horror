// Reads existing event state only. No visual state, animation, collision or
// controller belongs to this director. Optional events remain optional.
const sisterInView = (sister, player) => {
  const p = sister?.model?.position, eye = player?.pos, forward = player?.forward;
  if (!p || !eye || !forward) return false;
  const x = p.x - eye.x, y = 1.4 - eye.y, z = p.z - eye.z;
  return (x * forward.x + y * forward.y + z * forward.z) / Math.hypot(x, y, z) > .6;
};
export function narrativeQuiet(s) {
  if (s.ended || s.paused || s.story?.busy()) return true;
  // The standard scare retains active=true after handing over to the epilogue.
  // Dawn owns its own silence and brief reading window from that point on.
  if (s.dawn?.active) return s.dawn.t < 8.5 || s.dawn.t > 11.5;
  if (s.space?.active || s.combat?.active || (s.scare?.active && !s.scare.done)) return true;
  const room = s.story?.current();
  if (room === 'tunnel') {
    if (s.sideFold?.enabled && s.sideFold.group?.visible && ['explore', 'flicker', 'dark', 'exit'].includes(s.sideFold.state)) return true;
    if (['hush', 'burst', 'void', 'dark', 'turned', 'ignored'].includes(s.doorEvent?.state)) return true;
    if (s.glassEvent?.state && !['idle', 'done'].includes(s.glassEvent.state)) return true;
    if (s.hound?.state === 'flash') return true;
  }
  if (room === 'ward') return s.ward?.bend?.state === 'run' || s.ward?.state === 'beat';
  if (room === 'cellar') {
    const c = s.cellar, d = c?.dbg;
    if (c?.dive || c?.keypad?.padOn) return true;
    // The mirror room stops updating while visiting its annexes. Its last
    // apparition/gaze values must not hold narration there indefinitely.
    if (s.player?.pos.x > 4.2) return false;
    return !!(c?.holdNarration ||
      d?.runT >= 0 || (c?.gl >= 0 && c.gl < .9) ||
      (c?.started && !c.clean && d?.dm < 6.5 && d.dotv > .82));
  }
  if (room === 'warehouse') {
    const sister = s.wh?.sorella;
    return !!(s.wh?.bridge?.holdNarration || s.wh?.state === 'taken' || s.wh?.sec === 1 ||
      ['fade', 'gap', 'dash'].includes(sister?.state) ||
      (sister?.state === 'show' && ((sister.t ?? 0) < 1.2 || sister.rv > 0 || sisterInView(sister, s.player))));
  }
  if (room === 'tower') return !!(s.tower?.opened || s.tower?.blade?.active || s.flags?.bladeEnding);
  return false;
}

export function createNarrativeDirector({ read, audio, say }) {
  let room = null, roomTime = 0, epilogue = false, hallStarted = false;
  const heard = new Set();
  const cue = (name, key = name) => {
    if (!heard.has(key) && audio.motif?.(name, { key })) heard.add(key);
  };
  return {
    quiet: () => narrativeQuiet(read()) || !!globalThis.speechSynthesis?.speaking,
    update(dt) {
      const s = read(), current = s.story?.current();
      if (current !== room) { room = current; roomTime = 0; audio.stopMotif?.(); }
      roomTime += dt;
      if (room === 'tunnel' && !hallStarted && s.doorEvent?.state === 'hush') {
        hallStarted = true; s.story.silence?.();
      }
      if (s.dawn?.active && !epilogue) { epilogue = true; say.reset(); audio.stopMotif?.(); }
      const fold = s.sideFold;
      if (s.ended || s.paused || s.story?.busy() || s.space?.active || s.combat?.active || s.scare?.active ||
          s.dawn?.active || globalThis.speechSynthesis?.speaking || s.tower?.opened ||
          (room === 'warehouse' && ['fade', 'gap', 'dash'].includes(s.wh?.sorella?.state)) ||
          (room === 'tunnel' && ['flicker', 'dark', 'exit'].includes(fold?.state))) {
        audio.stopMotif?.(); return;
      }
      // The existing impact/crescendo blocks take precedence inside audio.motif.
      // A rejected cue is never queued: only a still-valid quiet window may retry.
      if (room === 'tunnel' && fold?.enabled && fold.group?.visible && fold.state === 'explore' && fold.t > 2.8)
        cue('portal');
      if (room === 'ward' && s.ward?.bend?.state === 'run' && s.ward.bend.t > 4.9 && s.ward.bend.t < 9)
        cue('fracture');
      if (room === 'warehouse') {
        const bridge = s.wh?.bridge, sister = s.wh?.sorella;
        if (bridge?.state === 'open' && (bridge.group?.userData.presence?.age || 0) > 4) cue('bridge');
        if (sister?.state === 'show' && sister.t > .4) cue('sister');
      }
      if (room === 'tower' && !s.flags?.bladeEnding && roomTime > 2 && roomTime < 12) cue('agnese');
    },
  };
}
