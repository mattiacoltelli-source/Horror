# Analisi tecnica — SPACE FOLD

Snapshot analizzato: `0300fb7d0099cd23ba8e9fbe81b22df4b8d79c16`, repository `mattiacoltelli-source/Horror`, 18 novembre 2026.

## 1. Repository e protezione della versione esistente

Il ramo remoto predefinito/pubblicato è `ccr-d2d1979b-98409q`; al momento dell'ispezione non esiste un ramo remoto `main`.
Il worktree `/workspace/horror` contiene modifiche preesistenti: non sono state riutilizzate, sovrascritte, azzerate o incluse nel prototipo.
È stato creato un worktree separato `/workspace/horror-space-fold`, sul solo branch `feature/space-fold`, partendo dal commit pubblicato sopra.
Le aggiunte risiedono esclusivamente in `labs/space-fold/`. Nessuna modifica a workflow, service worker, salvataggi o versione pubblica; nessun push, merge o deploy eseguito.

Il workflow Pages attuale copia esplicitamente solo i file del gioco e non la cartella `labs`. Il branch sperimentale non corrisponde al filtro push `main`/`ccr-**`. Non viene comunque usato alcun workflow o hosting per questa prova.

## 2. Ambienti realmente presenti

| Ambiente | Geometria e coordinate canoniche | Compatibilità |
| --- | --- | --- |
| Reparto, `js/events/ward.js` | Corridoio **4 × 20 × 2,5 m**, da Z −480 a −500; kit `mg_wall`, due porte `hw_door_1`, lampada `wlamp`, pavimento `mg_floor.jpg`, soffitto `ward_ceiling.jpg` | Scelta migliore: asse unico, sagoma stretta, materiali già modulari e deformazione leggibile lungo la fuga |
| Obitorio, `js/events/morgue.js` | Sala **9 × 15 × 3 m**, da Z −500 a −515; tavolo, sedia, parete con radiografie, porte/eventi propri | Non è un secondo corridoio equivalente: curvarlo coinvolgerebbe molti arredi, interazioni e collisioni scritte in coordinate mondiali |

Il reparto sbocca già nell'obitorio senza dissolvenza. I commenti storici del sorgente che lo definiscono una stanza solo di prova non descrivono più tutti i collegamenti effettivi. La scelta riguarda quindi il **corridoio che conduce all'obitorio**, riusato visivamente in un laboratorio indipendente.

La prova riprende la sezione originale di 4 × 2,5 m e i primi 20 m; aggiunge 4 m di vestibolo per verificare il cammino dopo la curva. Non duplica l'intero reparto con i suoi eventi, né carica l'obitorio.

## 3. Motore, camera, input e collisioni esistenti

- **Three.js r170**, vendorizzato in `vendor/three/`, ESM e import map; sito statico senza framework/build o motore fisico.
- `js/main.js`: `WebGLRenderer`, una `Scene`, camera prospettica, gruppi di stanze, loop e orchestrazione. FOV verticale 68° in portrait e 58° in landscape.
- `js/player/controls.js`: joystick fluttuante a sinistra e visuale a destra, due pointer ID/capture, WASD/frecce su desktop. Viene importato senza modificarlo.
- `js/player/player.js`: movimento XZ con altezza occhi costante, yaw/pitch, box assiali e resolver per stanze. La camera viene riscritta ogni frame: ruotarla esternamente non produrrebbe locomozione sulla parete.
- Le collisioni in `ward.js`, `morgue.js` e altri eventi usano Z/X canonici e non un sistema generale di gravità. Alcuni oggetti hanno repulsioni manuali. Deformare solo il rendering renderebbe quelle collisioni incoerenti.
- Esistono risoluzione adattiva, materiali PBR, pooling delle luci e passaggi aggiuntivi per specchi/vetro. Il laboratorio usa la risoluzione adattiva disponibile, senza attivare specchi o ulteriori passaggi.

## 4. Architettura scelta

**Stesso Three.js, una pagina separata e un controller curvilineo.** Nessun secondo motore, canvas sovrapposto o libreria fisica. Il gioco di produzione non viene eseguito contemporaneamente alla prova.

