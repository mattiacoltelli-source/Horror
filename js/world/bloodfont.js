// FONT DI SANGUE: scrive qualsiasi frase (nome incluso) con lettere VERE di sangue (ritagliate dalle scritte di Gemini della versione standard, con le loro colature naturali,
// assets/tex/blood_real.png) e, per le lettere che mancano (B G H J K V W X Y Z), con l'alfabeto di riserva assets/tex/blood_font.png. Ogni lettera ha piu' varianti: si sceglie a caso (stabile per ogni testo).
// bloodText('NOME,\nNON FERMARTI') -> { tex, aspect }: texture di canvas pronta per writingDecals ({ text }). Per rifare l'atlante: python3 tools/blood_real_glyphs.py
import * as THREE from 'three';
const A = {"A":[0,0,98,123,4,104],"B":[140,0,82,111,4,106],"C":[280,0,92,111,4,106],"D":[420,0,87,131,4,104],"E":[560,0,82,138,4,102],"F":[700,0,84,152,4,104],"G":[840,0,102,134,4,105],"H":[0,176,87,132,4,105],"I":[140,176,29,124,4,101],"J":[280,176,88,113,4,107],"K":[420,176,85,136,4,105],"L":[560,176,80,108,4,103],"M":[700,176,104,131,4,103],"N":[840,176,86,124,4,106],"O":[0,352,97,119,4,105],"P":[140,352,82,138,4,102],"Q":[280,352,105,145,4,110],"R":[420,352,91,135,4,106],"S":[560,352,81,147,4,110],"T":[700,352,99,111,4,101],"U":[840,352,88,130,4,104],"V":[0,528,97,130,4,101],"W":[140,528,131,137,4,104],"X":[280,528,89,145,4,103],"Y":[420,528,91,133,4,101],"Z":[560,528,95,153,4,105],"À":[700,528,96,155,4,131],"È":[840,528,79,162,4,128],"É":[0,704,79,154,4,127],"Ì":[140,704,39,136,4,128],"Ò":[280,704,97,167,4,134],"Ù":[420,704,88,131,4,127],"'":[560,704,30,48,4,25],",":[700,704,33,50,4,26],".":[840,704,33,37,4,23],"?":[0,880,72,118,4,109],"!":[140,880,30,115,4,107],"-":[280,880,68,27,4,22],":":[420,880,32,81,4,68],"0":[560,880,85,117,4,103],"1":[700,880,47,126,4,100],"2":[840,880,82,122,4,103],"3":[0,1056,78,123,4,103],"4":[140,1056,81,127,4,100],"5":[280,1056,78,118,4,103],"6":[420,1056,76,127,4,108],"7":[560,1056,80,123,4,97],"8":[700,1056,75,127,4,107],"9":[840,1056,75,126,4,105]};   // riserva: carattere -> [x, y, w, h, top, base]
const REAL = {"N":[[0,0,59,168,107],[129,0,49,199,103],[652,0,71,255,128],[807,0,60,321,124],[615,325,68,290,121],[763,325,57,296,120],[148,629,47,101,105],[199,629,46,301,98],[1067,629,59,306,119],[1198,629,50,308,116]],"O":[[63,0,62,86,84],[727,0,76,104,100],[266,325,85,247,99],[687,325,72,100,98],[1054,325,74,92,96],[1195,325,82,275,99],[249,629,59,207,96],[543,629,55,161,100],[996,629,67,212,96],[1130,629,64,88,96]],"F":[[182,0,66,97,97]],"E":[[252,0,53,83,83],[102,325,68,134,96],[545,325,66,188,99],[895,325,65,209,99],[363,629,58,127,99],[797,629,56,117,92]],"R":[[309,0,54,94,94],[487,0,65,102,102]],"M":[[367,0,62,95,101]],"A":[[433,0,50,98,98],[966,0,51,176,98],[1146,0,49,148,101],[1199,0,49,98,101],[1370,0,57,193,109],[94,629,50,121,101],[425,629,48,107,102],[602,629,70,133,98],[935,629,57,136,107]],"T":[[556,0,72,94,107],[1021,0,74,238,106],[174,325,88,110,103],[451,325,90,168,106],[0,629,72,100,104],[477,629,62,103,105],[857,629,74,126,124],[0,941,68,172,100]],"I":[[632,0,16,99,99],[1353,0,13,160,96],[81,325,17,123,96],[430,325,17,155,96],[964,325,17,162,99],[1424,325,20,299,97],[76,629,14,98,92],[1480,629,15,286,96]],"È":[[871,0,45,231,129],[1310,629,52,306,122]],"L":[[920,0,42,181,98],[1132,325,59,204,101],[312,629,47,300,102]],"U":[[1099,0,43,223,97],[1367,325,53,300,97],[1366,629,49,291,101]],"C":[[1252,0,44,216,99],[1300,0,49,74,94],[1252,629,54,172,94],[1419,629,57,218,94]],"D":[[0,325,77,187,103],[355,325,71,134,100]],"S":[[824,325,67,216,104],[985,325,65,180,106],[676,629,57,183,95]],"Q":[[1281,325,82,171,100]],"P":[[737,629,56,106,102]],"'":[[72,941,11,37,112]]};   // lettere vere: carattere -> [[x, y, w, h, base], ...] (altezza maiuscola = 100)
const CAP = 100, S = 0.72, LH = 150, SPACE = 46, PAD = 24, TOPPAD = 40, BOT = 190;
let atlas = null, real = null; const waiting = [];
const load = (src, set) => { const im = new Image(); im.onload = () => { set(im); if (atlas && real) waiting.splice(0).forEach((f) => f()); }; im.src = src; };
load('assets/tex/blood_font.png', (i) => (atlas = i)); load('assets/tex/blood_real.png', (i) => (real = i));
const cache = new Map();
function rng(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; }
export function bloodText(text) {
  if (cache.has(text)) return cache.get(text);
  const R = rng(text), has = (c) => c === ' ' || REAL[c] || A[c], lines = text.toUpperCase().replace(/[’`´]/g, "'").split('\n').map((l) => [...l].filter(has));
  let prev = null;
  const pl = lines.map((l) => { let x = 0; const g = l.map((c) => {
    if (c === ' ') { x += SPACE; return null; }
    let v = null, w, h, base; if (REAL[c]) { const L = REAL[c]; let k = Math.floor(R() * L.length); if (L.length > 1 && prev === c + k) k = (k + 1) % L.length; prev = c + k; v = L[k]; w = v[2]; h = v[3]; base = v[4]; } else { const m = A[c]; w = m[2]; h = m[3]; base = m[5]; }
    const o = { c, v, x, w, h, base, rot: (R() - 0.5) * 0.07, dy: (R() - 0.5) * 6, sc: 0.96 + R() * 0.08 }; x += w * (v ? 0.8 : 0.86) + (R() - 0.3) * 6; return o; });
    return { g: g.filter(Boolean), w: x }; });
  const maxW = Math.max(...pl.map((l) => l.w), 1), cw = Math.ceil(maxW * S + PAD * 2), ch = Math.ceil(TOPPAD * S + pl.length * LH * S + BOT * S);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cw, ch);
    pl.forEach((l, li) => {
      const ox = PAD + (maxW - l.w) * S / 2, by = (TOPPAD + CAP + li * LH) * S;   // by: linea di base
      for (const o of l.g) {
        ctx.save(); ctx.translate(ox + o.x * S + o.w * S / 2, by + o.dy * S); ctx.rotate(o.rot); ctx.scale(o.sc, o.sc);
        if (o.v) ctx.drawImage(real, o.v[0], o.v[1], o.w, o.h, -o.w * S / 2, -o.base * S, o.w * S, o.h * S);
        else { const m = A[o.c]; let dy = -m[5]; if (o.c === '.') dy = 2 - m[3]; else if (o.c === ',') dy = -22; else if (o.c === "'") dy = -CAP; else if (o.c === '-') dy = -38 - m[3] / 2; ctx.drawImage(atlas, m[0], m[1], m[2], m[3], -m[2] * S / 2, dy * S, m[2] * S, m[3] * S); }
        ctx.restore();
      }
    });
    tex.needsUpdate = true;
  };
  if (atlas && real) draw(); else waiting.push(draw);
  const res = { tex, aspect: cw / ch }; cache.set(text, res); return res;
}
