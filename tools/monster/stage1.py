# Stage 1: costruisce HIGH (dettaglio) e LOW (per il gioco) e li salva in un .blend
import sys; sys.path.insert(0, '.')
from build import *
random.seed(5); reset()
HP = (0, -0.43, 1.64); HROT = (math.radians(18), 0, math.radians(-8))
col_hi = bpy.data.collections.new('HIGH'); col_lo = bpy.data.collections.new('LOW'); bpy.context.scene.collection.children.link(col_hi); bpy.context.scene.collection.children.link(col_lo)
def to_col(o, col):
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o)
def apply_mods(o):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    for m in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e: print('mod fail', o.name, m.name, e)
skin = mat_skin()
# ---------- HIGH
body = build_body(); displace(body, 0.005, 0.045); body.data.materials.append(skin); body.name = 'hi_body'; to_col(body, col_hi)
head = build_head2(); head.data.materials.append(skin); head.modifiers.new('sub', 'SUBSURF').levels = 1; head.location = HP; head.rotation_euler = HROT; head.name = 'hi_head'; to_col(head, col_hi)
jaw = build_jaw(); jaw.data.materials.append(skin); jaw.location = HP; jaw.rotation_euler = HROT; jaw.name = 'hi_jaw'; to_col(jaw, col_hi)
bone = mat_simple('bone', (0.30, 0.25, 0.17, 1), 0.5)
for r in build_ribs():
    r.data.materials.append(bone); r.name = 'hi_' + r.name; to_col(r, col_hi)
for o in list(col_hi.objects): apply_mods(o) if o.type == 'MESH' else None
# le costole sono curve: convertile in mesh
for o in list(col_hi.objects):
    if o.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH')
print('HIGH tris:', sum(len(o.data.polygons) for o in col_hi.objects))
# ---------- LOW (stessa forma, meno suddivisioni)
lb = build_body(); lb.modifiers['sub'].levels = 1; lb.modifiers['sub'].render_levels = 1; lb.name = 'lo_body'; to_col(lb, col_lo)
lh = build_head2()  # 128x80 -> troppo: sostituisco con una sfera più leggera con la stessa deformazione
bpy.data.objects.remove(lh, do_unlink=True)
def build_head_low():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=26, radius=1, location=(0, 0, 0)); o = bpy.context.object
    me = o.data; co = np.array([v.co[:] for v in me.vertices]); P = co * np.array([0.072, 0.105, 0.128])
    low = np.clip((-P[:, 2] - 0.02) / 0.11, 0, 1); P[:, 0] *= (1 - 0.38 * low ** 1.3); P[:, 1] *= (1 - 0.22 * low)
    zyg = np.exp(-(((P[:, 2] + 0.01) / 0.03) ** 2)); P[:, 0] *= (1 + 0.14 * zyg)
    def dent(P, c, r, depth, axis=(0, 1, 0)):
        d = np.linalg.norm(P - np.array(c), axis=1); w = np.exp(-(d / r) ** 2); P += np.outer(w * depth, np.array(axis)); return P
    for sx in (1, -1):
        P = dent(P, (0.030 * sx, -0.100, 0.030), 0.024, 0.052); P = dent(P, (0.040 * sx, -0.090, -0.030), 0.034, 0.020); P = dent(P, (0.036 * sx, -0.098, 0.062), 0.030, -0.010)
        P = dent(P, (0.060 * sx, -0.050, -0.005), 0.025, -0.006); P = dent(P, (0.062 * sx, -0.020, 0.00), 0.03, 0.010)
    P = dent(P, (0, -0.108, -0.012), 0.014, 0.030); P = dent(P, (0, -0.095, -0.062), 0.040, 0.030); P[:, 0] += 0.007 * np.exp(-((P[:, 2] + 0.03) / 0.07) ** 2) * (P[:, 0] > 0)
    for v, p in zip(me.vertices, P): v.co = p
    bpy.ops.object.shade_smooth(); return o
lh = build_head_low(); lh.location = HP; lh.rotation_euler = HROT; lh.name = 'lo_head'; to_col(lh, col_lo)
lj = ellipsoid('lo_jaw', (0, -0.075, -0.158), (0.042, 0.065, 0.034), 20, 10); lj.location = HP; lj.rotation_euler = HROT; to_col(lj, col_lo)
for o in list(col_lo.objects):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    # applica trasformazioni (testa/mandibola ruotate)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print('LOW tris:', sum(len(o.data.polygons) for o in col_lo.objects))
bpy.ops.wm.save_as_mainfile(filepath='./stage1.blend')
