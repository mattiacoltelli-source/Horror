#!/usr/bin/env python3
"""Riduce le texture incorporate nei .glb (la memoria GPU sul telefono e' il collo di bottiglia): lato massimo 256 px, 512 per gli oggetti visti da vicino.
uso: python3 tools/shrink_glb.py   (idempotente: salta le immagini gia' piccole)"""
import json, struct, glob, io, os
from PIL import Image
KEEP512 = {'pistol', 'axe', 'sorella', 'door', 'gate', 'hw_door_1', 'ammo'}   # tenuti piu' nitidi: arma in mano, personaggio, porte grandi
def shrink(path, limit):
    d = open(path, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl]); off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]; binc = d[off + 8:off + 8 + bl]
    bvs = j['bufferViews']; new = {}
    changed = False
    for img in j.get('images', []):
        bv = bvs[img['bufferView']]; raw = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        im = Image.open(io.BytesIO(raw)); w, h = im.size
        if max(w, h) <= limit: continue
        k = limit / max(w, h); im2 = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        out = io.BytesIO()
        if img.get('mimeType') == 'image/png' or im.mode in ('RGBA', 'LA', 'P'): im2.save(out, 'PNG', optimize=True); img['mimeType'] = 'image/png'
        else: im2.convert('RGB').save(out, 'JPEG', quality=88, optimize=True); img['mimeType'] = 'image/jpeg'
        new[img['bufferView']] = out.getvalue(); changed = True
    if not changed: return 0
    parts = []; pos = 0
    for i, bv in enumerate(bvs):
        data = new.get(i, binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
        pad = (-pos) % 4; parts.append(b'\0' * pad); pos += pad
        bv['byteOffset'] = pos; bv['byteLength'] = len(data); parts.append(data); pos += len(data)
    pad = (-pos) % 4; parts.append(b'\0' * pad); pos += pad
    j['buffers'][0]['byteLength'] = pos; nb = b''.join(parts)
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(nb)
    open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(nb), b'BIN\0') + nb)
    return len(d) - total
tot = 0
for f in sorted(glob.glob('assets/models/*.glb')):
    n = os.path.basename(f)[:-4]; s = shrink(f, 512 if n in KEEP512 else 256)
    if s: print(f'{n:22s} -{s // 1024} KB'); tot += s
print('risparmio file:', tot // 1024, 'KB')
