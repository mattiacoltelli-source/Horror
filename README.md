# NON GIRARTI

Horror psicologico in prima persona, verticale (9:16), per browser mobile. Sito statico: HTML + CSS + JavaScript + Three.js, nessun build.

## Storia
Sei il paziente n. 17, entrato la notte del 3 novembre. Tua sorella è morta in un incendio e tu eri in casa. Poi un secondo incendio, appiccato di proposito, parte dal magazzino dell'ospedale. Solo tu sopravvivi. Dalle grate continua a salire fumo. **Suor Agnese** ti ha tirato fuori dal fuoco, ha scritto che è stato un guasto e non ti lascia andare: è la suora della torre e firma il registro che compare a ogni stanza. La sorella è il senso di colpa (nel magazzino).

**Percorso:** tunnel → vetro con la sagoma (poi una presenza di fumo dal tombino) → portone → sala della folla (+ «non guardare dietro») → cantina (specchio, scritta nel vapore, sagoma) → reparto → obitorio (scelta tra due porte: luce rossa o respiro, cambia il magazzino) → magazzino (la sorella, pistola o ascia, cancello) → torre (combattimento perso + finale).

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
- **La presenza del tombino** (`js/events/drain-presence.js`): dopo il vetro sale una figura incompleta di fumo, con due occhi rosso scuro. Avvicinandosi si sfilaccia, si allarga e perde densità fino a sparire in circa quattro secondi. Nessun cambio della camera, blocco o apparizione improvvisa; movimento ridotto supportato.
- **La sorella** (`js/events/sorella.js`, `assets/models/sorella.glb`, script Blender in `tools/monster/`): nel magazzino, sempre uguale e prima dell'arma.
- **Prova altare di Elisa**: solo con `?per=elisa`, nella cripta/cappella della cantina la foto col volto bruciato e' carta scolorita, piegata e bruciata ai bordi (`pic_elisa_altar_burnt.webp`, con trasparenza). Foto e supporto sono ulteriormente ridotti dell'8%, conservando l'appoggio sull'altare. E' fissata con due puntine a una tavoletta di legno scuro, scheggiata, con base e sostegno posteriore appoggiati sull'altare. La luce alta delle candele illumina il fronte dell'altare; la scritta ha righe piu' distanziate, rimane entro la pietra e ha meno luce propria.
- **Oggetti che reagiscono**: i busti si voltano, la TV del magazzino si accende da sola; **topi** (`js/events/rats.js`).
- **Ascensore fuori servizio** (`js/world/elevator.js`): nicchia sul lato destro del corridoio del reparto, prima dell'obitorio. Cabina arrugginita e grate aperte, pulsanti e lampada spenti; solo scenografia, senza interazioni. Si guarda dal corridoio, senza cambiare il percorso.
  Cartello «Fuori servizio · Ascensore abbandonato · Non utilizzare» e pulsantiera con tasti tondi, targhette dei piani e serratura ricreati dal riferimento fornito (`assets/tex/elevator_details.webp`, atlante condiviso); i tasti hanno rilievo geometrico.
  Sulla parete interna sinistra, il simbolo rosso con colature fornito dall'autore (`assets/tex/elevator_mural.webp`), con fondo trasparente, appare dipinto sulla lamiera dietro il corrimano.
- **Audio**: sintesi Web Audio più alcune registrazioni mp3 corte in `assets/audio` (`audio.sfx`): drone della sala della folla, ringhio, fuoco. La presenza del tombino riusa il vento procedurale.
- **Folla, crescendo sonoro** (`js/audio/hall.js`): tre campane modali spezzate sulle riapparizioni, colpi sempre più serrati e due raffiche di passi/trascinamenti nel buio. Le distanze audio seguono quelle delle sagome; le code vengono troncate prima del respiro. Verifiche: `node --experimental-vm-modules tools/check_hall_timing.cjs` e `node tools/check_hall_audio.cjs` (Playwright/Chromium; argomento WAV facoltativo per esportare l’anteprima).
  Accenti ambientali molto bassi (`js/audio/ambience.js`): aria nel tunnel, tubature nel reparto, ventilazione lontana nell'obitorio e scricchiolio nel magazzino. Una sola volta per ambiente, durante brevi finestre di esplorazione, con dissolvenza e posizione 3D; si interrompono cambiando stanza, nei silenzi di tensione e durante il combattimento. Nessun nuovo file audio da scaricare.
