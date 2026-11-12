import sys; sys.path.insert(0, '.')
from build import *
from mathutils import Matrix, Quaternion
import numpy as np
random.seed(5)
bpy.ops.wm.open_mainfile(filepath='./stage2.blend')
for o in list(bpy.data.collections['HIGH'].objects): bpy.data.objects.remove(o, do_unlink=True)
HP = (0, -0.43, 1.64); HROT = (math.radians(18), 0, math.radians(-8))
skin = bpy.data.objects['lo_skin']
# ---------- materiale della pelle per il gioco (texture cotte)
m = bpy.data.materials.new('skin_game'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N = nt.nodes; L = nt.links
out = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 0.66; b.inputs['Metallic'].default_value = 0.0; b.inputs['Emission Strength'].default_value = 1.0
for k in ('albedo', 'normal', 'emit'):
    t = N.new('ShaderNodeTexImage'); im = bpy.data.images.load(f'./tex_{k}.png', check_existing=False); im.name = k + '_png'; im.colorspace_settings.name = 'Non-Color' if k == 'normal' else 'sRGB'; im.pack(); t.image = im
    if k == 'albedo': L.new(t.outputs['Color'], b.inputs['Base Color'])
    elif k == 'emit': L.new(t.outputs['Color'], b.inputs['Emission Color'])
    else:
        nm = N.new('ShaderNodeNormalMap'); L.new(t.outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], b.inputs['Normal'])
L.new(b.outputs[0], out.inputs[0]); skin.data.materials.clear(); skin.data.materials.append(m)
# ---------- gonna a bassa poligonalità (UV analitici) + bake del colore
def build_skirt_low(N=40, M=16):
    bm = bmesh.new(); rows = []; rnd = random.Random(11); phase = [rnd.uniform(0, 6.28) for _ in range(4)]
    uvl = bm.loops.layers.uv.new('UVMap')
    for j in range(M + 1):
        t = j / M; z = 1.04 - t * 0.55; row = []
        for i in range(N):
            th = 2 * math.pi * i / N
            r = (0.135 + 0.11 * t ** 1.2) * (1 + 0.16 * math.sin(th * 5 + phase[0] + t * 3) + 0.09 * math.sin(th * 11 + phase[1]) + 0.05 * math.sin(th * 23 + phase[2]))
            row.append(bm.verts.new((r * math.sin(th) * 1.05, 0.015 + r * math.cos(th) * 0.9, z)))
        rows.append(row)
    for j in range(M):
        for i in range(N):
            f = bm.faces.new((rows[j][i], rows[j][(i + 1) % N], rows[j + 1][(i + 1) % N], rows[j + 1][i]))
            for lp, (uu, vv) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]): lp[uvl].uv = (uu / N, 1 - vv / M)
    for i in range(N):
        th = 2 * math.pi * i / N; tooth = (abs(math.sin(th * 4.5 + phase[2])) ** 0.6) * 0.20 + (abs(math.sin(th * 13 + phase[3])) ** 2) * 0.07
        for j in range(M - 4, M + 1): rows[j][i].co.z += tooth * ((j - (M - 4)) / 4.0) ** 1.5
    me = bpy.data.meshes.new('skirt'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('skirt', me); bpy.context.collection.objects.link(o); return o
skirt = build_skirt_low(); skirt.data.materials.append(mat_cloth())
for p in skirt.data.polygons: p.use_smooth = True
S = bpy.context.scene; S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 8
cim = bpy.data.images.new('cloth', 512, 512); nt2 = skirt.data.materials[0].node_tree; tn = nt2.nodes.new('ShaderNodeTexImage'); tn.image = cim; nt2.nodes.active = tn; tn.select = True
bpy.ops.object.select_all(action='DESELECT'); skirt.select_set(True); bpy.context.view_layer.objects.active = skirt
S.render.bake.use_selected_to_active = False; S.render.bake.margin = 6
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
cim.filepath_raw = './tex_cloth.png'; cim.file_format = 'PNG'; cim.save()
gm = bpy.data.materials.new('cloth_game'); gm.use_nodes = True; gn = gm.node_tree; gn.nodes.clear(); go = gn.nodes.new('ShaderNodeOutputMaterial'); gb = gn.nodes.new('ShaderNodeBsdfPrincipled'); gt = gn.nodes.new('ShaderNodeTexImage'); cim2 = bpy.data.images.load('./tex_cloth.png', check_existing=False); cim2.pack(); gt.image = cim2
gn.links.new(gt.outputs['Color'], gb.inputs['Base Color']); gb.inputs['Roughness'].default_value = 0.95; gn.links.new(gb.outputs[0], go.inputs[0]); gm.use_backface_culling = False
skirt.data.materials.clear(); skirt.data.materials.append(gm)
# ---------- capelli (tubi sottili uniti), denti, braci
hair_mat = mat_simple('hair', (0.006, 0.005, 0.005, 1), 0.7)
hs = build_hair(HP, 56)
for c in hs: c.data.resolution_u = 2; c.data.bevel_resolution = 0; c.data.bevel_depth *= 1.6
bpy.ops.object.select_all(action='DESELECT')
for c in hs: bpy.context.view_layer.objects.active = c; c.select_set(True)
bpy.ops.object.convert(target='MESH'); bpy.ops.object.join(); hair = bpy.context.object; hair.name = 'hair'; hair.data.materials.clear(); hair.data.materials.append(hair_mat)
tooth_mat = mat_simple('tooth', (0.42, 0.36, 0.22, 1), 0.35)
def teeth(z0, up, name):
    objs = []
    rr = random.Random(7 + up)
    for i in range(15):
        u = (i / 14 - 0.5) * 2; x = u * 0.034; y = -0.108 + 0.048 * u * u
        if rr.random() < 0.18: continue
        h = rr.uniform(0.012, 0.024) * (1.0 + 0.5 * (1 - abs(u)))
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.0045, radius2=0.0008, depth=h, location=(x + rr.uniform(-0.002, 0.002), y, z0 + (h / 2) * (-up))); t = bpy.context.object
        t.rotation_euler = (math.radians(180 if up == 1 else 0) + rr.uniform(-0.2, 0.2), rr.uniform(-0.2, 0.2), 0); objs.append(t)
    bpy.ops.object.select_all(action='DESELECT')
    for t in objs: t.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.object; o.name = name; o.data.materials.append(tooth_mat)
    o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
    R = Euler(HROT).to_matrix().to_4x4(); o.data.transform(Matrix.Translation(HP) @ R); return o       # porta i denti dal sistema locale della testa a quello del mondo
