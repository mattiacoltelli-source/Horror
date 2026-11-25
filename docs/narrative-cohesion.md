# NON GIRARTI — coerenza narrativa

## Direzione

L'ospedale conserva ciò che il protagonista non riesce a ricostruire: la
sorella, una porta, il fuoco, il cane e le persone rimaste dentro. Il registro
di Suor Agnese è una testimonianza interessata, non una voce onnisciente.
Ricorda un salvataggio e ammette una falsificazione; non chiarisce se stia
proteggendo il protagonista, trattenendolo o condividendo la sua prigione.

Le note distinguono l'incendio domestico precedente al ricovero dall'incendio
del magazzino. L'innesco volontario è un dato scritto nel registro; chi abbia
chiuso la porta resta un'accusa e un ricordo incompleto. La camera infantile
bruciata nella torre e la cantina bruciata nello specchio suggeriscono che
luoghi e tempi possano essere sovrapposti. Non viene confermata una diagnosi,
una simulazione mentale o la natura dell'universo oltre l'ospedale.

Il titolo cambia significato senza cambiare la scelta del giocatore. La prima
volta indica un pericolo alle spalle. Alla fine può indicare la notte che si
continua a evitare. Guardare o non guardare non basta a stabilire la verità.

## Sequenza effettiva e associazioni

La sequenza deriva dai moduli di gioco, non dall'ordine storico del README.
Gli eventi facoltativi possono essere saltati; nessun testo finale deve
presupporre che siano stati osservati tutti.

| Ambiente | Eventi già presenti | Funzione narrativa |
| --- | --- | --- |
| Primo tunnel | Arco laterale aperto, pianeta con galassia, montagne, lava e falò lontano; sfarfallio, buio e ritorno rivolti verso il corridoio. | Prima crepa facoltativa, prima del vetro e del cane. Il fuoco compare anche nel luogo che sembra offrire una fuga. Il ritorno rende incerta l'uscita senza spiegarla. |
| Tunnel principale | Figura dietro il vetro, avvicinamento e mani; cane nella penombra; murale del cane; topi e rumori del condotto. | Il ricordo prende prima una forma incompleta e poi un corpo lasciato indietro. Il registro dice soltanto che il nuovo ingresso conosce già la strada. |
| Sala oltre il portone | Tre rivelazioni della folla, due avanzamenti nel buio, rintocchi e pressione sonora, respiro alle spalle; scelta di voltarsi. | L'appello incompleto trasforma le sagome in assenze, senza dare una biografia a ciascuna. La prima lettura del titolo rimane una regola di sopravvivenza. |
| Cantina e specchio | Riflesso di una cantina bruciata, ombre ai margini, sangue, vapore, nome personale o «TI VEDO», figura che attraversa la stanza, busto che si volta e torcia che rotola. | Il luogo è riconosciuto prima del proprio volto. Le variazioni ai margini e gli oggetti che rispondono quando non vengono osservati sostengono il dubbio su memoria e giudizio. |
| Cripta e annessi | Altare, eventuale foto personale, rosario spezzato, scritta con data e ora del dispositivo, fratture con brace; santuario dei film accessibile con chiave. | Il rito usa il presente del giocatore mentre i muri conservano il fuoco. Il santuario resta un ritrovamento facoltativo e la collezione di Cos: non diventa un nuovo capitolo esplicativo. |
| Percorso segreto della cantina | Codice del tastierino, apertura del portale a terra, caduta cosmica di 13 secondi, occhio gigantesco, arrivo diretto nella torre con lama di luce. | Il motivo dello sguardo può essere umano o cosmico. La luce rende possibile un altro gesto, senza certificare una liberazione. Lo spettacolo conserva spazio per l'osservazione. |
| Reparto | Corridoio che si flette e si torce, ritorno graduale alla forma iniziale, blackout breve; quadro elettrico e arredi ospedalieri. | La soglia viene raggiunta e subito desiderata da capo. Il registro suggerisce ripetizione e resistenza, senza descrivere la deformazione come un sintomo accertato. |
| Obitorio | Strumento che cade quando gli si danno le spalle, impronte, sedia che cambia orientamento quando non osservata, nicchia dell'ascensore fuori servizio, porte rossa e del respiro. | Il corpo ricorda ciò che il registro non conclude. Le due porte permettono di scegliere come proseguire, ma nessuna garantisce un'uscita dal passato. L'ascensore resta una presenza statica. |
| Magazzino | Pavimento che si apre ai lati di un ponte, universo sottostante con rotazione e pulsazione, presenza nebulosa quasi indistinguibile; televisore, figura sotto il faro, sorella, carrello con pistola/ascia, cancello. | La pianta non ammette ciò che c'è sotto il luogo dell'incendio. Il ponte è un collegamento fragile; la presenza può essere colpa o qualcosa che esiste indipendentemente dal protagonista. La sorella dà forma al ricordo che non rimane più sullo sfondo. |
| Torre | Camera bruciata della sorella, giocattoli e segni di altezza, busto e carrozzina; porta finale, Suor Agnese e confronto. | Un ricordo domestico dentro la struttura ospedaliera avvicina il dubbio alla sua massima intensità. Il salvataggio di Agnese non equivale alla promessa di essere al sicuro. |
| Epilogo | Risveglio sotto le stelle, immobilità e libera osservazione, vento che si interrompe, respiro e oscurità finale. | Il cielo esterno richiama quello impossibile. Il ritorno del respiro impedisce di certificare una liberazione, anche dopo la scomparsa di Agnese nel percorso segreto. |

