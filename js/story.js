// Regia del gioco: stanze, scelte (flags) e passaggi tra una stanza e l'altra (dissolvenza nel buio).
import { P, onRoom as personalRoom } from './personal.js';
export function createStory({ scene, camera, controls, player, audio, hall, getCellar, getTower, getWh, getMorgue, getWard, say, lights, instab, onRoom }) {
  let busy = false, current = 'tunnel';
  const fade = document.getElementById('fade');
  const hideLegacy = (keep) => scene.children.forEach((o) => { if (!o.isLight && o !== camera && !o.userData.keep && !keep.includes(o)) o.visible = false; });
  // LA TRAMA, due righe per stanza (il paziente: un incendio, una cura, una colpa). Compaiono come i suggerimenti, senza schermate di testo.
  const LINES = {
    cellar: ['lo specchio non c\'era, prima.', P ? 'ricordi la tua faccia, ' + P.name + '?' : 'ricordi la tua faccia?'],
    morgue: ['sedia, cinghie, tre strumenti.', P ? 'qui ti hanno cura' + (P.f === false ? 'to' : 'ta') + ', ' + P.name + '.' : 'qui ti hanno curato.'],
    warehouse: ['tutto ciò che è bruciato è passato da qui.', 'qualcuno ha lasciato la pistola dove l\'avresti trovata.'],
    tower: ['l\'ultima stanza era la sua.', 'non si arrabbia. aspetta.'],
  };
  const tell = (name) => { const l = LINES[name]; if (!l) return; [[2800, l[0]], [10500, l[1]]].forEach(([ms, t]) => setTimeout(() => { if (current === name && !busy) say?.(t, 5200); }, ms)); };
  const S = {
    tell,
    // PASSAGGIO SENZA STACCO tra due stanze contigue. preview: la stanza successiva si vede oltre il varco (spostata di d); cross: appena attraversi la soglia il giocatore
    // viene riportato nelle coordinate della nuova stanza (invisibile: stessa posizione relativa) e la vecchia resta visibile alle spalle, spostata di -d, finche' non sei lontano.
    preview(to, d) { const t = ({ ward: getWard(), tower: getTower() })[to]; t.group.position.z = d; t.group.visible = true; t.preview = true; t.onPreview?.(); },
    cross(from, to, d) {
      const f = ({ cellar: getCellar(), warehouse: getWh() })[from], t = ({ ward: getWard(), tower: getTower() })[to];
      player.pos.z -= d; f.group.position.z = -d; t.group.position.z = 0; t.preview = false; f.gone = true;
      t.enter(true); current = to; camera.far = { ward: 40, tower: 46 }[to] ?? 40; camera.updateProjectionMatrix(); tell(to); onRoom?.(to); personalRoom(to);
      setTimeout(() => { f.leave(); f.group.position.z = 0; }, 7000);
    },
    // passaggio senza dissolvenza (soglia aperta tra due stanze): cambia solo la stanza corrente e i suoi testi
    seamless(name) { current = name; tell(name); onRoom?.(name); personalRoom(name); },
    current: () => current, busy: () => busy,
    goto(name, quick = false) {
      if (busy) return; busy = true; controls.enabled = false;
      fade.style.transition = quick ? 'opacity 0.25s' : 'opacity 1.3s'; fade.style.opacity = 1; audio.duck(0, quick ? 0.2 : 0.6);
      setTimeout(() => {
        const cellar = getCellar(), tower = getTower(), wh = getWh(), morgue = getMorgue(), ward = getWard?.();
        player.box = null; player.frozen = false;
        if (name === 'cellar') { hideLegacy([cellar.group]); hall.group.visible = false; hall.active = false; cellar.enter(); }
        if (name === 'morgue') { hideLegacy([morgue.group]); cellar.leave(); morgue.enter(); }
        if (name === 'warehouse') { hideLegacy([wh.group]); cellar.leave(); morgue.leave(); wh.enter(); }
        if (name === 'ward') { hideLegacy([ward.group, morgue.group]); cellar.leave(); ward.enter(); }
        if (name === 'tower') { hideLegacy([tower.group]); cellar.leave(); wh.leave(); tower.enter(); }
        camera.far = { cellar: 42, morgue: 34, warehouse: 36, tower: 46, ward: 40 }[name] ?? 60; camera.updateProjectionMatrix();   // oltre la nebbia non serve disegnare
        current = name; lights.torchKill(0.01, 0); tell(name); onRoom?.(name); personalRoom(name);
        setTimeout(() => { fade.style.transition = quick ? 'opacity 0.9s' : 'opacity 2s'; fade.style.opacity = 0; controls.enabled = true; busy = false; audio.duck(1, 2); }, 350);
      }, quick ? 320 : 1500);
    },
  };
  return S;
}
