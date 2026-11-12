// FONT DI SANGUE: scrive qualsiasi frase (nome incluso) con le lettere dipinte col sangue di assets/tex/blood_font.png (atlante 7x7, vedi tools/ se serve rifarlo).
// bloodText('NOME,\nNON FERMARTI') -> { tex, aspect }: texture di canvas pronta per writingDecals ({ text }). Lettere leggermente ruotate/spostate e colature in piu', stabili per ogni testo.
import * as THREE from 'three';
const A = {"A":[0,0,98,123,4,104],"B":[140,0,82,111,4,106],"C":[280,0,92,111,4,106],"D":[420,0,87,131,4,104],"E":[560,0,82,138,4,102],"F":[700,0,84,152,4,104],"G":[840,0,102,134,4,105],"H":[0,176,87,132,4,105],"I":[140,176,29,124,4,101],"J":[280,176,88,113,4,107],"K":[420,176,85,136,4,105],"L":[560,176,80,108,4,103],"M":[700,176,104,131,4,103],"N":[840,176,86,124,4,106],"O":[0,352,97,119,4,105],"P":[140,352,82,138,4,102],"Q":[280,352,105,145,4,110],"R":[420,352,91,135,4,106],"S":[560,352,81,147,4,110],"T":[700,352,99,111,4,101],"U":[840,352,88,130,4,104],"V":[0,528,97,130,4,101],"W":[140,528,131,137,4,104],"X":[280,528,89,145,4,103],"Y":[420,528,91,133,4,101],"Z":[560,528,95,153,4,105],"À":[700,528,96,155,4,131],"È":[840,528,79,162,4,128],"É":[0,704,79,154,4,127],"Ì":[140,704,39,136,4,128],"Ò":[280,704,97,167,4,134],"Ù":[420,704,88,131,4,127],"'":[560,704,30,48,4,25],",":[700,704,33,50,4,26],".":[840,704,33,37,4,23],"?":[0,880,72,118,4,109],"!":[140,880,30,115,4,107],"-":[280,880,68,27,4,22],":":[420,880,32,81,4,68],"0":[560,880,85,117,4,103],"1":[700,880,47,126,4,100],"2":[840,880,82,122,4,103],"3":[0,1056,78,123,4,103],"4":[140,1056,81,127,4,100],"5":[280,1056,78,118,4,103],"6":[420,1056,76,127,4,108],"7":[560,1056,80,123,4,97],"8":[700,1056,75,127,4,107],"9":[840,1056,75,126,4,105]};   // carattere -> [x, y, w, h, top, base] nell'atlante
const CAP = 100, S = 0.72, LH = 150, SPACE = 46, PAD = 24, TOPPAD = 40, BOT = 150;   // altezza maiuscola nell'atlante, scala, passo righe...
let atlas = null; const waiting = [];
{ const im = new Image(); im.onload = () => { atlas = im; waiting.splice(0).forEach((f) => f()); }; im.src = 'assets/tex/blood_font.png'; }
const cache = new Map();
function rng(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; }
export function bloodText(text) {
  if (cache.has(text)) return cache.get(text);
  const R = rng(text), lines = text.toUpperCase().replace(/[’`´]/g, "'").split('\n').map((l) => [...l].filter((c) => c === ' ' || A[c]));
  const pl = lines.map((l) => { let x = 0; const g = l.map((c) => { if (c === ' ') { x += SPACE; return null; } const m = A[c], o = { c, x, rot: (R() - 0.5) * 0.1, dy: (R() - 0.5) * 9, sc: 0.95 + R() * 0.1 }; x += m[2] * 0.86 + 3 + R() * 4; return o; }); return { g: g.filter(Boolean), w: x }; });
  const maxW = Math.max(...pl.map((l) => l.w), 1), cw = Math.ceil(maxW * S + PAD * 2), ch = Math.ceil(TOPPAD * S + pl.length * LH * S + BOT * S);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cw, ch);
    pl.forEach((l, li) => {
      const ox = PAD + (maxW - l.w) * S / 2, by = (TOPPAD + CAP + li * LH) * S;   // by: linea di base
      for (const o of l.g) {
        const m = A[o.c], c = o.c; let dy = -m[5];
        if (c === '.') dy = 2 - m[3]; else if (c === ',') dy = -22; else if (c === "'") dy = -CAP; else if (c === '-') dy = -38 - m[3] / 2;
        ctx.save(); ctx.translate(ox + o.x * S + m[2] * S / 2, by + o.dy * S); ctx.rotate(o.rot); ctx.scale(o.sc, o.sc);
        ctx.drawImage(atlas, m[0], m[1], m[2], m[3], -m[2] * S / 2, dy * S, m[2] * S, m[3] * S); ctx.restore();
      }
    });
    // qualche colatura in piu' sotto l'ultima riga
    const last = pl[pl.length - 1], ly = (TOPPAD + CAP + (pl.length - 1) * LH) * S + 6, n = Math.min(3, Math.max(1, Math.round(last.g.length / 7)));
    for (let k = 0; k < n && last.g.length; k++) {
      const o = last.g[Math.floor(R() * last.g.length)], x = PAD + (maxW - last.w) * S / 2 + (o.x + A[o.c][2] * 0.5) * S + (R() - 0.5) * 10 * S, len = (36 + R() * 80) * S, wd = (5 + R() * 3) * S;
      ctx.fillStyle = '#4f0707'; ctx.beginPath(); ctx.moveTo(x - wd / 2, ly); ctx.lineTo(x + wd / 2, ly); ctx.lineTo(x + wd * 0.4, ly + len); ctx.lineTo(x - wd * 0.4, ly + len); ctx.fill();
      ctx.beginPath(); ctx.arc(x, ly + len, wd * 0.8, 0, 6.3); ctx.fill();
    }
    tex.needsUpdate = true;
  };
  if (atlas) draw(); else waiting.push(draw);
  const res = { tex, aspect: cw / ch }; cache.set(text, res); return res;
}
