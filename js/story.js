// Regia del gioco: stanze, scelte (flags) e passaggi tra una stanza e l'altra (dissolvenza nel buio).
import { onRoom as personalRoom, stopWhispers } from './personal.js';
import { ROOM_LINES } from './narrative-copy.js';
export function createStory({ scene, camera, controls, player, audio, hall, getCellar, getTower, getWh, getMorgue, getWard, say, lights, instab, prepare, onRoom }) {
  let busy = false, preparing = false, current = 'tunnel';
  const fade = document.getElementById('fade');
  const hideLegacy = (keep) => scene.children.forEach((o) => { if (!o.isLight && o !== camera && !o.userData.keep && !keep.includes(o)) o.visible = false; });
  let pending = [];
  const resetNarration = () => { pending = []; say.reset?.(); audio.stopMotif?.(); stopWhispers(); };
  const schedule = (delay, action) => pending.push({ left: delay, room: current, action });
  const personal = (name) => personalRoom(name, (delay, action) => schedule(delay, () => { audio.stopMotif?.(); action(); }));
  // Only narrative timers use the game clock. All room transitions below retain
  // their original timing, coordinates, checkpoints and preparation.
  const tell = (name) => {
    const lines = ROOM_LINES[name]; if (!lines) return;
    schedule(3, () => say?.(lines.join('\n'), 7000, 'note'));
  };
  const S = {
    tell, schedule, silence: resetNarration,
    update(dt) {
      if (busy) return;
      for (const task of pending) task.left -= dt;
      pending = pending.filter((task) => task.room === current);
      if (say.canRead && !say.canRead()) return;
      const i = pending.findIndex((task) => task.left <= 0);
      if (i >= 0) { const [task] = pending.splice(i, 1); task.action(); }
    },
    quiet: () => !!say.blocked?.(),
    // PASSAGGIO SENZA STACCO tra due stanze contigue. preview: la stanza successiva si vede oltre il varco (spostata di d); cross: appena attraversi la soglia il giocatore
    // viene riportato nelle coordinate della nuova stanza (invisibile: stessa posizione relativa) e la vecchia resta visibile alle spalle, spostata di -d, finche' non sei lontano.
    preview(to, d, gap = 0.25) { const t = ({ ward: getWard(), tower: getTower() })[to]; t.warm?.(); t.group.position.z = d - gap; t.group.visible = true; t.preview = true; t.pdz = d - gap; t.onPreview?.(); },   // gap: la stanza dopo e' spostata di 25 cm oltre il muro, cosi' le sue pareti non spuntano coplanari ai lati del varco
    // precompila in anticipo la stanza successiva (shader nelle condizioni d'ingresso), cosi' il passaggio non si blocca
    warm(to) { return ({ ward: getWard(), tower: getTower() })[to]?.warm?.(); },
    cross(from, to, d) {
      resetNarration();
      const f = ({ cellar: getCellar(), warehouse: getWh() })[from], t = ({ ward: getWard(), tower: getTower() })[to];
      d = t.pdz ?? d; player.pos.z -= d; f.group.position.z = -d; t.group.position.z = 0; t.preview = false; f.gone = true;
      t.enter(true); current = to; camera.far = { ward: 40, tower: 46 }[to] ?? 40; camera.updateProjectionMatrix(); tell(to); onRoom?.(to); personal(to);
      setTimeout(() => { f.leave(); f.group.position.z = 0; }, 7000);
    },
    // passaggio senza dissolvenza (soglia aperta tra due stanze): cambia solo la stanza corrente e i suoi testi
    seamless(name) { resetNarration(); current = name; tell(name); onRoom?.(name); personal(name); },
    current: () => current, busy: () => busy, preparing: () => preparing,
    goto(name, quick = false) {
      if (busy) return; resetNarration(); busy = true; controls.enabled = false;
      fade.style.transition = quick ? 'opacity 0.25s' : 'opacity 1.3s'; fade.style.opacity = 1; audio.duck(0, quick ? 0.2 : 0.6);
      setTimeout(async () => {
        preparing = true;
        const cellar = getCellar(), tower = getTower(), wh = getWh(), morgue = getMorgue(), ward = getWard?.();
        player.box = null; player.frozen = false;
        if (name === 'cellar') { hideLegacy([cellar.group]); hall.group.visible = false; hall.active = false; cellar.enter(); }
        if (name === 'morgue') { hideLegacy([morgue.group]); cellar.leave(); morgue.enter(); }
        if (name === 'warehouse') { hideLegacy([wh.group]); cellar.leave(); morgue.leave(); wh.enter(); }
        if (name === 'ward') { hideLegacy([ward.group, morgue.group]); cellar.leave(); ward.enter(); }
        if (name === 'tower') { hideLegacy([tower.group]); cellar.leave(); wh.leave(); tower.enter(); }
        camera.far = { cellar: 42, morgue: 34, warehouse: 36, tower: 46, ward: 40 }[name] ?? 60; camera.updateProjectionMatrix();   // oltre la nebbia non serve disegnare
        current = name; lights.torchKill(0.01, 0); onRoom?.(name);
        if (name === 'cellar') await cellar.prepare?.();
        if (name === 'warehouse') await wh.prepare?.();
        await prepare?.();
        preparing = false;
        tell(name); personal(name);
        setTimeout(() => { fade.style.transition = quick ? 'opacity 0.9s' : 'opacity 2s'; fade.style.opacity = 0; controls.enabled = true; busy = false; audio.duck(1, 2); }, 350);
      }, quick ? 320 : 1500);
    },
  };
  return S;
}
