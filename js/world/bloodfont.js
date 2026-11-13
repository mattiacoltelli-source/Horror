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
    const out = cv.getContext('2d'), tc = document.createElement('canvas'); tc.width = cw; tc.height = ch; const ctx = tc.getContext('2d');   // si disegna su un canvas di lavoro, poi si ammorbidiscono i contorni (sangue che si e' un po' sparso, non vettoriale)
    pl.forEach((l, li) => {
      const ox = PAD + (maxW - l.w) * S / 2, by = (TOPPAD + CAP + li * LH) * S;   // by: linea di base
      for (const o of l.g) {
        const m = A[o.c], c = o.c; let dy = -m[5];
        if (c === '.') dy = 2 - m[3]; else if (c === ',') dy = -22; else if (c === "'") dy = -CAP; else if (c === '-') dy = -38 - m[3] / 2;
        ctx.save(); ctx.translate(ox + o.x * S + m[2] * S / 2, by + o.dy * S); ctx.rotate(o.rot); ctx.scale(o.sc, o.sc);
        ctx.drawImage(atlas, m[0], m[1], m[2], m[3], -m[2] * S / 2, dy * S, m[2] * S, m[3] * S); ctx.restore();
      }
    });
    // --- aspetto sangue: forma morbida, spessore (piu' scuro dove e' denso), riflesso umido sul bordo, grumi, schizzi e colature irregolari ---
    const mkc = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
    const base = mkc(), bx = base.getContext('2d'); bx.globalAlpha = 0.2;
    for (const [dx, dy] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [1, 1], [-1, -1], [1, -1], [-1, 1], [2.2, 0.6], [-2.2, -0.6]]) bx.drawImage(tc, dx, dy);   // alone sfumato
    bx.globalAlpha = 0.8; bx.drawImage(tc, 0, 0); bx.globalAlpha = 1;
    out.clearRect(0, 0, cw, ch); out.drawImage(base, 0, 0); out.globalCompositeOperation = 'source-atop';
    const th = mkc(), tx = th.getContext('2d'); tx.globalAlpha = 0.07;   // densita': le zone spesse (centro del tratto, incroci) sono piu' scure
    for (let k = 0; k < 16; k++) { const an = k * 0.39, r = 4 + (k % 3) * 3; tx.drawImage(tc, Math.cos(an) * r, Math.sin(an) * r); }
    tx.globalAlpha = 1; tx.globalCompositeOperation = 'source-in'; tx.fillStyle = '#1c0000'; tx.fillRect(0, 0, cw, ch);
    out.globalAlpha = 0.75; out.drawImage(th, 0, 0); out.globalAlpha = 1;
    out.fillStyle = 'rgba(64, 4, 6, 0.4)'; out.fillRect(0, 0, cw, ch);   // meno vivo: un cremisi scuro, non rosso da vernice
    const hl = mkc(), hx = hl.getContext('2d'); hx.drawImage(tc, 0, 0); hx.globalCompositeOperation = 'destination-out'; hx.drawImage(tc, 2.2, 2.4);   // bordo in alto a sinistra: riflesso del sangue ancora umido
    hx.globalCompositeOperation = 'source-in'; hx.fillStyle = 'rgba(255, 150, 140, 1)'; hx.fillRect(0, 0, cw, ch);
    out.globalAlpha = 0.4; out.drawImage(hl, 0, 0); out.globalAlpha = 1;
    out.globalCompositeOperation = 'destination-out';   // piccoli vuoti: sangue che si e' seccato a scaglie
    for (let k = 0; k < Math.round(cw / 14); k++) { out.globalAlpha = 0.5 + R() * 0.4; out.beginPath(); out.arc(R() * cw, PAD + R() * (ch - 2 * PAD), 0.5 + R() * 1.1, 0, 6.3); out.fill(); }
    out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
    for (let k = 0; k < Math.round(cw / 22); k++) {   // schizzi vicino alle lettere
      const li = Math.floor(R() * pl.length), l = pl[li], by = (TOPPAD + CAP + li * LH) * S, x0 = PAD + (maxW - l.w) * S / 2;
      out.fillStyle = 'rgba(' + (62 + Math.round(R() * 26)) + ', 5, 7, ' + (0.45 + R() * 0.4).toFixed(2) + ')'; out.beginPath(); out.arc(x0 + R() * l.w * S, by - CAP * S * (R() * 1.25 - 0.1), 0.7 + R() * 1.9, 0, 6.3); out.fill();
    }
    pl.forEach((l, li) => {   // colature: spesse in alto, che si assottigliano, con una goccia in fondo; a volte da piu' lettere
      const lastLine = li === pl.length - 1, n = lastLine ? Math.min(4, Math.max(1, Math.round(l.g.length / 5))) : Math.min(2, Math.round(l.g.length / 8)), ly = (TOPPAD + CAP + li * LH) * S + 4;
      for (let k = 0; k < n && l.g.length; k++) {
        const o = l.g[Math.floor(R() * l.g.length)], m = A[o.c], x = PAD + (maxW - l.w) * S / 2 + (o.x + m[2] * (0.25 + R() * 0.5)) * S, wd = (7 + R() * 5) * S, len = (lastLine ? 50 + R() * 120 : 12 + R() * 22) * S;
        const g2 = out.createLinearGradient(0, ly, 0, ly + len); g2.addColorStop(0, 'rgba(78,6,8,0.95)'); g2.addColorStop(1, 'rgba(48,3,5,0.95)');
        out.fillStyle = g2; out.beginPath(); out.moveTo(x - wd * 0.55, ly); out.quadraticCurveTo(x - wd * 0.5 + (R() - 0.5) * 2, ly + len * 0.5, x - wd * 0.28, ly + len); out.lineTo(x + wd * 0.28, ly + len); out.quadraticCurveTo(x + wd * 0.5 + (R() - 0.5) * 2, ly + len * 0.5, x + wd * 0.55, ly); out.fill();
        out.beginPath(); out.ellipse(x, ly + len + wd * 0.35, wd * 0.62, wd * 0.8, 0, 0, 6.3); out.fill();   // goccia in fondo
        out.fillStyle = 'rgba(255,150,140,0.13)'; out.fillRect(x - wd * 0.28, ly + 1, Math.max(1, wd * 0.14), len * 0.85);   // riflesso sulla colatura
      }
    });
    tex.needsUpdate = true;
  };
  if (atlas) draw(); else waiting.push(draw);
  const res = { tex, aspect: cw / ch }; cache.set(text, res); return res;
}
