// Regia del gioco: stanze, scelte (flags) e passaggi tra una stanza e l'altra (dissolvenza nel buio).
import { P, onRoom as personalRoom } from './personal.js';
export function createStory({ scene, camera, controls, player, audio, hall, getCellar, getTower, getWh, getMorgue, getWard, say, lights, instab, onRoom }) {
  let busy = false, current = 'tunnel';
  const fade = document.getElementById('fade');
  const hideLegacy = (keep) => scene.children.forEach((o) => { if (!o.isLight && o !== camera && !o.userData.keep && !keep.includes(o)) o.visible = false; });
  // LA TRAMA: il registro notturno dell'infermiera. All'ingresso di ogni stanza compaiono 3 righe (come le note, in corsivo, ~7 s), senza fermarti ne' coprire i pulsanti.
  // Racconta in ordine: l'ingresso la notte del 3 novembre, la folla, lo specchio, la sorella, l'incendio partito dal magazzino, e alla fine la voce dell'infermiera che ti ha tirato fuori dal fuoco.
  // Versione personalizzata: nome e genere dal profilo; la standard dice "paziente n. 17" e usa il maschile (come le note).
  const N = P ? P.name : '', m = !P || P.f === false, o = m ? 'o' : 'a', lui = m ? 'lo' : 'la';
  const SIG = '— suor Agnese';   // il registro e' suo: la suora della torre e' l'infermiera che ti ha tirato fuori dal fuoco e non ti lascia andare
  const LINES = {   // righe corte (max ~34 caratteri): ognuna sta su una riga dello schermo del telefono
    tunnel: ['registro di suor Agnese, 3 novembre.', 'nuovo ingresso: ' + (N || 'paziente n. 17') + '.', lui + ' fanno passare dal tunnel.'],
    hall: ['erano qui tutti, quella notte.', 'nessuno di loro è uscito.', 'non guardarli in faccia.', SIG],
    cellar: ['lo specchio l\'hanno rimesso.', 'dice che non è la sua faccia.', 'non sa più chi è.', SIG],
    ward: ['la sedia si muove da sola.', 'chiede ogni giorno di sua sorella.', 'nessuno osa dirglielo.', SIG],
    morgue: ['qui ti hanno curat' + o + (N ? ', ' + N : '') + '.', 'sedia, cinghie, tre strumenti.', 'sua sorella è qui sotto, dal fuoco.', 'giura di non averla vista.'],
    warehouse: ['il fuoco è partito da qui.', 'benzina sui registri.', 'cancello chiuso da dentro.', SIG],
    tower: ['l\'ultima stanza era la sua.', 'l\'ho tirat' + o + ' fuori io, dal fuoco.', 'nessuno saprà cosa hai fatto' + (N ? ', ' + N : '') + '.', 'non ti lascio andare. ' + SIG],
  };
  const EXTRA = { warehouse: 'qualcuno ha lasciato la pistola dove l\'avresti trovata.', tower: 'non si arrabbia. aspetta.' };   // seconda riga, piu' tardi
  const tell = (name) => {
    const l = LINES[name]; if (!l) return;
    setTimeout(() => { if (current === name && !busy) say?.(l.join('\n'), 7000, 'note'); }, 3000);
    if (EXTRA[name]) setTimeout(() => { if (current === name && !busy) say?.(EXTRA[name], 5200); }, 13500);
  };
  const S = {
    tell,
    // PASSAGGIO SENZA STACCO tra due stanze contigue. preview: la stanza successiva si vede oltre il varco (spostata di d); cross: appena attraversi la soglia il giocatore
    // viene riportato nelle coordinate della nuova stanza (invisibile: stessa posizione relativa) e la vecchia resta visibile alle spalle, spostata di -d, finche' non sei lontano.
    preview(to, d, gap = 0.25) { const t = ({ ward: getWard(), tower: getTower() })[to]; t.group.position.z = d - gap; t.group.visible = true; t.preview = true; t.pdz = d - gap; t.onPreview?.(); },   // gap: la stanza dopo e' spostata di 25 cm oltre il muro, cosi' le sue pareti non spuntano coplanari ai lati del varco
    cross(from, to, d) {
      const f = ({ cellar: getCellar(), warehouse: getWh() })[from], t = ({ ward: getWard(), tower: getTower() })[to];
      d = t.pdz ?? d; player.pos.z -= d; f.group.position.z = -d; t.group.position.z = 0; t.preview = false; f.gone = true;
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
