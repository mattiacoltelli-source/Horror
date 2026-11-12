# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

**Stato: gioco completo.** Tunnel → vetro con la sagoma → portone → sala della folla (+ scelta «non guardare dietro») → cantina (specchio impossibile, apparizione) → magazzino (pistola) → torre (combattimento perso + 3 finali).

Finali: **A** non ti sei girato · **B** ti sei girato · **D** condanna (tutte e 5 le note, abbassi la pistola). In ogni caso arriva la suora: non c'è più il finale segreto dello specchio.

Combattimento: pistola a 4 colpi; trascini per guardare, joystick per camminare piano, ma per sparare devi fermarti (SPARA); il mostro ti disarma sempre.

Scorciatoie per provare: `?start=porta` · `?start=cantina` · `?start=obitorio` · `?start=magazzino` · `?start=torre` · `?start=epilogo` (con `&turned=1`, `&mirror=1` o `&door=red|breath`, `&weapon=axe` o `&nogun=1`).

Storia: il paziente. Due righe per stanza, tre finali (negazione, accettazione, segreto). Nell'obitorio scegli tra il cancello (luce rossa) e la porta (respiro): cambia il magazzino.

## Avvio locale
```
npx http-server -p 8123 -c-1 .
```
Apri `http://localhost:8123` (su desktop: WASD + trascinamento a destra; `?debug=1` espone `window.__g`).

## Struttura
- `js/main.js` — bootstrap, loop, flusso di gioco
- `js/world/` — materiali PBR, tunnel procedurale, luci (torcia + pool di 2 luci)
- `js/player/` — controlli touch, movimento/collisioni
- `js/audio/` — audio procedurale Web Audio
- `js/events/glass.js` — vetro · `door.js` — portone + sala della folla + scelta · `hall.js` — sala/folla · `cellar.js` — specchio e apparizione · `tower.js` — porta d'uscita e finali · `scare.js` — jump scare · `js/story.js` — stanze e transizioni
- `js/ui/instability.js` — indicatore di instabilità
- `assets/tex` — texture convertite (colore / normal / ORM)
- `assets/models` — modelli GLB

## Crediti asset (verificare le licenze originali prima di pubblicare)
Passi: Kenney «Impact Sounds» (CC0, kenney.nl), assets/audio.
Modelli dei personaggi (base low-poly) forniti dall'autore (licenza da confermare); posa "cotta" con Blender.
Texture e modelli forniti dall'autore del progetto, provenienti da Poly Haven e ambientCG (CC0): Bricks097, Ground110, Ground112, stone_wall_02, rusty_metal_04, caged_hanging_light, can_rusted, small_lpg_tank, rusted_wheel_rim_02, security_camera_01, creepy_bathroom (HDRI). Modello «whisperer» fornito dall'autore (licenza da confermare). Three.js: MIT.

## App installabile e aggiornamenti
Il gioco è una PWA: icona sulla home, schermo intero, funziona offline dopo il primo avvio. Quando esce una nuova versione compare il banner **«Aggiornamento disponibile · AGGIORNA»** (il controllo avviene a ogni apertura e ogni 30 minuti).

Prima di ogni commit che cambia il gioco si lancia `tools/bump.sh`: calcola l'hash dei file e lo scrive in `sw.js` (se nulla cambia, nessun banner). Gli asset pesanti hanno una cache separata, quindi un aggiornamento del solo codice non li riscarica.
