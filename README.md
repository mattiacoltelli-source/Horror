# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

**Stato: gioco completo.** Tunnel → vetro con la sagoma → portone → sala della folla (+ scelta «non guardare dietro») → cantina (specchio impossibile, apparizione) → magazzino (pistola) → torre (combattimento perso + 3 finali).

Finali: **A** non ti sei girato · **B** ti sei girato · **C** (segreto) hai guardato lo specchio fino in fondo.

Combattimento: pistola a 6 colpi, MIRA (tieni premuto) e SPARA; il mostro ti disarma sempre.

Scorciatoie per provare: `?start=porta` · `?start=cantina` · `?start=torre` (con `&turned=1` o `&mirror=1`).

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
