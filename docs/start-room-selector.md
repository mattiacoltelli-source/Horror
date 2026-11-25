# Ambiente iniziale e versioni allineate

Il menu iniziale mostra sempre il selettore «ambiente: … ▾», anche quando non
esiste alcun checkpoint. Le sette scelte sono tunnel (inizio), sala della
folla, cantina e cripta, reparto, obitorio, magazzino e torre. Dopo la scelta
si usa il pulsante ENTRA NEL GIOCO. La sala della folla parte dal tratto prima
del portone, conservando la regia originale della sua apertura.

Le voci con un checkpoint sono contrassegnate «salvato» e conservano scelte,
arma e note già raccolte. Le altre permettono l'accesso diretto senza dover
sbloccare gli ambienti. Rimangono attivi i reset previsti per chiave e porta
del santuario e la migrazione dei vecchi salvataggi.

La scelta è locale alla schermata: non riscrive l'URL personale, il nome, la
data, la frase o la città. Una scelta esplicita prevale sulle scorciatoie del
link; scegliendo il tunnel si torna realmente all'inizio. Senza intervento
restano valide le precedenti scorciatoie `?start=`. Durante la compilazione
dell'ingresso la scelta viene bloccata, evitando cambi a caricamento avviato.

Lo stesso HTML, CSS e JavaScript serve tutte le versioni. Yana conserva foto,
genere e sussurri del proprio profilo; ambienti, effetti, storia condivisa e
menu sono gli stessi della standard e delle altre personalizzazioni. Anche
gli occhi nella presenza del tombino sono attenuati del 15% tramite il
materiale condiviso, senza modificare il fumo o la dispersione.

La tendina si apre sopra il pulsante e scorre all'interno sugli schermi bassi.
Sono presenti selezione ARIA, navigazione con frecce/Home/End e chiusura con
Escape o tocco esterno. Le impostazioni della qualità e l'elenco degli
ambienti si chiudono a vicenda. La raccolta iniziale del profilo rimane una
fase separata, seguita dallo stesso menu del gioco.

File: `index.html`, sezione del selettore in `css/style.css`, collegamenti in
`js/main.js` e materiale degli occhi in `js/events/drain-presence.js`.
Nessun nuovo asset, ambiente, dipendenza o effetto pesante. La cache PWA della
shell cambia; quella degli asset pesanti resta valida.

Test: `tools/check_start_rooms.cjs` esegue il codice vero del menu senza
checkpoint e con snapshot, per più profili; `check_narrative_state.cjs`
controlla destinazioni, precedenza delle scelte, vecchi link e checkpoint.
`check_start_rooms_browser.cjs` verifica la stessa lista in standard, Yana,
Mati e Steve, il layout verticale 360×568, il vero ingresso di Yana nel reparto
senza salvataggi e la ripresa della torre di Mati con arma/note/scelte.
I test browser completati non rilevano errori JavaScript, console o HTTP.
