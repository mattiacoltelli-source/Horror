// The register remains a witness, never an explanation of the hospital.
// Personal details share the same story and never borrow another person's photo.
import { P, PKEY, CITY } from './personal.js';

const o = P?.f === false || !P ? 'o' : 'a';
const N = P?.name || 'paziente n. 17';
const SIG = '— suor Agnese';
export const ROOM_LINES = {
  tunnel: ['registro notturno, 3 novembre.', 'nuovo ingresso: ' + N + '.', 'la strada la conosce già.', SIG],
  hall: ['all’appello mancavano tutti.', 'continua a contarli, ogni notte.', SIG],
  cellar: ['lo specchio è nuovo.', 'riconosce ancora quella stanza.', 'non ricorda quando c’è stat' + o + '.', SIG],
  ward: ['arriva sempre fino alla porta.', 'poi chiede di ricominciare.', SIG],
  morgue: ['chiede quale porta porti fuori.', 'non chiede mai', 'che cosa c’è dall’altra parte.', SIG],
  warehouse: ['sotto il magazzino', 'la pianta non segna niente.', SIG],
  tower: ['«Ti ho tirat' + o + ' fuori dal fuoco.', 'Non ti ho mai detto', 'che qui saresti stat' + o + ' al sicuro.»', SIG],
};

const d = new Date(), h = d.getHours();
const NOW = 'sono le ' + String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '.\n' +
  (h >= 23 || h < 5 ? 'a quest’ora non dorme nessuno.' : h < 12 ? 'fuori è già giorno. qui dentro no.' : h < 18 ? 'fuori c’è luce. qui non è mai entrata.' : 'fuori è sera. qui è sempre notte.');
const trait = !P ? '' : PKEY === 'mati' || PKEY === 'matilde' ? '\nin reparto la chiamano Mati.' :
  PKEY === 'rebecca' ? '\nin reparto la chiamano Reb.' : P.hair ? '\ncapelli ' + P.hair + '. la firma non è sua.' : '';
export const NOTE_TEXT = [
  'paziente n. 17' + (P ? ': ' + P.name : '') + '.\ningresso: notte del 3 novembre.\n' +
    (CITY ? 'proveniente da ' + CITY + '.\n' : '') + 'non risponde al nome sul bracciale.' + trait,
  'specchio sostituito.\nriconosce la stanza bruciata.\ndice che ' + (P?.detail || 'quella faccia non è la sua') + '.',
  'incendio in casa. prima del ricovero.\nsua sorella non è uscita.\n' + (P?.name || 'il paziente') + ' era lì.\nricorda il fumo. non la porta.',
  'magazzino: benzina sui registri.\ninnesco volontario.\n' + (o === 'o' ? 'un solo sopravvissuto: ' : 'una sola sopravvissuta: ') + N +
    '.\nil cane è rimasto dentro.\nil cancello era chiuso da dentro.',
  'l’ho tirat' + o + ' fuori dal fuoco.\nho scritto: guasto elettrico.\nmi chiede di lasciarl' + o +
    ' andare.\nnon ricorda chi ha chiuso la porta.\n' + NOW + (P?.nurse ? '\n' + P.nurse : '') + '\n' + SIG,
];

const address = P ? ', ' + P.name : '';
export const ENDINGS = {
  A: 'non ti sei girat' + o + address + '.\n«Non guardare indietro», diceva.\nnon avevi mai capito\ndi quale notte parlasse.',
  B: 'ti sei girat' + o + address + '.\n«La porta l’hai chiusa tu.»\nnon ricordavi più\na chi appartenesse quella voce.',
  BLADE: 'Agnese è scomparsa nella luce.\nfuori non c’è più nessuno\na dirti di non girarti.',
};