- **Ambiente iniziale**: il selettore «ambiente: … ▾» è sempre visibile, anche senza salvataggi. Puoi scegliere tunnel, sala della folla, cantina e cripta, reparto, obitorio, magazzino e torre. Le voci «salvato» riprendono le scelte e le note del checkpoint (`localStorage`, `ng_ckpt` e `ng_rooms`); le altre partono dall'ingresso dell'ambiente. Il menu è comune alla versione standard e a tutte le personalizzazioni, inclusa Yana. Il reparto parte prima del montacarichi; i vecchi checkpoint dell'obitorio continuano a recuperare anche quello del reparto.
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
- `js/events/` — `glass` vetro · `door` portone e sala della folla · `hall` sala/folla · `cellar` specchio · `ward` reparto · `morgue` obitorio · `warehouse` magazzino · `tower` torre e finali · `drain-presence` fumo e occhi · `scare` jump scare · `combat` combattimento · `notes` note · `dawn` epilogo
- `js/ui/` — instabilità, sfasamento RGB
- `assets/tex`, `assets/models`, `assets/audio` — texture, modelli GLB, suoni
- `tex-lib/` — libreria di texture di riserva (colore 512 px), non inclusa nella cache del gioco
- `tools/` — `bump.sh` (hash e cache del service worker), `shrink_glb.py` (riduce le texture dei modelli), script per font di sangue, murales e icone

## Crediti asset
- Texture e modelli Poly Haven / ambientCG (CC0).
- Ghiaia cosmica: adattamento della texture `floorB_c.jpg` già nel progetto. Basalto e frattura della cripta: riferimento grafico dell'autore e decal originale generata e ottimizzata per il gioco.
- Falò lontano del pianeta: geometria da `17-camp_fire.rar` fornito dall'autore; colori dell'atlante incorporati nei vertici, senza caricatore FBX o texture aggiuntive. Fiamma leggera creata nel gioco.
- Presenza nebulosa sotto il ponte: ritaglio originale generato per il progetto, ottimizzato in WebP 512×512 con trasparenza e incorporato in `js/world/abyss-presence-image.js`.
- Suoni registrati: Pixabay (alesiadavina) e Mixkit (licenze gratuite); passi: Kenney «Impact Sounds» (CC0).
- Modelli dei personaggi e murales forniti dall'autore del progetto (murales generati con strumenti di immagini); licenze originali da confermare prima di una pubblicazione più ampia.
- Three.js: MIT.

## Effetto della piega nel reparto
Di default (in tutte le versioni; `?piega=0` la spegne) il corridoio del reparto si flette a S e si torce un po' sul proprio asse (circa 27° al massimo) per un attimo (circa 11 s), poi torna dritto prima dell'obitorio. Collisioni, posizioni ed eventi non cambiano: cambia solo il disegno (`js/world/bend.js`, stessa matematica di `labs/space-fold`). Con `?piega=0` non viene caricato niente. Con «movimento ridotto» del sistema l'effetto è più piccolo e senza allargamento del campo visivo.

## Allungamento del tunnel
Nel primo tunnel, tra 9 e 14 m dall'ingresso, il corridoio diventa lunghissimo per un attimo (il fondo schizza lontano, circa 2 s in tutto) e poi torna com'era. Solo disegno (`js/world/breath.js`): collisioni e posizioni non cambiano. Spento di default (non convinceva): si attiva solo con `?allunga=1`.

## Ponte sull'abisso nel magazzino
Avanzando al centro, i due lati del pavimento scendono realmente di 8 m, con gli oggetti appoggiati, lasciando un percorso stabile largo 2,1 m. Il pavimento si consuma a chiazze, con fratture appena violacee; gli oggetti sfumano nel nero e rivelano un vuoto stellato tridimensionale, senza luci aggiuntive. Il perimetro delle aperture ha lo stesso spessore verticale del ponte (22 cm) e riusa la texture del pavimento. Le stelle ruotano lentamente attorno al centro del ponte e la loro luce pulsa dolcemente: cambiano soltanto una trasformazione e un colore, senza aggiornare i vertici. Si può avanzare, fermarsi e tornare indietro; i bordi impediscono la caduta. Dopo il passaggio il pavimento risale e riprendono gli eventi originali. Nessuna rotazione automatica della visuale. La preferenza di sistema «movimento ridotto» rallenta la trasformazione, usa una dissolvenza semplice e ferma rotazione e pulsazione.

