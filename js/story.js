// Regia del gioco: stanze, scelte (flags) e passaggi tra una stanza e l'altra (dissolvenza nel buio).
export function createStory({ scene, camera, controls, player, audio, hall, getCellar, getTower, getWh, lights, instab }) {
  let busy = false, current = 'tunnel';
  const fade = document.getElementById('fade');
  const hideLegacy = (keep) => scene.children.forEach((o) => { if (!o.isLight && o !== camera && !keep.includes(o)) o.visible = false; });
  const S = {
    current: () => current, busy: () => busy,
    goto(name) {
      if (busy) return; busy = true; controls.enabled = false;
      fade.style.transition = 'opacity 1.3s'; fade.style.opacity = 1; audio.duck(0, 0.6);
      setTimeout(() => {
        const cellar = getCellar(), tower = getTower(), wh = getWh();
        player.box = null; player.frozen = false;
        if (name === 'cellar') { hideLegacy([cellar.group]); hall.group.visible = false; hall.active = false; cellar.enter(); }
        if (name === 'warehouse') { hideLegacy([wh.group]); cellar.leave(); wh.enter(); }
        if (name === 'tower') { hideLegacy([tower.group]); cellar.leave(); wh.leave(); tower.enter(); }
        current = name; lights.torchKill(0.01, 0);
        setTimeout(() => { fade.style.transition = 'opacity 2s'; fade.style.opacity = 0; controls.enabled = true; busy = false; audio.duck(1, 2); }, 350);
      }, 1500);
    },
  };
  return S;
}
