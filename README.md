# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

## Storia
Sei il paziente n. 17, entrato la notte del 3 novembre. Tua sorella è morta in un incendio e tu eri in casa. Poi un secondo incendio, appiccato di proposito, parte dal magazzino dell'ospedale. Solo tu sopravvivi (il cane della struttura no). **Suor Agnese** ti ha tirato fuori dal fuoco, ha scritto che è stato un guasto e non ti lascia andare: è la suora della torre e firma il registro che compare a ogni stanza. La sorella è il senso di colpa (nel magazzino).

**Percorso:** tunnel → vetro con la sagoma (poi un cane nella penombra) → portone → sala della folla (+ «non guardare dietro») → cantina (specchio, scritta nel vapore, sagoma) → reparto → obitorio (scelta tra due porte: luce rossa o respiro, cambia il magazzino) → magazzino (la sorella, pistola o ascia, cancello) → torre (combattimento perso + finale).

**Finali (2):** **A** non ti sei girato · **B** ti sei girato. In entrambi la suora arriva da davanti. Tutte e 5 le note trovate = qualche secondo in più nel combattimento. Non esiste più il finale segreto dello specchio.

**Registro di suor Agnese:** all'ingresso di ogni stanza compaiono 3-4 righe in corsivo (`js/story.js`, tabella `LINES`), con nome e genere nelle versioni personalizzate. Le 5 note da cercare (`js/events/notes.js`) sono un extra.

Combattimento: pistola a 4 colpi o ascia (scelta nel magazzino); trascini per guardare, joystick per camminare piano, per sparare devi fermarti (SPARA); il mostro ti disarma sempre.

## Santuario di Cos (facoltativo)
Nella cantina, prima della cripta, una chiave sul muro opposto apre un pannello mimetizzato nei mattoni. Il piccolo archivio contiene 10 locandine principali e altre 38 sui muri, selezionate dagli horror votati almeno 7 dal profilo CineFighi **Cos** (snapshot del 17 novembre 2026). La visita non modifica scelte o finali; a ogni ingresso nella cantina, anche dal checkpoint, la porta è chiusa e la chiave è di nuovo vicino allo specchio. Su desktop si può usare anche **E** quando compare il pulsante.

Le locandine originali provengono da TMDB: titoli, voti e riferimenti delle immagini sono in `assets/tex/film-shrine/sources.json`. I due atlanti WebP sono locali e funzionano offline, senza accessi a CineFighi durante la partita. Geometria e interazioni: `js/world/film-shrine.js` e `js/events/film-shrine.js`. Le locandine conservano le immagini originali, con carta ingiallita, strappi, bruciature, aloni e pieghe applicati dal materiale `js/world/worn-paper.js`; la stanza e gli arredi condividono fuliggine e umidità. Il pavimento resta piano e libero, con piccole zone umide; un telaio di ferro arrugginito riveste il vano e il bordo del pannello nascosto, con labbro esterno di 2,1 cm. Il riferimento alla città del giocatore compare solo nella prima nota.

Verifica delle interazioni e delle collisioni: `node --experimental-vm-modules tools/check_film_shrine.cjs`.