Guardando sotto il ponte si distingue una presenza gigantesca, inizialmente confusa con una nebulosa. La nube e le stelle condividono lo stesso riferimento spaziale: la sua posizione e il suo orientamento rimangono fissi nell'universo. La comparsa segue il tempo della scena, indipendentemente dallo sguardo; soltanto i lembi interni si muovono lentamente, senza suoni improvvisi o interventi sulla camera. Due accenni agli occhi e uno alla bocca suggeriscono un volto demoniaco attraverso ombre molto deboli, legate alle pieghe della nube: modificano appena il colore già campionato, senza nuove immagini o luci. Un piano 2.5D da 192 triangoli usa una sola immagine WebP da 512 pixel (circa 75 KiB), preparata prima dell'ingresso. Il movimento avviene nel vertex shader, senza ricaricare i vertici. L'immagine incorporata nella shell conserva la cache degli asset pesanti. Il movimento ridotto mantiene la sagoma ferma; ripristino e checkpoint azzerano la rivelazione, e un eventuale errore dell'immagine lascia il ponte giocabile.

Prova diretta: `?start=magazzino`; disattivazione completa: `?ponte=0`. Si ripristina a ogni ingresso/checkpoint. Usa la stessa scena, i materiali del pavimento e il pool esistente di due luci; nessun asset da scaricare durante la trasformazione. Verifiche disponibili: `node --experimental-vm-modules tools/check_warehouse_bridge.cjs` e, con server locale e Chromium/Playwright, `tools/check_warehouse_bridge_browser.cjs`. I test software non misurano gli FPS su Android reale.

## App installabile e aggiornamenti
Il gioco è una PWA: icona sulla home, schermo intero, funziona offline dopo il primo avvio. Quando esce una nuova versione compare il banner **«Aggiornamento disponibile · AGGIORNA»** (controllo a ogni apertura e ogni 30 minuti).

Prima di ogni commit che cambia il gioco si lancia `tools/bump.sh`: calcola l'hash dei file e lo scrive in `sw.js` (se nulla cambia, nessun banner). Gli asset pesanti hanno una cache separata, quindi un aggiornamento del solo codice non li riscarica.

### Lava, scolo e foschia della folla

Sul pianeta le colate lontane hanno 18 fiammelle instanziate, ancorate ai triangoli reali del terreno sul confine lava/roccia. Sono più larghe e alte per essere leggibili dalle colline, con ritmo irregolare e lingue occasionalmente più alte. L'alone morbido usa quattro campioni locali della stessa mappa, sulla mesh già presente: nessun post-processing, luce aggiuntiva o nuova immagine. La rifrazione dello sfondo è omessa per evitare un passaggio di rendering completo. Il pianeta resta sotto 9.000 triangoli e aggiunge una sola draw call; il blackout originale spegne anche le fiamme.

Nel tunnel la presenza informe esce dalle fessure dello scolo; avvicinandosi a 12 metri, i 128 filamenti si allargano e si diradano sul posto in 3,2 secondi (3,8 con movimento ridotto), senza rientrare nella grata. Camminando normalmente la dissolvenza finisce a circa 7 metri; un limite di prossimità completa comunque la scomparsa entro 6 metri, anche con ingresso diretto o FPS bassi. Gli occhi rosso cupo restano alla loro altezza e si spengono prima delle ultime volute, mantenendo la precedente riduzione di luminosità del 15%. La grata rimane fissa, anche in qualità bassa. Nessun cane, relativo credito iniziale o riferimento narrativo; il murale esistente è lasciato invariato in questa modifica.

La sala della folla usa 120 volute soffici instanziate (84 in qualità bassa), in una draw call e con la stessa texture procedurale 128×128 del tunnel. Centri irregolari e lieve sovrapposizione sostituiscono le vecchie strisce: ogni voluta è più trasparente e sfuma in altezza fino a zero a 50 centimetri, anche inclinando la visuale. Il volume resta nello spazio della stanza: le traiettorie degli al massimo 15 mostri aprono la foschia, che si richiude quando la scia decade. Gli avvicinamenti originali avvengono nei blackout e sono mantenuti; non viene introdotto un nuovo movimento dei mostri né un lampo radente. La foschia segue il buio e non aggiunge luci. Le texture e i programmi sono preparati prima di uscire dal menu. Movimento ridotto ferma le oscillazioni, mantenendo la dissolvenza graduale e l'apertura della foschia.

Verifiche: `node --experimental-vm-modules tools/check_atmosphere.cjs`, `tools/check_cosmic_landscape.cjs`, `tools/check_drain_timing.cjs` (stesso comando Node) e i test browser `tools/check_cosmic_browser.cjs`, `tools/check_drain_presence_browser.cjs`, `tools/check_crowd_fog_browser.cjs` con un server HTTP e Playwright/Chromium. Le prove browser controllano le scene dalla camera del giocatore in verticale; la misura degli FPS e la resa finale richiedono uno smartphone Android reale.