Queste sono associazioni di regia, non didascalie da mostrare una per evento.
Fuoco, porte, appello e sguardi ricorrono in pochi testi e in molte immagini già
esistenti. Murali, radiografie, disegni e sagoma bruciata restano indizi visivi
liberi; non richiedono nuove frasi durante l'esplorazione.

## Scelte e percorsi da conservare

- I due finali standard dipendono da `flags.turned`, impostato nella sala della
  folla. `ENDINGS.A` e `ENDINGS.B` mantengono gli incipit necessari
  all'identificazione del finale nell'interfaccia.
- Le porte dell'obitorio conducono entrambe al magazzino. `flags.door` conserva
  le differenze di luce e respiro esistenti; non viene aggiunta una valutazione
  morale o una nuova destinazione.
- Pistola, ascia e passaggio senza arma restano possibili. Il confronto
  standard non viene trasformato in uno scontro vincibile. Le note conservano
  il beneficio temporale esistente, senza introdurre nuove ricompense.
- Il portale della cantina imposta `flags.bladeEnding` e conduce alla lama di
  luce nella torre. Anche questa strada raggiunge l'epilogo. Il testo finale
  descrive la scomparsa di Agnese, non la distruzione certa dell'entità o della
  prigione.
- `flags.mirror` conserva il riconoscimento dell'evento dello specchio; non
  decide un finale. Il vecchio finale dello specchio è rimosso nella versione
  di partenza e non viene ripristinato.
- La routine `combat.lower()` esiste nel codice, ma il gioco corrente passa
  `calm = null` a `combat.begin()`. La resa con «ABBASSA LA PISTOLA» è dormiente;
  non va attivata come parte di questa revisione.

## Regia e suono

Il copy condiviso risiede in `js/narrative-copy.js`. Registro, note raccolte e
finali usano la stessa progressione e concordanza del profilo. Città e
provenienza rimangono nella prima nota. Mati/Matilde e gli altri profili
conservano i dettagli compatibili; nessun testo assegna a un profilo una foto
che non possiede.

La regia narrativa deve sospendere le letture automatiche durante le anomalie
visive e gli attacchi. Una nota già iniziata deve poter essere completata;
l'ingresso nella stanza successiva, una pausa o un caricamento non devono
lasciare in coda una frase appartenente alla scena precedente. I messaggi
funzionali indispensabili e gli inviti urgenti a voltarsi rimangono distinti
dal registro.

`js/narrative-director.js` osserva gli stati già esposti dagli eventi; non
deforma o riposiziona la scena. Le finestre principali sono:

- arco cosmico: esplorazione prima dello sfarfallio, lasciando intatti buio e
  rivelazione del ritorno;
- reparto: una sola variazione del motivo durante la deformazione, dopo il
  primo suono strutturale;
- ponte: presenza sostenuta, evitando apertura e ripristino del pavimento;
- sorella: apparizione lontana, interrompendo il motivo prima della sparizione
  e dell'attacco;
- Agnese: anticipazione e rivelazione, evitando spari, colpo finale e silenzio
  dell'epilogo.

Il motivo sonoro sintetico di tre note condivide una relazione intervallare,
ma cambia registro, respiro e inviluppo. È un'associazione discreta, non una
notifica. Cooldown, cancellazione, pausa e priorità dei suoni esistenti devono
impedire ripetizioni o code fuori scena. Nessun nuovo asset audio deve essere
caricato durante la partita.

I richiami sono opportunistici: correndo attraverso il pianeta si può non
sentire il motivo; dopo il ponte il cooldown può lasciare muta l'apparizione
della sorella. Non viene riprodotto in ritardo per compensare uno slot perso.
Il silenzio e i suoni dell'evento hanno sempre la precedenza.

