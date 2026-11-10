// Indicatore di instabilità: un solo punto luminoso. Volutamente ambiguo:
// il valore reale segue gli eventi solo in parte, con falsi allarmi e mancate reazioni.
const lerp = (a, b, t) => a + (b - a) * t;
const COLORS = [[63, 220, 110], [232, 196, 58], [226, 50, 43]]; // verde, giallo, rosso

export function createInstability(audio) {
  const el = document.getElementById('sig');
  let level = 0, shown = 0, hold = 0, t = 0, nextBeat = 0, nextFake = 25 + Math.random() * 30;
  const api = {
    show() { el.style.opacity = 1; },
    hide() { el.style.opacity = 0; },
    // livello 0..1 desiderato per `secs` secondi (poi ritorna verso il basso)
    push(l, secs = 6) { level = Math.max(level, l); hold = Math.max(hold, secs); },
    set(l, secs = 6) { level = l; hold = secs; },
    update(dt) {
      t += dt;
      hold -= dt; if (hold <= 0) level = Math.max(0, level - dt * 0.12);
      // falsi allarmi: sale senza motivo, in momenti casuali
      nextFake -= dt;
      if (nextFake <= 0) { api.push(0.55 + Math.random() * 0.45, 2 + Math.random() * 3); nextFake = 35 + Math.random() * 55; }
      shown += (level - shown) * Math.min(1, dt * (level > shown ? 3 : 0.8));
      const v = Math.min(1, Math.max(0, shown + Math.sin(t * 7.3) * 0.03 * shown));
      const s = v * 2, i = Math.min(1, Math.floor(s)), f = s - i;
      const c = COLORS[i].map((x, k) => Math.round(lerp(x, COLORS[Math.min(2, i + 1)][k], f)));
      const rate = lerp(0.7, 2.1, v);
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * rate);
      const tremor = v > 0.6 ? (Math.random() - 0.5) * 0.25 * v : 0;
      el.style.setProperty('--c', `rgb(${c})`);
      el.style.setProperty('--o', (0.55 + pulse * 0.4 + tremor).toFixed(2));
      el.style.setProperty('--s', (0.9 + pulse * 0.2 * (0.5 + v)).toFixed(2));
      el.style.setProperty('--p', (pulse * (0.4 + v)).toFixed(2));
      // battito, appena percepibile da giallo in su
      nextBeat -= dt;
      if (nextBeat <= 0 && v > 0.35) { audio.heartbeat(0.25 + v * 0.55); nextBeat = 1 / rate * (0.9 + Math.random() * 0.2) + 0.25; }
    },
  };
  return api;
}
