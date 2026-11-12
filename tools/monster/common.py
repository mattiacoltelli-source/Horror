import bpy, bmesh, math, random
from mathutils import Vector, Euler

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def skin_figure(name, verts, edges):
    """verts: [(x,y,z,rx,ry)], edges: [(i,j)] -> oggetto con Skin modifier (radii per vertice)"""
    me = bpy.data.meshes.new(name); me.from_pydata([v[:3] for v in verts], edges, [])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    sk = ob.modifiers.new('Skin', 'SKIN'); sk.use_smooth_shade = True
    bm = bmesh.new(); bm.from_mesh(me)
    layer = bm.verts.layers.skin.verify()
    for v, d in zip(bm.verts, verts):
        v[layer].radius = (d[3], d[4]); 
    bm.verts.ensure_lookup_table(); bm.verts[0][layer].use_root = True
    bm.to_mesh(me); bm.free()
    return ob

def camera_light(loc=(0, -4.2, 1.1), look=(0, 0, 1.0), lens=50):
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
    cam.location = loc; cam.data.lens = lens
    d = Vector(look) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam

def lights(strong=1.0):
    for loc, e, col in [((2.5, -3, 3.5), 600*strong, (1, .9, .8)), ((-3, -1, 2), 250*strong, (.6, .7, 1)), ((0, 3, 2.5), 400*strong, (1, .5, .3))]:
        l = bpy.data.lights.new('l', 'AREA'); l.energy = e; l.color = col; l.size = 2.5
        o = bpy.data.objects.new('l', l); bpy.context.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def render(path, w=540, h=760, samples=40):
    s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x = w; s.render.resolution_y = h; s.render.filepath = path
    s.world = bpy.data.worlds.new('w'); s.world.use_nodes = True; s.world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.022, 0.025, 1)
    bpy.ops.render.render(write_still=True)
