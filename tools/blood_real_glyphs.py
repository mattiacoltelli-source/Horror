# Estrae le lettere "vere" (dalle scritte di sangue della versione standard) in un atlante: ogni lettera ha le sue colature naturali. Uso: python3 tools/blood_real_glyphs.py
import json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
SRC = {'t1': ['NONFERMARTI'], 't3': ['NONÈLATUAFACCIA'], 'c2': ['DIETRO', 'DITE'], 'w4': ['NONSEISOLO'], 'o': ['QUITIHANNOLEGATO'], 'h': ['TISTAVANO', 'ASPETTANDO'], 'm': ["NONC'ÈUSCITA"]}
CAP = 100
glyphs = []
for k, lines in SRC.items():
    im = np.asarray(Image.open(f'assets/tex/wr_std_{k}.png').convert('RGBA')); H, W = im.shape[:2]; a = im[:, :, 3] > 100
    lab, n = ndi.label(a); objs = ndi.find_objects(lab); comps = []
    for i, sl in enumerate(objs):
        m = lab[sl] == i + 1; area = int(m.sum())
        if area < 40: continue
        comps.append(dict(i=i + 1, sl=sl, area=area, x0=sl[1].start, x1=sl[1].stop, y0=sl[0].start, y1=sl[0].stop))
    big = [c for c in comps if c['area'] > 1200]
    # righe: cluster per centro y dei componenti grandi
    big.sort(key=lambda c: (c['y0'] + c['y1']) / 2)
    rows = [[big[0]]]
    for c in big[1:]:
        ref = np.median([(r['y0'] + r['y1']) / 2 for r in rows[-1]])
        if (c['y0'] + c['y1']) / 2 - ref > 0.9 * np.median([b['y1'] - b['y0'] for b in big]): rows.append([c])
        else: rows[-1].append(c)
    if len(rows) != len(lines): print(k, 'righe', len(rows), 'attese', len(lines)); continue
    for row, text in zip(rows, lines):
        row.sort(key=lambda c: c['x0'])
        # altezza maiuscola e linea di base: mediana delle cime dei corpi e dei fondi del corpo (fondo del 'corpo' = riga dove la massa crolla)
        tops = np.median([c['y0'] for c in row]); prof = a[int(tops):, :].sum(1) if False else None
        sub = np.zeros_like(a); 
        for c in row: sub[c['sl']] |= (lab[c['sl']] == c['i'])
        pr = sub.sum(1); thr = pr.max() * 0.3; base = int(np.where(pr > thr)[0].max()) + 1; top = int(np.median([c['y0'] for c in row]))
        capH = base - top
        letters = list(text)
        # componenti piccoli: segni (accento/apice) e gocce
        small = [c for c in comps if c not in big and c['area'] >= 40]
        marks = [c for c in small if c['y1'] < top + 0.5 * capH and top - 0.8 * capH < c['y0'] and any(r['x0'] - 30 < (c['x0'] + c['x1']) / 2 < r['x1'] + 30 for r in row)]
        drips = [c for c in small if c not in marks and c['y0'] >= base - 0.6 * capH and any(r['x0'] - 10 < (c['x0'] + c['x1']) / 2 < r['x1'] + 10 for r in row)]
        letters_n = len(letters) - (1 if "'" in letters else 0)
        nxt = lab.max() + 1
        while len(row) < letters_n:   # lettere attaccate: spezzo il componente piu' largo nel punto piu' sottile
            row.sort(key=lambda c: c['x0']); wmed = np.median([c['x1'] - c['x0'] for c in row]); c = max(row, key=lambda c: c['x1'] - c['x0'])
            if (c['x1'] - c['x0']) < 1.5 * wmed: break
            m = lab[c['sl']] == c['i']; colsum = m.sum(0).astype(float); w = len(colsum); lo, hi = int(w * 0.3), int(w * 0.7); cut = lo + int(np.argmin(colsum[lo:hi]))
            sub = lab[c['sl']]; left = m.copy(); left[:, cut:] = False; right = m & ~left
            sub[right] = nxt; lab[c['sl']] = sub
            ys, xs = np.where(left); cl = dict(i=c['i'], sl=c['sl'], area=int(left.sum()), x0=c['sl'][1].start, x1=c['sl'][1].start + cut, y0=c['sl'][0].start + ys.min(), y1=c['sl'][0].start + ys.max() + 1)
            ys, xs = np.where(right); cr = dict(i=nxt, sl=c['sl'], area=int(right.sum()), x0=c['sl'][1].start + cut, x1=c['sl'][1].stop, y0=c['sl'][0].start + ys.min(), y1=c['sl'][0].start + ys.max() + 1); nxt += 1
            row.remove(c); row += [cl, cr]
        row.sort(key=lambda c: c['x0'])
        if len(row) != letters_n: print(k, text, 'lettere', len(row), 'attese', letters_n, '-> salto riga'); continue
        # assegna i segni
        mk = sorted(marks, key=lambda c: c['x0'])
        # apostrofo = segno lontano da qualunque corpo (tra due lettere)
        glyph_ids = {}
        L = [c for c in letters if c != "'"]
        for idx, c in enumerate(row): glyph_ids[idx] = [c['i']]
        apo = None
        for m in mk:
            cx = (m['x0'] + m['x1']) / 2; inside = [j for j, r in enumerate(row) if r['x0'] - 5 <= cx <= r['x1'] + 5]
            if inside and "'" not in letters or (inside and L[inside[0]] == 'È' and True):
                glyph_ids[inside[0]].append(m['i'])
            else:
                apo = m
        for d in drips:
            cx = (d['x0'] + d['x1']) / 2; j = min(range(len(row)), key=lambda j: abs((row[j]['x0'] + row[j]['x1']) / 2 - cx)); glyph_ids[j].append(d['i'])
        def crop(ids, ch):
            mask = np.isin(lab, ids); ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = im[y0:y1, x0:x1].copy(); rgba[:, :, 3] = np.where(mask[y0:y1, x0:x1], rgba[:, :, 3], 0)
            glyphs.append(dict(ch=ch, img=rgba, base=base - y0, cap=capH, src=k))
        for j, ch in enumerate(L): crop(glyph_ids[j], ch)
        if apo is not None: crop([apo['i']], "'")