## Link e scorciatoie
- **Anteprima del link** (WhatsApp, Telegram…): `index.html` ha i meta Open Graph con l'icona del gioco; le app tengono l'anteprima in cache, quindi un link già inviato può mostrare quella vecchia.
- **Il link normale (senza parametri) è la versione personalizzabile**: chiede nome, genere, data e frase (vedi sotto). La versione di base senza domande esiste solo con `?base=1` (per provare).
- Versione personalizzata: `?per=elisa`, `?per=yana`, `?per=gabriele`, `?per=tommy`, `?per=alice`, `?per=mati` (anche `?per=matilde`) (profili in `js/personal.js`). Qualsiasi altro nome: `?per=nome&g=m|f` (e opzionale `&capelli=biondi|rossi|castani|neri|grigi|no`).
- **Link per tutti:** il link normale (o `?chiedi=1`) chiede nome e genere prima di iniziare (solo lettere, 2-14), chiede anche la data di nascita (facoltativa, scritta nel reparto come `g/m/aa`), salva nome e data sul telefono (`ng_name`) e ricarica la pagina come versione personalizzata; la seconda volta salta la domanda, con «non sei …? cambia».
- Per provare una parte: `?start=porta` · `cantina` · `reparto` · `obitorio` · `magazzino` · `torre` · `epilogo`, con `&turned=1` (scelta «ti sei girato»), `&door=red|breath` (porta dell'obitorio), `&weapon=axe`, `&nogun=1`, `&specchio=1` (cantina, davanti allo specchio), `&debug=1` (espone `window.__g`).

## Aspetto e giocabilità
- **Tinta per stanza** (`lights.grade`): blu freddo in cantina, verde in obitorio e reparto, ambra in magazzino, seppia in torre.
- **Murales** (`assets/tex/pic_mural_*.webp`, posizioni in `js/main.js`): affreschi scrostati con bordo irregolare, una campata libera ciascuno; in torre gli angeli (sinistra) e il trono (destra) ai lati della porta. Quadri e foto piccole sono `pic_*.webp`.
- **Texture rovinate** (`patchDecals` in `js/world/blood.js`): chiazze di intonaco, cemento, pietra e muffa; ruggine e bruciature sugli oggetti (`js/world/aged.js`); tracce d'incendio (`burnDecals`), più forti nel magazzino e nel reparto.
- **Scritte di sangue** con lettere vere (`js/world/bloodfont.js`, `tools/blood_real_glyphs.py`).
- **Il cane** (`js/events/hound.js`, «Grimhound Rig» di DM-913, CC-BY 4.0): nel tunnel, dopo il vetro, solo due occhi rossi e un respiro; scompare quando la lampada sfarfalla.
- **La sorella** (`js/events/sorella.js`, `assets/models/sorella.glb`, script Blender in `tools/monster/`): nel magazzino, sempre uguale e prima dell'arma.
- **Prova altare di Elisa**: solo con `?per=elisa`, nella cripta/cappella della cantina la foto col volto bruciato e' carta scolorita, piegata e bruciata ai bordi (`pic_elisa_altar_burnt.webp`, con trasparenza). Foto e supporto sono ulteriormente ridotti dell'8%, conservando l'appoggio sull'altare. E' fissata con due puntine a una tavoletta di legno scuro, scheggiata, con base e sostegno posteriore appoggiati sull'altare. La luce alta delle candele illumina il fronte dell'altare; la scritta ha righe piu' distanziate, rimane entro la pietra e ha meno luce propria.
- **Oggetti che reagiscono**: i busti si voltano, la TV del magazzino si accende da sola; **topi** (`js/events/rats.js`).
- **Ascensore fuori servizio** (`js/world/elevator.js`): nicchia sul lato destro del corridoio del reparto, prima dell'obitorio. Cabina arrugginita e grate aperte, pulsanti e lampada spenti; solo scenografia, senza interazioni. Si guarda dal corridoio, senza cambiare il percorso.
  Cartello «Fuori servizio · Ascensore abbandonato · Non utilizzare» e pulsantiera con tasti tondi, targhette dei piani e serratura ricreati dal riferimento fornito (`assets/tex/elevator_details.webp`, atlante condiviso); i tasti hanno rilievo geometrico.
  Sulla parete interna sinistra, il simbolo rosso con colature fornito dall'autore (`assets/tex/elevator_mural.webp`), con fondo trasparente, appare dipinto sulla lamiera dietro il corrimano.
- **Audio**: sintesi Web Audio più alcune registrazioni mp3 corte in `assets/audio` (`audio.sfx`): respiro del cane, drone della sala della folla, ringhio, fuoco.
- **Folla, crescendo sonoro** (`js/audio/hall.js`): tre campane modali spezzate sulle riapparizioni, colpi sempre più serrati e due raffiche di passi/trascinamenti nel buio. Le distanze audio seguono quelle delle sagome; le code vengono troncate prima del respiro. Verifiche: `node --experimental-vm-modules tools/check_hall_timing.cjs` e `node tools/check_hall_audio.cjs` (Playwright/Chromium; argomento WAV facoltativo per esportare l’anteprima).
  Accenti ambientali molto bassi (`js/audio/ambience.js`): aria nel tunnel, tubature nel reparto, ventilazione lontana nell'obitorio e scricchiolio nel magazzino. Una sola volta per ambiente, durante brevi finestre di esplorazione, con dissolvenza e posizione 3D; si interrompono cambiando stanza, nei silenzi di tensione e durante il combattimento. Nessun nuovo file audio da scaricare.
- **Checkpoint**: a ogni stanza si salva uno snapshot con le scelte (`localStorage`, `ng_ckpt` e `ng_rooms`); dal menu iniziale «riparti da… ▾» scegli tra cantina, reparto, obitorio, magazzino e torre gia' raggiunti. Il reparto riparte dall'ingresso del corridoio, prima del montacarichi; conserva scelte e note. Nei vecchi salvataggi, se e' presente lo snapshot dell'obitorio, il reparto viene recuperato da quello (tra i due ingressi non ci sono nuove note o scelte).
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
- Ghiaia cosmica: adattamento della texture `floorB_c.jpg` già nel progetto. Basalto e frattura della cripta: riferimento grafico dell'autore e decal originale generata e ottimizzata per il gioco.
- Falò lontano del pianeta: geometria da `17-camp_fire.rar` fornito dall'autore; colori dell'atlante incorporati nei vertici, senza caricatore FBX o texture aggiuntive. Fiamma leggera creata nel gioco.
- Modello del cane: «Grimhound Rig» di DM-913 (CC-BY 4.0), citato nella schermata iniziale.
- Suoni registrati: Pixabay (alesiadavina) e Mixkit (licenze gratuite); passi: Kenney «Impact Sounds» (CC0).
- Modelli dei personaggi e murales forniti dall'autore del progetto (murales generati con strumenti di immagini); licenze originali da confermare prima di una pubblicazione più ampia.
- Three.js: MIT.

## Effetto della piega nel reparto
Di default (in tutte le versioni; `?piega=0` la spegne) il corridoio del reparto si flette a S e si torce un po' sul proprio asse (circa 27° al massimo) per un attimo (circa 11 s), poi torna dritto prima dell'obitorio. Collisioni, posizioni ed eventi non cambiano: cambia solo il disegno (`js/world/bend.js`, stessa matematica di `labs/space-fold`). Con `?piega=0` non viene caricato niente. Con «movimento ridotto» del sistema l'effetto è più piccolo e senza allargamento del campo visivo.

## Allungamento del tunnel
Nel primo tunnel, tra 9 e 14 m dall'ingresso, il corridoio diventa lunghissimo per un attimo (il fondo schizza lontano, circa 2 s in tutto) e poi torna com'era. Solo disegno (`js/world/breath.js`): collisioni e posizioni non cambiano. Spento di default (non convinceva): si attiva solo con `?allunga=1`.

## Ponte sull'abisso nel magazzino
Avanzando al centro, i due lati del pavimento scendono realmente di 8 m, con gli oggetti appoggiati, lasciando un percorso stabile largo 2,1 m. Si può avanzare, fermarsi e tornare indietro; i bordi impediscono la caduta. Dopo il passaggio il pavimento risale e riprendono gli eventi originali. Nessuna rotazione automatica della visuale. La preferenza di sistema «movimento ridotto» rallenta la trasformazione.

Prova diretta: `?start=magazzino`; disattivazione completa: `?ponte=0`. Si ripristina a ogni ingresso/checkpoint. Usa la stessa scena, i materiali del pavimento e il pool esistente di due luci; nessun asset da scaricare durante la trasformazione. Verifiche disponibili: `node --experimental-vm-modules tools/check_warehouse_bridge.cjs` e, con server locale e Chromium/Playwright, `tools/check_warehouse_bridge_browser.cjs`. I test software non misurano gli FPS su Android reale.

## App installabile e aggiornamenti
Il gioco è una PWA: icona sulla home, schermo intero, funziona offline dopo il primo avvio. Quando esce una nuova versione compare il banner **«Aggiornamento disponibile · AGGIORNA»** (controllo a ogni apertura e ogni 30 minuti).

Prima di ogni commit che cambia il gioco si lancia `tools/bump.sh`: calcola l'hash dei file e lo scrive in `sw.js` (se nulla cambia, nessun banner). Gli asset pesanti hanno una cache separata, quindi un aggiornamento del solo codice non li riscarica.
