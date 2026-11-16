import bpy
from pathlib import Path
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="assets/models/c_nurse.glb")
scene = bpy.context.scene
points = [obj.matrix_world @ Vector(corner)
          for obj in scene.objects if obj.type == "MESH"
          for corner in obj.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo + hi) / 2
height = hi.z - lo.z

def aim(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.2, 0.23, 0.29, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

for name, offset, energy, color in [
    ("Key", (1.0, -2.0, 1.3), 420, (0.83, 0.91, 1.0)),
    ("Fill", (-1.3, -1.2, 0.6), 170, (1.0, 0.84, 0.71)),
    ("Rim", (0.4, 1.8, 1.2), 500, (0.64, 0.77, 1.0)),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.size = energy, color, 1.4
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = center + Vector(offset)
    aim(obj, center)

camera = bpy.data.cameras.new("Reference")
scene.camera = bpy.data.objects.new("Reference", camera)
scene.collection.objects.link(scene.camera)
camera.type = "ORTHO"
camera.ortho_scale = height * 1.28
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 720, 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
out = Path("nun-reference").resolve()
out.mkdir(exist_ok=True)
for name, offset in [("front", (0, -3, 0)), ("three-quarter", (2, -3, 0)), ("back", (0, 3, 0))]:
    scene.camera.location = center + Vector(offset)
    aim(scene.camera, center)
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "original-reference.blend"))

# Preserve the original proportions, mask and winged cornette.
from math import atan2, exp, sin
from mathutils.noise import noise_vector

def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

for obj in [o for o in scene.objects if o.type == "MESH"]:
    mesh = obj.data
    colors = mesh.color_attributes.active_color
    if colors is None:
        raise RuntimeError("Original vertex colors are missing")
    positions = [obj.matrix_world @ v.co for v in mesh.vertices]
    samples = [p for p in positions if 0.89 < (p.z-lo.z)/height < 0.95]
    face_x = sum(p.x for p in samples) / max(1, len(samples))
    for i, item in enumerate(colors.data):
        index = mesh.loops[i].vertex_index if colors.domain == "CORNER" else i
        p = positions[index]
        x, y, z = (p.x-face_x)/height, (p.y-center.y)/height, (p.z-lo.z)/height
        r, g, b, alpha = item.color
        pigment = max(0, r - b)
        variation = noise_vector(Vector((x*41, y*41, z*41)))[0]
        cloth = 0.76 + variation * 0.13
        skirt = smooth(0.15, 0.22, z) * (1-smooth(0.62, 0.68, z))
        fold = sin(atan2(x, y) * 18 + z*7)
        cloth *= 1 - skirt * 0.16 * (0.5 + 0.5*fold)
        stain = smooth(0.035, 0.19, pigment) if z < 0.8 else 0
        orbital = exp(-((z-0.924)/0.015)**2) * exp(-((abs(x)-0.025)/0.025)**2)
        orbital *= 1 - smooth(-0.14, -0.035, y)
        cloth *= 1 - 0.37*orbital
        item.color = (
            r*cloth*(1-stain) + 0.18*stain,
            g*cloth*(1-stain) + 0.042*stain,
            b*cloth*(1-stain) + 0.035*stain,
            alpha,
        )
    for poly in mesh.polygons:
        poly.use_smooth = True

bpy.ops.export_scene.gltf(filepath=str(out / "suor-agnese-proposta.glb"),
                          export_format="GLB", use_visible=True)
for label, offset in [("proposta-front", (0,-3,0)), ("proposta-three-quarter", (2,-3,0))]:
    scene.camera.location = center + Vector(offset)
    aim(scene.camera, center)
    scene.render.filepath = str(out / (label + ".png"))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "suor-agnese-proposta.blend"))
