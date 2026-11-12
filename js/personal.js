// VERSIONE PERSONALIZZATA: aperta con ?per=<nome> (es. ?per=elisa) cambia nome, genere e dettagli nella trama. Senza il parametro il gioco è identico a quello di tutti.
// Niente si salva e niente va in rete: i dati sono qui dentro, il link serve solo a scegliere il profilo.
// name: nome; hair: aggettivo dei capelli; hairHex: colore dei capelli della sorella (bruciati); joke: riga della nota 1 (battuta leggera); detail: tratto per la nota 2
const PRESETS = {
  elisa: { name: 'Elisa', hair: 'rossi', f: true, hairHex: 0x6a1708, joke: 'capelli rossi. molto carina, annota l\'infermiere, e lo sottolinea due volte.', detail: 'quei capelli rossi non sono i suoi', sister: 'quella con i capelli come i suoi' },
  yana: { name: 'Yana', hair: 'biondi', f: true, hairHex: 0x8c7440, joke: 'capelli biondi, occhi azzurri. molto carina, annota l\'infermiere. il turno di notte, da allora, lo chiedono tutti.', detail: 'quegli occhi azzurri non sono i suoi', sister: 'quella con i capelli biondi come i suoi',
    lang: 'uk-UA', whisper: ['Яно.', 'Спи, Яно.'], turn: 'Обернись, Яно.', nurse: 'ogni sera le dice «добраніч», buonanotte, come vuole lei.' },   // ucraina: sussurri in ucraino (se il telefono ha la voce), buonanotte nella nota dell\'infermiera
};
const key = (new URLSearchParams(location.search).get('per') || '').trim().toLowerCase();
export const P = PRESETS[key] || null;

// sussurro con la voce sintetica del telefono: basso, lento, una o due volte in tutta la partita.
// Se il profilo ha una lingua (es. ucraino) e il telefono ha quella voce, parla in quella lingua; altrimenti dice il nome in italiano (e, per le altre frasi, tace: il testo e' gia' sullo schermo).
function speak(text, lang, fallback) {
  try {
    const s = window.speechSynthesis; if (!s) return; let use = text, lg = lang || 'it-IT';
    if (lang && lang !== 'it-IT') { const has = (s.getVoices() || []).some((v) => (v.lang || '').toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())); if (!has) { if (!fallback) return; use = fallback; lg = 'it-IT'; } }
    const u = new SpeechSynthesisUtterance(use); u.lang = lg; u.volume = 0.5; u.pitch = 0.05; u.rate = 0.5; s.cancel(); s.speak(u);
  } catch (_) {}
}
let whispers = 0;
export function whisperName() {
  if (!P) return; const w = P.whisper ? P.whisper[Math.min(whispers, P.whisper.length - 1)] : P.name; whispers++;
  speak(w, P.lang, P.name);
}
// "girati" sussurrato nella sua lingua (solo se il telefono ha la voce)
export function whisperTurn() { if (P && P.turn) speak(P.turn, P.lang, null); }
// momenti in cui il gioco la chiama per nome (una volta per stanza al massimo)
const done = new Set();
export function onRoom(name) {
  if (!P || done.has(name)) return; done.add(name);
  if (name === 'morgue') setTimeout(whisperName, 9000);
  if (name === 'warehouse') setTimeout(whisperName, 21000);
}