print(len(glyphs), 'glifi')
# atlante: righe di glifi alla scala della maiuscola = CAP
tiles = []; 
for g in glyphs:
    s = CAP / g['cap']; im = Image.fromarray(g['img'], 'RGBA'); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS); tiles.append((g, im, round(g['base'] * s)))
DROP = {('A', 9), ('D', 2), ('T', 7), ('R', 2), ('F', 1), ('S', 3), ('N', 8)}; DROP_ALL = {'G', 'H'}   # glifi scartati dopo il controllo a occhio (spezzati o scambiati)
SW = 1500; x = y = rowh = 0; meta = {}; cnt = {}; sheet = Image.new('RGBA', (SW, 2400), (0, 0, 0, 0))
for g, im, base in tiles:
    n_ = cnt.get(g['ch'], 0); cnt[g['ch']] = n_ + 1
    if g['ch'] in DROP_ALL or (g['ch'], n_) in DROP: continue
    if x + im.width + 4 > SW: x = 0; y += rowh + 4; rowh = 0
    sheet.alpha_composite(im, (x, y)); meta.setdefault(g['ch'], []).append([x, y, im.width, im.height, base]); x += im.width + 4; rowh = max(rowh, im.height)
sheet = sheet.crop((0, 0, SW, y + rowh + 2)); print(sheet.size)
sheet.quantize(colors=128, method=Image.FASTOCTREE, dither=0).save('assets/tex/blood_real.png', optimize=True)
json.dump(meta, open('/tmp/claude-0/-home-user-Horror/c170a066-e707-5d63-832a-75c0ce676129/scratchpad/real_meta.json', 'w'), ensure_ascii=False)
print({c: len(v) for c, v in sorted(meta.items())})
bg = Image.new('RGBA', sheet.size, (60, 50, 46, 255)); bg.alpha_composite(sheet); bg.convert('RGB').save('/tmp/claude-0/-home-user-Horror/c170a066-e707-5d63-832a-75c0ce676129/scratchpad/real_sheet.png')