La preferenza di movimento ridotto conserva il comportamento originale degli
effetti. La revisione narrativa non aumenta rotazioni, pulsazioni o movimenti
della camera.

## Flag e accessi

Restano invariati gli interruttori esistenti: `?porta=0` disattiva l'arco
cosmico laterale, `?piega=0` la deformazione del reparto, `?ponte=0` il ponte.
`?spazio=0` salta la caduta cosmica ma mantiene la destinazione del percorso
segreto. L'allungamento storico del tunnel resta disabilitato di default e si
ottiene soltanto con `?allunga=1`. Il laboratorio SPACE FOLD non è il reparto
attivo e non deve essere riattivato o riscritto da questa revisione.

L'esperienza deve funzionare dall'inizio, dai checkpoint `ng_ckpt`/`ng_rooms`,
dal menu delle stanze raggiunte e dagli accessi `?start=piega|porta|cantina|reparto|obitorio|magazzino|torre|epilogo`.
Le note già raccolte e le scelte salvate rimangono valide. Una partenza diretta
non aggiunge retroattivamente ricordi o oggetti che il giocatore non ha visto.

## Verifiche e limiti

I risultati dei test sono riportati nel resoconto della modifica, non
anticipati in questo documento. La verifica mirata comprende code e priorità
del testo, pausa, cambi stanza rapidi, profili maschili e femminili, checkpoint,
entrambi i finali standard, percorso della lama, disattivazione degli effetti,
pulizia delle sorgenti audio e cache PWA.

Su smartphone reale restano da verificare:

- leggibilità dei testi in verticale, anche con nomi lunghi, senza coprire i
  controlli o interrompere l'osservazione;
- volume effettivo del motivo su altoparlante e cuffie, in rapporto a campane,
  respiro, suoni strutturali e silenzi;
- sospensione/ripresa dell'audio dopo blocco schermo o cambio applicazione;
- fluidità e temperatura durante una partita completa, anche con movimento
  ridotto e qualità bassa;
- aggiornamento PWA e successivo avvio offline con tutti i nuovi moduli già
  disponibili in cache.

I test in browser desktop o con servizi Web Audio simulati non certificano i
30 FPS su Android né il bilanciamento percettivo delle frequenze più basse.
La revisione lascia invariati geometrie, shader, texture, modelli, luci,
collisioni e tempi delle sequenze visive: il significato nasce da scrittura,
associazioni e scelta dei momenti in cui tacere.

## File della revisione

- Copy, code e regia: `js/narrative-copy.js`, `js/narration.js`,
  `js/narrative-director.js`, `js/story.js`, `js/main.js`, `js/personal.js`.
- Motivo e priorità audio: `js/audio/motif.js`, `js/audio/audio.js`.
- Collegamenti narrativi negli eventi: `js/events/notes.js`, `door.js`,
  `tower.js`, `dawn.js`, `space.js`, `side-fold.js`, `lightblade.js`,
  `ambient.js`, `cellar.js`. In cantina viene esposto soltanto uno stato di
  lettura dell'apparizione, senza cambiare l'animazione.
- Caricamento e cache: tre sole stringhe di `index.html`; versione shell e
  lista dei moduli in `sw.js`. L'hash della cache degli asset resta
  `5b2f574a01`: i file pesanti non sono cambiati.
- Nuovi test: `tools/check_narration.cjs`, `check_story_narration.cjs`,
  `check_narrative_director.cjs`, `check_narrative_state.cjs`,
  `check_narrative_scope.cjs`, `check_memory_audio.cjs`,
  `check_narrative_browser.cjs`.
- Harness aggiornati: `tools/check_story_preparation.cjs`,
  `check_personal_photos.cjs`, `check_hall_timing.cjs`,
  `check_cosmic_landscape.cjs`, `check_epilogue.cjs`. Gli assert su tempi,
  movimenti e grafica restano attivi; cambiano soltanto fixture dei testi e
  stub incompleti della versione di partenza.

## Verifiche automatiche eseguite

Sono passati 22 controlli automatici: i sei nuovi controlli di narrazione,
regia, stato, immutabilità/cache e audio; inoltre i controlli già presenti su
preparazione delle scene e della storia, foto personali, ritmo e audio della
folla, santuario, paesaggio cosmico, fratture, avvicinamento all'altare,
sostituti del riflesso, qualità del renderer, anteprima cosmica, coerenza
visiva, ponte, arco ed epilogo.

Il rendering Web Audio reale verifica tutte le cinque variazioni, con picchi
tra 0,0075 e 0,009, tre oscillatori e sette nodi interamente rilasciati per
motivo. Pausa, taglio, crescendo e cancellazione non lasciano note future o
code sonore. Il controllo del renderer non equivale a una misura dei FPS su
telefono.
