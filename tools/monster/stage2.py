import sys; sys.path.insert(0, '.')
import bpy, bmesh, math, time
bpy.ops.wm.open_mainfile(filepath='./stage1.blend')
S = bpy.context.scene; hi = bpy.data.collections['HIGH']; lo = bpy.data.collections['LOW']
# unisci i LOW in un solo oggetto
bpy.ops.object.select_all(action='DESELECT')
objs = [o for o in lo.objects]; act = objs[0]
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = act; bpy.ops.object.join(); low = bpy.context.object; low.name = 'lo_skin'
# UV
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.6); 
bpy.ops.uv.pack_islands(margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
SIZE = 1024
def img(name, color, nc=False):
    im = bpy.data.images.new(name, SIZE, SIZE, alpha=False, float_buffer=False); im.generated_color = color; im.colorspace_settings.name = 'Non-Color' if nc else 'sRGB'; return im
imgs = {'albedo': img('albedo', (0.02, 0.02, 0.02, 1)), 'normal': img('normal', (0.5, 0.5, 1, 1), True), 'emit': img('emit', (0, 0, 0, 1))}
m = bpy.data.materials.new('baketgt'); m.use_nodes = True; nt = m.node_tree
low.data.materials.clear(); low.data.materials.append(m)
nodes = {}
for k, im in imgs.items():
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; nodes[k] = n
S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 16; S.cycles.use_denoising = False
B = S.render.bake; B.use_selected_to_active = True; B.cage_extrusion = 0.04; B.max_ray_distance = 0.09; B.margin = 10; B.use_clear = True
def bake(kind, key, **kw):
    for n in nt.nodes: n.select = False
    nt.nodes.active = nodes[key]; nodes[key].select = True
    bpy.ops.object.select_all(action='DESELECT')
    for o in hi.objects: o.select_set(True)
    low.select_set(True); bpy.context.view_layer.objects.active = low
    t = time.time()
    if kind == 'NORMAL': bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
    elif kind == 'DIFFUSE': bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    else: bpy.ops.object.bake(type='EMIT')
    print('bake', kind, round(time.time() - t), 's')
bake('DIFFUSE', 'albedo'); bake('NORMAL', 'normal'); bake('EMIT', 'emit')
for k, im in imgs.items():
    im.filepath_raw = f'./tex_{k}.png'; im.file_format = 'PNG'; im.save()
bpy.ops.wm.save_as_mainfile(filepath='./stage2.blend')
print('done')
