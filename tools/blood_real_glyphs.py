# Estrae le lettere "vere" di sangue (da scritte di Gemini) in un atlante: ogni lettera ha le sue colature naturali.
# Sorgenti: le 7 scritte della versione standard (assets/tex/wr_std_*.png, gia' con trasparenza) e un collage con le lettere mancanti (B G H J K V W X Y Z).
# Uso: python3 tools/blood_real_glyphs.py [collage.jpg]   -> assets/tex/blood_real.png + metadati (stampati in real_meta.json nella cartella indicata da META_OUT)
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
META_OUT = os.environ.get('META_OUT', 'real_meta.json'); CAP = 100
COLLAGE = sys.argv[1] if len(sys.argv) > 1 else None
STD = {'t1': ['NONFERMARTI'], 't3': ['NONÈLATUAFACCIA'], 'c2': ['DIETRO', 'DITE'], 'w4': ['NONSEISOLO'], 'o': ['QUITIHANNOLEGATO'], 'h': ['TISTAVANO', 'ASPETTANDO'], 'm': ["NONC'ÈUSCITA"]}
PANELS = [((8, 6, 700, 250), ['BEGH']), ((708, 6, 1400, 250), ['JKVWXYZ']), ((8, 258, 1400, 508), ['GABBIAHOTEL']), ((8, 518, 700, 765), ['KAYAKWAGGHI']), ((708, 518, 1400, 765), ['ZUBOXYZGHJ'])]
TARGET = np.array([82., 29., 27.])
glyphs = []

def process(k, im, lines, minarea=1200):
    a = im[:, :, 3] > 100; lab, n = ndi.label(a); comps = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        area = int((lab[sl] == i + 1).sum())
        if area < 40: continue
        comps.append(dict(i=i + 1, sl=sl, area=area, x0=sl[1].start, x1=sl[1].stop, y0=sl[0].start, y1=sl[0].stop))
    big = [c for c in comps if c['area'] > minarea]
    if not big: print(k, 'nessun componente'); return
    big.sort(key=lambda c: (c['y0'] + c['y1']) / 2); medh = np.median([b['y1'] - b['y0'] for b in big]); rows = [[big[0]]]
    for c in big[1:]:
        if (c['y0'] + c['y1']) / 2 - np.median([(r['y0'] + r['y1']) / 2 for r in rows[-1]]) > 0.9 * medh: rows.append([c])
        else: rows[-1].append(c)
    if len(rows) != len(lines): print(k, 'righe', len(rows), 'attese', len(lines)); return
    nxt = lab.max() + 1
    for row, text in zip(rows, lines):
        letters_n = len([c for c in text if c != "'"])
        while len(row) < letters_n:   # lettere attaccate: spezzo il componente piu' largo nel punto piu' sottile
            row.sort(key=lambda c: c['x0']); wmed = np.median([c['x1'] - c['x0'] for c in row]); c = max(row, key=lambda c: c['x1'] - c['x0'])
            if (c['x1'] - c['x0']) < 1.5 * wmed: break
            m = lab[c['sl']] == c['i']; colsum = m.sum(0).astype(float); w = len(colsum); lo, hi = int(w * 0.3), int(w * 0.7); cut = lo + int(np.argmin(colsum[lo:hi]))
            sub = lab[c['sl']]; left = m.copy(); left[:, cut:] = False; right = m & ~left; sub[right] = nxt; lab[c['sl']] = sub
            ys, _ = np.where(left); cl = dict(i=c['i'], sl=c['sl'], area=int(left.sum()), x0=c['sl'][1].start, x1=c['sl'][1].start + cut, y0=c['sl'][0].start + ys.min(), y1=c['sl'][0].start + ys.max() + 1)
            ys, _ = np.where(right); cr = dict(i=nxt, sl=c['sl'], area=int(right.sum()), x0=c['sl'][1].start + cut, x1=c['sl'][1].stop, y0=c['sl'][0].start + ys.min(), y1=c['sl'][0].start + ys.max() + 1); nxt += 1
            row.remove(c); row += [cl, cr]
        row.sort(key=lambda c: c['x0'])
        L = [c for c in text if c != "'"]
        if len(row) != letters_n: print(k, text, 'lettere', len(row), 'attese', letters_n, '-> salto riga'); continue
        sub = np.zeros_like(a)
        for c in row: sub[c['sl']] |= (lab[c['sl']] == c['i'])
        pr = sub.sum(1); base = int(np.where(pr > pr.max() * 0.3)[0].max()) + 1; top = int(np.median([c['y0'] for c in row])); capH = base - top
        small = [c for c in comps if c not in big and c['area'] >= 40]; ids = set(c['i'] for c in row)
        marks = [c for c in small if c['y1'] < top + 0.5 * capH and top - 0.8 * capH < c['y0'] and any(r['x0'] - 30 < (c['x0'] + c['x1']) / 2 < r['x1'] + 30 for r in row)]
        drips = [c for c in small if c not in marks and c['y0'] >= base - 0.6 * capH and any(r['x0'] - 10 < (c['x0'] + c['x1']) / 2 < r['x1'] + 10 for r in row)]
        gid = {i: [c['i']] for i, c in enumerate(row)}; apo = None
        for m in sorted(marks, key=lambda c: c['x0']):
            cx = (m['x0'] + m['x1']) / 2; inside = [j for j, r in enumerate(row) if r['x0'] - 5 <= cx <= r['x1'] + 5]
            if inside and ("'" not in text or L[inside[0]] == 'È'): gid[inside[0]].append(m['i'])
            else: apo = m
        for d in drips:
            cx = (d['x0'] + d['x1']) / 2; j = min(range(len(row)), key=lambda j: abs((row[j]['x0'] + row[j]['x1']) / 2 - cx)); gid[j].append(d['i'])
        def crop(idl, ch):
            mask = np.isin(lab, idl); ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = im[y0:y1, x0:x1].copy(); rgba[:, :, 3] = np.where(mask[y0:y1, x0:x1], rgba[:, :, 3], 0)
            glyphs.append(dict(ch=ch, img=rgba, base=base - y0, cap=capH, src=k))
        for j, ch in enumerate(L): crop(gid[j], ch)
        if apo is not None: crop([apo['i']], "'")

