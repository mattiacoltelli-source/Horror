// VERSIONE PERSONALIZZATA: aperta con ?per=<nome> (es. ?per=elisa) cambia nome, genere e dettagli nella trama. Senza il parametro il gioco è identico a quello di tutti.
// Niente si salva e niente va in rete: i dati sono qui dentro, il link serve solo a scegliere il profilo.
const PRESETS = { elisa: { name: 'Elisa', hair: 'rossi', f: true } };
const key = (new URLSearchParams(location.search).get('per') || '').trim().toLowerCase();
export const P = PRESETS[key] || null;

// sussurro con la sua voce sintetica del telefono: basso, lento, una o due volte in tutta la partita
export function whisperName() {
  if (!P) return;
  try {
    const s = window.speechSynthesis; if (!s) return; const u = new SpeechSynthesisUtterance(P.name); u.lang = 'it-IT'; u.volume = 0.5; u.pitch = 0.05; u.rate = 0.5; s.cancel(); s.speak(u);
  } catch (_) {}
}
// momenti in cui il gioco la chiama per nome (una volta per stanza al massimo)
const done = new Set();
export function onRoom(name) {
  if (!P || done.has(name)) return; done.add(name);
  if (name === 'morgue') setTimeout(whisperName, 9000);
  if (name === 'warehouse') setTimeout(whisperName, 21000);
}
