// Regia del gioco: stanze, scelte (flags) e passaggi tra una stanza e l'altra (dissolvenza nel buio).
import { P, onRoom as personalRoom } from './personal.js';
export function createStory({ scene, camera, controls, player, audio, hall, getCellar, getTower, getWh, getMorgue, say, lights, instab, onRoom }) {
  let busy = false, current = 'tunnel';
  const fade = document.getElementById('fade');
  const hideLegacy = (keep) => scene.children.forEach((o) => { if (!o.isLight && o !== camera && !o.userData.keep && !keep.includes(o)) o.visible = false; });
  // LA TRAMA, due righe per stanza (il paziente: un incendio, una cura, una colpa). Compaiono come i suggerimenti, senza schermate di testo.
  const LINES = {
    cellar: ['lo specchio non c\'era, prima.', P ? 'ricordi la tua faccia, ' + P.name + '?' : 'ricordi la tua faccia?'],
    morgue: ['sedia, cinghie, tre strumenti.', P ? 'qui ti hanno curata, ' + P.name + '.' : 'qui ti hanno curato.'],
    warehouse: ['tutto ciò che è bruciato è passato da qui.', 'qualcuno ha lasciato la pistola dove l\'avresti trovata.'],
    tower: ['l\'ultima stanza era la sua.', 'non si arrabbia. aspetta.'],
  };
  const tell = (name) => { const l = LINES[name]; if (!l) return; [[2800, l[0]], [10500, l[1]]].forEach(([ms, t]) => setTimeout(() => { if (current === name && !busy) say?.(t, 5200); }, ms)); };
  const S = {
    tell,
    current: () => current, busy: () => busy,
    goto(name) {
      if (busy) return; busy = true; controls.enabled = false;
      fade.style.transition = 'opacity 1.3s'; fade.style.opacity = 1; audio.duck(0, 0.6);
      setTimeout(() => {
        const cellar = getCellar(), tower = getTower(), wh = getWh(), morgue = getMorgue();
        player.box = null; player.frozen = false;
        if (name === 'cellar') { hideLegacy([cellar.group]); hall.group.visible = false; hall.active = false; cellar.enter(); }
        if (name === 'morgue') { hideLegacy([morgue.group]); cellar.leave(); morgue.enter(); }
        if (name === 'warehouse') { hideLegacy([wh.group]); cellar.leave(); morgue.leave(); wh.enter(); }
        if (name === 'tower') { hideLegacy([tower.group]); cellar.leave(); wh.leave(); tower.enter(); }
        camera.far = { cellar: 42, morgue: 34, warehouse: 36, tower: 46 }[name] ?? 60; camera.updateProjectionMatrix();   // oltre la nebbia non serve disegnare
        current = name; lights.torchKill(0.01, 0); tell(name); onRoom?.(name); personalRoom(name);
        setTimeout(() => { fade.style.transition = 'opacity 2s'; fade.style.opacity = 0; controls.enabled = true; busy = false; audio.duck(1, 2); }, 350);
      }, 1500);
    },
  };
  return S;
}
