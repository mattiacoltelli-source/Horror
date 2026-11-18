# SPACE FOLD — corridoio impossibile giocabile

Prototipo isolato di **NON GIRARTI**, sul branch locale `feature/space-fold`, derivato da `0300fb7d0099cd23ba8e9fbe81b22df4b8d79c16`.
Nessun merge, push, deploy o cambiamento all'entry point del gioco. Le modifiche preesistenti negli altri worktree restano intatte.

## Avvio

Dalla radice del repository, oppure dalla radice del pacchetto di anteprima:

```sh
python3 -m http.server 8186 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:8186/labs/space-fold/?spaceFold=1`.
Usare un'origine/porta diversa da quella impiegata per il gioco pubblico, per evitare il service worker già installato. La pagina del laboratorio non registra service worker e non legge/scrive i salvataggi.

Su Android collegato via USB al computer che esegue il server, con debug USB e Android Platform Tools disponibili:

```sh
adb reverse tcp:8186 tcp:8186
```

Aprire **sul telefono**, in Chrome, lo stesso indirizzo `http://127.0.0.1:8186/labs/space-fold/?spaceFold=1`.
Il server deve girare sul computer collegato via USB: un localhost aperto nella workspace remota non è automaticamente raggiungibile dal telefono.
Il pacchetto ZIP di anteprima permette questa prova senza pubblicare né scaricare tutti gli asset del gioco.
I moduli ES non vanno aperti direttamente con `file://`.

## Controlli e sequenza

- Metà sinistra: joystick per avanti, indietro e spostamento laterale. Metà destra: trascina per guardare.
- Desktop: WASD/frecce; trascina a destra per la visuale. Esc oppure `Ⅱ` per la pausa.
- **Movimento ridotto** segue la preferenza del sistema e si può cambiare dal pannello di pausa. Rallenta piega e camminata, senza scatti quando viene attivato durante la trasformazione.
- **Suono** si può disattivare dal pannello. L'audio viene inizializzato dal pulsante di ingresso, secondo le regole del browser mobile.

Si parte in un tratto dritto. Superati 2,6 metri scatta un preavviso strutturale di 1,8 s; la piega dura circa **12 s di gioco attivo**, oppure **24 s** in movimento ridotto. La trasformazione prosegue anche mentre il giocatore è fermo; pausa e cambio scheda la sospendono.
La pendenza finale è 90°. Dopo la curva ci sono 8 m stabili percorribili. Si può tornare indietro lungo l'intero corridoio. Non avvengono tagli, dissolvenze, teletrasporti o cambi automatici di direzione.
Velocità: 1,45 m/s, oppure 0,8 m/s in movimento ridotto. Nessun head-bob o lampeggio aggiunto.

La porta finale delimita la prova: **il laboratorio non avvia la storia dell'obitorio**. Le porte laterali sono decorative, chiuse e non interattive; non includiamo letto, sedia a rotelle, montacarichi, nemici e relativi eventi del reparto di produzione.

## Aggiunte della seconda prova (solo nel laboratorio)

- **Corridoio di 10 m dritti** prima della piega (prima erano 4): lunghezza totale 30 m (10 dritti, 12 di piega, 8 stabili). Due porte e tre lampade in più nel tratto dritto.
- **Sedia a rotelle che scivola**: ferma in fondo; quando la piega supera ~40° si stacca e rotola verso il giocatore lungo il pavimento (gravità ridotta, attrito, 4,8 m/s al massimo), con un rumore metallico che cresce con la velocità. Si ferma vicino all'inizio.
- **Rotazione sull'asse**: dopo la piega, quando si arriva a ~23,5 m, la sezione del corridoio gira su se stessa fino a 180° in 10 s (20 s con movimento ridotto). Il pavimento resta sotto i piedi; il fondo si capovolge. `?roll=0` la disattiva.
- **Effetto vertigine**: dopo l'inizio della piega il campo visivo si allarga fino a +9° mentre ci si avvicina al fondo, quindi il fondo sembra ritrarsi. Disattivato con «movimento ridotto».

