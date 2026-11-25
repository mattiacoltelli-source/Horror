# Presenza dal tombino

La figura del primo tunnel viene sostituita da una forma incompleta di fumo,
con due fessure rosso scuro appena leggibili. Il riferimento del movimento è
l'HTML `nebbia-umanoide _2_.html` fornito dall'utente: particelle ancorate alle
fessure della grata, corpo che prende forma lentamente, occhi rivelati dopo
l'emersione. Il fondale 2D della dimostrazione non viene sovrapposto al gioco.

## Regia e dissoluzione

La presenza è nel mondo, sopra la grata già esistente a `(0.3, 0, -45)`.
L'emersione parte soltanto dopo il vetro e dura circa 3,1 secondi. Il giocatore
può fermarsi, guardare altrove e muoversi liberamente. Dopo l'avvicinamento la
forma perde coerenza: i lembi si separano, si allargano e salgono leggermente,
mentre la densità si riduce per circa 3,8 secondi. Gli occhi sfumano insieme
al fumo. La mesh viene nascosta soltanto quando l'opacità è già zero; nessun
flash o cambio della camera sostituisce la dispersione.

Il movimento ridotto ferma ondeggiamento e pulsazione, mantiene un'emersione
graduale e allunga la dispersione a 4,4 secondi. Tornando indietro la presenza
non ricompare. Gli altri ambienti e l'epilogo la tengono disattivata. In qualità
bassa una grata procedurale minima conserva la sorgente del fumo.

La regia dei sottotitoli resta libera quando il giocatore guarda altrove. Il
soffio riusa il vento Web Audio esistente, con volume molto basso e arresto
quando l'evento finisce o si lascia il tunnel.

## Costo e risorse

- 128 lembi instanziati: una mesh e 256 triangoli; gli occhi aggiungono una
  sprite e due triangoli. Due draw call aggiuntive misurate nel browser.
- Qualità bassa: al massimo una terza draw call e due triangoli per la grata.
- Tre piccole texture procedurali preparate una sola volta; le animazioni
  cambiano uniformi, senza ridisegnare canvas o ricaricare vertici.
- Shader compilati e texture caricate sulla GPU prima di iniziare. Nessuna
  nuova libreria, ombra dinamica, luce, simulazione fisica o post-processing.
- Il modello sostituito aveva 22.136 triangoli e occupava 1.598.116 byte.
  Modello e registrazione inutilizzati vengono rimossi dalla distribuzione.

Il murale infernale fornito dall'utente viene raddrizzato per ricavarne una
texture frontale, compressa in WebP 1280×692 (circa 279 KiB). Occupa la stessa
campata, conserva le proporzioni e resta interamente sotto l'imposta della
volta. Una maschera statica consuma i bordi senza cancellare i dettagli del
dipinto. La vecchia illustrazione non viene più distribuita.

Credito iniziale e riferimenti narrativi alla precedente figura sono rimossi.
La nota del magazzino ora richiama il fumo che sale dalle grate, mantenendo
nome, genere, provenienza e gli altri indizi personali.

## File e verifiche

Effetto: `js/events/drain-presence.js`; murale: `js/world/painted-mural.js` e
`assets/tex/pic_mural_infernal_smoke.webp`. Collegamenti in `js/main.js`,
`js/narrative-director.js`, `js/narrative-copy.js`, `js/audio/audio.js` e
`index.html`. Documentazione e cache PWA vengono aggiornate.

`tools/check_drain_presence_browser.cjs` verifica l'emersione nel vero tunnel,
la posizione indipendente dallo sguardo, la dispersione progressiva degli
occhi e del corpo, l'assenza di ricomparsa, costo in draw call/triangoli,
proporzioni del murale, qualità bassa, movimento ridotto e disattivazione
fuori dal tunnel. Controlla anche gli errori JavaScript/HTTP e che le risorse
precedenti non vengano richieste. Le immagini di verifica sono salvate in
`/tmp/horror-drain-presence/`.

I controlli di narrazione, preparazione, checkpoint, profili personali, ritmo
della folla, paesaggio cosmico, epilogo, renderer e ponte restano disponibili.
La guardia di immutabilità ammette soltanto i cinque file visivi esplicitamente
coinvolti nella sostituzione e la rimozione del credito, continuando a
proteggere gli altri ambienti, asset, controlli e la logica PWA.

Rimangono da valutare sul telefono reale la leggibilità desiderata della
figura e degli occhi, il mix del soffio e gli FPS: il browser software non
certifica le prestazioni di uno smartphone Android.
