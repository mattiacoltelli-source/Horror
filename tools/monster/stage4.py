import sys; sys.path.insert(0, '.')
import bpy, math, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler
bpy.ops.wm.open_mainfile(filepath='./stage3.blend')
HP = Vector((0, -0.43, 1.64)); HROT = Euler((math.radians(18), 0, math.radians(-8)))
skin, skirt, hair, tu, tl, eyes = [bpy.data.objects[n] for n in ('lo_skin', 'skirt', 'hair', 'teeth_up', 'teeth_lo', 'eyes')]
# ---------- scheletro (stesse coordinate della figura)
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0)); arm = bpy.context.object; arm.name = 'Armature'; ab = arm.data; ab.name = 'rig'
ab.edit_bones.remove(ab.edit_bones[0])
B = {}
def bone(name, h, t, parent=None, connect=False):
    e = ab.edit_bones.new(name); e.head = Vector(h); e.tail = Vector(t)
    if parent: e.parent = B[parent]
    B[name] = e; return e
bone('hips', (0, 0.02, 0.93), (0, 0.0, 1.10)); bone('spine', (0, 0.0, 1.10), (0, -0.07, 1.29), 'hips'); bone('chest', (0, -0.07, 1.29), (0, -0.16, 1.45), 'spine')
bone('neck', (0, -0.16, 1.45), (0, -0.36, 1.57), 'chest'); bone('head', (0, -0.36, 1.57), (0, -0.44, 1.76), 'neck')
jc = HP + HROT.to_matrix() @ Vector((0, -0.075, -0.158))
bone('jaw', tuple(HP + HROT.to_matrix() @ Vector((0, -0.01, -0.09))), tuple(jc + Vector((0, -0.05, -0.02))), 'head')
for sfx, s in (('L', 1), ('R', -1)):
    bone(f'clav.{sfx}', (0, -0.16, 1.45), (0.19 * s, -0.15, 1.45), 'chest'); bone(f'uparm.{sfx}', (0.19 * s, -0.15, 1.45), (0.27 * s, -0.12, 1.16), f'clav.{sfx}')
    bone(f'foarm.{sfx}', (0.27 * s, -0.12, 1.16), (0.29 * s, -0.16, 0.76), f'uparm.{sfx}'); bone(f'hand.{sfx}', (0.29 * s, -0.16, 0.76), (0.29 * s, -0.19, 0.60), f'foarm.{sfx}')
    for k, (dx, dy) in enumerate([(-0.04, 0), (-0.015, -0.02), (0.01, -0.025), (0.035, -0.015), (0.052, 0.03)]):
        x0 = 0.29 * s; bone(f'f{k}a.{sfx}', (x0, -0.19, 0.60), (x0 + dx * s, -0.20 + dy, 0.50 - abs(dx)), f'hand.{sfx}'); bone(f'f{k}b.{sfx}', (x0 + dx * s, -0.20 + dy, 0.50 - abs(dx)), (x0 + dx * 1.5 * s, -0.215 + dy, 0.30 - abs(dx)), f'f{k}a.{sfx}')
    bone(f'thigh.{sfx}', (0.095 * s, 0.02, 0.90), (0.105 * s, -0.05, 0.50), 'hips'); bone(f'shin.{sfx}', (0.105 * s, -0.05, 0.50), (0.105 * s, 0.0, 0.09), f'thigh.{sfx}')
    bone(f'foot.{sfx}', (0.105 * s, 0.0, 0.09), (0.105 * s, -0.12, 0.03), f'shin.{sfx}'); bone(f'toe.{sfx}', (0.105 * s, -0.12, 0.03), (0.105 * s, -0.21, 0.02), f'foot.{sfx}')
bpy.ops.object.mode_set(mode='OBJECT')
segs = {n: (np.array(arm.data.bones[n].head_local), np.array(arm.data.bones[n].tail_local)) for n in B}
def dist_seg(p, a, b):
    ab = b - a; t = np.clip(np.dot(p - a, ab) / max(1e-9, np.dot(ab, ab)), 0, 1); return np.linalg.norm(p - (a + ab * t))