Il pavimento è descritto dalla coordinata di distanza `s`. La curva inizia a 4 m, occupa 12 m e si conclude a 16 m; segue un tratto stabile fino a 24 m.

```text
u = clamp((s − 4) / 12, 0, 1)
θ(s,t) = α(t) · (10u³ − 15u⁴ + 6u⁵)
T(s,t) = (0, sin θ, −cos θ)
N(s,t) = (0, cos θ,  sin θ)
C(s,t) = integrale di T rispetto a s
P(x,y,s,t) = C(s,t) + (x,0,0) + y · N(s,t)
```

`α` cresce da zero a π/2 con easing quintico. L'integrazione Simpson su 480 intervalli fornisce il centro della superficie. La tangente e la normale restano continue ai raccordi. Il giocatore e tutti gli asset usano la stessa mappa.

Le mesh di pavimento, soffitto e pareti sono segmentate ogni 12,5 cm. Il profilo e gli UV del vero muro `mg_wall` preservano intonaco verde, piastrelle e cornice. Le porte originali sono suddivise longitudinalmente e deformate, comprese le normali corrette tramite Jacobiano: non scivolano su un muro che cambia forma. Le lampade seguono posizione e orientamento della normale locale.

Le trigonometrie e i lookup della curva sono condivisi per stazione longitudinale, evitando di ricalcolarli per ogni vertice. Le mesh vengono aggiornate solo quando cambia l'angolo della piega. Bounds conservativi includono l'intera deformazione e mantengono validi anche i raycast a 90°.

### Locomozione e camera

Il controller mantiene `(x,s)` e yaw/pitch relativi alla superficie. Joystick e tastiera producono movimento nel piano tangente; l'altezza resta 1,62 m lungo `N`. Non viene invertita una posizione mondiale con approssimazioni, né applicato un teletrasporto alla soglia.
Il giocatore conserva il controllo durante preavviso e trasformazione: può avanzare, fermarsi, guardare, spostarsi lateralmente e arretrare. I limiti laterali ±1,30 m lasciano margine per il raggio di 32 cm e le porte. Le estremità hanno limiti fisici espliciti.

La rotazione della camera è `frame_locale · look_locale`, con inseguimento esponenziale del frame (circa 0,10 s), senza head-bob o shake. Il pavimento continua a portare con sé un giocatore fermo sulla curva; i suoi comandi non vengono forzati.
Movimento ridotto rallenta piega e velocità; il progresso è normalizzato, quindi cambiare modalità durante la deformazione non cambia istantaneamente l'angolo. Le durate sono calibrate perché anche camminando senza pause si arrivi a un tratto ormai stabile prima dell'estremità.

## 5. Suono e atmosfera

Web Audio genera rumore filtrato, due frequenze profonde dissonanti, risonanze metalliche a intervalli e piccoli passi proporzionati alla distanza effettivamente percorsa. Il preavviso comincia prima della deformazione; il suono strutturale cresce durante la piega e si attenua quando si stabilizza.
Non sono stati aggiunti file audio da scaricare. Un compressore limita i picchi; inizializzazione al gesto dell'utente, mute, pausa e rilascio delle risorse restano locali al laboratorio.

Materiali e mappe sono quelli del reparto. Una torcia segue la camera e due sole luci puntiformi seguono le lampade più vicine, che a loro volta seguono il corridoio. Nessuna ombra dinamica aggiunta, volumetria o post-processing. Il materiale importato della lampada è adattato per evitare il passaggio di trasmissione del vetro.

## 6. Prestazioni: fatti e limiti

Nelle viste automatizzate: circa **17.800–24.500 triangoli visibili**, **20–38 draw call**, 13 texture GPU e 30 geometrie. Questi conteggi dipendono dall'inquadratura. I cinque asset richiesti sono già nel repository; si caricano prima dell'ingresso insieme agli shader. Durante piega e attraversamento i test non rilevano ulteriori richieste di rete.
Il pixel ratio iniziale è al massimo 1,15, con il controller adattivo esistente fino a 0,7. Alla fine della piega cessa l'aggiornamento delle mesh, mentre input, camera e luci continuano.

