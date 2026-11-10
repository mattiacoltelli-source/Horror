# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

**Stato: prototipo (vertical slice) — tunnel, torcia, evento «La sagoma dietro il vetro», indicatore di instabilità.**

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
- `js/events/glass.js` — evento del vetro
- `js/ui/instability.js` — indicatore di instabilità
- `assets/tex` — texture convertite (colore / normal / ORM)
- `assets/models` — modelli GLB

## Crediti asset (verificare le licenze originali prima di pubblicare)
Texture e modelli forniti dall'autore del progetto, provenienti da Poly Haven e ambientCG (CC0): Bricks097, Ground110, Ground112, stone_wall_02, rusty_metal_04, caged_hanging_light, can_rusted, small_lpg_tank, rusted_wheel_rim_02, security_camera_01, creepy_bathroom (HDRI). Modello «whisperer» fornito dall'autore (licenza da confermare). Three.js: MIT.
