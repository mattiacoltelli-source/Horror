// SCRITTA DITATA NEL VAPORE: un nome scritto con un dito, un tratto alla volta, come se qualcuno dall'altra parte del vetro lo stesse scrivendo (cantina, versione personalizzata).
// Disegna su un canvas (bianco = vapore pulito dal dito) che lo shader della condensa legge. Ogni lettera e' fatta di pochi tratti scritti a mano:
// velocita' irregolare con partenza e arresto morbidi, pause tra i tratti e tra le lettere, un po' di tremore, e dopo la fine qualche goccia che scende dalle lettere.
// createFingerWriter(nome, W, H) -> { canvas, tex, update(dt, enabled) -> { tipU, tipV, on, done, hold }, strokes }   (W,H: pixel del canvas, stessa proporzione dello specchio)
import * as THREE from 'three';

// alfabeto a tratto singolo: x in [0,~0.9], y in [0 (alto), 1 (basso)]
const F = {
  A: [[[0, 1], [.4, 0], [.8, 1]], [[.12, .65], [.68, .65]]],
  B: [[[0, 1], [0, 0], [.5, 0], [.7, .12], [.7, .35], [.5, .48], [0, .5]], [[.5, .48], [.75, .62], [.75, .88], [.5, 1], [0, 1]]],
  C: [[[.8, .15], [.55, 0], [.25, 0], [0, .25], [0, .75], [.25, 1], [.55, 1], [.8, .85]]],
  D: [[[0, 0], [0, 1], [.4, 1], [.75, .8], [.75, .2], [.4, 0], [0, 0]]],
  E: [[[.75, 0], [0, 0], [0, 1], [.75, 1]], [[0, .5], [.55, .5]]],
  F: [[[.75, 0], [0, 0], [0, 1]], [[0, .5], [.55, .5]]],
  G: [[[.8, .15], [.55, 0], [.25, 0], [0, .25], [0, .75], [.25, 1], [.55, 1], [.8, .8], [.8, .55], [.45, .55]]],
  H: [[[0, 0], [0, 1]], [[.75, 0], [.75, 1]], [[0, .5], [.75, .5]]],
  I: [[[.2, 0], [.2, 1]]],
  J: [[[.6, 0], [.6, .8], [.4, 1], [.15, 1], [0, .85]]],
  K: [[[0, 0], [0, 1]], [[.75, 0], [0, .55]], [[.25, .4], [.75, 1]]],
  L: [[[0, 0], [0, 1], [.7, 1]]],
  M: [[[0, 1], [0, 0], [.45, .6], [.9, 0], [.9, 1]]],
  N: [[[0, 1], [0, 0], [.75, 1], [.75, 0]]],
  O: [[[.4, 0], [.12, .1], [0, .5], [.12, .9], [.4, 1], [.68, .9], [.8, .5], [.68, .1], [.4, 0]]],
  P: [[[0, 1], [0, 0], [.5, 0], [.75, .15], [.75, .4], [.5, .55], [0, .55]]],
  Q: [[[.4, 0], [.12, .1], [0, .5], [.12, .9], [.4, 1], [.68, .9], [.8, .5], [.68, .1], [.4, 0]], [[.5, .7], [.85, 1.1]]],
  R: [[[0, 1], [0, 0], [.5, 0], [.75, .15], [.75, .4], [.5, .55], [0, .55]], [[.4, .55], [.75, 1]]],
  S: [[[.75, .15], [.5, 0], [.25, 0], [0, .18], [.1, .4], [.7, .6], [.8, .82], [.55, 1], [.25, 1], [0, .85]]],
  T: [[[0, 0], [.8, 0]], [[.4, 0], [.4, 1]]],
  U: [[[0, 0], [0, .75], [.2, 1], [.55, 1], [.75, .75], [.75, 0]]],
  V: [[[0, 0], [.4, 1], [.8, 0]]],
  W: [[[0, 0], [.2, 1], [.45, .4], [.7, 1], [.9, 0]]],
  X: [[[0, 0], [.75, 1]], [[.75, 0], [0, 1]]],
  Y: [[[0, 0], [.4, .5], [.8, 0]], [[.4, .5], [.4, 1]]],
  Z: [[[0, 0], [.75, 0], [0, 1], [.75, 1]]],
  '-': [[[0, .5], [.5, .5]]],
};
const ADV = { I: 0.4, J: 0.75, M: 1.1, W: 1.15, T: 0.95, L: 0.85, ' ': 0.55, '-': 0.7 };