Chromium nella workspace usa **SwiftShader**, quindi non misura la GPU di uno smartphone. Il benchmark CPU del JSON riguarda soltanto `corridor.update()` e comprende rumore di scheduling/JIT della macchina virtuale: non è un budget completo di frame o una promessa di FPS su Android.

Da verificare su dispositivo fisico: almeno 30 FPS, frame time p95 circa 33,3 ms o inferiore, temperatura dopo 10 minuti, resa delle frequenze basse e comfort. Se il costo di upload dei vertici fosse eccessivo, prima ridurre la segmentazione a 20–25 cm e il dettaglio delle maniglie, poi valutare deformazione nel vertex shader mantenendo identica la matematica del controller. Non è necessario introdurre un motore fisico.

## 7. Verifiche eseguite

- Test matematici: lunghezza, continuità di raccordi, normalizzazione del frame, Jacobiano del soffitto sempre positivo (margine minimo >0,38), altezza occhi, avanti/indietro, diagonale, rotazione, arresto e limiti.
- Simulazione di giocatore fermo sulla piega: posizione locale costante e rotazione continua; cambio della modalità ridotta senza inversioni dell'angolo. Attraversamento senza fermate in entrambe le modalità.
- Test browser su Chromium con input touch emulato: due dita contemporanee, rilascio, pointercancel, pausa con tasto premuto, ripresa e rotazione portrait/landscape.
- Raycast sulla mesh reale in sette punti fra 5 e 22 m: distanza occhi-pavimento circa 1,62 m, con scarto inferiore a 0,1 mm nelle viste controllate. Normali delle mesh finite e normalizzate, lampade esattamente ancorate alla mappa.
- Trasformazione verificata nelle posizioni dei vertici di pavimento e porte, anche con camera e giocatore fermi nel tratto iniziale: l'effetto non dipende da una sola rotazione della visuale.
- Flag URL disattivato e kill switch globale: nessun caricamento di motore/asset. Funzionamento sotto `/Horror/`, nessun nuovo download durante la sequenza, salvataggi sentinella inalterati e nessun errore JavaScript/WebGL o richiesta fallita.
- Rendering audio nativo offline di 20 s: campioni finiti, suono nel preavviso e nella piega, picco inferiore al clipping, silenzio iniziale e dopo il mute.
- Nove controlli preesistenti in `tools/`: qualità, preparazione scena e storia, foto personali, avvicinamento cripta, specchio, santuario, tempi e audio sala mostri. Superati; i test VM sono stati eseguiti con il flag Node richiesto.

I primi tentativi dei test hanno individuato e risolto bounds statici errati per raycast sulla parte verticale. I controlli che richiedono VM/Chromium sono stati rieseguiti con le rispettive opzioni disponibili nell'ambiente; non si sono alterati i file dei test del gioco per aggirarne i requisiti.

## 8. Limiti e rischio di regressione

**Oggi:** isolamento alto e rischio per il gioco corrente molto basso: nessun suo file, checkpoint o evento è modificato. Il laboratorio termina in un vestibolo verticale con porta chiusa e consente il ritorno; non promette il successivo caricamento dell'obitorio. Nessuna certificazione su Android fisico o di assenza di motion sickness.

**Integrazione futura:** rischio medio/alto se si inserisse la trasformazione direttamente nei gruppi attuali. Letto, sedia, montacarichi, scritte, audio posizionale, torcia, trigger e collisioni dovrebbero usare coordinate canoniche locali; le logiche narrative non possono leggere ingenuamente le coordinate mondiali deformate.

Prima di agganciarlo al percorso esistente bisogna scegliere un'uscita realmente continua. La soluzione meno invasiva è un successivo riassestamento geometrico graduale del corridoio, ancora sotto controllo del giocatore, fino a far coincidere pose e normali con la soglia originale; solo allora si restituisce il movimento al controller del gioco. Una destinazione permanentemente verticale richiederebbe invece trasportare anche il frame dell'obitorio e adattare i suoi eventi. Nessuno di questi raccordi è stato finto con un teleport o introdotto nel gioco attuale.

Per perdita del contesto WebGL il laboratorio mette in pausa e chiede di ricaricare: il ripristino completo a metà deformazione non è implementato. I due muri laterali restano chiusi e gli arredi mobili non vengono simulati fisicamente.