# ---------- pesi per distanza dalle ossa
Rj = HROT.to_matrix(); 
def weights_for(ob, only=None, jaw_rule=False):
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    vg = {n: ob.vertex_groups.new(name=n) for n in B}
    mw = np.array(ob.matrix_world)
    for v in ob.data.vertices:
        p = np.array(ob.matrix_world @ v.co)
        names = only if only else list(B)
        if jaw_rule:
            q = np.array(Rj.transposed() @ (Vector(p) - jc)) / np.array([0.042, 0.065, 0.034])
            # mandibola: vertici dentro l'ellissoide della mandibola (e sotto il cranio) -> osso 'jaw'
            qh = np.array(Rj.transposed() @ (Vector(p) - HP)) 
            if np.linalg.norm(q) < 1.18 and qh[2] < -0.1: vg['jaw'].add([v.index], 1.0, 'REPLACE'); continue
        d = np.array([dist_seg(p, *segs[n]) for n in names]); order = np.argsort(d)[:3]
        w = 1.0 / (d[order] + 0.012) ** 2.2; w /= w.sum()
        for i, wi in zip(order, w):
            if wi > 0.02: vg[names[i]].add([v.index], float(wi), 'REPLACE')
def rigid(ob, bone_name):
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    g = ob.vertex_groups.new(name=bone_name); g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
weights_for(skin, jaw_rule=True)
weights_for(skirt, only=['hips', 'thigh.L', 'thigh.R', 'spine', 'shin.L', 'shin.R'])
rigid(hair, 'head'); rigid(tu, 'head'); rigid(tl, 'jaw'); rigid(eyes, 'head')
for ob in (skin, skirt, hair, tu, tl, eyes):
    ob.parent = arm; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
for ob in list(bpy.data.objects):
    if ob.type == 'MESH' and ob.name not in ('lo_skin', 'skirt', 'hair', 'teeth_up', 'teeth_lo', 'eyes'): bpy.data.objects.remove(ob, do_unlink=True)
# ---------- animazioni
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for p in pb: p.rotation_mode = 'QUATERNION'
rest = {n: arm.data.bones[n].matrix_local.to_quaternion() for n in B}
def q_world(n, axis, ang):      # rotazione di "ang" attorno a un asse del MONDO (X: avanti/indietro, Y: inclinazione laterale, Z: torsione)
    ax = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]; R = Quaternion(ax, ang); M = rest[n]
    return M.inverted() @ R @ M
def pose(n, **kw):
    q = Quaternion((1, 0, 0, 0))
    for ax, a in kw.items(): q = q @ q_world(n, ax, a) if False else q_world(n, ax, a) @ q
    pb[n].rotation_quaternion = q
def key(frame):
    for p in pb: p.keyframe_insert('rotation_quaternion', frame=frame)
def reset_pose():
    for p in pb: p.rotation_quaternion = Quaternion((1, 0, 0, 0)); p.location = (0, 0, 0)