tu = teeth(-0.108, 1, 'teeth_up'); tl = teeth(-0.152, -1, 'teeth_lo')
ember = mat_simple('ember', (0, 0, 0, 1), 0.5); eb = ember.node_tree.nodes['Principled BSDF']; eb.inputs['Emission Color'].default_value = (1, 0.22, 0.03, 1); eb.inputs['Emission Strength'].default_value = 1.6
eyes = []
for sx in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.0075, location=(0, 0, 0)); e = bpy.context.object
    p = Matrix.Translation(HP) @ Euler(HROT).to_matrix().to_4x4() @ Vector((0.030 * sx, -0.078, 0.030)); e.location = p.to_translation() if hasattr(p, 'to_translation') else p; eyes.append(e)
    e.data.materials.append(ember)
bpy.ops.object.select_all(action='DESELECT')
for e in eyes: e.select_set(True)
bpy.context.view_layer.objects.active = eyes[0]; bpy.ops.object.join(); eyes = bpy.context.object; eyes.name = 'eyes'
print('tris skin', sum(len(p.vertices) - 2 for p in skin.data.polygons), 'skirt', sum(len(p.vertices) - 2 for p in skirt.data.polygons), 'hair', sum(len(p.vertices) - 2 for p in hair.data.polygons), 'teeth', sum(len(p.vertices) - 2 for p in tu.data.polygons) + sum(len(p.vertices) - 2 for p in tl.data.polygons))
bpy.ops.wm.save_as_mainfile(filepath='./stage3.blend')