// Catmull-Rom: punti densi lungo il tratto, cosi' le curve non hanno spigoli
function smooth(pts, n = 7) {
  if (pts.length < 3) return pts.slice();
  const out = [], P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((a) => 0.5 * ((2 * P[i][a]) + (-P[i - 1][a] + P[i + 1][a]) * t + (2 * P[i - 1][a] - 5 * P[i][a] + 4 * P[i + 1][a] - P[i + 2][a]) * t2 + (-P[i - 1][a] + 3 * P[i][a] - 3 * P[i + 1][a] + P[i + 2][a]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}

export function createFingerWriter(name, W, H, opts = {}) {
  let sd = 5; for (const c of name) sd = (sd * 31 + c.charCodeAt(0)) >>> 0;
  const R = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
  const letters = [...name.toUpperCase()].filter((c) => F[c] || c === ' ');
  // dimensioni: la scritta sta nel 66% della larghezza, altezza lettere al massimo 17% del campo
  const adv = letters.map((c) => (ADV[c] ?? 0.88) + 0.28), total = adv.reduce((a, b) => a + b, 0);
  const lh = Math.min(H * 0.15, (W * 0.66) / Math.max(total, 1)), cx = opts.cx ?? 0.47, cy = opts.cy ?? 0.5;   // lh: altezza maiuscola in px
  const x0 = cx * W - (total * lh) / 2 + lh * 0.14, slope = (R() - 0.5) * 0.05, yTop = (1 - cy) * H - lh / 2;
  const lw = Math.max(3.4, lh * 0.15);   // larghezza del dito
  // tratti in pixel, con tremore
  const strokes = []; let x = x0;
  letters.forEach((c, li) => {
    const sc = lh * (0.93 + R() * 0.14), rot = (R() - 0.5) * 0.12, oy = (R() - 0.5) * lh * 0.07, w = (ADV[c] ?? 0.88) * lh;
    for (const [si, s] of (F[c] || []).entries()) {
      const pts = s.map(([px, py]) => {
        const ax = (px - 0.4) * sc, ay = (py - 0.5) * sc, rx = ax * Math.cos(rot) - ay * Math.sin(rot), ry = ax * Math.sin(rot) + ay * Math.cos(rot);
        return [x + w / 2 + rx + (R() - 0.5) * lh * 0.025, yTop + lh / 2 + oy + ry + (x - x0) * slope + (R() - 0.5) * lh * 0.025];
      });
      const sm = smooth(pts); let L = 0; const cum = [0];
      for (let i = 1; i < sm.length; i++) { L += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]); cum.push(L); }
      strokes.push({ pts: sm, cum, L, lw: lw * (0.88 + R() * 0.3), first: si === 0, letter: li });
    }
    x += (adv[li]) * lh;
  });
  // tempi: velocita' ~ 4.2 altezze di lettera al secondo, variabile; pause piu' lunghe tra lettere, ogni tanto un'esitazione
  let t0 = 0.5;
  for (const s of strokes) {
    s.t0 = t0; s.dur = Math.max(0.22, s.L / (lh * (3.2 + R() * 1.6)));
    t0 += s.dur + (s.first ? 0.22 + R() * 0.3 + (R() < 0.12 ? 0.55 : 0) : 0.1 + R() * 0.14);
  }
  const endT = strokes.length ? strokes[strokes.length - 1].t0 + strokes[strokes.length - 1].dur : 0;

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const tex = new THREE.CanvasTexture(canvas); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  // gocce che colano dalle lettere dopo la fine (il vapore bagnato scende dal bordo dei tratti)
  const drips = [], low = strokes.flatMap((s) => s.pts.filter((p) => p[1] > yTop + lh * 0.55).map((p) => p));
  const nd = Math.min(6, Math.max(3, Math.round(letters.length / 2)));
  for (let i = 0; i < nd && low.length; i++) { const p = low[Math.floor(R() * low.length)]; drips.push({ x: p[0], y: p[1], t: endT + 0.7 + R() * 3.6, v: lh * (0.12 + R() * 0.12), max: lh * (0.8 + R() * 1.5), run: 0, w: Math.max(2, lw * (0.4 + R() * 0.2)), px: p[0], py: p[1] }); }

  const W_ = { t: 0, tipU: 0, tipV: 0, on: 0, done: false, hold: 0, canvas, tex, strokes, last: new Map(), dirty: false, frame: 0 };
  const pos = (s, p) => {   // punto del tratto al progresso p in [0,1] (distanza)
    const d = p * s.L; let i = 1; while (i < s.cum.length - 1 && s.cum[i] < d) i++;
    const a = s.pts[i - 1], b = s.pts[i], k = (d - s.cum[i - 1]) / Math.max(1e-4, s.cum[i] - s.cum[i - 1]); return [a[0] + (b[0] - a[0]) * Math.min(1, Math.max(0, k)), a[1] + (b[1] - a[1]) * Math.min(1, Math.max(0, k))];
  };
  W_.update = (dt, enabled = true) => {
    if (!enabled) { W_.on += (0 - W_.on) * Math.min(1, dt * 6); return W_; }
    W_.t += dt; const t = W_.t; let active = null;
    for (const s of strokes) {
      if (t < s.t0) break;
      const u = Math.min(1, (t - s.t0) / s.dur), e = u * u * (3 - 2 * u) * 0.65 + u * 0.35;   // parte e si ferma piano, ma non e' un'onda perfetta
      const prev = W_.last.get(s), np = pos(s, e);
      if (!prev) { if (opts.onStroke) opts.onStroke(s); }
      else if (Math.hypot(np[0] - prev[0], np[1] - prev[1]) > 0.4) { g.lineWidth = s.lw * (0.9 + 0.2 * Math.sin(e * 9)); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(np[0], np[1]); g.stroke(); W_.dirty = true; }
      if (!prev || Math.hypot(np[0] - prev[0], np[1] - prev[1]) > 0.4) W_.last.set(s, np);
      if (u < 1) active = np;
    }
    if (active) { W_.tipU = active[0] / W; W_.tipV = 1 - active[1] / H; W_.on += (1 - W_.on) * Math.min(1, dt * 14); } else W_.on += (0 - W_.on) * Math.min(1, dt * 7);
    if (t > endT) { W_.done = true; W_.hold = t - endT; }
    for (const d of drips) {
      if (t < d.t || d.run >= d.max) continue;
      d.v += dt * lh * 0.08; const step = d.v * dt, ny = d.y + step; d.run += step;
      g.lineWidth = d.w; g.beginPath(); g.moveTo(d.x, d.y); d.x += (R() - 0.5) * 0.35; g.lineTo(d.x, ny); g.stroke(); d.y = ny;
      W_.dirty = true;
    }
    if (W_.dirty && (++W_.frame & 1) === 0) { tex.needsUpdate = true; W_.dirty = false; }
    return W_;
  };
  W_.endT = endT;
  return W_;
}