def new_action(name):
    a = bpy.data.actions.new(name); a.use_fake_user = True
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = a; return a
rnd = random.Random(4)
# ---- IDLE (48 f, ciclo)
act = new_action('Idle'); F = 48
twitch = {n: [rnd.uniform(0.1, 0.35) for _ in range(4)] for n in B if n.startswith('f')}
for f in (0, 12, 24, 36, 48):
    reset_pose(); ph = (f % 48) / 48.0 * 2 * math.pi
    pose('hips', y=0.025 * math.sin(ph), z=0.02 * math.sin(ph + 1)); pose('spine', x=0.03 + 0.02 * math.sin(ph)); pose('chest', x=0.04 + 0.03 * math.sin(ph - 0.5))
    pose('neck', x=0.05 * math.sin(ph + 1.2)); pose('head', y=0.07 * math.sin(ph + 0.4), z=0.05 * math.sin(ph * 2 + 1), x=0.03 * math.sin(ph))
    pose('jaw', x=0.10 + 0.07 * math.sin(ph * 2 + 2))
    for sfx, sg in (('L', 1), ('R', -1)):
        pose(f'uparm.{sfx}', x=0.04 * math.sin(ph + sg), y=0.03 * sg * math.sin(ph)); pose(f'foarm.{sfx}', x=0.05 * math.sin(ph + 0.8 + sg)); pose(f'hand.{sfx}', x=0.08 * math.sin(ph * 2 + sg))
        for k in range(5):
            tw = twitch[f'f{k}a.{sfx}'][(f // 12) % 4] if f % 48 else 0.1
            pose(f'f{k}a.{sfx}', x=-tw * (0.6 + 0.4 * math.sin(ph + k))); pose(f'f{k}b.{sfx}', x=-tw * 0.9)
    key(f)
for fc in act.fcurves if hasattr(act, 'fcurves') else []: 
    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
# ---- WALK (30 f, ciclo): passo strascicato, braccia penzoloni
act = new_action('Walk')
for f in (0, 7.5, 15, 22.5, 30):
    reset_pose(); ph = (f / 30.0) * 2 * math.pi; f = int(round(f))
    pose('hips', z=0.10 * math.sin(ph), y=0.05 * math.sin(ph)); pose('spine', x=0.10 + 0.02 * math.sin(ph * 2), z=-0.08 * math.sin(ph)); pose('chest', x=0.06, z=-0.07 * math.sin(ph))
    pose('neck', x=0.12 + 0.04 * math.sin(ph * 2)); pose('head', y=0.05 * math.sin(ph), x=0.06); pose('jaw', x=0.18)
    for sfx, sg, off in (('L', 1, 0), ('R', -1, math.pi)):
        a = math.sin(ph + off); pose(f'thigh.{sfx}', x=-0.42 * a); pose(f'shin.{sfx}', x=0.08 + 0.32 * max(0, math.sin(ph + off + 1.2))); pose(f'foot.{sfx}', x=-0.10 * a + 0.1 * max(0, math.sin(ph + off + 1.2)))
        pose(f'uparm.{sfx}', x=0.20 * a, y=0.04 * sg); pose(f'foarm.{sfx}', x=0.10 + 0.08 * math.sin(ph + off + 1)); pose(f'hand.{sfx}', x=0.1 * math.sin(ph * 2))
        for k in range(5): pose(f'f{k}a.{sfx}', x=-0.18 - 0.1 * math.sin(ph + k)); pose(f'f{k}b.{sfx}', x=-0.2)
    key(f)
# ---- LUNGE (24 f, non ciclo): carica e scatto in avanti con la bocca aperta
act = new_action('Lunge')
frames = {0: (0, 0, 0), 5: (-0.12, -0.12, 0.1), 10: (0.14, 0.22, 1.0), 14: (0.16, 0.26, 1.0), 24: (0.04, 0.04, 0.25)}
for f, (ch, ne, jw) in frames.items():
    reset_pose(); pose('hips', x=0.05 if f in (10, 14) else 0); pose('spine', x=ch * 0.7); pose('chest', x=ch); pose('neck', x=ne); pose('head', x=0.2 * ne); pose('jaw', x=0.15 + 0.75 * jw)
    for sfx, sg in (('L', 1), ('R', -1)):
        arm_up = -1.0 if f in (10, 14) else (-0.1 if f == 24 else 0.0); pose(f'uparm.{sfx}', x=arm_up, y=-0.3 * sg * (1 if f in (10, 14) else 0)); pose(f'foarm.{sfx}', x=-0.35 if f in (10, 14) else 0.0)
        for k in range(5): pose(f'f{k}a.{sfx}', x=-0.5 if f in (10, 14) else -0.15); pose(f'f{k}b.{sfx}', x=-0.4 if f in (10, 14) else -0.15)
        pose(f'thigh.{sfx}', x=-0.25 * (1 if f in (10, 14) else 0) * sg); pose(f'shin.{sfx}', x=0.35 if f in (10, 14) else 0.0)
    key(f)
bpy.ops.object.mode_set(mode='OBJECT')
arm.animation_data.action = bpy.data.actions['Idle']
for a in bpy.data.actions:
    try: a.use_frame_range = True; a.frame_start = min(kp.co.x for fc in a.fcurves for kp in fc.keyframe_points); a.frame_end = max(kp.co.x for fc in a.fcurves for kp in fc.keyframe_points)
    except Exception as e: print('range', a.name, e)
bpy.ops.wm.save_as_mainfile(filepath='./stage4.blend')
print('rig ok', len(B), 'bones; actions', [a.name for a in bpy.data.actions])