for k, lines in STD.items(): process(k, np.asarray(Image.open(f'assets/tex/wr_std_{k}.png').convert('RGBA')), lines)
if COLLAGE:
    full = np.asarray(Image.open(COLLAGE).convert('RGB')).astype(float)
    for n, ((x0, y0, x1, y1), lines) in enumerate(PANELS):
        p = full[y0 + 4:y1 - 4, x0 + 4:x1 - 4]; bg = np.median(p.reshape(-1, 3), axis=0); lum = p.mean(2); red = p[:, :, 0] - (p[:, :, 1] + p[:, :, 2]) / 2
        al = np.clip(np.maximum((bg.mean() - lum) / 70, (red - 25) / 60), 0, 1); al = np.clip((al - 0.12) / 0.88, 0, 1)
        m = al > 0.3; mean = p[m].mean(0); rgb = np.clip(p * (TARGET / mean), 0, 255)   # colore uniformato alla versione standard
        rgb = np.where((al > 0)[..., None], rgb, 0)
        process(f'col{n}', np.dstack([rgb, al * 255]).astype('uint8'), lines, minarea=900)
print(len(glyphs), 'glifi')
DROP = {('A', 9), ('D', 2), ('T', 7), ('R', 2), ('F', 1), ('S', 3), ('N', 8)}; DROP_ALL = {'G', 'H'} if not COLLAGE else set()
# i glifi di riserva sono scartati se vengono dalle sorgenti standard (G/H spezzati): con il collage si usano quelli del collage
tiles = []
for g in glyphs:
    s = CAP / g['cap']; im = Image.fromarray(g['img'], 'RGBA'); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS); tiles.append((g, im, round(g['base'] * s)))
SW = 1600; x = y = rowh = 0; meta = {}; cnt = {}; sheet = Image.new('RGBA', (SW, 3600), (0, 0, 0, 0))
for g, im, base in tiles:
    n_ = cnt.get(g['ch'], 0); cnt[g['ch']] = n_ + 1
    if g['src'] in STD and (g['ch'] in {'G', 'H'} or (g['ch'], n_) in DROP): continue
    if x + im.width + 4 > SW: x = 0; y += rowh + 4; rowh = 0
    sheet.alpha_composite(im, (x, y)); meta.setdefault(g['ch'], []).append([x, y, im.width, im.height, base]); x += im.width + 4; rowh = max(rowh, im.height)
sheet = sheet.crop((0, 0, SW, y + rowh + 2)); print(sheet.size)
sheet.quantize(colors=128, method=Image.FASTOCTREE, dither=0).save('assets/tex/blood_real.png', optimize=True)
json.dump(meta, open(META_OUT, 'w'), ensure_ascii=False)
print({c: len(v) for c, v in sorted(meta.items())})