## Disattivazione completa

- Senza `spaceFold=1`, oppure con `spaceFold=0`, nessun renderer, asset, audio o controller viene caricato.
- Impostare `SPACE_FOLD_AVAILABLE = false` in `config.js` per bloccare l'esperimento anche con un URL di attivazione.
- L'entry point pubblico non importa il laboratorio: il costo per il gioco corrente è zero.

## File aggiunti

| File | Responsabilità |
| --- | --- |
| `index.html`, `style.css`, `boot.js` | Pagina separata, pannello, flag e caricamento condizionale |
| `config.js` | Kill switch e opzioni URL |
| `path.js` | Curva, sequenza e controller vincolato alla superficie |
| `corridor.js` | Pavimento/pareti/soffitto segmentati, porte deformate, lampade ancorate |
| `lab.js` | Rendering, controlli esistenti, camera, luci, pausa e risoluzione adattiva |
| `audio.js` | Rumble, risonanze strutturali e passi sintetizzati con Web Audio |
| `check-math.cjs` | Invarianti matematiche, locomozione, accessibilità e flag |
| `check-browser.cjs` | WebGL, raycast, attraversamento, touch e isolamento |
| `check-audio.cjs` | Rendering Web Audio offline e controllo del segnale |
| `ANALISI.md`, `README.md` | Valutazione tecnica e istruzioni |

Tutti i file del gioco in `js/`, `assets/`, `index.html`, `sw.js` e `.github/` rimangono identici alla base del branch.

## Verifiche riproducibili

```sh
node labs/space-fold/check-math.cjs
node labs/space-fold/check-browser.cjs
node labs/space-fold/check-audio.cjs
```

Gli ultimi due richiedono Playwright e Chromium già disponibili. Se non sono risolvibili automaticamente, specificare `PLAYWRIGHT_MODULE=/percorso/playwright` e `CHROMIUM_PATH=/percorso/chromium` prima del comando. I test non installano dipendenze.
`SPACE_FOLD_ARTIFACTS=/percorso/cartella` salva screenshot, risultati JSON e anteprima audio WAV fuori dal repository. Il test browser avvia autonomamente un server su una porta libera di `127.0.0.1`, anche sotto il prefisso `/Horror/`.

`?spaceFold=1&debug=1` abilita contatori e API di prova `window.__spaceFold`. I metodi `advance`/`step` usano lo stesso aggiornamento del gameplay per i test deterministici; la modalità `manual` sospende gli aggiornamenti RAF. L'API non esiste nella modalità normale e non viene importata dal gioco pubblico.

## Stato della verifica

Superati test matematici, browser Chromium/SwiftShader con touch emulato, raycast del pavimento e test audio offline nativi. Superati anche i nove controlli già presenti in `tools/` (quelli basati su VM richiedono `--experimental-vm-modules`).

**Non è disponibile un telefono Android fisico nella workspace.** Non è certificato il target di 30 FPS, né sono valutati comfort vestibolare e resa acustica su hardware reale. SwiftShader è rendering software e non è un benchmark Android. I dati CPU nel JSON misurano solo la deformazione, non un frame completo.

Per la prova sul telefono: percorrere avanti/indietro, fermarsi a metà piega, muovere entrambi i pollici, attivare movimento ridotto in pausa, ruotare lo schermo, sospendere e riprendere Chrome. Verificare almeno 10 minuti, riscaldamento e frame time: obiettivo 30 FPS e p95 del frame entro circa 33,3 ms sul dispositivo scelto. `debug=1` è solo un'indicazione, la validazione richiede gli strumenti prestazioni di Chrome sul dispositivo.

Vedere [ANALISI.md](ANALISI.md) per architettura, motivazione, rischi e limiti dell'integrazione.
