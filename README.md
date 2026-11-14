# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

## Storia
Sei il paziente n. 17, entrato la notte del 3 novembre. Tua sorella è morta in un incendio e tu eri in casa. Poi un secondo incendio, appiccato di proposito, parte dal magazzino dell'ospedale. Solo tu sopravvivi (il cane della struttura no). **Suor Agnese** ti ha tirato fuori dal fuoco, ha scritto che è stato un guasto e non ti lascia andare: è la suora della torre e firma il registro che compare a ogni stanza. La sorella è il senso di colpa (nel magazzino).

**Percorso:** tunnel → vetro con la sagoma (poi un cane nella penombra) → portone → sala della folla (+ «non guardare dietro») → cantina (specchio, scritta nel vapore, sagoma) → reparto → obitorio (scelta tra due porte: luce rossa o respiro, cambia il magazzino) → magazzino (la sorella, pistola o ascia, cancello) → torre (combattimento perso + finale).

**Finali (2):** **A** non ti sei girato · **B** ti sei girato. In entrambi la suora arriva da davanti. Tutte e 5 le note trovate = qualche secondo in più nel combattimento. Non esiste più il finale segreto dello specchio.

**Registro di suor Agnese:** all'ingresso di ogni stanza compaiono 3-4 righe in corsivo (`js/story.js`, tabella `LINES`), con nome e genere nelle versioni personalizzate. Le 5 note da cercare (`js/events/notes.js`) sono un extra.

Combattimento: pistola a 4 colpi o ascia (scelta nel magazzino); trascini per guardare, joystick per camminare piano, per sparare devi fermarti (SPARA); il mostro ti disarma sempre.

## Link e scorciatoie
- Versione standard: la pagina senza parametri.
- Versione personalizzata: `?per=elisa`, `?per=yana`, `?per=gabriele`, `?per=tommy`, `?per=alice` (profili in `js/personal.js`). Qualsiasi altro nome: `?per=nome&g=m|f` (e opzionale `&capelli=biondi|rossi|castani|neri|grigi|no`).
- Per provare una parte: `?start=porta` · `cantina` · `reparto` · `obitorio` · `magazzino` · `torre` · `epilogo`, con `&turned=1` (scelta «ti sei girato»), `&door=red|breath` (porta dell'obitorio), `&weapon=axe`, `&nogun=1`, `&specchio=1` (cantina, davanti allo specchio), `&debug=1` (espone `window.__g`).

## Aspetto e giocabilità
- **Tinta per stanza** (`lights.grade`): blu freddo in cantina, verde in obitorio e reparto, ambra in magazzino, seppia in torre.
- **Murales** (`assets/tex/pic_mural_*.webp`, posizioni in `js/main.js`): affreschi scrostati con bordo irregolare, una campata libera ciascuno; in torre gli angeli (sinistra) e il trono (destra) ai lati della porta. Quadri e foto piccole sono `pic_*.webp`.
- **Texture rovinate** (`patchDecals` in `js/world/blood.js`): chiazze di intonaco, cemento, pietra e muffa; ruggine e bruciature sugli oggetti (`js/world/aged.js`); tracce d'incendio (`burnDecals`), più forti nel magazzino e nel reparto.
- **Scritte di sangue** con lettere vere (`js/world/bloodfont.js`, `tools/blood_real_glyphs.py`).
- **Il cane** (`js/events/hound.js`, «Grimhound Rig» di DM-913, CC-BY 4.0): nel tunnel, dopo il vetro, solo due occhi rossi e un respiro; scompare quando la lampada sfarfalla.
- **La sorella** (`js/events/sorella.js`, `assets/models/sorella.glb`, script Blender in `tools/monster/`): nel magazzino, sempre uguale e prima dell'arma.
- **Oggetti che reagiscono**: i busti si voltano, la TV del magazzino si accende da sola; **topi** (`js/events/rats.js`).
- **Audio**: sintesi Web Audio più alcune registrazioni mp3 corte in `assets/audio` (`audio.sfx`): respiro del cane, drone della sala della folla, ringhio, fuoco.
- **Checkpoint**: a ogni stanza si salva uno snapshot con le scelte (`localStorage`, `ng_ckpt` e `ng_rooms`); dal menu iniziale «riparti da… ▾» scegli una qualsiasi delle stanze già raggiunte.
- **Qualità grafica** (alta / media / bassa, di base alta) dal menu iniziale, ricordata in `ng_quality`; in partita la risoluzione si abbassa da sola se i frame calano. Gli shader di tutte le stanze si precompilano nel tunnel.
- **Vibrazione** su porte, vetro, passi pesanti, note e TV (solo Android).

## Avvio locale
```
npx http-server -p 8123 -c-1 .
```
Apri `http://localhost:8123` (su desktop: WASD + trascinamento a destra).

## Struttura
- `js/main.js` — bootstrap, loop, flusso di gioco, posizione di murales e scritte
- `js/story.js` — stanze, transizioni senza stacco, registro di suor Agnese
- `js/personal.js` — profili personalizzati
- `js/world/` — materiali, tunnel procedurale, luci (torcia + pool di 2 luci), decorazioni, sangue, oggetti invecchiati
- `js/player/` — controlli touch, movimento/collisioni
- `js/audio/` — audio procedurale e registrato
- `js/events/` — `glass` vetro · `door` portone e sala della folla · `hall` sala/folla · `cellar` specchio · `ward` reparto · `morgue` obitorio · `warehouse` magazzino · `tower` torre e finali · `hound` cane · `scare` jump scare · `combat` combattimento · `notes` note · `dawn` epilogo
- `js/ui/` — instabilità, sfasamento RGB
- `assets/tex`, `assets/models`, `assets/audio` — texture, modelli GLB, suoni
- `tex-lib/` — libreria di texture di riserva (colore 512 px), non inclusa nella cache del gioco
- `tools/` — `bump.sh` (hash e cache del service worker), `shrink_glb.py` (riduce le texture dei modelli), script per font di sangue, murales e icone

## Crediti asset
- Texture e modelli Poly Haven / ambientCG (CC0).
- Modello del cane: «Grimhound Rig» di DM-913 (CC-BY 4.0), citato nella schermata iniziale.
- Suoni registrati: Pixabay (alesiadavina) e Mixkit (licenze gratuite); passi: Kenney «Impact Sounds» (CC0).
- Modelli dei personaggi e murales forniti dall'autore del progetto (murales generati con strumenti di immagini); licenze originali da confermare prima di una pubblicazione più ampia.
- Three.js: MIT.

## App installabile e aggiornamenti
Il gioco è una PWA: icona sulla home, schermo intero, funziona offline dopo il primo avvio. Quando esce una nuova versione compare il banner **«Aggiornamento disponibile · AGGIORNA»** (controllo a ogni apertura e ogni 30 minuti).

Prima di ogni commit che cambia il gioco si lancia `tools/bump.sh`: calcola l'hash dei file e lo scrive in `sw.js` (se nulla cambia, nessun banner). Gli asset pesanti hanno una cache separata, quindi un aggiornamento del solo codice non li riscarica.
